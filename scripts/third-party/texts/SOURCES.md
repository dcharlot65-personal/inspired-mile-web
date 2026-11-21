# License texts for the third-party notices

`scripts/third-party-notices.mjs` copies these into `public/licenses/THIRD-PARTY-NOTICES.txt` (Parts 2
and 3). Each was fetched on 2026-11-19 from the address below and is kept byte for byte. Packages that
carry their own license file are not here: the build reads theirs from `node_modules`.

| File | From | sha256 |
|---|---|---|
| `Apache-2.0.txt` | https://www.apache.org/licenses/LICENSE-2.0.txt | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `draco-LICENSE.txt` | https://raw.githubusercontent.com/google/draco/main/LICENSE (last changed in commit 2225d05b, 2023-02-06). The Draco repository has no NOTICE file. three.js's `examples/jsm/libs/draco/README.md` names this license for the decoder it carries. | `d3709b0fb4b8a94bbb1d02b8a2e484f258b0d9c5c5a01f940391f3fe662cd1a4` |
| `basis-universal-LICENSE.txt` | https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/LICENSE (last changed in commit 2e189397, 2026-01-25) | `065fcf48d6af21c0b75e23be5ed5753aee75c892e1c2cf178fa6736305614a5c` |
| `basis-universal-NOTICE.txt` | https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/NOTICE (last changed in commit 0e4cd3e4, 2026-07-01). Which Basis Universal release three.js 0.183.2's transcoder was built from is not recorded in three.js; this is the project's current notice. | `a710c77f53231533f19fbc00e04a7109077f2dec74232b62a96f2ac1a1c04c85` |
| `unicode-license-v3.txt` | https://www.unicode.org/license.txt ("Copyright © 1991-2026 Unicode, Inc."): the notice for the confusables and Unihan data | `e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96` |
| `cldr-rbnf-49.0.0-LICENSE.txt` | The `LICENSE` of the npm package cldr-rbnf 49.0.0 (https://registry.npmjs.org/cldr-rbnf/-/cldr-rbnf-49.0.0.tgz, tarball sha256 `6dc75363…313d`, the one scripts/build-judge-words.mjs pins): CLDR's own copy of the notice, "Copyright © 2001–2026 Unicode, Inc.", which puts CLDR's data under the Unicode License v3 (and keeps the LDML specification, which the game does not use, under Unicode's terms of use). The CLDR words in judge-words.ts are read from that package. Fetched 2026-11-20. | `65eb33419e22a297550a811b5b535f5e532f9a7e0114b516c0ea18afd53c3804` |
| `stopwords-iso-LICENSE.txt` | https://raw.githubusercontent.com/stopwords-iso/stopwords-iso/master/LICENSE (last changed in commit d5514b4f, 2020-03-05). The npm package stopwords-iso 1.1.0 (tarball sha256 `e09c4b23…1130`, the one scripts/build-function-words.mjs pins) carries no license file; its package.json says `"license": "MIT"` and names Gene Diaz as author. | `7f2982f30e863a3c9826dcc51e1ad895d2a78b1f55d4398d0f5eb9b5c0631f13` |
| `opencc-LICENSE.txt` | https://raw.githubusercontent.com/BYVoid/OpenCC/ver.1.1.9/LICENSE (the tag docs/language/NAMES-AND-QUOTATIONS.md records). `NOTICE` at that tag: 404, none. | `b534e465949558eec2597b04f5092b5e161236a68dfbfd04d547592ac3964308` |
| `fflate-LICENSE.txt` | The `LICENSE` of the npm package fflate 0.8.2 (https://registry.npmjs.org/fflate/-/fflate-0.8.2.tgz, tarball sha256 `61fd5061…41dc`, matching the registry's integrity `sha512-cPJU47Oa…`). three.js 0.183.2's `examples/jsm/libs/fflate.module.js` names version 0.8.2 in its header. Fetched 2026-11-19. | `805f6cb28bb8b6d3a0badd83c93bccd9671fa01a3b4b92b7042b0743325ac243` |
| `ktx-parse-LICENSE.txt` | The `LICENSE` of the npm package ktx-parse 1.0.1 (tarball sha256 `277d2ceb…5c1d`, registry integrity `sha512-djwUWv/8…`); 1.0.0 and 1.1.0 carry the same file. three.js's `examples/jsm/libs/ktx-parse.module.js` is a minified build that matches none of those releases' files byte for byte, and three.js does not record the release. Fetched 2026-11-19. | `79847431f9ecef9cf399085cb863452e71a6dab99738f4f0c1ea06c6484b5692` |
| `zstddec-LICENSE.txt` | The `LICENSE` of the npm package zstddec 0.1.0 (tarball sha256 `12c9fe7f…7385`, registry integrity `sha512-w2NTI8+3…`): zstddec's MIT License, then Zstandard's BSD License. The WebAssembly inside three.js's `examples/jsm/libs/zstddec.module.js` (38,976 characters of base64) is the same string as in zstddec 0.1.0's `dist/zstddec.modern.js`; 0.2.0's is different. Fetched 2026-11-19. | `8d078b49fc02bd63c1beaf4ddc629a8b48e4ba6a435415408c8209e2a5c3aacf` |
| `meshoptimizer-LICENSE.md` | The `LICENSE.md` of the npm package meshoptimizer 1.0.0 (tarball sha256 `3bdcef74…b984`, registry integrity `sha512-xsmHsLUF…`); 1.0.1 carries the same file. three.js's `examples/jsm/libs/meshopt_decoder.module.js` (sha256 `97901fb3…1709`) is byte for byte the `meshopt_decoder.mjs` of both. Fetched 2026-11-19. | `e4a26033e3551fb2722888949fbb41e77aee628e8e8f04dcffeee301aa7e5634` |
| `jieba-LICENSE.txt` | https://raw.githubusercontent.com/fxsjy/jieba/67fa2e36e72f69d9134b8a1037b83fbb070b9775/LICENSE (the commit the record pins) | `18ba0984839f85853b29fadaf992f7dba8fd0ca0fbeae34de2b8735222dc7a37` |
| `onnxruntime-LICENSE.txt` | The `onnxruntime/LICENSE` of ONNX Runtime's Python wheels on PyPI, 1.22.0 (`onnxruntime-1.22.0-cp310-cp310-win_amd64.whl`, sha256 `20bca649…59bc9`) and 1.31.0 (`onnxruntime-1.31.0-cp311-cp311-win_arm64.whl`, sha256 `e85c1632…7b096`), which carry the same file; its npm packages carry none (docs/ASSETS.md). The two wheels' `onnxruntime/ThirdPartyNotices.txt` are served, byte for byte, as `public/licenses/onnxruntime-1.22-ThirdPartyNotices.txt` and `onnxruntime-1.31-ThirdPartyNotices.txt`. Fetched 2026-11-19; checked against both wheels again on 2026-11-20. | `c250d6278f0b47a6439fb7592b08b58a55eb9f535aa49a1db63211c3f982b674` |

Apache Lucene's attribution notice (in Part 3) is the first paragraph of
https://raw.githubusercontent.com/apache/lucene/main/NOTICE.txt (sha256 `543e5afa…dbb0` that day); the rest
of that file is about parts of Lucene the game does not use.

The Snowball license is `src/lib/verse/stem/snowball/COPYING`, beside the files it covers; the NAIST notice is
`public/licenses/mecab-ipadic-NOTICE.txt`; the CMU and SCOWL notices are read from
`src/lib/verse/pron-en.ts` itself. SCOWL's is the release's whole `Copyright` file, which
`scripts/build-pronunciation.mjs` copies from the tarball it pins (scowl-2020.12.07.tar.gz, sha256
`5587667c…59cc`) into the table and, byte for byte, into `public/licenses/SCOWL-Copyright.txt`
(sha256 `283326a422e29c510e2ba6805518c418ce3c35ed1fadc3eec83d2da4f6c5a055`, 11,758 bytes); the build fails when
the table's notice does not hold that file whole.
