# ShahContract

A branching, crowd-written story as an Ethereum smart contract, plus a static in-browser demo that retells six
episodes of the Shahnameh (Persian epic) in English and Persian, with a guardian-recovery wallet panel.

> **Based on Adventureum by anallergytoanalogy**
> ([blockchain-adventure](https://github.com/anallergytoanalogy/blockchain-adventure)). The contract design and the
> original game idea are theirs. This repository adapts the contract (Solidity 0.8, a game-over fix, tests) and adds a new
> demo and original story text.

## Licence

- **Upstream:** `anallergytoanalogy/blockchain-adventure` has no licence file, so no reuse rights are formally granted.
  Credit is given here and on the demo; permission from the author is being sought before any wider publication.
- **New work in this repository** (demo app, story text, tests, TS ports): © Reza Ghamar, MIT. `Adventure.sol` carries an
  MIT SPDX header added in this fork; that header cannot grant rights the upstream author has not granted.
- The wallet logic in the demo is a port of [R3za22/basic-eth-wallet](https://github.com/R3za22/basic-eth-wallet) (MIT).

## What is here

| Path | What |
|---|---|
| `ethereum/contracts/Adventure.sol` | The story contract: `addSituation`, `addSignature`, `getNextSituation`, ... |
| `test/Adventure.test.ts` | Hardhat 3 tests against the real Solidity |
| `demo/` | Vite + TypeScript static demo, base path `/demos/shahnameh/` |
| `demo/parity/*.json` | Scenarios run against **both** Solidity and the TS ports |
| `demo/content/` | Story text (DRAFT, see its README) |
| `frontend/`, `index.html` | The original Adventureum browser frontend (legacy, unused by the demo) |

## Change from upstream

`pathwayCount += choiceTexts.length - 1` reverts with an arithmetic panic on Solidity 0.8 when a situation has no choices
(a game-over). It is now `pathwayCount = pathwayCount + choiceTexts.length - 1`.

## How the demo works

The demo runs with no network: the story contract and the wallet are TypeScript ports (about 120 lines each), seeded in the page.
An in-browser EVM was rejected: it would exceed the 500 KB gzip budget for a six-function contract. Fidelity is shown by
running the same scenario files against the Solidity (Hardhat) and the ports (Vitest).

```bash
npm install
npm test            # Hardhat contract tests + Vitest (parity, story graph)
npm run dev:demo    # local dev server
npm run build:demo  # writes demo/dist-demo/
npm run test:e2e    # Playwright smoke (needs build:demo first, Chromium)
```

On drives that block symlinks use `npm install --no-bin-links`.
