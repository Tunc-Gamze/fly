"""Original SerpApi smoke script; only runs when explicitly invoked."""
from datetime import date, timedelta

def main():
    import requests  # HTTP istekleri göndermek için requests kütüphanesini içe aktarır
    from dotenv import load_dotenv  # .env dosyasındaki değişkenleri yüklemek için kullanılır
    import os  # İşletim sistemi ortam değişkenlerine erişmek için kullanılır
    
    load_dotenv()  # .env dosyasındaki değişkenleri programa yükler
    
    api_key = os.getenv("SERPAPI_API_KEY")  # .env içindeki SerpApi anahtarını alır
    
    
    # response = requests.get("https://httpbin.org/get")  # Test amacıyla HTTP isteği gönderir
    # print(response.status_code)  # Gelen HTTP durum kodunu yazdırır
    # print(response.json())  # Gelen JSON verisini yazdırır
    
    
    params = {
        "engine": "google_flights",  # SerpApi'de Google Flights motorunu kullanır
        "departure_id": "ASR",  # Kalkış havalimanının IATA kodunu belirtir
        "arrival_id": "IST",  # Varış havalimanının IATA kodunu belirtir
        "outbound_date": (date.today() + timedelta(days=7)).isoformat(),  # Gidiş tarihini belirtir
        "currency": "TRY",
        "type": "2",  # Arama tipini belirtir (tek yön)
        "api_key": api_key  # SerpApi API anahtarını isteğe ekler
    }
    
    response = requests.get(
        "https://serpapi.com/search",  # SerpApi arama adresine istek gönderir
        params=params, timeout=45  # Yukarıdaki arama parametrelerini isteğe ekler
    )
    
    print(response.status_code)  # API isteğinin HTTP durum kodunu yazdırır
    
    # print(response.text)  # API'den gelen ham cevabı metin olarak gösterir
    # response.raise_for_status()  # İstek başarısızsa Python hatası oluşturur
    
    
    data = response.json()  # API'den gelen JSON verisini Python sözlüğüne dönüştürür
    
    
    # Aşağıdaki print'ler API'nin JSON yapısını keşfederken kullandığımız kontrollerdir.
    # print(data.keys())  # Ana JSON verisinin sahip olduğu anahtarları gösterir
    # print(type(data["best_flights"]))  # best_flights verisinin veri tipini gösterir
    # print(data["best_flights"][0].keys())  # İlk uçuş seçeneğinin anahtarlarını gösterir
    # print(type(data["best_flights"][0]["flights"]))  # flights verisinin veri tipini gösterir
    # print(data["best_flights"][0]["flights"][0].keys())  # İlk uçuş segmentinin anahtarlarını gösterir
    # print(data["best_flights"][0]["flights"][0]["departure_airport"].keys())  # Kalkış havalimanının anahtarlarını gösterir
    
    
    departure = data["best_flights"][0]["flights"][0]["departure_airport"]  # İlk uçuş segmentinin kalkış havalimanı bilgilerini alır
    
    # print(departure["name"])  # Kalkış havalimanının adını gösterir
    # print(departure["id"])  # Kalkış havalimanının IATA kodunu gösterir
    # print(departure["time"])  # Kalkış tarih ve saatini gösterir
    
    
    arrival = data["best_flights"][0]["flights"][0]["arrival_airport"]  # İlk uçuş segmentinin varış havalimanı bilgilerini alır
    
    # print(arrival["name"])  # Varış havalimanının adını gösterir
    # print(arrival["id"])  # Varış havalimanının IATA kodunu gösterir
    # print(arrival["time"])  # Varış tarih ve saatini gösterir
    
    
    flight = data["best_flights"][0]["flights"][0]  # İlk uçuş seçeneğinin ilk uçuş segmentini alır
    
    result = data["best_flights"][0]  # İlk uçuş seçeneğinin tamamını alır
    
    
    print(flight["airline"])  # Havayolu şirketinin adını gösterir
    print(flight["flight_number"])  # Uçuş numarasını gösterir
    print(flight["duration"])  # Uçuş süresini dakika cinsinden gösterir
    
    print(result["price"])  # Uçuş seçeneğinin toplam fiyatını gösterir
    print(result["total_duration"])  # Uçuş seçeneğinin toplam süresini dakika cinsinden gösterir
    print(len(result["flights"]))  # Uçuş seçeneğindeki toplam uçuş segmenti sayısını gösterir
    
    # print(result["flights"])  # Uçuş seçeneğindeki tüm uçuş segmentlerini gösterir
    # print(result.keys())  # Uçuş seçeneğinin sahip olduğu anahtarları gösterir
    
    
    # print(data["args"]["origin"])  # Test amaçlı origin değerini gösterir
    # print(data["args"]["destination"])  # Test amaçlı destination değerini gösterir


if __name__ == "__main__":
    main()
