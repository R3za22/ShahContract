import { render } from "preact";
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/vazirmatn/arabic-400.css";
import "@fontsource/vazirmatn/arabic-500.css";
import "@fontsource/vazirmatn/arabic-700.css";
import "./style.css";
import { App } from "./App";
import { applyLang, langStore } from "./i18n";
import { config } from "./config";
import type { ChainAdapter } from "./adapter";
import { MockAdapter } from "./chain/mock";

async function createAdapter(): Promise<ChainAdapter> {
  if (config.mode === "live") {
    const { LiveAdapter } = await import("./chain/live");
    return new LiveAdapter({ storyAddress: config.storyAddress, walletAddress: config.walletAddress, chainId: config.chainId });
  }
  const q = new URLSearchParams(location.search).get("latency");
  return new MockAdapter({ latencyMs: q ? Number(q) : config.mockLatencyMs });
}

applyLang(langStore.get());
createAdapter().then((adapter) => {
  (window as any).__adapter = adapter; // handy for tests and debugging
  render(<App adapter={adapter} />, document.getElementById("app")!);
});
