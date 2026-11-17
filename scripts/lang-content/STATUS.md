# Play content: where the work stands

One line per finished step, newest last. Whoever continues this branch starts here.

- 2026-11-16 loadArea in the runtime; playground and story pages read page areas; English areas written.
- 2026-11-16 Wikidata items and labels fetched for 238 names (entities.tsv, wikidata-labels.json).
- 2026-11-16 playground area written in all 15 other languages (by the model; not yet machine-checked).
- 2026-11-16 trivia written for es, fr (scripts/lang-content/trivia); build.mjs and check.mjs pass for them.
- 2026-11-16 trivia written for de, it, pt.
- 2026-11-16 trivia written for pl, ru.
- 2026-11-16 trivia written for zh, ja, ko. Left: ar, hi, vi, th, id; then story (all 15), challenges, tests, QA.
- 2026-11-16 trivia written for ar, hi, vi, th, id: all 15 languages have trivia. Left: story (15), challenges, tests, provenance doc, QA pass.
- 2026-11-16 story written in all 15; tests written (play-areas.test.ts, tests/play-i18n.spec.ts). Left: run suites, challenges from Wikisource, provenance doc, spelling/back-translation pass.
- 2026-11-16 quote challenges from Wikisource (Hamlet only): fr 11, de 12, it 10, ru 10, pl 9, es 8; the other nine languages have none and play the English originals, labelled. verify-challenges.mjs checks each line against its evidence.
- 2026-11-16 (second engineer) found the branch as 6869bf1: suites green on the iMac Pro (vitest 136, build, Playwright 164 passed and 2 skipped with E2E_NO_DOWNLOADS=1); OPUS-MT had run over every string of every language, but only the trivia flags of th, hi, ar, vi, id, ko, ja, zh, ru, pl had been read, and align had never run.
- 2026-11-16 read the other 407 OPUS-MT flags (review.tsv). Names: pt-br labels first (the game's Portuguese is Brazilian); names read in the plays' Wikipedia articles for pt, es, it, pl, ko, th (picks.tsv, names-evidence.tsv). Terminology checked with lang/qa-pipeline's glossary from a scratch copy; gender-neutral address in fr, es, pt, pl, ru; trivia 131 Gloucester is an earl. Everything is in qa/fixes.tsv.
- 2026-11-16 searched for quotations in ar, ko, hi, vi, id, pt, th (provenance.mjs says what and where); none reaches the eight a language needs. Thai: Wikisource has no Rama VI translation; vajirayana.org disallows AI agents in robots.txt, so it was not fetched.
- 2026-11-16 qa/labse.py: LaBSE as a second meaning signal (from the shared pipeline's installation).
- 2026-11-16 (second pass, after an independent checker refused the branch) counts by CLDR plural category (countProblems; the score is "Aciertos: {n}" and the like); Arabic English isolated with U+2068/U+2069 (bidi.mjs, build.mjs) and counts out of a total written {n}/{total}; no gender assumed in any language's story (genderedYou).
- 2026-11-16 evidence.mjs: every names-evidence line read in its play's own article, beside the character; 48 lines broke a rule and were re-read, moved or dropped; hand-written name options keyed (trivia-option-handnames.tsv) and checked against sources (handNameProblems); places' Wikidata labels for the earls (fetch-places.py).
- 2026-11-16 Hunspell for ko, th, hi through whole words (qa/words.mjs + the shared hspell): planted words caught, every rejection read. Tsubouchi's lines with their U+3000. Play pages: logical classes, rtl:tracking-normal, the onboarding tooltip in the viewport. Left: OPUS-MT and LaBSE over the strings changed in this pass, when the Studio's load allows.

