import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyAction,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent
} from "@elgato/streamdeck";

/** Settings stored per key. */
type TickerSettings = {
  /** "doviz" (currency) or "altin" (gold). Kept for backward compatibility. */
  list?: "doviz" | "altin";
  /** Symbol, e.g. "USD", "EUR", "GRA" (gram altın). */
  sembol?: string;
  /** Custom label shown on the key. Falls back to the symbol. */
  label?: string;
  /** Refresh interval in seconds (minimum 15). */
  interval?: number;
  /** Font size (px) for the label line. */
  labelSize?: number;
  /** Target font size (px) for the price line; auto-shrinks to keep padding. */
  priceSize?: number;
  /** Font size (px) for the change line. */
  changeSize?: number;
  /** Background color of the key (hex, e.g. "#101418"). */
  bgColor?: string;
  /** Top padding (px) — shifts all text down from the top edge. */
  topPad?: number;
};

/** Shape of a single quote returned by truncgil (v4). */
type Quote = {
  Buying?: number;
  Selling?: number;
  Change?: number; // percentage change, e.g. 0.16 or -1.27
  Type?: string; // "Currency" | "Gold" | ...
  Name?: string;
};

/** Full payload: a map of symbol -> quote, plus an "Update_Date" string. */
type TruncgilData = Record<string, Quote | string>;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const ENDPOINT = "https://finans.truncgil.com/v4/today.json";

/**
 * truncgil returns every symbol in one response, so we fetch once and share
 * the result across all keys. The cache has a short TTL and an in-flight guard
 * so simultaneous key refreshes coalesce into a single network request.
 */
const CACHE_TTL_MS = 30_000;
let cache: { at: number; data: TruncgilData } | null = null;
let inflight: Promise<TruncgilData> | null = null;

/** Fetch the endpoint once and parse it. Throws on HTTP or JSON errors. */
async function fetchOnce(): Promise<TruncgilData> {
  const res = await fetch(ENDPOINT, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  // The feed occasionally returns a truncated body, so parse defensively
  // from text rather than trusting res.json().
  const text = await res.text();
  return JSON.parse(text) as TruncgilData;
}

/**
 * Return the latest data, coalescing concurrent callers and caching for a
 * short TTL. The upstream feed intermittently emits malformed JSON, so we
 * retry once and, failing that, serve the last good data (stale) rather than
 * flipping every key to an error.
 */
async function fetchAll(): Promise<TruncgilData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      let data: TruncgilData;
      try {
        data = await fetchOnce();
      } catch (first) {
        streamDeck.logger.warn("truncgil fetch failed, retrying once", first);
        data = await fetchOnce();
      }
      cache = { at: Date.now(), data };
      return data;
    } catch (err) {
      if (cache) {
        streamDeck.logger.warn("truncgil unavailable, serving cached data", err);
        return cache.data;
      }
      throw err;
    }
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Map legacy GenelPara gold codes to their truncgil equivalents. */
const SYMBOL_ALIASES: Record<string, string> = {
  GA: "GRA", // gram altın
  C: "CEYREKALTIN",
  Y: "YARIMALTIN",
  T: "TAMALTIN",
  CUM: "CUMHURIYETALTINI"
};

@action({ UUID: "com.koraybirand.stockb.ticker" })
export class PriceTicker extends SingletonAction<TickerSettings> {
  /** Per-key refresh timers, keyed by action id. */
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  override onWillAppear(ev: WillAppearEvent<TickerSettings>): Promise<void> {
    if (ev.action.isKey()) {
      this.schedule(ev.action, ev.payload.settings);
      return this.refresh(ev.action, ev.payload.settings);
    }
    return Promise.resolve();
  }

  override onWillDisappear(ev: WillDisappearEvent<TickerSettings>): void {
    const timer = this.timers.get(ev.action.id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(ev.action.id);
    }
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<TickerSettings>): Promise<void> {
    if (ev.action.isKey()) {
      this.schedule(ev.action, ev.payload.settings);
      return this.refresh(ev.action, ev.payload.settings);
    }
    return Promise.resolve();
  }

  override onKeyDown(ev: KeyDownEvent<TickerSettings>): Promise<void> {
    // Manual refresh on press.
    return this.refresh(ev.action, ev.payload.settings);
  }

  /** (Re)start the auto-refresh timer for a key. */
  private schedule(action: KeyAction<TickerSettings>, settings: TickerSettings): void {
    const existing = this.timers.get(action.id);
    if (existing) {
      clearInterval(existing);
    }
    const seconds = Math.max(15, Number(settings.interval) || 60);
    const timer = setInterval(() => {
      void this.refresh(action, settings);
    }, seconds * 1000);
    this.timers.set(action.id, timer);
  }

  /** Fetch the latest quote and paint the key. */
  private async refresh(action: KeyAction<TickerSettings>, settings: TickerSettings): Promise<void> {
    const raw = (settings.sembol || "USD").trim().toUpperCase();
    const sembol = SYMBOL_ALIASES[raw] ?? raw;
    const label = settings.label?.trim() || raw;

    try {
      const data = await fetchAll();
      const entry = data[sembol];
      const quote = entry && typeof entry === "object" ? entry : undefined;

      if (!quote) {
        await action.setImage(this.render(label, "—", "?", "#888888", settings));
        streamDeck.logger.warn(`No data for ${sembol}`);
        return;
      }

      const value = quote.Selling ?? quote.Buying;
      const price = value != null ? this.formatPrice(value) : "—";
      const changeNum = Number(quote.Change);
      const hasChange = !Number.isNaN(changeNum);
      const up = hasChange ? changeNum >= 0 : true;
      const color = up ? "#2ecc71" : "#e74c3c";
      const arrow = up ? "▲" : "▼";
      const changeText = hasChange ? `${arrow} %${Math.abs(changeNum).toFixed(2)}` : "";

      await action.setImage(this.render(label, price, changeText, color, settings));
    } catch (err) {
      streamDeck.logger.error(`Fetch failed for ${sembol}`, err);
      await action.setImage(this.render(label, "hata", "✕", "#e74c3c", settings));
    }
  }

  /** Format a numeric price with Turkish-style grouping and 2–4 decimals. */
  private formatPrice(value: number): string {
    const decimals = value >= 10 ? 2 : value >= 1 ? 3 : 4;
    return value.toLocaleString("tr-TR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /** Build a 144x144 SVG key image as a base64 data URI. */
  private render(label: string, price: string, change: string, color: string, settings: TickerSettings): string {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const clamp = (v: unknown, def: number) => Math.max(8, Math.min(48, Number(v) || def));
    const labelSize = clamp(settings.labelSize, 22);
    const changeSize = clamp(settings.changeSize, 22);

    // Price uses the chosen size as a target, but auto-shrinks so it always
    // fits within ~16px of left/right padding.
    const maxWidth = 112;
    const priceTarget = clamp(settings.priceSize, 26);
    const priceSize = Math.max(14, Math.min(priceTarget, Math.floor(maxWidth / (price.length * 0.58))));

    const bg = /^#[0-9a-fA-F]{3,8}$/.test(settings.bgColor ?? "") ? settings.bgColor : "#101418";

    // Top padding shifts the whole text block down from the top edge.
    const pad = Math.max(0, Math.min(60, Number(settings.topPad) || 0));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="14" fill="${bg}"/>
  <text x="72" y="${34 + pad}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${labelSize}" font-weight="700" fill="#dfe6ee">${esc(label)}</text>
  <text x="72" y="${84 + pad}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${priceSize}" font-weight="800" fill="#ffffff">${esc(price)}</text>
  <text x="72" y="${122 + pad}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${changeSize}" font-weight="700" fill="${color}">${esc(change)}</text>
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
}
