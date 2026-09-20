from datetime import date, datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, Field, model_validator


def today():
    return datetime.now(timezone(timedelta(hours=3))).date()


class Search(BaseModel):
    origin: str = Field(pattern=r'^[A-Z]{3}$')
    destination: str = Field(pattern=r'^[A-Z]{3}$')
    date: date
    adults: int = Field(default=1, ge=1, le=9)
    trip_type: Literal['one_way'] = 'one_way'

    @model_validator(mode='after')
    def validate_search(self):
        if self.origin == self.destination:
            raise ValueError('Kalkış ve varış farklı olmalı.')
        if not today() <= self.date <= today() + timedelta(days=330):
            raise ValueError('Tarih bugün ile önümüzdeki 330 gün arasında olmalı.')
        return self


class Discovery(Search):
    end_date: date

    @model_validator(mode='after')
    def validate_range(self):
        if not self.date <= self.end_date <= min(self.date + timedelta(days=90), today() + timedelta(days=330)):
            raise ValueError('Keşif aralığı en fazla 90 gün olmalı.')
        return self


def sample_dates(start: date, end: date):
    span = (end - start).days
    count = min(5, span + 1)
    return [start + timedelta(days=round(i * span / max(count - 1, 1))) for i in range(count)]
