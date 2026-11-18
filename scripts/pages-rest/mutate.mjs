// Proves the checks of the localised pages can fail. Run on the build host, in a checkout
// that can be thrown away:
//
//   node scripts/pages-rest/mutate.mjs            the unit tests (vitest)
//   node scripts/pages-rest/mutate.mjs --browser  the browser tests too (needs the E2E_* ports of your own run)
//   node scripts/pages-rest/mutate.mjs --dry      only check that each mutation still applies
//
// Each mutation breaks one thing, runs the test file that should notice, expects it to go
// red with a message that names the damage, and puts the file back. A mutation that leaves
// the tests green is reported as MISSED and the script exits 1: the check it was aimed at
// proves nothing.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const UNIT = 'src/i18n/pages-rest.test.ts';
const ERRORS = 'src/lib/api-errors.test.ts';
const BROWSER = 'tests/pages-rest.spec.ts';
const TERMS = 'src/i18n/pages-rest-terms.test.ts';

/** A string as Wikidata's API writes it into JSON: every character past ASCII as a backslash-u escape. */
const asciiJson = (text) => [...text].map((c) => (c.codePointAt(0) > 127 ? '\\' + 'u' + c.codePointAt(0).toString(16).padStart(4, '0') : c)).join('');

/** [what is broken, file, find, replace, test file, text the failure must contain] */
const UNIT_MUTATIONS = [
  ['a key missing from one language', 'src/i18n/pages/classroom/th.ts', /^  'classroom\.join\.title': .*\n/m, '', UNIT, 'missing classroom.join.title'],
  ['an empty value', 'src/i18n/pages/marketplace/ko.ts', /('market\.buy': )'[^']*'/, "$1' '", UNIT, 'empty market.buy'],
  ['a placeholder renamed', 'src/i18n/pages/tournaments/ru.ts', "'tour.round': 'Раунд {n}'", "'tour.round': 'Раунд {m}'", UNIT, 'tour.round has {m}'],
  ['a placeholder dropped', 'src/i18n/pages/classroom/de.ts', 'Du bist „{name}“ beigetreten.', 'Du bist beigetreten.', UNIT, 'classroom.join.done has {}'],
  ['a stray brace', 'src/i18n/pages/season/it.ts', "'season.level': 'Livello'", "'season.level': 'Livello}'", UNIT, 'stray brace in season.level'],
  ['a plural form the language needs is gone', 'src/i18n/pages/shared/pl.ts', /^  'credits\.few': .*\n/m, '', UNIT, 'credits lacks the "few" form'],
  ['an Arabic plural form is gone', 'src/i18n/pages/classroom/ar.ts', /^  'classroom\.members\.two': .*\n/m, '', UNIT, 'classroom.members lacks the "two" form'],
  ['a string left in English', 'src/i18n/pages/viewer/ja.ts', /('viewer\.reset': )'[^']*'/, "$1'Reset the camera'", UNIT, 'viewer.reset is still English'],
  ['a French colon without its no-break space', 'src/i18n/pages/classroom/fr.ts', "'classroom.list.code': 'Code\\u00a0:'", "'classroom.list.code': 'Code :'", UNIT, 'needs a no-break space before :'],
  ['a German ellipsis without its no-break space', 'src/i18n/pages/marketplace/de.ts', "'Karten suchen\\u00a0…'", "'Karten suchen…'", UNIT, 'German puts a no-break space before'],
  ['a Hindi sentence ended with a full stop', 'src/i18n/pages/shared/hi.ts', 'पहले साइन इन करें।', 'पहले साइन इन करें.', UNIT, 'danda'],
  ['a Cyrillic letter hiding in a Latin word', 'src/i18n/pages/shared/es.ts', "'activity.challenge': 'Desafío'", "'activity.challenge': 'Dеsafío'", UNIT, 'mixes Latin and Cyrillic'],
  ['a key that the core locale already has', 'src/i18n/pages/shared/en.ts', "  'activity.trivia': 'Trivia',", "  'activity.trivia': 'Trivia',\n  'nav.home': 'Home',", UNIT, 'nav.home'],
  ['a nav name that differs from the core locale', 'src/i18n/pages/shared/fr.ts', "'offline.link.home': 'Accueil'", "'offline.link.home': 'Maison'", UNIT, 'Maison'],
  ['a page asks for a key nobody has', 'src/pages/season.astro', 'data-i18n="season.track"', 'data-i18n="season.trakc"', UNIT, 'season.trakc'],
  ['a script asks for a key nobody has', 'src/pages/tournaments.astro', "t('tour.bye')", "t('tour.byee')", UNIT, 'tour.byee'],
  ['a viewer library goes back to an English sentence', 'src/lib/splat-viewer.ts', "this.options.onStatusChange?.(msg('viewer.status.loading'));", "this.options.onStatusChange?.('Loading splat model...' as any);", UNIT, 'splat-viewer'],
  ['the offline page is stale', 'public/offline.html', 'data-k="title">You are offline<', 'data-k="title">You are Offline<', UNIT, 'public/offline.html is out of date'],
  ['the manifest lost a language', 'public/manifest.json', /^\s*"th": "Sonnet Man[^\n]*\n/m, '', UNIT, 'public/manifest.json is out of date'],
  ['the manifest’s English renamed with no new translations', 'public/manifest.json', '"name": "Sonnet Man: the duel of verses"', '"name": "Sonnet Man: verses at dawn"', UNIT, 'translate the new English'],
  ['Thai "sign in" spelt otherwise than the core locale', 'src/i18n/pages/shared/th.ts', "'error.not_signed_in': 'โปรดเข้าสู่ระบบก่อน'", "'error.not_signed_in': 'โปรดลงชื่อเข้าใช้ก่อน'", UNIT, 'sign in is written ลงชื่อเข้าใช้'],
  ['a Vietnamese tone mark placed otherwise than the core locale', 'src/i18n/pages/pwa/vi.ts', 'Trình duyệt sẽ không tự xóa.\',\n  \'pwa.storage.keptNoSize\'', 'Trình duyệt sẽ không tự xoá.\',\n  \'pwa.storage.keptNoSize\'', UNIT, 'tone mark in oa, oe, uy is written oá'],
  ['Hindi "Shakespeare" spelt otherwise than the core locale', 'src/i18n/pages/marketplace/hi.ts', 'साथ शेक्सपियर के', 'साथ शेक्सपीयर के', UNIT, 'Shakespeare is written शेक्सपीयर'],
  ['a shortcut named otherwise than the site names the place', 'src/i18n/pages/shared/de.ts', "'app.shortcut.battle': 'Kampfarena'", "'app.shortcut.battle': 'Kampfplatz'", UNIT, 'Kampfplatz'],
  ['src/lib/pwa.ts says an English sentence again', 'src/lib/pwa.ts', "title: say('pwa.install.title'),", "title: 'Install Sonnet Man first',", UNIT, 'pwa.install.title'],
  ['sizes written the English way whatever the language', 'src/lib/pwa.ts', 'return new Intl.NumberFormat(intlLocale(), { style: \'unit\'', 'return new Intl.NumberFormat(\'en\', { style: \'unit\'', UNIT, 'Go'],
  ['the install guidance loses a Japanese string', 'src/i18n/pages/pwa/ja.ts', /^  'pwa\.install\.dismiss': .*\n/m, '', UNIT, 'missing pwa.install.dismiss'],
  ['loadArea stops filling in English for a missing string', 'src/i18n/index.ts', "for (const code of l === 'en' ? ['en'] : ['en', l])", "for (const code of [l])", UNIT, "'Join'"],
  // The redraw meets the English of the area, which is what the player would see.
  ['a page redraws before its areas are in the new language', 'src/i18n/page.ts', 'void areasReady().then(() => {', 'void Promise.resolve().then(() => {', UNIT, "'de: Claim'"],
  ['the server gains an answer nobody mapped', 'backend/src/classroom/handlers.rs', '"Invalid join code".into()', '"That join code has expired".into()', ERRORS, 'That join code has expired'],
  ['the server gains a code nobody translated', 'backend/src/auth/email.rs', '"email_in_use"', '"email_is_taken"', ERRORS, 'no message for "email_is_taken"'],
  ['a language loses an error sentence', 'src/i18n/pages/shared/vi.ts', /^  'error\.tournament_full': .*\n/m, '', ERRORS, 'vi: no message for "tournament_full"'],
  ['an error sentence left in English', 'src/i18n/pages/shared/hi.ts', /('error\.listing_own': )'[^']*'/, "$1'You cannot buy your own listing.'", ERRORS, 'hi: the message for "listing_own" is still English'],
  ['an error sentence needs a variable nothing supplies', 'src/i18n/pages/shared/es.ts', 'Este torneo está completo.', 'Este torneo está completo: {max}.', ERRORS, 'needs {max}'],
  ['the page shows the server’s text again', 'src/lib/api-errors.ts', '  const code = apiErrorCode(e);\n  const vars', '  if (e instanceof ApiError && e.body && !e.code) return e.body;\n  const code = apiErrorCode(e);\n  const vars', ERRORS, 'relation'],
  ['a client library throws a sentence again', 'src/lib/tournament-client.ts', 'throw new ApiError(response.status, await response.text())', 'throw new Error(`API ${response.status}: ${await response.text()}`)', ERRORS, 'tournament-client'],
  // Found by the independent checker of 2026-11-16 (its M3, M12, M14) or by the fixes after it.
  ['a plural form the language does not have (Russian "two")', 'src/i18n/pages/shared/ru.ts', "  'credits.one': '{n} кредит',", "  'credits.one': '{n} кредит',\n  'credits.two': '{n} кредита',", UNIT, 'credits has a "two" form, which CLDR does not give ru'],
  ['Russian "one" written out, though it is also 21, 31, 101', 'src/i18n/pages/shared/ru.ts', "'credits.one': '{n} кредит'", "'credits.one': 'один кредит'", UNIT, 'ru: credits.one has {} but English has {n}'],
  ['French "one" written out, though it is also 0', 'src/i18n/pages/shared/fr.ts', "'credits.one': '{n} crédit'", "'credits.one': 'un crédit'", UNIT, 'fr: credits.one has {} but English has {n}'],
  ['a Hindi gender hedge again', 'src/i18n/pages/classroom/hi.ts', 'मुझे पता है कि मेरे शिक्षक', 'मैं समझता/समझती हूँ कि मेरे शिक्षक', UNIT, 'a gender hedge "समझता/समझती"'],
  ['a Polish gender hedge in brackets', 'src/i18n/pages/classroom/pl.ts', "'Uczę, prowadzę szkolenia", "'Uczyłe(ła)m, prowadzę szkolenia", UNIT, 'a gender hedge in brackets'],
  ['Arabic و standing apart from a Latin name', 'src/i18n/pages/viewer/ar.ts', 'Quest 3 وVision Pro', 'Quest 3 و Vision Pro', UNIT, 'و stands apart'],
  ['the Arabic manifest values without their direction', 'scripts/pages-rest/build-static.mjs', "RTL.includes(l) ? { value, dir: 'rtl' } : value", 'value', UNIT, 'public/manifest.json is out of date'],
  ['a third Thai word for virtual reality on the VR page', 'src/i18n/pages/viewer/th.ts', "'vr.badge': 'ความเป็นจริงเสมือน'", "'vr.badge': 'โลกเสมือนจริง'", TERMS, 'vr/th: vr.badge does not say'],
  ['Thai virtual reality back to the word the branch had', 'src/i18n/pages/viewer/th.ts', "'vr.badge': 'ความเป็นจริงเสมือน'", "'vr.badge': 'ความจริงเสมือน'", TERMS, 'vr/th: vr.badge does not say'],
  ['Polish virtual reality back in the reversed order', 'src/i18n/pages/viewer/pl.ts', "'vr.badge': 'Rzeczywistość wirtualna'", "'vr.badge': 'Wirtualna rzeczywistość'", TERMS, 'vr/pl: vr.badge does not say'],
  ['the German Vision Pro gesture back to pinching skin', 'src/i18n/pages/viewer/de.ts', 'tippe dann deinen Zeigefinger und Daumen zusammen, um sie auszuwählen', 'kneif, um sie auszuwählen', TERMS, 'select_gesture/de: vr.card.vision.body does not say'],
  ['Spanish "the teaching staff" beside "docente"', 'src/i18n/pages/classroom/es.ts', 'Los docentes crean clases, ponen', 'El profesorado crea clases, pone', TERMS, 'teacher/es: classroom.meta.description does not say'],
  ['the Japanese bye recorded as Wikidata’s', 'docs/language/pages-rest-terms.json', /("ja": \{\n\s*"word": "不戦勝",\n\s*"rel": )"none"/, '$1"same"', TERMS, 'bye/ja: "不戦勝" is said to be Wikidata'],
  ['the Japanese bye’s verdict claiming Wikidata again', 'docs/language/pages-rest-meaning.json', "the bye, 不戦勝: the model's word, no source in this language (terms record)", 'the bye, as Wikidata labels it (Q1268659) or, where it has no usable label, a description (Tournaments table)', TERMS, 'which the terms record says is the model\'s word'],
  ['a saved Wikidata answer that no longer has the Thai label the record cites', 'docs/language/sources/pages-rest-wikidata-terms-b.json', `"th":{"language":"th","value":"${asciiJson('ความเป็นจริงเสมือน')}"}`, `"th":{"language":"th","value":"${asciiJson('ความจริงเสมือน')}"}`, TERMS, 'vr/th: "ความเป็นจริงเสมือน" is said to be Wikidata'],
  ['a term table of the doc edited by hand', 'docs/language/pages-rest.md', '| th | ครู =', '| th | ครู (Wikidata) =', TERMS, 'the term tables are stale'],
  // Found by the second checker of 2026-11-16, or by the merge of integrate/wave3 (2026-11-17).
  ['the French "many" form a copy of "other" again', 'src/i18n/pages/shared/fr.ts', "'credits.many': '{n} de crédits'", "'credits.many': '{n} crédits'", UNIT, 'credits.many must join the number to its noun with "de"'],
  ['the Portuguese "many" form a copy of "other" again', 'src/i18n/pages/classroom/pt.ts', "'classroom.members.many': '{n} de membros'", "'classroom.members.many': '{n} membros'", UNIT, 'classroom.members.many must join the number to its noun with "de"'],
  ['a saved CLDR pair that no longer joins the million with de', 'docs/language/sources/pages-rest-cldr-minimal-pairs.json', '"many": "{0}\u00a0de jours"', '"many": "{0}\u00a0jours"', UNIT, 'minimal pairs do'],
  ['a Korean particle hedge after the privacy link again', 'src/i18n/pages/classroom/ko.ts', "'을 읽었으며,", "'을(를) 읽었으며,", UNIT, 'a Korean particle hedge in brackets'],
  ['the Korean particle a vowel takes, after a link that ends in a consonant', 'src/i18n/pages/classroom/ko.ts', "'을 읽었으며,", "'를 읽었으며,", UNIT, 'which takes 을, not 를'],
  ['Spanish RV beside the core’s Galería VR', 'src/i18n/pages/viewer/es.ts', "'vr.enter': 'Entrar en VR'", "'vr.enter': 'Entrar en RV'", UNIT, 'vr.enter writes RV'],
  ['French RA beside VR', 'src/i18n/pages/viewer/fr.ts', "'viewer.ar': 'Voir en AR'", "'viewer.ar': 'Voir en RA'", UNIT, 'viewer.ar writes RA'],
  ['Thai bare งาน for an assignment in an error sentence', 'src/i18n/pages/shared/th.ts', "'error.assignment_title_invalid': 'ชื่องานที่มอบหมายต้องมี", "'error.assignment_title_invalid': 'ชื่องานต้องมี", TERMS, 'assignment/th: error.assignment_title_invalid does not say'],
  ['a sign-in code of the merged server loses its Japanese sentence', 'src/i18n/pages/shared/ja.ts', /^  'error\.cross_site_request': .*\n/m, '', ERRORS, 'ja: no message for "cross_site_request"'],
  ['a server text the merged server no longer says, back in the table', 'src/lib/api-errors.ts', "  ['Something went wrong on our side. Please try again.', 'server_error'],\n", "  ['Something went wrong on our side. Please try again.', 'server_error'],\n  [/^DB error: /, 'server_error'],\n", ERRORS, '/^DB error: /'],
  ['the Rust scan stops finding anything', 'src/lib/api-errors.test.ts', "const SKIP_DIRS = ['multiplayer'];", "const SKIP_DIRS = ['multiplayer', 'classroom', 'marketplace', 'tournaments', 'seasons', 'credits', 'auth', 'stats', 'referral', 'variants', 'inventory', 'migration'];", ERRORS, 'toBeGreaterThan'],
];

// A date without a time used to be shown a day early west of Greenwich. The mutation that
// undoes the fix can only be seen from such a time zone, so it is tried only there.
if (new Date(2026, 10, 1).getTimezoneOffset() > 0) {
  UNIT_MUTATIONS.push(['a date without a time read as midnight UTC', 'src/i18n/fmt.ts', "const day = typeof d === 'string' ?", "const day = typeof d === 'no' ?", UNIT, 'Nov 1, 2026']);
} else {
  console.log('SKIPPED the date-only mutation: this machine is not west of Greenwich, where the fault shows');
}

/** The same for the browser tests: [what, file, find, replace, test title that must go red] */
const BROWSER_MUTATIONS = [
  // The locale file itself says English: the unit test catches it, and so must the page test,
  // which until 2026-11-16 took whatever reads the same as English to be meant (MISSED).
  ['English left in the Spanish marketplace', 'src/i18n/pages/marketplace/es.ts', /('market\.sell\.title': )'[^']*'/, "$1'Create a listing'", 'marketplace: every language'],
  // The page's script writes an English sentence of its own, with no key at all.
  ['the marketplace script writes English itself', 'src/pages/marketplace.astro', "${esc(t(sale ? 'market.buy' : 'market.offer'))}", "${esc(sale ? t('market.buy') : 'Offer a trade')}", 'marketplace: every language'],
  ['an element of the classroom page without its key', 'src/pages/classroom.astro', ' data-i18n="classroom.gate.title">', '>', 'classroom: every language'],
  ['a placeholder never filled on the season page', 'src/pages/season.astro', "t('season.next', { n: num(progress.xpToNext) })", "t('season.next')", 'season: every language'],
  ['a key shown as text on the tournaments page', 'src/pages/tournaments.astro', "esc(t('tour.viewBracket'))", "esc(t('tour.viewBrackets'))", 'tournaments: every language'],
  ['a block wider than a phone on the viewer page', 'src/pages/viewer.astro', '<p class="text-obsidian-400 max-w-2xl mx-auto" data-i18n="viewer.intro">', '<p class="text-obsidian-400 w-[640px]" data-i18n="viewer.intro">', 'viewer: every language'],
  ['Arabic no longer right to left on the offline page', 'public/offline.html', "RTL.indexOf(locale) >= 0 ? 'rtl' : 'ltr'", "'ltr'", 'speaks the language the player chose'],
  ['the server’s text shown when the API fails', 'src/i18n/page.ts', '  return apiErrorMessage(e, t, has, num);', "  return (e as any)?.body || apiErrorMessage(e, t, has, num);", 'a broken server is reported'],
  ['a classroom name run as markup', 'src/pages/classroom.astro', '<bdi>${esc(c.name)}</bdi>', '<bdi>${c.name}</bdi>', 'never run as markup'],
  ['the install box not drawn again when the language changes', 'src/lib/pwa.ts', "if (document.getElementById('pwa-install')) void showInstall();", 'void 0;', 'names Apple’s own buttons'],
  ['Japanese lines break anywhere again', 'src/styles/global.css', '  word-break: auto-phrase;\n  line-break: strict;\n', '  word-break: normal;\n', 'no line opens with ー'],
  ['the status of a tournament shown as the server spells it', 'src/pages/tournaments.astro', "const statusName = (status: string) => (has(`tour.status.${status}`) ? t(`tour.status.${status}`) : status.replace(/_/g, ' '));", "const statusName = (status: string) => status.replace(/_/g, ' ');", 'tournaments: states, formats'],
];

function run(command) {
  try {
    return { ok: true, out: execSync(`${command} 2>&1`, { encoding: 'utf8', maxBuffer: 256e6 }) };
  } catch (err) {
    return { ok: false, out: String(err.stdout ?? '') + String(err.stderr ?? '') };
  }
}

function mutate(file, find, replace) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(find, replace);
  if (after === before) throw new Error(`${file}: ${String(find).slice(0, 80)} is no longer there; update this mutation`);
  writeFileSync(file, after);
  return () => writeFileSync(file, before);
}

let wrong = 0;

// --dry: only check that every mutation still finds what it breaks (no test is run).
if (process.argv.includes('--dry')) {
  let stale = 0;
  for (const [what, file, find] of [...UNIT_MUTATIONS, ...BROWSER_MUTATIONS]) {
    const text = readFileSync(file, 'utf8');
    const found = typeof find === 'string' ? text.includes(find) : find.test(text);
    if (!found) {
      stale++;
      console.log(`STALE  ${what}: ${file}`);
    }
  }
  console.log(`${UNIT_MUTATIONS.length} unit and ${BROWSER_MUTATIONS.length} browser mutations, ${stale} stale`);
  process.exit(stale ? 1 : 0);
}

// First, unbroken: a suite that is already red cannot show that a mutation turned it red.
for (const file of [UNIT, ERRORS, TERMS]) {
  const clean = run(`npx vitest run ${file}`);
  console.log(`${clean.ok ? 'GREEN  ' : 'RED    '} ${file} before any mutation`);
  if (!clean.ok) {
    console.log(clean.out.split('\n').slice(-40).join('\n'));
    process.exit(1);
  }
}

for (const [what, file, find, replace, test, expected] of UNIT_MUTATIONS) {
  const restore = mutate(file, find, replace);
  let result;
  try {
    result = run(`npx vitest run ${test}`);
  } finally {
    restore();
  }
  // vitest prints a string inside an array with its quotation marks escaped (\"few\").
  const caught = !result.ok && (result.out.includes(expected) || result.out.replace(/\\"/g, '"').includes(expected));
  console.log(`${caught ? 'CAUGHT ' : result.ok ? 'MISSED ' : 'RED, BUT NOT FOR THIS '} ${what}`);
  if (!caught) {
    wrong++;
    console.log(result.out.split('\n').filter((l) => /AssertionError|Error:|expected|✗|×|FAIL/.test(l)).slice(0, 12).join('\n'));
  }
}

if (process.argv.includes('--browser')) {
  const line = (out, name) => out.split('\n').filter((l) => l.includes(name) && /[✓✘×]|\bok\b|failed/.test(l));
  for (const [what, file, find, replace, title] of BROWSER_MUTATIONS) {
    const restore = mutate(file, find, replace);
    let result;
    try {
      result = run(`npx playwright test ${BROWSER} --reporter=list -g "${title.replace(/"/g, '\\"')}"`);
    } finally {
      restore();
    }
    const lines = line(result.out, title);
    const caught = !result.ok && lines.some((l) => /✘|×/.test(l));
    console.log(`${caught ? 'CAUGHT ' : 'MISSED '} ${what}`);
    if (!caught) {
      wrong++;
      console.log(result.out.split('\n').slice(-15).join('\n'));
    }
  }
}

console.log(wrong ? `${wrong} mutation(s) were not caught` : 'every mutation was caught');
process.exit(wrong ? 1 : 0);
