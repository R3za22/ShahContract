# Story content — DRAFT, owner review required

**Status: DRAFT. Do not publish until Reza has read and approved every line.**

- `story.json` is an original, short retelling of six Shahnameh episodes (Zal and the Simurgh, Rakhsh, the White Demon,
  Rostam and Sohrab, Esfandiyar, Siyavash), English and Persian. It paraphrases the well-known plots; it is not a translation
  or quotation of Ferdowsi's verse, and it takes liberties (the "reunion" ending, episode order) on purpose because it is a
  branching game.
- The Persian text was machine-drafted and has **not** been checked by a native editor. Check grammar, diction and whether the
  tone suits the poem.
- Structure: a tree of 15 chapters. Each chapter = episode number + bilingual title + text + choice labels per language, and `next` pointing
  to the next situation key (`null` = branch deliberately left open for readers to write).
- At runtime the simulated chain seeds these nodes as chapters through the same rules as the contract: branch labels must be <= 31 bytes (Persian letters are 2 bytes), title <= 63 bytes, text (EN + FA) <= 1200 bytes. `demo/test/story-content.test.ts` enforces this.

Review checklist: facts (plot accuracy), taste (tragic endings), Persian wording, anything you would not want under your name.
