# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StocKB is an Elgato Stream Deck plugin that shows live currency, gold, and other quotes on keys. It is a TypeScript Node plugin built on `@elgato/streamdeck`, bundled with Rollup into a single ES module that the Stream Deck app runs as a child process.

## Commands

```bash
npm install                                          # dependencies
npm run build                                        # bundle src/ -> com.koraybirand.stockb.sdPlugin/bin/plugin.js
npm run watch                                        # rebuild on change (also watches manifest.json)
npx @elgato/cli validate com.koraybirand.stockb.sdPlugin   # validate manifest before packaging
npx @elgato/cli pack com.koraybirand.stockb.sdPlugin --force  # produce com.koraybirand.stockb.streamDeckPlugin
npx @elgato/cli link com.koraybirand.stockb.sdPlugin       # symlink into the Stream Deck Plugins dir (dev install)
```

There is no test suite or linter configured.

## Applying a code change (dev loop)

The `.sdPlugin` folder is symlinked into `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`, so a fresh `npm run build` is already in place. To reload **without** restarting the whole Stream Deck app, kill the plugin's node process — the Stream Deck app auto-respawns it under a new PID with the new `bin/plugin.js`:

```bash
kill $(pgrep -f "com.koraybirand.stockb.sdPlugin/bin/plugin.js")
```

The plugin logs only on warn/error (to `com.koraybirand.stockb.sdPlugin/logs/`), so silence after a reload means clean fetches. A full app relaunch (`pkill -f "Elgato Stream Deck.app/Contents/MacOS/Stream Deck"; open -a "Elgato Stream Deck"`) is the fallback; the CLI `restart` can leave a stale instance.

## Architecture

- **`src/plugin.ts`** — entry point. Sets the log level, registers the single action, and calls `streamDeck.connect()`.
- **`src/actions/price-ticker.ts`** — the entire app. One `PriceTicker` action (`SingletonAction`) that:
  - Keeps a **per-key refresh timer** (`timers` Map), started on `onWillAppear`, cleared on `onWillDisappear`, restarted on settings change. Refresh is also triggered by `onDidReceiveSettings` (live edits) and `onKeyDown` (manual).
  - Fetches via a **module-level shared cache** (`fetchAll`): all keys reuse one request to the truncgil feed (30s TTL + in-flight guard), so adding keys adds no network requests.
  - Renders each key as a **base64-encoded SVG** passed to `action.setImage()` — every line (label/price/change, font sizes, colors, padding, background) is drawn programmatically; price auto-shrinks to fit. There are no static price images.
- **`com.koraybirand.stockb.sdPlugin/`** — the deployed plugin: `manifest.json` (metadata; `Version` is the 4-part Stream Deck version), `ui/ticker.html` (Property Inspector settings UI, using `sdpi-components`), `bin/plugin.js` (generated, gitignored), `imgs/` (placeholder icons from `gen-icons.mjs`).

Build output (`bin/`), logs, and the packaged `*.streamDeckPlugin` are gitignored. The packaged artifact lives in `release/` and is attached to GitHub releases, not committed.

## Data source

Quotes come from truncgil's keyless feed, which returns **every symbol in one response**:

```
https://finans.truncgil.com/v4/today.json
```

Each entry has `Buying`, `Selling`, `Change` (signed percent, drives the ▲/▼ color), and `Type`. The plugin displays `Selling`, formats with tr-TR grouping, and maps legacy GenelPara gold codes for backward compatibility (`GA→GRA`, `C→CEYREKALTIN`, `Y→YARIMALTIN`, `T→TAMALTIN`, `CUM→CUMHURIYETALTINI`).

**Feed gotchas:** the endpoint intermittently returns a **truncated/malformed body** (parse fails ~byte 6764) — `fetchAll` handles this by parsing from text, retrying once, then serving the last-good cache rather than erroring keys. several symbols return `Selling: 0` in v4 (broken upstream) — confirmed `ONS`, `BRENT`, `DBITCOIN` — so they are excluded from suggested symbols. Verify a symbol is non-zero before recommending it.

## Releasing

Bump both `package.json` `version` and `manifest.json` `Version` (4-part), then build → validate → pack → move artifact to `release/` → commit/push → tag `vX.Y.Z`. Publishing the GitHub release needs auth: `gh` is **not** logged in on this machine, but `git` has a token in the keychain helper — borrow it (`GH_TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | sed -n 's/^password=//p')`, run unsandboxed). See `.claude/projects/.../memory/` notes if present.
