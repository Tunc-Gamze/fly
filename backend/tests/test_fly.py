import asyncio
from datetime import timedelta
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.models import Search, Discovery, today, sample_dates
from backend.normalize import normalize, number, sort_flights
from backend.service import FlightService
from backend.main import app


def query():
    return Search(origin='ASR', destination='IST', date=today()+timedelta(days=7))


def payload():
    return {'search_parameters': {'currency':'TRY'}, 'best_flights':[
        {'price':1650, 'total_duration':95, 'flights':[{'airline':'Test Air', 'flight_number':'T123',
         'departure_airport':{'id':'ASR','time':'2026-10-01 23:30'},
         'arrival_airport':{'id':'IST','time':'2026-10-02 01:05'},'duration':95}]},
        {'price':None,'flights':[{}]}, None]}


def test_normalize_missing_fields_currency_duplicates():
    data=payload();data['other_flights']=[data['best_flights'][0]]
    result=normalize(data,'2026-10-01')
    assert len(result)==2
    assert result[0]['price']==1650 and result[0]['stops']==0
    assert result[0]['legs'][0]['arrivalTime']=='2026-10-02 01:05'
    assert result[1]['price'] is None
    assert result[1]['legs'][0]['airplane'] is None
    data['search_parameters']['currency']='EUR'
    assert normalize(data,'2026-10-01')[0]['currency']=='EUR'


@pytest.mark.parametrize('value,expected',[(1650,1650),('1650.50',1650.5),('₺1.650',None),(-1,None),(True,None),(None,None),('NaN',None)])
def test_price_parsing(value,expected):
    assert number(value)==expected


def test_sorting_and_connecting_duration():
    data=payload();f=data['best_flights'][0];f['flights'].append({'duration':120});f['total_duration']=300
    result=normalize(data,'2026-10-01')
    assert result[0]['stops']==1 and result[0]['durationMinutes']==300
    assert sort_flights(result,'duration')[0]['price']==1650
    assert sort_flights(result,'departure')[0]['price']==1650


def test_invalid_nested_leg_type():
    assert normalize({'best_flights':[{'flights':123}]},'2026-10-01')==[]


@pytest.mark.parametrize('failure,status',[(httpx.TimeoutException('redacted'),504),(httpx.ConnectError('redacted'),502)])
def test_provider_network_errors(tmp_path,monkeypatch,failure,status):
    monkeypatch.setenv('SERPAPI_API_KEY','test-secret')
    async def fake_get(self,url,params):
        raise failure
    monkeypatch.setattr(httpx.AsyncClient,'get',fake_get)
    service=FlightService(tmp_path/'cache.sqlite3')
    with pytest.raises(HTTPException) as error:
        asyncio.run(service.search(query()))
    assert error.value.status_code==status
    assert 'test-secret' not in error.value.detail


def test_sampling_is_bounded_unique_and_inclusive():
    for span in (0,1,3,30,90):
        result=sample_dates(today(),today()+timedelta(days=span))
        assert len(result)==min(5,span+1)==len(set(result))
        assert result[0]==today() and result[-1]==today()+timedelta(days=span)


def test_request_validation():
    client=TestClient(app)
    for changes in ({'origin':'123'},{'destination':'ASR'},{'adults':0},{'date':'2020-01-01'},{'trip_type':'round_trip'}):
        response=client.post('/api/search',json={**query().model_dump(mode='json'),**changes})
        assert response.status_code==422
        assert isinstance(response.json()['detail'],str)


def test_cache_deduplication_and_budget(tmp_path,monkeypatch):
    monkeypatch.setenv('SERPAPI_API_KEY','test-secret')
    monkeypatch.setenv('FLY_DAILY_BUDGET','1')
    calls=[]
    async def fake_get(self,url,params):
        calls.append(params)
        return httpx.Response(200,json=payload())
    monkeypatch.setattr(httpx.AsyncClient,'get',fake_get)
    service=FlightService(tmp_path/'cache.sqlite3')
    async def run():
        results=await asyncio.gather(service.search(query()),service.search(query()))
        assert len(calls)==1
        assert results[1]['cached']
        assert 'test-secret' not in str(results)
        other=query().model_copy(update={'adults':2})
        with pytest.raises(HTTPException) as error:
            await service.search(other)
        assert error.value.status_code==429
    asyncio.run(run())


def test_expired_cache_refetches(tmp_path,monkeypatch):
    monkeypatch.setenv('SERPAPI_API_KEY','test')
    calls=[]
    async def fake_get(self,url,params):
        calls.append(1)
        return httpx.Response(200,json=payload())
    monkeypatch.setattr(httpx.AsyncClient,'get',fake_get)
    service=FlightService(tmp_path/'cache.sqlite3',ttl=0)
    async def run():
        await service.search(query());await service.search(query())
    asyncio.run(run());assert len(calls)==2


def test_discovery_stops_on_failure_and_keeps_results(monkeypatch):
    import backend.main as main
    calls=[]
    async def fake_search(q):
        calls.append(q)
        if len(calls)>1:raise HTTPException(429,'Kota doldu')
        return {'date':str(q.date),'flights':[]}
    monkeypatch.setattr(main.service,'search',fake_search)
    response=TestClient(app).post('/api/discover',json={**query().model_dump(mode='json'),'end_date':str(query().date+timedelta(days=30))})
    assert len(calls)==2
    assert len(response.json()['days'])==1 and len(response.json()['errors'])==1
