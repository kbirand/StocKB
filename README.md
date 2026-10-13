# StocKB — Döviz & Altın Stream Deck Plugin

A lightweight [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugin that shows **live currency and gold prices** on your keys, powered by the free [truncgil finans](https://finans.truncgil.com/) API.

Each key renders a clean, fully‑customizable tile: a label, the current price, and a colored ▲/▼ change indicator. Add one key for the US Dollar, another for gram gold — or any symbol truncgil supports.

```
┌─────────────┐
│    Dolar    │   ← label
│    45,90    │   ← price (auto-fit, tr-TR formatting)
│  ▼ %0.13    │   ← change (green ▲ / red ▼)
└─────────────┘
```

---

## Features

- 💱 **Currency, gold & more** — döviz, altın (gram/çeyrek/…), silver, Brent, Bitcoin, all from one feed.
- 🔄 **Auto-refresh** on a configurable interval (per key), plus instant refresh on key press.
- 🚀 **One shared fetch** — every key reuses a single cached request (30s TTL) instead of one request per key.
- 🛡️ **Resilient** — the upstream feed occasionally returns a truncated body; the plugin retries once and falls back to the last good data, so keys never flicker to an error on a transient blip.
- 🎨 **Fully themeable per key** — font size for each line, top padding, and background color.
- 📐 **Auto-shrinking price** so long numbers never overflow the key.
- 🟢🔴 **Color-coded change** indicator (up green / down red) with ▲/▼ arrows.
- 🧩 Built on the official **[@elgato/streamdeck](https://www.npmjs.com/package/@elgato/streamdeck)** Node SDK + TypeScript.
- 🔑 **No API key required.**

---

## Installation

### From a release

1. Download the latest `com.koraybirand.stockb.streamDeckPlugin` from the [Releases](../../releases) page.
2. Double‑click it — the Stream Deck app installs it automatically.

### From source (development)

```bash
git clone https://github.com/kbirand/StocKB.git
cd StocKB
npm install
npm run build
npx @elgato/cli link com.koraybirand.stockb.sdPlugin
```

Then (re)start the Stream Deck app so it loads the plugin.

> **Requirements:** Stream Deck app **6.5+**, Node.js **20+**, macOS 12+ or Windows 10+.

---

## Usage

1. In the Stream Deck app, open the **Keys** list and find the **StocKB** category.
2. Drag the **Fiyat** action onto a key.
3. Configure it in the Property Inspector (settings panel):

| Setting | Key | Description | Default |
|---|---|---|---|
| **Sembol** | `sembol` | truncgil symbol — see table below | `USD` |
| **Etiket** | `label` | Custom label; falls back to the symbol | — |
| **Yenileme (sn)** | `interval` | Refresh interval in seconds (min 15) | `60` |
| **Etiket Boyutu** | `labelSize` | Label font size (px) | `22` |
| **Fiyat Boyutu** | `priceSize` | Price target font size (px, auto‑shrinks) | `26` |
| **Değişim Boyutu** | `changeSize` | Change font size (px) | `22` |
| **Üst Boşluk** | `topPad` | Top padding — shifts text down (px) | `0` |
| **Arka Plan** | `bgColor` | Background color (hex) | `#101418` |

### Example layout

| Key | Sembol | Etiket |
|---|---|---|
| 1 | `USD` | Dolar |
| 2 | `EUR` | Euro |
| 3 | `GRA` | Gram Altın |

---

## Common symbols

**Döviz:** `USD` (Dolar), `EUR` (Euro), `GBP` (Sterlin), `CHF`, `JPY`, `CAD`, `AUD`, `RUB`, `SAR`, …

**Altın:** `GRA` (Gram), `CEYREKALTIN` (Çeyrek), `YARIMALTIN` (Yarım), `TAMALTIN` (Tam), `CUMHURIYETALTINI` (Cumhuriyet), `ATAALTIN`, `14AYARALTIN`, `18AYARALTIN`, …

**Diğer:** `GUMUS` (Gümüş), `XU100` (BIST 100), …

> Legacy GenelPara gold codes still work and are mapped automatically: `GA → GRA`, `C → CEYREKALTIN`, `Y → YARIMALTIN`, `T → TAMALTIN`, `CUM → CUMHURIYETALTINI`. No need to change existing keys when upgrading.

---

## Data source & API

Quotes come from truncgil's public JSON endpoint, which returns **every symbol in a single response**:

```
https://finans.truncgil.com/v4/today.json
```

Example response (excerpt):

```json
{
  "Update_Date": "2026-06-01 20:19:01",
  "USD": { "Buying": 45.8906, "Selling": 45.9027, "Change": 0.16, "Type": "Currency" },
  "GRA": { "Buying": 6601.77, "Selling": 6602.64, "Change": -1.27, "Type": "Gold", "Name": "GRAMALTIN" }
}
```

The plugin displays `Selling`, derives the ▲/▼ direction and green/red color from the sign of `Change`, and formats the price with Turkish grouping (e.g. `6.604,94`).

> 💡 Because the plugin fetches the whole feed once and caches it for 30s, adding more keys does **not** add network requests. There is no per-symbol daily limit to worry about.

---

## Development

```bash
npm install        # install dependencies
npm run build      # bundle into com.koraybirand.stockb.sdPlugin/bin/plugin.js
npm run watch      # rebuild on change
```

After a code change, the most reliable way to apply it is to **fully relaunch** the Stream Deck app (the CLI `restart` can leave a stale instance running):

```bash
# macOS
pkill -f "Elgato Stream Deck.app/Contents/MacOS/Stream Deck"
open -a "Elgato Stream Deck"
```

Validate the manifest before packaging:

```bash
npx @elgato/cli validate com.koraybirand.stockb.sdPlugin
```

### Project structure

```
StocKB/
├── src/
│   ├── plugin.ts                 # entry point — registers the action, connects
│   └── actions/
│       └── price-ticker.ts       # fetch + cache + SVG rendering + refresh timers
├── com.koraybirand.stockb.sdPlugin/
│   ├── manifest.json             # plugin & action metadata
│   ├── bin/plugin.js             # bundled output (generated)
│   ├── ui/ticker.html            # Property Inspector (settings UI)
│   └── imgs/                     # icons (generated by gen-icons.mjs)
├── gen-icons.mjs                 # generates placeholder PNG icons
├── rollup.config.mjs             # bundler config
├── tsconfig.json
└── package.json
```

### How it works

- The key image is a **base64‑encoded SVG** set via `action.setImage()`, so every line (font size, color, position, background) is drawn programmatically — no static images.
- All keys share **one cached fetch** of the truncgil feed (30s TTL, with an in‑flight guard so simultaneous refreshes coalesce into a single request).
- Each key keeps **its own refresh timer**, started on `onWillAppear` and cleared on `onWillDisappear`.
- Refreshes are triggered by: the timer, `onWillAppear`, `onDidReceiveSettings` (live updates while editing), and `onKeyDown` (manual).
- Placeholder icons are solid‑color PNGs created by `gen-icons.mjs`; replace the files in `imgs/` with real artwork before publishing.

### Packaging for distribution

```bash
npx @elgato/cli pack com.koraybirand.stockb.sdPlugin
```

This produces `com.koraybirand.stockb.streamDeckPlugin`, ready to share or submit to the Elgato Marketplace.

---

## Roadmap / ideas

- [ ] Text color pickers for label / price / change
- [ ] `Buying` / `Selling` toggle
- [ ] Symbol picker dropdown in the Property Inspector
- [ ] Real icons & marketplace artwork

---

## Credits

- Data: [truncgil finans](https://finans.truncgil.com/)
- Built with the [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/)

## License

[MIT](LICENSE) © Koray Birand

> Not affiliated with or endorsed by Elgato or truncgil. Prices are provided for informational purposes only and may be delayed; do not rely on them for trading decisions.
