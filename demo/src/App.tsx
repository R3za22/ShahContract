import { useEffect } from "preact/hooks";
import type { ChainAdapter } from "./adapter";
import { AdapterContext } from "./hooks";
import { Layout } from "./ui/Layout";
import { useRoute } from "./router";
import { translate, useI18n } from "./i18n";
import { Landing } from "./screens/Landing";
import { Connect } from "./screens/Connect";
import { Reader } from "./screens/Reader";
import { Write } from "./screens/Write";
import { Wallet } from "./screens/Wallet";
import { Recovery } from "./screens/Recovery";
import { History } from "./screens/History";
import { NotFound } from "./screens/NotFound";

function Screen() {
  const route = useRoute();
  switch (route.segments[0] ?? "") {
    case "": return <Landing />;
    case "connect": return <Connect />;
    case "read": return <Reader />;
    case "write": return <Write />;
    case "wallet": return <Wallet />;
    case "recovery": return <Recovery />;
    case "history": return <History />;
    default: return <NotFound />;
  }
}

export function App({ adapter }: { adapter: ChainAdapter }) {
  const { lang } = useI18n();
  useEffect(() => { document.title = translate(lang, "app.title"); }, [lang]);
  return (
    <AdapterContext.Provider value={adapter}>
      <Layout><Screen /></Layout>
    </AdapterContext.Provider>
  );
}
