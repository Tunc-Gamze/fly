# Fly — Flight Price Explorer

Fly, farklı tarihlerdeki gerçek uçuş fiyatlarını karşılaştırarak uygun seyahat tarihlerini keşfetmeyi kolaylaştıran bir uçuş arama ve fiyat karşılaştırma uygulamasıdır.

Uygulama, SerpApi Google Flights verilerini kullanarak uçuşları sorgular; fiyat, süre, aktarma ve uçuş detaylarını kullanıcı dostu bir arayüzde sunar. Türkçe arayüz, TRY fiyat desteği, esnek tarih karşılaştırması ve uçuş detayları V1'in temel özelliklerini oluşturur.

## V1 Özellikleri

* Tek yön, ekonomi sınıfı ve 1–9 yetişkin desteği.
* IATA kodu veya listelenen şehirlerden havalimanı seçimi.
* Belirli bir gün için doğrudan uçuş araması.
* En fazla 90 günlük tarih aralığında eşit yayılmış **en fazla 5 günün** fiyat karşılaştırması.
* Başlangıç ve bitiş tarihleri örneklemeye dahildir; seçilen aralıktaki bütün günler otomatik olarak sorgulanmaz.
* Aylık takvim görünümü ve önceki/sonraki ay navigasyonu.
* Sorgulanan tarihler arasındaki en uygun fiyatların gösterimi.
* Takvimde henüz sorgulanmamış bir güne tıklayarak o tarih için yeni sorgu oluşturma.
* Fiyat, uçuş süresi ve kalkış saatine göre sıralama.
* Direkt ve aktarmalı uçuş filtreleri.
* Uçuş segmentlerinin ayrıntılı gösterimi:

  * Havayolu
  * Uçuş numarası
  * Kalkış ve varış havalimanı
  * Yerel kalkış ve varış tarih/saatleri
  * Uçuş süresi
  * Uçak tipi
  * Seyahat sınıfı
* Uçuş bilgilerinin kopyalanabilmesi.
* SQLite tabanlı 30 dakikalık TTL önbelleği.
* Aynı anda gelen aynı sorguların birleştirilmesi.
* Varsayılan günlük 40 yeni sağlayıcı çağrısı limiti.
* Cache hit'lerin günlük limite dahil edilmemesi.
* Günlük limitin Türkiye saatine göre hesaplanması.
* Loading, boş sonuç, kısmi sonuç, kota, bağlantı ve doğrulama durumlarının yönetimi.

## Teknolojiler

### Backend

* Python 3.12+
* FastAPI
* httpx
* SQLite
* Pydantic
* Pytest

### Frontend

* React 19
* TypeScript
* Vite

Ek bir veritabanı servisine ihtiyaç duyulmaz.

## Proje Yapısı

```text
fly/
├── backend/
│   ├── main.py          # HTTP endpoint'leri ve frontend sunumu
│   ├── models.py        # Veri modelleri, doğrulama ve tarih örnekleme
│   ├── service.py       # SerpApi, TTL cache ve günlük sorgu limiti
│   ├── normalize.py     # Sağlayıcı verisini uygulama modeline dönüştürme
│   └── tests/           # Backend testleri
│
├── frontend/
│   └── src/             # React arayüzü ve responsive stiller
│
├── test_api.py          # SerpApi entegrasyonunun geliştirme testi
├── .env.example         # Environment variable örneği
├── requirements.txt
├── requirements.lock.txt
└── README.md
```

## Kurulum

### 1. Repository'yi klonlayın

```powershell
git clone https://github.com/Tunc-Gamze/fly.git
cd fly
```

### 2. Python sanal ortamını oluşturun

```powershell
python -m venv .venv
```

Windows / PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Bu projede doğrulanan Python paket sürümleri `requirements.lock.txt` dosyasında tutulur.

Aynı bağımlılık sürümlerini kullanmak için:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
```

Frontend bağımlılıklarının kesin sürümleri `package-lock.json` ile sabitlenmiştir.

## Environment Variables

Örnek environment dosyasını kopyalayın:

```powershell
Copy-Item .env.example .env
```

Ardından `.env` dosyasına kendi SerpApi API anahtarınızı ekleyin:

```dotenv
SERPAPI_API_KEY=your_api_key_here
FLY_DAILY_BUDGET=40
```

API anahtarı yalnızca backend tarafından okunur.

`.env`, SQLite cache dosyaları, sanal ortam, loglar ve build çıktıları Git tarafından takip edilmez.

> API anahtarını frontend koduna veya `VITE_` ile başlayan environment variable'lara eklemeyin.

## Geliştirme Ortamında Çalıştırma

Backend ve frontend ayrı terminallerde çalıştırılabilir.

### Backend

Proje kök dizininde:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

FastAPI dokümantasyonu:

```text
http://127.0.0.1:8000/docs
```

### Frontend

Yeni bir terminal açın:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Uygulamayı tarayıcıda açın:

```text
http://127.0.0.1:5173
```

Vite, `/api` isteklerini yerel FastAPI backend'ine yönlendirir.

## Tek Sunucuyla Çalıştırma

Önce frontend build oluşturun:

```powershell
cd frontend
npm.cmd run build
cd ..
```

Ardından backend'i başlatın:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Uygulama:

```text
http://127.0.0.1:8000
```

adresinden kullanılabilir.

V1'de aynı istekleri birleştiren eşzamanlılık mekanizması süreç içinde çalıştığı için uygulamanın tek worker ile çalıştırılması önerilir.

Mevcut V1 mimarisi öncelikle yerel kullanım ve geliştirme amacıyla tasarlanmıştır. Herkese açık production ortamına geçmeden önce erişim kontrolü, kullanıcı bazlı rate limiting ve ek güvenlik önlemleri uygulanmalıdır.

## Test ve Doğrulama

Backend testlerini çalıştırmak için:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Python dosyalarını derleme kontrolünden geçirmek için:

```powershell
.\.venv\Scripts\python.exe -m compileall -q backend
```

Frontend production build ve TypeScript kontrolü:

```powershell
cd frontend
npm.cmd run build
```

Testler aşağıdaki davranışları kapsar:

* Sağlayıcı verilerinin normalize edilmesi
* Eksik alanların yönetimi
* Sayısal fiyat dönüşümü
* Gece yarısını geçen yerel uçuş saatleri
* Direkt ve aktarmalı uçuşlar
* Uçuş süresi
* Sıralama
* Tarih örnekleme
* Input validation
* Cache TTL
* Eşzamanlı aynı sorgular
* Günlük sorgu limiti
* Kota sonrası kısmi sonuçlar

Testler gerçek SerpApi çağrısı yapmaz.

## API ve Veri Kaynağı

Fly V1, [SerpApi Google Flights](https://serpapi.com/google-flights-api) entegrasyonunu kullanır.

Google Flights endpoint'i tek bir uçuş tarihi için sonuç döndürür.

`price_insights.price_history`, seçilen uçuşun geçmişte gözlenen fiyatlarını ifade eder; gelecekteki farklı günlerin fiyat takvimi değildir. Bu nedenle gelecek tarihler için bu veriden fiyat üretilmez.

[Flights Deals](https://serpapi.com/google-flights-deals-api) esnek tarih aralıklarını desteklese de belirli bir rotanın tüm günlerini eksiksiz kapsama garantisi sunmaz.

Bu nedenle V1, kesin kalkış → varış rotasını korumak amacıyla `google_flights` entegrasyonu üzerinden sınırlı tarih örneklemesi uygular.

## V1 Sınırları

* “En ucuz gün” yalnızca **sorgulanan tarihler ve sağlayıcının döndürdüğü uçuşlar** arasında hesaplanır.
* Sonuç, bütün ayın veya tüm pazarın kesin minimum fiyatı anlamına gelmez.
* Bir tarih keşfi en fazla 5 cache miss oluşturur.
* Sağlayıcı hatası oluşursa yeni çağrılar durdurulur; daha önce başarıyla alınan günler gösterilebilir.
* Sayfa yenilendiğinde frontend görünümü temizlenir ancak backend cache korunur.
* Fiyatlar TRY olarak talep edilir.
* Sağlayıcı farklı para birimi döndürürse sonuç kendi para birimiyle gösterilir ve TRY bazlı en ucuz tarih karşılaştırmasına dahil edilmez.
* Belirsiz fiyat formatları tahmin edilmez.
* Gösterilen fiyat seçilen yetişkinlerin toplam fiyatıdır.
* Bagaj, koltuk seçimi veya ödeme yöntemine bağlı ek ücretler bulunabilir.
* Fiyat ve müsaitlik satın alma anına kadar değişebilir.
* Uçuş saatleri ilgili havalimanlarının yerel saatleridir.
* V1 yalnızca tek yön uçuşları destekler.
* Veri modelinde `trip_type` bulunmasına rağmen şu anda yalnızca `one_way` kabul edilir.
* Booking token doğrudan satın alma bağlantısı değildir.
* Satın alma yönlendirmesi için sağlayıcının ayrı Booking Options akışının uygulanması gerekir.
* Havalimanı önerileri sınırlı bir yerel liste üzerinden sunulur.
* Liste dışındaki havalimanları 3 harfli IATA kodu ile aranabilir.
* Cache ve günlük API bütçesi `fly-cache.sqlite3` içerisinde saklanır.
* Başarısız sağlayıcı çağrılarının tekrar denenmesi ek API kredisi tüketebilir.
* Otomatik retry uygulanmaz.
* Uygulama SerpApi hesabındaki toplam kalan kotayı sorgulamaz.

## Güvenlik

API anahtarları repository içerisinde tutulmaz.

`.gitignore` aşağıdaki yerel ve hassas dosyaların Git'e eklenmesini engeller:

```text
.env
.venv/
*.sqlite3*
__pycache__/
.pytest_cache/
node_modules/
dist/
```

Repository içerisinde yalnızca örnek yapılandırma için `.env.example` bulunur.

## Roadmap

Planlanan geliştirmeler:

1. Kesin rota için daha geniş tarih/fiyat takvimi sağlayabilecek veri kaynaklarının değerlendirilmesi.
2. Doğrulanmış satın alma yönlendirmesi için Booking Options entegrasyonu.
3. Gidiş-dönüş uçuş desteği.
4. Daha kapsamlı havalimanı araması.
5. Fiyat geçmişi ve fiyat değişim takibi.
6. Fiyat uyarıları.
7. Favori rotalar.
8. Esnek tarih araması.
9. Fiyat, süre ve diğer kriterlere dayalı uçuş karşılaştırma özellikleri.
10. Production deployment için kullanıcı yönetimi, rate limiting ve güvenlik katmanları.

## Proje Durumu

Fly aktif olarak geliştirilmektedir.

Mevcut sürüm, gerçek uçuş verileriyle çalışan V1 prototipidir. Proje; ürün geliştirme, API entegrasyonu, backend/frontend geliştirme, test süreçleri ve yazılım analizi pratiklerini gerçek bir ürün geliştirme süreci içerisinde uygulamak amacıyla geliştirilmektedir.
