# StocKB — Döviz & Altın Stream Deck Plugin

A lightweight [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugin that shows **live currency and gold prices** on your keys, powered by the free [GenelPara](https://www.genelpara.com/) API.

Each key renders a clean, fully‑customizable tile: a label, the current price, and a colored ▲/▼ change indicator. Add one key for the US Dollar, another for gram gold — or any symbol GenelPara supports.

```
┌─────────────┐
│    Dolar    │   ← label
│   ₺45.91    │   ← price (auto-fit)
│  ▼ %-0.02   │   ← change (green ▲ / red ▼)
└─────────────┘
```

---

## Features

- 💱 **Currency & gold** quotes from GenelPara (`doviz` / `altin` lists).
- 🔄 **Auto-refresh** on a configurable interval (per key), plus instant refresh on key press.
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
git clone https://github.com/<you>/StocKB.git
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
| **Veri Tipi** | `list` | `Döviz` (currency) or `Altın` (gold) | `doviz` |
| **Sembol** | `sembol` | GenelPara symbol — see table below | `USD` |
| **Etiket** | `label` | Custom label; falls back to the symbol | — |
| **Yenileme (sn)** | `interval` | Refresh interval in seconds (min 15) | `60` |
| **Etiket Boyutu** | `labelSize` | Label font size (px) | `22` |
| **Fiyat Boyutu** | `priceSize` | Price target font size (px, auto‑shrinks) | `26` |
| **Değişim Boyutu** | `changeSize` | Change font size (px) | `22` |
| **Üst Boşluk** | `topPad` | Top padding — shifts text down (px) | `0` |
| **Arka Plan** | `bgColor` | Background color (hex) | `#101418` |

### Example layout

| Key | Veri Tipi | Sembol | Etiket |
|---|---|---|---|
| 1 | Döviz | `USD` | Dolar |
| 2 | Döviz | `EUR` | Euro |
| 3 | Altın | `GA`  | Gram Altın |

---

## Common symbols

**Döviz (`list=doviz`):** `USD` (Dolar), `EUR` (Euro), `GBP` (Sterlin), `CHF`, `JPY`, `CAD`, `AUD`, `RUB`, `SAR`, …

**Altın (`list=altin`):** `GA` (Gram), `C` (Çeyrek), `Y` (Yarım), `T` (Tam), `CUM` (Cumhuriyet), `ATA`, `ONS`, …

> Make sure **Veri Tipi** matches the symbol — e.g. `GA` only works under **Altın**, `USD` only under **Döviz**.

---

## Data source & API

Quotes come from GenelPara's public JSON endpoint:

```
https://api.genelpara.com/json/?list=<doviz|altin>&sembol=<SYMBOL>
```

Example response:

```json
{
  "success": true,
  "list": "doviz",
  "count": 1,
  "remaining": 997,
  "data": {
    "USD": {
      "alis": "45.9059",
      "satis": "45.9097",
      "degisim": "-0.02",
      "oran": "-0.0092",
      "yon": "moneyDown",
      "kur": "TRY",
      "sembol": "₺"
    }
  }
}
```

The plugin displays `satis` (selling price), colors the change by `yon` (`moneyUp`/`moneyDown`), and prefixes the currency `sembol`.

> ⚠️ **Fair-use limit:** GenelPara blocks IPs that exceed ~**10,000 requests/day**. At the default 60s interval, one key makes ~1,440 requests/day — keep that in mind if you add many fast‑refreshing keys. The `remaining` field in each response shows your daily quota.

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
│       └── price-ticker.ts       # fetch + SVG rendering + refresh timers
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

- [ ] One shared fetch per symbol (instead of one request per key)
- [ ] Text color pickers for label / price / change
- [ ] Thousands separator (`6.656,98`)
- [ ] `alış` / `satış` toggle
- [ ] Real icons & marketplace artwork

---

## Credits

- Data: [GenelPara](https://www.genelpara.com/)
- Built with the [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/)

## License

[MIT](LICENSE) © Koray Birand

> Not affiliated with or endorsed by Elgato or GenelPara. Prices are provided for informational purposes only and may be delayed; do not rely on them for trading decisions.
