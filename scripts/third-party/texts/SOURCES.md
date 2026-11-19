# License texts for the third-party notices

`scripts/third-party-notices.mjs` copies these into `public/licenses/THIRD-PARTY-NOTICES.txt` (Parts 2
and 3). Each was fetched on 2026-11-19 from the address below and is kept byte for byte. Packages that
carry their own license file are not here: the build reads theirs from `node_modules`.

| File | From | sha256 |
|---|---|---|
| `Apache-2.0.txt` | https://www.apache.org/licenses/LICENSE-2.0.txt | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `GPL-3.0.txt` | https://www.gnu.org/licenses/gpl-3.0.txt | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` |
| `draco-LICENSE.txt` | https://raw.githubusercontent.com/google/draco/main/LICENSE (last changed in commit 2225d05b, 2023-02-06). The Draco repository has no NOTICE file. three.js's `examples/jsm/libs/draco/README.md` names this license for the decoder it carries. | `d3709b0fb4b8a94bbb1d02b8a2e484f258b0d9c5c5a01f940391f3fe662cd1a4` |
| `basis-universal-LICENSE.txt` | https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/LICENSE (last changed in commit 2e189397, 2026-01-25) | `065fcf48d6af21c0b75e23be5ed5753aee75c892e1c2cf178fa6736305614a5c` |
| `basis-universal-NOTICE.txt` | https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/NOTICE (last changed in commit 0e4cd3e4, 2026-07-01). Which Basis Universal release three.js 0.183.2's transcoder was built from is not recorded in three.js; this is the project's current notice. | `a710c77f53231533f19fbc00e04a7109077f2dec74232b62a96f2ac1a1c04c85` |
| `unicode-license-v3.txt` | https://www.unicode.org/license.txt | `e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96` |
| `stopwords-iso-LICENSE.txt` | https://raw.githubusercontent.com/stopwords-iso/stopwords-iso/master/LICENSE (last changed in commit d5514b4f, 2020-03-05). The npm package stopwords-iso 1.1.0 (tarball sha256 `e09c4b23…1130`, the one scripts/build-function-words.mjs pins) carries no license file; its package.json says `"license": "MIT"` and names Gene Diaz as author. | `7f2982f30e863a3c9826dcc51e1ad895d2a78b1f55d4398d0f5eb9b5c0631f13` |
| `opencc-LICENSE.txt` | https://raw.githubusercontent.com/BYVoid/OpenCC/ver.1.1.9/LICENSE (the tag docs/language/NAMES-AND-QUOTATIONS.md records). `NOTICE` at that tag: 404, none. | `b534e465949558eec2597b04f5092b5e161236a68dfbfd04d547592ac3964308` |
| `jieba-LICENSE.txt` | https://raw.githubusercontent.com/fxsjy/jieba/67fa2e36e72f69d9134b8a1037b83fbb070b9775/LICENSE (the commit the record pins) | `18ba0984839f85853b29fadaf992f7dba8fd0ca0fbeae34de2b8735222dc7a37` |

Apache Lucene's attribution notice (in Part 3) is the first paragraph of
https://raw.githubusercontent.com/apache/lucene/main/NOTICE.txt (sha256 `543e5afa…dbb0` that day); the rest
of that file is about parts of Lucene the game does not use.

The Snowball license is `src/lib/verse/stem/snowball/COPYING`, beside the files it covers; the NAIST notice is
`public/licenses/mecab-ipadic-NOTICE.txt`; the CMU and SCOWL notices are read from
`src/lib/verse/pron-en.ts` itself.
