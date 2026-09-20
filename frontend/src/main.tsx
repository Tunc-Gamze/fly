import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plane,
  ArrowRight,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  ArrowUpRight,
  Compass,
  Info,
  Check,
  LoaderCircle,
} from "lucide-react";
import "./style.css";

type Leg = {
  airline: string | null;
  flightNumber: string | null;
  departureAirport: string | null;
  departureName: string | null;
  departureTime: string | null;
  arrivalAirport: string | null;
  arrivalName: string | null;
  arrivalTime: string | null;
  durationMinutes: number | null;
  airplane: string | null;
  travelClass: string | null;
};
type Flight = {
  id: string;
  date: string;
  price: number | null;
  currency: string;
  legs: Leg[];
  stops: number;
  durationMinutes: number | null;
};
type Day = {
  date: string;
  flights: Flight[];
  updatedAt: string;
  cached: boolean;
};
type Query = {
  origin: string;
  destination: string;
  adults: number;
  trip_type: "one_way";
};
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Istanbul",
}).format(new Date());
const addDays = (s: string, n: number) => {
  const d = new Date(s + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDate(d);
};
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
const money = (n: number | null, c = "TRY") =>
  n === null
    ? "Fiyat belirtilmedi"
    : /^[A-Z]{3}$/.test(c)
      ? new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency: c,
          maximumFractionDigits: 0,
        }).format(n)
      : `${n} (para birimi bilinmiyor)`;
const duration = (n: number | null) =>
  n === null
    ? "Süre belirtilmedi"
    : `${Math.floor(n / 60)} sa ${n % 60 ? (n % 60) + " dk" : ""}`;
const clock = (s: string | null) => s?.match(/\d{2}:\d{2}/)?.[0] ?? "—";
const airports = [
  ["ASR", "Kayseri"],
  ["IST", "İstanbul"],
  ["SAW", "İstanbul Sabiha Gökçen"],
  ["ESB", "Ankara"],
  ["ADB", "İzmir"],
  ["AYT", "Antalya"],
  ["DLM", "Dalaman"],
  ["BJV", "Bodrum"],
  ["TZX", "Trabzon"],
  ["GZT", "Gaziantep"],
  ["COV", "Çukurova"],
  ["ERZ", "Erzurum"],
  ["VAN", "Van"],
  ["DIY", "Diyarbakır"],
];
const airport = (s: string) =>
  airports.find(
    ([, name]) =>
      name.toLocaleLowerCase("tr-TR") === s.trim().toLocaleLowerCase("tr-TR"),
  )?.[0] ??
  s
    .trim()
    .toUpperCase()
    .match(/\b[A-Z]{3}\b/)?.[0] ??
  s.trim().toUpperCase();
const city = (code: string) => airports.find((a) => a[0] === code)?.[1] ?? code;
function cheapest(day: Day) {
  return day.flights
    .filter((f) => f.price !== null && f.currency === "TRY")
    .sort((a, b) => a.price! - b.price!)[0];
}
async function api<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 260000);
  try {
    const res = await fetch("/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        typeof data.detail === "string" ? data.detail : "Arama tamamlanamadı.",
      );
    return data;
  } catch (e) {
    if (e instanceof TypeError || e instanceof SyntaxError)
      throw new Error(
        "Sunucuya ulaşılamadı veya yanıt okunamadı. Backend’in çalıştığını kontrol edip tekrar deneyin.",
      );
    if (e instanceof Error && e.name === "AbortError")
      throw new Error(
        "Arama beklenenden uzun sürdü. Tekrar deneyin; tamamlanan tarihler önbellekten alınır.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
function App() {
  const [origin, setOrigin] = useState("ASR"),
    [destination, setDestination] = useState("IST"),
    [adults, setAdults] = useState(1);
  const [mode, setMode] = useState("flex"),
    [start, setStart] = useState(addDays(today, 1)),
    [end, setEnd] = useState(addDays(today, 30));
  const [active, setActive] = useState<Query | null>(null),
    [days, setDays] = useState<Record<string, Day>>({}),
    [selected, setSelected] = useState(""),
    [month, setMonth] = useState(today.slice(0, 7));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sort, setSort] = useState("price"),
    [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState("");
  const best = Object.values(days)
    .filter((d) => cheapest(d))
    .sort((a, b) => cheapest(a)!.price! - cheapest(b)!.price!);
  const day = days[selected];
  const flights = (day?.flights ?? [])
    .filter(
      (f) =>
        filter === "all" || (filter === "direct" ? f.stops === 0 : f.stops > 0),
    )
    .sort((a, b) =>
      sort === "departure"
        ? (a.legs[0].departureTime ?? "9999").localeCompare(
            b.legs[0].departureTime ?? "9999",
          )
        : sort === "duration"
          ? (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity)
          : (a.price ?? Infinity) - (b.price ?? Infinity),
    );
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const query: Query = {
      origin: airport(origin),
      destination: airport(destination),
      adults,
      trip_type: "one_way",
    };
    const same = JSON.stringify(query) === JSON.stringify(active);
    setBusy(true);
    setError("");
    setActive(query);
    if (!same) {
      setDays({});
      setSelected("");
    }
    setMonth(start.slice(0, 7));
    try {
      let received: Day[];
      if (mode === "flex") {
        const data = await api<{ days: Day[]; errors: { message: string }[] }>(
          "discover",
          { ...query, date: start, end_date: end },
        );
        received = data.days;
        setError(data.errors.map((e) => e.message).join(" "));
      } else received = [await api<Day>("search", { ...query, date: start })];
      setDays((old) => ({
        ...(same ? old : {}),
        ...Object.fromEntries(received.map((d) => [d.date, d])),
      }));
      const first = [...received].sort(
        (a, b) =>
          (cheapest(a)?.price ?? Infinity) - (cheapest(b)?.price ?? Infinity),
      )[0];
      if (first) {
        setSelected(first.date);
        setMonth(first.date.slice(0, 7));
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Bağlantı kurulamadı. Backend’in çalıştığını kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function choose(date: string) {
    if (!active || busy) return;
    setSelected(date);
    if (days[date] && Date.now() - Date.parse(days[date].updatedAt) < 1800000)
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Day>("search", { ...active, date });
      setDays((old) => ({ ...old, [date]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uçuşlar alınamadı.");
    } finally {
      setBusy(false);
    }
  }
  function shift(n: number) {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + n);
    setMonth(localDate(d).slice(0, 7));
  }
  const first = new Date(month + "-01T12:00:00"),
    offset = (first.getDay() + 6) % 7,
    count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Fly ana sayfa">
          <Plane size={26} />
          fly<span>FLIGHT EXPLORER</span>
        </a>
        <span className="header-note">
          Biraz esneklik. Daha iyi bir yolculuk.
        </span>
        <span className="currency">TRY · ₺</span>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">
            <span /> DAHA AZ ÖDE, DAHA ÇOK KEŞFET
          </div>
          <h1>
            Rotan belli.
            <br />
            Peki ya <em>en uygun gün?</em>
          </h1>
          <p>
            Tarihlere bir de fiyatlarıyla bak. Uygun günü bul,
            <br className="desktop" /> bir sonraki yolculuğuna yer aç.
          </p>
          <div className="route-art" aria-hidden="true">
            <span>ASR</span>
            <i />
            <Plane size={40} />
            <i />
            <span>IST</span>
            <small>Yeni bir yolculuk, doğru bir günle başlar.</small>
          </div>
        </section>
        <form onSubmit={run} className="search-panel">
          <div className="search-top">
            <span>
              <Plane size={16} /> Tek yön
            </span>
            <span>Ekonomi</span>
            <label className="passengers">
              <select
                aria-label="Yetişkin sayısı"
                value={adults}
                onChange={(e) => setAdults(+e.target.value)}
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} yetişkin
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="search-fields">
            <label>
              Nereden
              <input
                list="airports"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                required
                placeholder="Şehir veya IATA"
              />
            </label>
            <button
              className="swap icon"
              type="button"
              aria-label="Rotayı ters çevir"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <ArrowLeftRight size={18} />
            </button>
            <label>
              Nereye
              <input
                list="airports"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                placeholder="Şehir veya IATA"
              />
            </label>
            <label>
              {mode === "flex" ? "Başlangıç" : "Uçuş tarihi"}
              <input
                type="date"
                min={today}
                max={addDays(today, 330)}
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            {mode === "flex" && (
              <label>
                Bitiş
                <input
                  type="date"
                  required
                  min={start}
                  max={
                    addDays(start, 90) < addDays(today, 330)
                      ? addDays(start, 90)
                      : addDays(today, 330)
                  }
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            )}
            <button disabled={busy} className="primary" type="submit">
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Search size={18} />
              )}{" "}
              {busy
                ? "Araştırılıyor…"
                : mode === "flex"
                  ? "Uygun günleri bul"
                  : "Uçuşları bul"}
            </button>
          </div>
          <datalist id="airports">
            {airports.map(([code, name]) => (
              <option key={code} value={`${name} (${code})`} />
            ))}
          </datalist>
          <div className="search-bottom">
            <div className="segmented">
              <button
                type="button"
                className={mode === "flex" ? "active" : ""}
                onClick={() => setMode("flex")}
              >
                <CalendarDays size={15} /> Esnek tarihler
              </button>
              <button
                type="button"
                className={mode === "exact" ? "active" : ""}
                onClick={() => setMode("exact")}
              >
                Belirli bir tarih
              </button>
            </div>
            <small>
              {mode === "flex"
                ? "Aralığa yayılmış en fazla 5 gün karşılaştırılır."
                : "Seçtiğin güne ait gerçek uçuşlar."}
            </small>
          </div>
        </form>
        {error && (
          <div role="alert" className="error">
            <Info size={18} />
            {error}
          </div>
        )}
        <section className="discovery">
          <div className="section-heading">
            <div className="eyebrow">TARİHLERİ KEŞFET</div>
            <h2>
              {active
                ? `${city(active.origin)} → ${city(active.destination)}`
                : "İyi bir yolculuk, iyi bir tarihle başlar."}
            </h2>
            <p>
              {active
                ? "Aranan günlerin fiyatlarını karşılaştır. Yeni bir günün fiyatını öğrenmek için takvimden seç."
                : "Rotanı ve tarih aralığını seç. Bulunan fiyatlar burada görünsün."}
            </p>
          </div>
          <div className="discovery-grid">
            <div className="calendar panel">
              <div className="calendar-heading">
                <h3>
                  {first.toLocaleDateString("tr-TR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <div>
                  <button
                    className="icon"
                    aria-label="Önceki ay"
                    disabled={month <= today.slice(0, 7)}
                    onClick={() => shift(-1)}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    className="icon"
                    aria-label="Sonraki ay"
                    disabled={month >= addDays(today, 330).slice(0, 7)}
                    onClick={() => shift(1)}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="calendar-grid">
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                  <span className="weekday" key={d}>
                    {d}
                  </span>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={"blank" + i} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const date = `${month}-${String(i + 1).padStart(2, "0")}`,
                    d = days[date],
                    price = d ? cheapest(d) : null,
                    isBest =
                      price &&
                      best[0] &&
                      price.price === cheapest(best[0])?.price;
                  return (
                    <button
                      key={date}
                      title={`${dateLabel(date)} · ${d ? (price ? money(price.price) : "Fiyat bulunamadı") : "Aranmadı; seçmek en fazla 1 sorgu kullanır"}`}
                      className={`date-cell ${selected === date ? "selected" : ""} ${isBest ? "cheap" : ""}`}
                      disabled={
                        !active ||
                        busy ||
                        date < today ||
                        date > addDays(today, 330)
                      }
                      onClick={() => choose(date)}
                    >
                      <span>{i + 1}</span>
                      <strong>{price ? money(price.price) : "—"}</strong>
                      {d && !price && <small>Sonuç yok</small>}
                    </button>
                  );
                })}
              </div>
              <div className="legend">
                <span>
                  <i /> Bulunan en düşük fiyat
                </span>
                <span>— Henüz fiyat yok</span>
              </div>
              <p className="calendar-note">
                Takvimde yalnızca aranan günler yer alır. Ay değiştirmek sorgu
                kullanmaz; tüm ayın en ucuz günü garanti edilmez.
              </p>
            </div>
            <aside className="panel cheapest">
              <div className="aside-icon">
                <Compass size={23} />
              </div>
              <h3>En ucuz tarihler</h3>
              <p>
                Aradığın günler arasındaki
                <br />
                küçük kaçamak fırsatları.
              </p>
              {best.length ? (
                best.slice(0, 5).map((d, i) => (
                  <button
                    disabled={busy}
                    key={d.date}
                    className="best-date"
                    onClick={() => {
                      setMonth(d.date.slice(0, 7));
                      void choose(d.date);
                    }}
                  >
                    <span className="rank">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      {new Date(d.date + "T12:00:00").toLocaleDateString(
                        "tr-TR",
                        { day: "numeric", month: "long" },
                      )}
                      <small>
                        {new Date(d.date + "T12:00:00").toLocaleDateString(
                          "tr-TR",
                          { weekday: "long" },
                        )}
                      </small>
                    </span>
                    <strong>
                      {money(cheapest(d)!.price)}
                      <ArrowUpRight size={14} />
                    </strong>
                  </button>
                ))
              ) : (
                <div className="aside-empty">
                  {busy ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <CalendarDays size={28} />
                  )}
                  <span>
                    {busy
                      ? "Uygun günler araştırılıyor…"
                      : "İlk aramanla keşif başlasın."}
                  </span>
                </div>
              )}
              <div className="aside-footer">
                <Check size={15} /> Gerçek uçuşlar, gerçek fiyatlar
              </div>
            </aside>
          </div>
        </section>
        <section className="results" aria-live="polite">
          <div className="result-heading">
            <div>
              <div className="eyebrow">YOLCULUĞUNU SEÇ</div>
              <h2>{selected ? dateLabel(selected) : "Günün uçuşları"}</h2>
              <p>
                {day
                  ? `${day.flights.length} uçuş · Son güncelleme ${new Date(day.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}${day.cached ? " · Önbellekten" : ""}`
                  : "Bir tarih seçtiğinde uçuş detayları burada görünür."}
              </p>
            </div>
            {day && (
              <div className="filters">
                <select
                  aria-label="Aktarma filtresi"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Tüm uçuşlar</option>
                  <option value="direct">Direkt uçuşlar</option>
                  <option value="connecting">Aktarmalı uçuşlar</option>
                </select>
                <select
                  aria-label="Sıralama"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="price">En ucuz</option>
                  <option value="duration">En kısa</option>
                  <option value="departure">En erken kalkış</option>
                </select>
              </div>
            )}
          </div>
          {busy ? (
            <div className="skeletons" role="status">
              <span>
                Uçuşlar araştırılıyor. Bu işlem birkaç dakika sürebilir.
              </span>
              <div />
              <div />
            </div>
          ) : flights.length ? (
            flights.map((f) => (
              <article key={f.id} className="flight panel">
                <div className="flight-main">
                  <div className="airline">
                    <div className="airline-icon">
                      <Plane size={20} />
                    </div>
                    <div>
                      <strong>
                        {[
                          ...new Set(
                            f.legs.map(
                              (l) => l.airline ?? "Havayolu belirtilmedi",
                            ),
                          ),
                        ].join(" + ")}
                      </strong>
                      <small>
                        {f.legs
                          .map((l) => l.flightNumber ?? "Numara belirtilmedi")
                          .join(" · ")}
                      </small>
                    </div>
                  </div>
                  <div className="times">
                    <div>
                      <strong>{clock(f.legs[0].departureTime)}</strong>
                      <span>{f.legs[0].departureAirport ?? "—"}</span>
                    </div>
                    <div className="flight-line">
                      <small>{duration(f.durationMinutes)}</small>
                      <span>
                        <i />
                        <Plane size={14} />
                      </span>
                      <small>
                        {f.stops === 0 ? "Direkt" : `${f.stops} aktarma`}
                      </small>
                    </div>
                    <div>
                      <strong>{clock(f.legs.at(-1)!.arrivalTime)}</strong>
                      <span>{f.legs.at(-1)!.arrivalAirport ?? "—"}</span>
                      {f.legs.at(-1)!.arrivalTime?.slice(0, 10) !==
                        f.legs[0].departureTime?.slice(0, 10) &&
                        f.legs.at(-1)!.arrivalTime && (
                          <small className="arrival-date">
                            {f.legs.at(-1)!.arrivalTime!.slice(0, 10)}
                          </small>
                        )}
                    </div>
                  </div>
                  <div className="flight-price">
                    <strong>{money(f.price, f.currency)}</strong>
                    <small>{active?.adults} yetişkin · toplam</small>
                  </div>
                </div>
                <details>
                  <summary>
                    Uçuşu gör <ArrowRight size={15} />
                  </summary>
                  <div className="flight-details">
                    {f.legs.map((l, i) => (
                      <div className="leg" key={i}>
                        <strong>
                          {l.airline ?? "Havayolu belirtilmedi"} ·{" "}
                          {l.flightNumber ?? "Uçuş numarası belirtilmedi"}
                        </strong>
                        <p>
                          {l.departureName ?? l.departureAirport ?? "—"} →{" "}
                          {l.arrivalName ?? l.arrivalAirport ?? "—"}
                        </p>
                        <p>
                          {l.departureTime ?? "—"} → {l.arrivalTime ?? "—"}{" "}
                          <span>(havalimanlarının yerel saatleri)</span>
                        </p>
                        <small>
                          {[
                            duration(l.durationMinutes),
                            l.airplane,
                            l.travelClass,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </div>
                    ))}
                    <p className="booking-note">
                      Doğrudan satın alma bağlantısı mevcut değil. Bu bilgilerle
                      aynı uçuşu havayolunda veya bilet platformunda
                      bulabilirsin. Fiyatlar ve müsaitlik değişebilir.
                    </p>
                    <button
                      className="copy"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${dateLabel(f.date)}\n${f.legs.map((l) => `${l.airline ?? ""} ${l.flightNumber ?? ""} · ${l.departureAirport ?? ""} ${l.departureTime ?? ""} → ${l.arrivalAirport ?? ""} ${l.arrivalTime ?? ""}`).join("\n")}\n${money(f.price, f.currency)} · ${active?.adults} yetişkin`,
                          );
                          setCopied(f.id);
                        } catch {
                          setError(
                            "Kopyalama kullanılamıyor. Uçuş bilgilerini seçerek kopyalayabilirsiniz.",
                          );
                        }
                      }}
                    >
                      {copied === f.id
                        ? "Kopyalandı ✓"
                        : "Uçuş bilgilerini kopyala"}
                    </button>
                  </div>
                </details>
              </article>
            ))
          ) : (
            <div className="empty panel">
              <Plane size={30} />
              <h3>
                {day
                  ? "Bu seçimde uçuş bulunamadı."
                  : "Bir sonraki yolculuğun seni bekliyor."}
              </h3>
              <p>
                {day
                  ? "Başka bir tarih seçebilir veya aktarma filtresini değiştirebilirsin."
                  : "Önce rotanı ara, sonra sana uygun güne göz at."}
              </p>
            </div>
          )}
        </section>
        <footer>
          <a className="brand" href="/">
            fly
          </a>
          <span>Tarihin esnekse, seçeneklerin çoğalır.</span>
          <small>
            Uçuş verileri: SerpApi / Google Flights · Fiyatlar değişebilir.
          </small>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
