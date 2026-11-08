# Story content — DRAFT, owner review required

**Status: DRAFT. Do not publish until Reza has read and approved every line.**

- `story.json` is an original, short retelling of six Shahnameh episodes (Zal and the Simurgh, Rakhsh, the White Demon,
  Rostam and Sohrab, Esfandiyar, Siyavash), English and Persian. It paraphrases the well-known plots; it is not a translation
  or quotation of Ferdowsi's verse, and it takes liberties (the "reunion" ending, episode order) on purpose because it is a
  branching game.
- The Persian text was machine-drafted and has **not** been checked by a native editor. Check grammar, diction and whether the
  tone suits the poem.
- Structure: a tree of 15 situations. Each situation = episode number + text + choice labels per language, and `next` pointing
  to the next situation key (`null` = path deliberately left unwritten, because Adventure.sol never lets the last open path close).
- At runtime the contract port stores only the situation keys; the text shown comes from this file.
- Because the demo's contract port stores keys (<= 31 bytes each), keys must stay short ASCII.

Review checklist: facts (plot accuracy), taste (tragic endings), Persian wording, anything you would not want under your name.
