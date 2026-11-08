import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";
import type { ChainAdapter } from "./adapter";
import type { Session, TxHandle, TxRecord } from "./types";
import { NoWallet, Revert, UserRejected, WrongNetwork } from "./chain/errors";

export const AdapterContext = createContext<ChainAdapter>(null as unknown as ChainAdapter);
export const useAdapter = () => useContext(AdapterContext);

/** Re-renders whenever the adapter reports a change (new tx, account switch, ...). */
export function useVersion(): number {
  const a = useAdapter();
  const [v, setV] = useState(a.version);
  useEffect(() => a.subscribe(() => setV(a.version)), [a]);
  return v;
}
export function useSession(): { session: Session | null; networkOk: boolean } {
  const a = useAdapter();
  useVersion();
  return { session: a.session(), networkOk: a.networkOk() };
}

export interface Loaded<T> { data?: T; error?: Error; loading: boolean; reload: () => void }
/** Loads `fn(adapter)` and again whenever the chain changes or `deps` change. Keeps the old data while reloading. */
export function useChain<T>(fn: (a: ChainAdapter) => Promise<T>, deps: unknown[] = []): Loaded<T> {
  const a = useAdapter();
  const version = useVersion();
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    fn(a).then(
      (data) => { if (mine === seq.current) setState({ data, loading: false }); },
      (error) => { if (mine === seq.current) setState({ error, loading: false }); },
    );
  }, [a, version, tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

/** Current unix time in seconds, refreshed every `ms`. */
export function useNow(ms = 1000): number {
  const a = useAdapter();
  const [n, setN] = useState(a.now());
  useEffect(() => { const id = setInterval(() => setN(a.now()), ms); return () => clearInterval(id); }, [a, ms]);
  return n;
}

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "failed" | "rejected" | "error";
export interface TxState { phase: TxPhase; hash?: string; record?: TxRecord; error?: Error }
/**
 * Runs one transaction and tracks its life: signing -> pending -> confirmed | failed, or rejected / error.
 *   const tx = useTx(); tx.run(() => adapter.send(to, amount)); <TxStatusCard state={tx.state} />
 */
export function useTx() {
  const [state, setState] = useState<TxState>({ phase: "idle" });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const run = useCallback(async (start: () => Promise<TxHandle>): Promise<TxRecord | undefined> => {
    setState({ phase: "signing" });
    try {
      const handle = await start();
      if (alive.current) setState({ phase: "pending", hash: handle.hash });
      const record = await handle.confirmed;
      if (alive.current) setState({ phase: record.status === "failed" ? "failed" : "confirmed", hash: record.hash, record });
      return record;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      if (alive.current) setState({ phase: error instanceof UserRejected ? "rejected" : "error", error });
      return undefined;
    }
  }, []);
  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, run, reset, busy: state.phase === "signing" || state.phase === "pending" };
}

/** Name of the failure for the i18n key `err.<name>`. */
export function errorName(e: unknown): string {
  if (e instanceof Revert) return e.reason;
  if (e instanceof UserRejected || e instanceof NoWallet || e instanceof WrongNetwork) return e.name;
  return "generic";
}
