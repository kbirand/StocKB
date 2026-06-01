import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { PriceTicker } from "./actions/price-ticker";

// Log everything while developing; lower this to WARN for release.
streamDeck.logger.setLevel(LogLevel.INFO);

streamDeck.actions.registerAction(new PriceTicker());

streamDeck.connect();
