import hashlib
import json
import math
import re


def number(value):
    # SerpApi returns JSON numbers; ambiguous localized strings are not guessed.
    if isinstance(value, bool):
        return None
    if isinstance(value, str) and not re.fullmatch(r'\d+(\.\d+)?', value):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (ValueError, TypeError):
        return None


def obj(value):
    return value if isinstance(value, dict) else {}


def text(value):
    return value if isinstance(value, str) else None


def normalize(data, flight_date):
    currency = text(obj(data.get('search_parameters')).get('currency')) or 'TRY'
    if not re.fullmatch('[A-Z]{3}', currency):
        currency = 'UNKNOWN'
    results = []
    seen = set()
    for group in ('best_flights', 'other_flights'):
        for raw in data.get(group) or []:
            raw = obj(raw)
            legs = []
            raw_legs = raw.get('flights')
            for leg in raw_legs if isinstance(raw_legs, list) else []:
                if not isinstance(leg, dict):
                    continue
                dep, arr = obj(leg.get('departure_airport')), obj(leg.get('arrival_airport'))
                legs.append({
                    'airline': text(leg.get('airline')), 'flightNumber': text(leg.get('flight_number')),
                    'departureAirport': text(dep.get('id')), 'departureName': text(dep.get('name')),
                    'departureTime': text(dep.get('time')), 'arrivalAirport': text(arr.get('id')),
                    'arrivalName': text(arr.get('name')), 'arrivalTime': text(arr.get('time')),
                    'durationMinutes': number(leg.get('duration')), 'airplane': text(leg.get('airplane')),
                    'travelClass': text(leg.get('travel_class')),
                })
            if not legs:
                continue
            identity = hashlib.sha256(json.dumps([legs, raw.get('price')], sort_keys=True).encode()).hexdigest()[:16]
            if identity in seen:
                continue
            seen.add(identity)
            results.append({'id': identity, 'date': str(flight_date), 'price': number(raw.get('price')),
                            'currency': currency, 'legs': legs, 'stops': len(legs) - 1,
                            'durationMinutes': number(raw.get('total_duration'))})
    return sort_flights(results)


def sort_flights(flights, order='price'):
    def key(f):
        if order == 'departure':
            value = f['legs'][0]['departureTime']
        else:
            value = f.get('durationMinutes' if order == 'duration' else 'price')
        return (value is None, value)
    return sorted(flights, key=key)
