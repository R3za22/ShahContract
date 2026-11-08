import { createStore } from "./store";

export interface Route { path: string; segments: string[]; query: URLSearchParams }
const parse = (): Route => {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, q = ""] = raw.split("?");
  return { path: path || "/", segments: path.split("/").filter(Boolean), query: new URLSearchParams(q) };
};
export const routeStore = createStore<Route>(parse());
if (typeof window !== "undefined") window.addEventListener("hashchange", () => { routeStore.set(parse()); window.scrollTo(0, 0); });
export const useRoute = () => routeStore.use();
/** navigate("/write", { parent: 7, branch: 2 }) -> #/write?parent=7&branch=2 */
export function href(path: string, query?: Record<string, string | number>): string {
  const q = query ? "?" + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString() : "";
  return `#${path}${q}`;
}
export function navigate(path: string, query?: Record<string, string | number>) { location.hash = href(path, query).slice(1); }
