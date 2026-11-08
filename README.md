# ShahContract

`ShahnamehStory` is an original, crowd-written branching story on Ethereum: retold episodes of the Shahnameh in English and Persian,
where readers pick a branch and anyone can write the chapter behind an open branch. The repo also holds a wallet-connected dApp
(story reader, chapter writer, ETH wallet dashboard, guardian recovery, transaction history) that runs against either a simulated
in-browser chain (the public demo) or a real EIP-1193 wallet.

The smart-contract wallet lives in [basic-eth-wallet](https://github.com/R3za22/basic-eth-wallet).

## Contract rules (`contracts/ShahnamehStory.sol`, Solidity 0.8.35)

- A chapter has a title (63 bytes), English and Persian text (1200 bytes together) and either no branches (an ending) or 2 to 3 branches, each with an English and a Persian label of at most 31 bytes (Persian letters take two bytes).
- A branch starts open. The first valid `writeChapter` aimed at it fills it for good; chapters can never be edited.
- Spam limits: byte caps on every string, a per-address cooldown between writes, and the last open branch of the whole story can never be closed.
- `chooseBranch` records a reader's pick once per chapter (popularity only). Events: `ChapterWritten`, `BranchChosen`.

## Run it

```bash
npm install --no-bin-links        # --no-bin-links only for drives that block symlinks
npm test                          # Hardhat (contracts, fuzz, live adapter) + Vitest (ports, mock chain, screens' logic)
npm run lint:sol                  # solhint
npm run dev:demo                  # dApp on a simulated chain
npm run build:demo                # static build in demo/dist-demo, base path /demos/shahnameh/
npm run test:e2e                  # Playwright (needs build:demo first)
```

### Modes

| Mode | How | Chain |
|---|---|---|
| mock (default) | `VITE_CHAIN_MODE=mock` | in-browser simulation, state in `localStorage`, "Reset demo data" in the footer |
| live | `VITE_CHAIN_MODE=live VITE_STORY_ADDRESS=0x… VITE_WALLET_ADDRESS=0x… VITE_CHAIN_ID=11155111` | `window.ethereum` + ethers v6 |

In mock mode nothing leaves the browser. The simulated wallet can act as the owner, guardians and a spender; footer switches force a declined signature, a revert or the wrong network so every state can be seen.

### Deploying (nothing is deployed from this repo)

`npm run deploy:dry` deploys to Hardhat's in-process chain. For Sepolia export `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` yourself (never commit them) and run `npm run deploy:sepolia`; the wallet deploy script is in basic-eth-wallet.

## Tests

- `test/ShahnamehStory.test.ts`: shared scenario file `demo/parity/story-scenarios.json` (also run against the TypeScript port), direct event tests, seeded random model check.
- `contracts/ShahnamehStory.t.sol`: native Hardhat Solidity fuzz tests.
- `test/live-adapter.test.ts`: the live adapter against the real contracts on Hardhat's chain.
- `demo/test`: parity of both ports with the Solidity scenarios, mock chain, story content limits, form logic, i18n key parity.
- `demo/e2e`: Playwright journeys in mock mode, each asserting that no request leaves the origin.

## Content status

The Persian text is a machine draft and has not been reviewed by a native editor; the reader shows a DRAFT notice. The English retelling is original and not a translation of Ferdowsi.

## Licence

MIT, see `LICENSE`. The earlier fork of Adventureum and its browser frontend were removed; `ShahnamehStory` was written from scratch.
