/** Build-time configuration. In mock mode no contract address is needed. */
const env = (import.meta as any).env as Record<string, string | undefined>;
export const config = {
  mode: (env.VITE_CHAIN_MODE === "live" ? "live" : "mock") as "mock" | "live",
  storyAddress: env.VITE_STORY_ADDRESS ?? "",
  walletAddress: env.VITE_WALLET_ADDRESS ?? "",
  chainId: Number(env.VITE_CHAIN_ID ?? 11155111),
  /** set by build:demo: shows the demo banner */
  demoBanner: env.VITE_DEMO === "1",
  mockLatencyMs: env.VITE_MOCK_LATENCY ? Number(env.VITE_MOCK_LATENCY) : undefined,
};
