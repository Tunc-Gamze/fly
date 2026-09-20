from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .models import Search, Discovery, sample_dates
from .service import FlightService

app = FastAPI(title='Fly API', version='1.0.0')
service = FlightService()


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    return JSONResponse(status_code=422, content={'detail': 'Üç harfli havalimanı kodlarını, tarih aralığını ve yolcu sayısını kontrol edin.'})


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.post('/api/search')
async def search(query: Search):
    return await service.search(query)


@app.post('/api/discover')
async def discover(query: Discovery):
    days, errors = [], []
    for day in sample_dates(query.date, query.end_date):
        try:
            days.append(await service.search(Search(**{**query.model_dump(exclude={'end_date'}), 'date': day})))
        except HTTPException as error:
            errors.append({'date': str(day), 'message': error.detail})
            # Never continue spending quota after an upstream failure.
            break
    return {'days': days, 'errors': errors, 'sampledDates': [str(d) for d in sample_dates(query.date, query.end_date)]}


dist = Path(__file__).resolve().parents[1] / 'frontend' / 'dist'
if dist.exists():
    app.mount('/', StaticFiles(directory=dist, html=True), name='frontend')
