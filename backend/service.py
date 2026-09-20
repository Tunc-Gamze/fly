import asyncio
import json
import logging
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

from .models import today
from .normalize import normalize

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
log = logging.getLogger('fly')
# HTTP client debug logs may contain query credentials.
logging.getLogger('httpx').setLevel(logging.CRITICAL)
logging.getLogger('httpcore').setLevel(logging.CRITICAL)


class FlightService:
    def __init__(self, path=ROOT / 'fly-cache.sqlite3', ttl=1800):
        self.path, self.ttl = path, ttl
        self.lock = asyncio.Lock()
        with self.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, created REAL, body TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, count INTEGER)')

    def db(self):
        return sqlite3.connect(self.path)

    async def search(self, query):
        key = json.dumps(query.model_dump(mode='json'), sort_keys=True)
        # One worker + a single lock deduplicates simultaneous misses and bounds concurrency.
        async with self.lock:
            with self.db() as db:
                row = db.execute('SELECT created, body FROM cache WHERE key=?', (key,)).fetchone()
                if row and time.time() - row[0] < self.ttl:
                    return {**json.loads(row[1]), 'cached': True}
            api_key = os.getenv('SERPAPI_API_KEY')
            if not api_key or api_key == 'your_api_key_here':
                raise HTTPException(503, 'API anahtarı eksik. Proje .env dosyasını kontrol edin.')
            with self.db() as db:
                day = str(today())
                db.execute('INSERT OR IGNORE INTO usage VALUES (?, 0)', (day,))
                budget = max(1, int(os.getenv('FLY_DAILY_BUDGET', '40')))
                updated = db.execute('UPDATE usage SET count=count+1 WHERE day=? AND count<?', (day, budget))
                if not updated.rowcount:
                    raise HTTPException(429, 'Günlük sorgu sınırına ulaşıldı. Önbellekteki tarihlere bakabilir veya yarın tekrar deneyebilirsiniz.')
            params = dict(engine='google_flights', departure_id=query.origin, arrival_id=query.destination,
                          outbound_date=str(query.date), type=2, adults=query.adults, currency='TRY',
                          hl='tr', gl='tr', api_key=api_key)
            try:
                async with httpx.AsyncClient(timeout=45) as client:
                    response = await client.get('https://serpapi.com/search.json', params=params)
                if response.status_code == 429:
                    raise HTTPException(429, 'SerpApi sorgu kotası doldu. Lütfen daha sonra deneyin.')
                if response.status_code in (401, 403):
                    raise HTTPException(503, 'SerpApi anahtarı doğrulanamadı. Hesap ayarlarını kontrol edin.')
                if response.status_code >= 400:
                    raise HTTPException(502, 'Uçuş verileri alınamadı. Rota kodlarını kontrol edip tekrar deneyin.')
                data = response.json()
                if not isinstance(data, dict):
                    raise ValueError('invalid response')
                if data.get('error'):
                    if 'no results' in str(data['error']).lower():
                        data = {'best_flights': []}
                    else:
                        raise HTTPException(502, 'Sağlayıcı bu aramayı tamamlayamadı. Rota veya hesap kotasını kontrol edin.')
                if not any(k in data for k in ('best_flights', 'other_flights')):
                    raise ValueError('missing results')
                if any(data.get(k) is not None and not isinstance(data[k], list) for k in ('best_flights', 'other_flights')):
                    raise ValueError('invalid results')
                flights = normalize(data, query.date)
            except httpx.TimeoutException:
                raise HTTPException(504, 'Arama zaman aşımına uğradı. Lütfen tekrar deneyin.') from None
            except httpx.RequestError:
                raise HTTPException(502, 'Uçuş sağlayıcısına bağlanılamadı. İnternet bağlantısını kontrol edin.') from None
            except (ValueError, TypeError, AttributeError):
                log.warning('Provider returned an invalid flight payload')
                raise HTTPException(502, 'Uçuş sağlayıcısından beklenmeyen yanıt alındı.') from None
            result = {'date': str(query.date), 'flights': flights, 'cached': False,
                      'updatedAt': datetime.now(timezone.utc).isoformat()}
            with self.db() as db:
                db.execute('DELETE FROM cache WHERE created < ?', (time.time() - self.ttl,))
                db.execute('INSERT OR REPLACE INTO cache VALUES (?, ?, ?)', (key, time.time(), json.dumps(result)))
            log.info('Flight search completed: %s -> %s / %s', query.origin, query.destination, query.date)
            return result
