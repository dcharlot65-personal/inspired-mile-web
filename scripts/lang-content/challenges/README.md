# Quote challenges in other languages

A challenge depends on the exact words of a line, so a language gets a challenge only where a
published public-domain translation of that line was found. Nothing here is translated by us.

- `sources.tsv`: one row per translation used: translator, year of death, where it is on
  Wikisource, and why it is in the public domain.
- `evidence/<source>.txt`: the lines taken from that source, each with the permanent URL of the
  page revision it was read from and the date. Written only by `wikisource.py take`, which
  copies a line out of a fetched page; nobody types into these files.
- `<lang>.tsv`: the challenges of a language: which English challenge, the line, the missing
  words, the source.

`node scripts/lang-content/verify-challenges.mjs` fails if a line in `<lang>.tsv` is not, character
for character, part of a line in its source's evidence file. (One allowance: Hugo's French prose
marks the original's verse lines with " — "; the quotation may leave that mark out.)

To add a line: `python3 -I wikisource.py grep <lang> <page> <pattern>` to find it, then
`python3 -I wikisource.py take <source id> <lang> <page> <pattern>`, then add the row and run
`build.mjs` and `verify-challenges.mjs`.
