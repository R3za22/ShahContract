import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: { version: "0.8.35" },
  // Kept apart from the legacy `artifacts/` and `ethereum/build/` outputs checked in from the original fork.
  paths: { sources: "./ethereum/contracts", artifacts: "./hh-artifacts", cache: "./hh-cache", tests: { mocha: "./test" } },
});
