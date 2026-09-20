# Fly — Flight Price Explorer

Fly, esnek seyahat edenlerin bir rotada farklı günlerin gerçek uçuş fiyatlarını karşılaştırmasını sağlayan kişisel uçuş keşif uygulamasıdır. Türkçe arayüz, TRY fiyatlar ve uçuş detayları ile Kayseri → İstanbul gibi rotalarda uygun günü bulmayı kolaylaştırır.

## V1 özellikleri

- Tek yön / ekonomi, 1–9 yetişkin; IATA kodu veya listelenen şehirlerden havalimanı seçimi.
- Belirli gün araması veya en fazla 90 günlük aralığa eşit yayılmış **en fazla 5 günün** karşılaştırılması. Başlangıç ve bitiş dahil; örnekleme bütün günleri taramaz.
- Aylık takvim, önceki/sonraki ay, aranan günler arasında en ucuz tarihler. Boş bir güne basmak en fazla bir yeni sorgudur. Ay değiştirmek sorgu yapmaz.
- Fiyat, süre ve kalkış sıralaması; direkt/aktarmalı filtreleri.
- Her uçuşun tüm segmentleri, havayolu, uçuş numarası, yerel kalkış/varış tarih-saatleri, süre, uçak ve sınıf (varsa). Bilgileri kopyalama.
- SQLite ile 30 dakikalık TTL önbelleği; aynı anda gelen aynı istekleri birleştirme. Varsayılan günlük 40 yeni sağlayıcı çağrısı sınırı; hatalı denemeler de sayılır. Önbellek isabetleri sayılmaz. Gün sınırı Türkiye saatine göredir.
- Loading, boş sonuç, kısmi keşif, kota, bağlantı ve doğrulama hataları.

## Teknolojiler ve yapı

Python 3.12+, FastAPI, httpx, SQLite; React 19, TypeScript, Vite. Ek veritabanı servisi gerekmez.

```text
backend/
  main.py          HTTP endpoint'leri ve statik frontend sunumu
  models.py        Girdi doğrulama ve tarih örnekleme
  service.py       SerpApi, TTL cache ve günlük sorgu sınırı
  normalize.py     Sağlayıcı verisini temiz uçuş modeline dönüştürme
  tests/           Kritik davranış testleri (gerçek API çağırmaz)
frontend/src/      Türkçe React arayüzü ve responsive stiller
test_api.py        Mevcut SerpApi denemesi; yalnızca doğrudan çalıştırılırsa çağrı yapar
.env.example       Güvenli ayar örneği
```

## Kurulum (Windows / PowerShell)

Proje kökünde:

```powershell
cd C:\Users\gabar\fly
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Bu ortamda doğrulanan kesin Python sürümleri `requirements.lock.txt` içindedir; aynı kurulumu tekrarlamak için `pip install -r requirements.lock.txt` kullanılabilir. Frontend sürümleri `package-lock.json` ile sabitlenmiştir.

Mevcut `.env` varsa koruyun. Yoksa `.env.example` dosyasının `.env` isimli kopyasını oluşturup kendi anahtarınızı ekleyin:

```dotenv
SERPAPI_API_KEY=your_api_key_here
FLY_DAILY_BUDGET=40
```

Anahtar sadece backend tarafından okunur. `.env`, SQLite cache, sanal ortam ve build dosyaları Git ignore kapsamındadır. `VITE_` ile başlayan hiçbir değişkene API anahtarı eklemeyin.

### Geliştirme

Terminal 1 — proje kökünde:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd C:\Users\gabar\fly\frontend
npm.cmd ci
npm.cmd run dev
```

Tarayıcı: http://127.0.0.1:5173 . Vite `/api` isteklerini yerel backend'e yönlendirir. API dokümanı: http://127.0.0.1:8000/docs .

### Tek sunucuyla kullanım

```powershell
cd C:\Users\gabar\fly\frontend
npm.cmd run build
cd ..
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Build sonrasında backend'i başlatın / yeniden başlatın. Uygulama http://127.0.0.1:8000 adresindedir. Tek worker kullanın: eşzamanlı istek kilidi süreç içidir. Bu V1 kişisel yerel kullanım içindir; herkese açık sunucuya çıkarmadan önce erişim kontrolü ve kullanıcı bazlı limit gerekir.

## Test ve doğrulama

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall -q backend
cd frontend
npm.cmd run build
```

Build TypeScript kontrolünü de çalıştırır. Testler normalize etme, eksik alanlar, sayısal fiyat, gece yarısını geçen yerel saatler, aktarma/süre, sıralama, tarih örnekleme, doğrulama, cache TTL, eşzamanlı istekler ve kota sonrası kısmi sonuçları kapsar. Test verileri yalnızca test dosyalarındadır; uygulama demo fiyat göstermez.

## API kararı ve V1 sınırları

[SerpApi Google Flights](https://serpapi.com/google-flights-api), tek bir uçuş tarihi için sonuç verir. `price_insights.price_history`, seçilen uçuşun geçmişte gözlenen fiyatlarıdır; gelecekte farklı günlere ait fiyat takvimi değildir. Gelecek günler için bu veriden fiyat türetilmez.

[Flights Deals](https://serpapi.com/google-flights-deals-api) esnek tarih aralığı kabul eder ancak belgelenmiş kesin `arrival_id` parametresi ve belirli rotanın tüm günlerini kapsama garantisi sunmaz. Bu nedenle V1, kesin ASR → IST rotasını korumak için mevcut `google_flights` entegrasyonuyla sınırlı tarih örneklemesi kullanır. Tek seferde 90 çağrı yapılmaz. Daha dar aralık seçerek uygun günün çevresini ayrıntılandırabilirsiniz.

- En ucuz gün ifadesi **yalnızca sorgulanan günler ve sağlayıcının döndürdüğü uçuşlar** arasındadır; tüm pazarın veya ayın minimumu değildir.
- Bir keşif en fazla 5 cache miss oluşturur. Çağrılar sırayla çalışır; sağlayıcı hatasında devam edilmez. Başarılı günler gösterilir. Sayfa yenilemede görünüm temizlenir, backend önbelleği kalır.
- Fiyatlar TRY istenerek alınır. Sağlayıcı farklı para birimi bildirirse o birim gösterilir ve TRY ucuz tarih listesine karıştırılmaz. Belirsiz biçimlenmiş fiyatlar tahmin edilmez.
- Fiyat seçilen yetişkinler için toplamdır. Ek bagaj/koltuk/ödeme ücretleri farklı olabilir. Fiyat ve müsaitlik satın alma anında değişebilir.
- Saatler havalimanının yerel saatidir; tarayıcı saat dilimine çevrilmez. Detaylarda varış tarihi de görünür; farklı günlere varış kaybolmaz.
- Gidiş-dönüş V1 arayüzünde yoktur. Modelde `trip_type` vardır; yalnızca `one_way` kabul edilir. Dönüş seçimi/token akışı tamamlanmadan yanıltıcı sonuç gösterilmez.
- Booking token, doğrudan satın alma URL'si değildir. [Booking Options](https://serpapi.com/google-flights-booking-options) ayrı bir sağlayıcı çağrısı ve seçim akışı gerektirir. V1 sahte link üretmez; tüm uçuş bilgilerini gösterir ve kopyalatır.
- Havalimanı önerileri sınırlı yerel listedir. Diğer havalimanları için 3 harfli IATA girilebilir; kodun varlığı sağlayıcı tarafından belirlenir.
- Cache ve günlük bütçe `fly-cache.sqlite3` içinde kalıcıdır. Başarısız çağrı tekrar denemelerinde yeni kredi tüketilebilir; otomatik retry yoktur. Uygulama SerpApi hesabının kalan kotasını sorgulamaz.

## Sonraki adımlar

1. Kesin rota için tarih takvimi sağlayan bir veri kaynağını doğrulamak ve adapter eklemek.
2. Sağlayıcının booking options akışı ile doğrulanmış satın alma yönlendirmesi.
3. Gidiş-dönüşte dönüş uçuşu seçimi ve toplam fiyat doğrulaması.
4. Daha geniş havalimanı araması ve keşif sonuçlarını tarayıcıda saklama.
