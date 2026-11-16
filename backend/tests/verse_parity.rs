//! Parity: the Rust verse engine must answer exactly as the TypeScript engine does.
//!
//! `tests/golden/*.json` is written by `src/lib/multiplayer-golden.test.ts` from the
//! TypeScript engine (`scripts/gen-verse-golden.sh`). Every case here is compared in full:
//! every count, every point, every verdict. If a test fails, one of the two engines is
//! wrong; find out which and fix it. Do not loosen a comparison.

use std::fmt::Debug;
use std::path::PathBuf;

use inspired_mile_api::verse::cards::{card_by_id, CARDS, CHARACTER_NAMES};
use inspired_mile_api::verse::devices::{
    check_device, check_power_words, check_signature, curse_violations, device_for_house, DeviceContext, CURSE_IDS,
    CURSE_PENALTY, CURSE_PENALTY_CAP, DEVICE_IDS, FORBIDDEN_LETTERS, HOUSE_DEVICE, POTION_CURSE, POWER_WORDS_NEEDED,
    POWER_WORD_BONUS, RELIC_WORDS,
};
use inspired_mile_api::verse::duel::{
    match_winner, online_match_winner, online_plan, resolve_online_round, resolve_round, score_verse, Curse, DuelSide,
    MatchWinner, OnlineSide, Rng, RoundPlan, RoundWinner, ScoreInput, VerseScore, ROUNDS,
};
use inspired_mile_api::verse::forms::{
    forms_for_english, get_form, score_form, FormContext, FormScore, ACROSTIC_WORDS, FORMS, FORM_POINTS,
};
use inspired_mile_api::verse::judge::{rules_judge, JudgeSplit, Verdict, CRITERIA, JUDGE_POOL, LEXICON};
use inspired_mile_api::verse::text::{
    clean_verse, content_words, first_unit, first_word, fold, initial, last_unit, last_word, letter_count, line_length,
    lines_of, rhyme_ends, rhyme_key, rhymes, rules, syllables_in_line, syllables_in_word, word_span, words_of,
    MAX_VERSE_CHARS, MAX_VERSE_LINES,
};
use serde_json::{json, Value};

fn golden(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/golden").join(name);
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("{}: {e}. Generate it with scripts/gen-verse-golden.sh", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{} is not JSON: {e}", path.display()))
}

/// Collects every disagreement, so one run shows the whole picture.
struct Report {
    file: &'static str,
    compared: usize,
    wrong: Vec<String>,
}

impl Report {
    fn new(file: &'static str) -> Self {
        Self { file, compared: 0, wrong: Vec::new() }
    }

    fn same<T: PartialEq + Debug>(&mut self, what: impl FnOnce() -> String, rust: &T, typescript: &T) {
        self.compared += 1;
        if rust != typescript {
            self.wrong.push(format!("{}\n      rust:       {rust:?}\n      typescript: {typescript:?}", what()));
        }
    }

    /// Fails unless everything agreed and at least `at_least` values were compared (an
    /// empty or truncated golden file must not pass).
    fn finish(self, at_least: usize) {
        if !self.wrong.is_empty() {
            let shown: Vec<&String> = self.wrong.iter().take(25).collect();
            panic!(
                "{}: {} of {} comparisons disagree with the TypeScript engine. First {}:\n  - {}",
                self.file,
                self.wrong.len(),
                self.compared,
                shown.len(),
                shown.iter().map(|s| s.as_str()).collect::<Vec<_>>().join("\n  - ")
            );
        }
        assert!(
            self.compared >= at_least,
            "{}: only {} comparisons were made; at least {at_least} expected. Is the file complete?",
            self.file,
            self.compared
        );
    }
}

fn text(v: &Value) -> &str {
    v.as_str().unwrap_or_else(|| panic!("expected a string, found {v}"))
}

fn opt_text(v: &Value) -> Option<&str> {
    if v.is_null() { None } else { Some(text(v)) }
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array().unwrap_or_else(|| panic!("expected an array, found {v}")).iter().map(|s| text(s).to_string()).collect()
}

fn short(s: &str) -> String {
    let escaped = format!("{s:?}");
    if escaped.chars().count() > 160 { format!("{}…", escaped.chars().take(160).collect::<String>()) } else { escaped }
}

// --- Shapes shared with the TypeScript writer ---

fn form_json(f: &FormScore) -> Value {
    json!({
        "earned": f.earned,
        "kept": f.kept,
        "checks": f.checks.iter().map(|c| json!({ "id": c.id, "points": c.points, "earned": c.earned, "met": c.met })).collect::<Vec<_>>(),
    })
}

/// A score in the shape the golden files use. The multiplier is carried in quarters on
/// both sides, so that 2 (an integer in JSON) and 2.0 compare as the same number.
fn score_json(s: &VerseScore) -> Value {
    json!({
        "form": form_json(&s.form),
        "device": { "id": s.device.id, "met": s.device.met },
        "signature": s.signature,
        "synergy": s.synergy,
        "multiplier_quarters": quarters(s.multiplier),
        "power": s.power_words.as_ref().map(|p| json!({ "used": p.used, "met": p.met, "bonus": p.bonus })),
        "curse": s.curse.as_ref().map(|c| json!({ "id": c.id, "violations": c.violations, "penalty": c.penalty })),
        "craft": s.craft,
    })
}

fn quarters(multiplier: f64) -> u64 {
    let q = multiplier * 4.0;
    assert_eq!(q.fract(), 0.0, "a multiplier is a whole number of quarters, not {multiplier}");
    q as u64
}

fn expected_score(expect: &Value) -> Value {
    let mut e = expect.clone();
    let m = e["multiplier"].as_f64().expect("multiplier");
    let map = e.as_object_mut().expect("score object");
    map.remove("multiplier");
    map.insert("multiplier_quarters".into(), json!(quarters(m)));
    e
}

fn verdict_name(v: Verdict) -> &'static str {
    match v {
        Verdict::Player => "player",
        Verdict::Opponent => "opponent",
        Verdict::Split => "split",
    }
}

fn judge_json(j: &JudgeSplit) -> Value {
    let criteria: serde_json::Map<String, Value> =
        CRITERIA.iter().zip(j.criteria).map(|(c, v)| (c.to_string(), json!(verdict_name(v)))).collect();
    json!({ "player": j.player, "opponent": j.opponent, "criteria": criteria })
}

struct Side {
    verse: String,
    card_id: String,
    deck: Vec<String>,
    curse: Option<(String, String)>,
    lent: Option<Vec<String>>,
}

fn side(v: &Value) -> Side {
    Side {
        verse: text(&v["verse"]).to_string(),
        card_id: text(&v["cardId"]).to_string(),
        deck: strings(&v["deck"]),
        curse: (!v["curse"].is_null())
            .then(|| (text(&v["curse"]["curseId"]).to_string(), text(&v["curse"]["param"]).to_string())),
        lent: (!v["lent"].is_null()).then(|| strings(&v["lent"])),
    }
}

// --- The tests ---

#[test]
fn cards_json_is_the_catalogue_the_golden_files_were_written_from() {
    // tables.json and cards.json are written by the same run; the lexicon and the names
    // are derived from the cards, so a stale cards.json shows up here.
    let tables = golden("tables.json");
    let mut report = Report::new("tables.json (cards)");
    let mut lexicon: Vec<String> = LEXICON.iter().cloned().collect();
    lexicon.sort();
    let mut want = strings(&tables["lexicon"]);
    want.sort();
    report.same(|| "allusion lexicon".into(), &lexicon, &want);
    report.same(|| "character names".into(), &*CHARACTER_NAMES, &strings(&tables["characterNames"]));
    assert!(CARDS.iter().filter(|c| c.is_character()).count() >= 3);
    report.finish(2);
}

#[test]
fn tables_and_constants_match() {
    let t = golden("tables.json");
    let mut r = Report::new("tables.json");
    let c = &t["constants"];
    for (name, rust) in [
        ("MAX_VERSE_CHARS", MAX_VERSE_CHARS as u64),
        ("MAX_VERSE_LINES", MAX_VERSE_LINES as u64),
        ("FORM_POINTS", u64::from(FORM_POINTS)),
        ("JUDGE_POOL", u64::from(JUDGE_POOL)),
        ("ROUNDS", ROUNDS as u64),
        ("CURSE_PENALTY", u64::from(CURSE_PENALTY)),
        ("CURSE_PENALTY_CAP", u64::from(CURSE_PENALTY_CAP)),
        ("POWER_WORD_BONUS", u64::from(POWER_WORD_BONUS)),
        ("POWER_WORDS_NEEDED", POWER_WORDS_NEEDED as u64),
    ] {
        r.same(|| format!("constant {name}"), &Some(rust), &c[name].as_u64());
    }

    let forms: Vec<Value> = FORMS
        .iter()
        .map(|f| {
            json!({
                "id": f.id,
                "needsSyllables": f.needs_syllables,
                "requirements": f.requirements.iter().map(|q| json!({ "id": q.id, "points": q.points })).collect::<Vec<_>>(),
            })
        })
        .collect();
    r.same(|| "the forms, in order, with their requirements".into(), &Value::Array(forms), &t["forms"]);
    let english: Vec<String> = forms_for_english().iter().map(|f| f.id.to_string()).collect();
    r.same(|| "forms offered in English".into(), &english, &strings(&t["formsForEnglish"]));

    r.same(|| "device ids".into(), &DEVICE_IDS.map(String::from).to_vec(), &strings(&t["devices"]));
    for id in DEVICE_IDS {
        assert!(check_device(id, "", &DeviceContext::default()).is_some(), "device {id} is not implemented");
    }
    let houses = t["houseDevice"].as_object().expect("houseDevice");
    r.same(|| "number of houses with a device".into(), &HOUSE_DEVICE.len(), &houses.len());
    for (house, device) in houses {
        r.same(|| format!("device of house {house}"), &device_for_house(house), &text(device));
    }
    r.same(|| "device of a house without one".into(), &device_for_house("No Such House"), &"question");

    r.same(|| "curse ids".into(), &CURSE_IDS.map(String::from).to_vec(), &strings(&t["curses"]));
    let potions: serde_json::Map<String, Value> = POTION_CURSE.iter().map(|(p, c)| (p.to_string(), json!(c))).collect();
    r.same(|| "potion curses".into(), &Value::Object(potions), &t["potionCurse"]);
    let relics: serde_json::Map<String, Value> = RELIC_WORDS.iter().map(|(id, w)| (id.to_string(), json!(w))).collect();
    r.same(|| "relic words".into(), &Value::Object(relics), &t["relicWords"]);
    r.same(|| "acrostic words".into(), &ACROSTIC_WORDS.map(String::from).to_vec(), &strings(&t["acrosticWords"]));
    r.same(|| "forbidden letters".into(), &FORBIDDEN_LETTERS.map(String::from).to_vec(), &strings(&t["forbiddenLetters"]));
    r.same(|| "criteria".into(), &CRITERIA.map(String::from).to_vec(), &strings(&t["criteria"]));
    // What "long" and "short" mean in English (rulesFor('en') in lang.ts).
    let english_rules = json!({
        "unit": "word",
        "content": rules::CONTENT,
        "riposte": rules::RIPOSTE,
        "grand": rules::GRAND,
        "shortWord": rules::SHORT_WORD,
        "brevity": rules::BREVITY,
        "shortLine": rules::SHORT_LINE,
    });
    r.same(|| "the English thresholds".into(), &english_rules, &t["rules"]);

    for sample in t["rng"].as_array().expect("rng samples") {
        let seed = sample["seed"].as_u64().expect("seed") as u32;
        let mut g = Rng::new(seed);
        let draws: Vec<u64> = (0..8).map(|_| (g.next() * 1e9).floor() as u64).collect();
        let want: Vec<u64> = sample["draws"].as_array().expect("draws").iter().map(|d| d.as_u64().expect("draw")).collect();
        r.same(|| format!("rng({seed})"), &draws, &want);
    }
    r.finish(40);
}

#[test]
fn text_measurement_matches() {
    let t = golden("text.json");
    let mut r = Report::new("text.json");
    for v in t["verses"].as_array().expect("verses") {
        let raw = text(&v["raw"]);
        let at = || short(raw);
        let clean = clean_verse(raw);
        r.same(|| format!("cleanVerse({})", at()), &clean.as_str(), &text(&v["clean"]));
        // Compared in UTF-16 units too: that is the length JavaScript caps.
        r.same(
            || format!("cleanVerse({}) length in UTF-16 units", at()),
            &clean.encode_utf16().count(),
            &text(&v["clean"]).encode_utf16().count(),
        );
        let to_strings = |ls: Vec<&str>| ls.into_iter().map(String::from).collect::<Vec<_>>();
        r.same(|| format!("linesOf(raw {})", at()), &to_strings(lines_of(raw)), &strings(&v["rawLines"]));
        r.same(|| format!("wordsOf(raw {})", at()), &words_of(raw), &strings(&v["rawWords"]));
        let lines = lines_of(&clean);
        r.same(|| format!("linesOf(clean {})", at()), &to_strings(lines.clone()), &strings(&v["lines"]));
        r.same(|| format!("wordsOf(clean {})", at()), &words_of(&clean), &strings(&v["words"]));
        r.same(|| format!("contentWords({})", at()), &content_words(&clean), &strings(&v["content"]));
        r.same(|| format!("firstWord per line of {}", at()), &lines.iter().map(|l| first_word(l)).collect::<Vec<_>>(), &strings(&v["first"]));
        r.same(|| format!("lastWord per line of {}", at()), &lines.iter().map(|l| last_word(l)).collect::<Vec<_>>(), &strings(&v["last"]));
        let lengths: Vec<u64> = lines.iter().map(|l| line_length(l) as u64).collect();
        let want: Vec<u64> = v["lengths"].as_array().expect("lengths").iter().map(|n| n.as_u64().expect("length")).collect();
        r.same(|| format!("lineLength per line of {}", at()), &lengths, &want);
        let edges: Vec<Vec<String>> = lines.iter().map(|l| vec![first_unit(l), last_unit(l)]).collect();
        let want: Vec<Vec<String>> = v["edges"].as_array().expect("edges").iter().map(strings).collect();
        r.same(|| format!("edgeUnit first and last per line of {}", at()), &edges, &want);
        let syllables: Vec<Option<u64>> = lines.iter().map(|l| syllables_in_line(l, "en").map(u64::from)).collect();
        let want: Vec<Option<u64>> = v["syllables"].as_array().expect("syllables").iter().map(Value::as_u64).collect();
        r.same(|| format!("syllablesInLine per line of {}", at()), &syllables, &want);
    }
    for w in t["words"].as_array().expect("words") {
        let word = text(&w["w"]);
        r.same(|| format!("fold({word:?})"), &fold(word).as_str(), &text(&w["fold"]));
        r.same(|| format!("wordSpan({word:?})"), &(word_span(word) as u64), &w["span"].as_u64().expect("span"));
        r.same(|| format!("letterCount({word:?})"), &(letter_count(word) as u64), &w["letters"].as_u64().expect("letters"));
        r.same(|| format!("syllablesInWord({word:?})"), &syllables_in_word(word, "en").map(u64::from), &w["syllables"].as_u64());
        let key: Vec<u64> = rhyme_key(word).into_iter().map(u64::from).collect();
        let want: Vec<u64> = w["key"].as_array().expect("key").iter().map(|u| u.as_u64().expect("unit")).collect();
        r.same(|| format!("rhymeKey({word:?}) in UTF-16 units"), &key, &want);
        r.same(|| format!("initial({word:?})"), &initial(word).as_str(), &text(&w["initial"]));
    }
    for p in t["rhymes"].as_array().expect("rhymes") {
        let (a, b) = (text(&p["a"]), text(&p["b"]));
        r.same(|| format!("rhymes({a:?}, {b:?})"), &rhymes(a, b), &p["rhymes"].as_bool().expect("rhymes"));
    }
    for p in t["ends"].as_array().expect("ends") {
        let (a, b) = (text(&p["a"]), text(&p["b"]));
        let (ea, eb) = rhyme_ends(a, b);
        r.same(|| format!("rhymeEnds({}, {})", short(a), short(b)), &vec![ea, eb], &strings(&p["ends"]));
    }
    r.finish(8000);
}

#[test]
fn devices_curses_signatures_power_words_and_forms_match() {
    let t = golden("checks.json");
    let mut r = Report::new("checks.json");
    let names = &*CHARACTER_NAMES;
    for c in t["devices"].as_array().expect("devices") {
        let (id, verse) = (text(&c["id"]), text(&c["verse"]));
        let opponent_verse = opt_text(&c["opponentVerse"]);
        let met = check_device(id, verse, &DeviceContext { opponent_verse, names }).expect("device exists");
        r.same(|| format!("device {id} on {} (opponent: {:?})", short(verse), opponent_verse.map(short)), &met, &c["met"].as_bool().expect("met"));
    }
    for c in t["curses"].as_array().expect("curses") {
        let (id, param, verse) = (text(&c["id"]), text(&c["param"]), text(&c["verse"]));
        let n = curse_violations(id, verse, param).expect("curse exists");
        r.same(|| format!("curse {id}({param:?}) on {}", short(verse)), &u64::from(n), &c["violations"].as_u64().expect("violations"));
    }
    for c in t["signature"].as_array().expect("signature") {
        let card = card_by_id(text(&c["cardId"])).expect("card exists");
        let verse = text(&c["verse"]);
        r.same(|| format!("signature of {} on {}", card.id, short(verse)), &check_signature(card, verse), &c["met"].as_bool().expect("met"));
    }
    for c in t["power"].as_array().expect("power") {
        let verse = text(&c["verse"]);
        let p = check_power_words(&strings(&c["words"]), verse);
        r.same(|| format!("power words of {} on {}", text(&c["relicId"]), short(verse)), &(p.used, p.met), &(strings(&c["used"]), c["met"].as_bool().expect("met")));
    }
    for c in t["forms"].as_array().expect("forms") {
        let form = get_form(text(&c["formId"])).expect("form exists");
        let acrostic = opt_text(&c["acrostic"]);
        let verse = text(&c["verse"]);
        let s = score_form(form, verse, &FormContext { lang: "en", acrostic });
        let want = json!({ "earned": c["earned"], "kept": c["kept"], "checks": c["checks"] });
        r.same(|| format!("form {} (acrostic {acrostic:?}) on {}", form.id, short(verse)), &form_json(&s), &want);
    }
    r.finish(5000);
}

#[test]
fn score_verse_matches() {
    let cases = golden("score.json");
    let mut r = Report::new("score.json");
    for c in cases.as_array().expect("cases") {
        let s = side(c);
        let form = get_form(text(&c["formId"])).expect("form exists");
        let acrostic = opt_text(&c["acrostic"]);
        let opponent_verse = opt_text(&c["opponentVerse"]);
        let score = score_verse(&ScoreInput {
            verse: &s.verse,
            form,
            ctx: FormContext { lang: "en", acrostic },
            card: card_by_id(&s.card_id).expect("card exists"),
            deck_characters: &s.deck,
            opponent_verse,
            curse: s.curse.as_ref().map(|(id, param)| Curse { curse_id: id, param }),
            lent: s.lent.as_deref(),
        });
        r.same(
            || format!("scoreVerse: form {} ({acrostic:?}), card {}, deck {:?}, curse {:?}, lent {:?}, answering {:?}, verse {}",
                form.id, s.card_id, s.deck, s.curse, s.lent, opponent_verse.map(short), short(&s.verse)),
            &score_json(&score),
            &expected_score(&c["expect"]),
        );
    }
    // The task asks for at least 300 scored verses.
    r.finish(300);
}

#[test]
fn the_rule_based_judge_matches() {
    let cases = golden("judge.json");
    let mut r = Report::new("judge.json");
    for c in cases.as_array().expect("cases") {
        let (player, opponent) = (text(&c["player"]), text(&c["opponent"]));
        let j = rules_judge(player, opponent, "en", &LEXICON);
        r.same(|| format!("rulesJudge({}, {})", short(player), short(opponent)), &judge_json(&j), &c["expect"]);
    }
    r.finish(300);
}

#[test]
fn single_player_rounds_match() {
    let cases = golden("duel.json");
    let mut r = Report::new("duel.json");
    let mut won: Vec<bool> = Vec::new();
    for (i, c) in cases.as_array().expect("cases").iter().enumerate() {
        // Three rounds per match, in order.
        if i % ROUNDS == 0 {
            won.clear();
        }
        let (p, o) = (side(&c["player"]), side(&c["opponent"]));
        let form = get_form(text(&c["formId"])).expect("form exists");
        let result = resolve_round(
            form,
            FormContext { lang: "en", acrostic: opt_text(&c["acrostic"]) },
            &DuelSide {
                verse: &p.verse,
                card: card_by_id(&p.card_id).expect("card exists"),
                deck_characters: &p.deck,
                curse: p.curse.as_ref().map(|(id, param)| Curse { curse_id: id, param }),
                lent: p.lent.as_deref(),
            },
            &DuelSide {
                verse: &o.verse,
                card: card_by_id(&o.card_id).expect("card exists"),
                deck_characters: &o.deck,
                curse: o.curse.as_ref().map(|(id, param)| Curse { curse_id: id, param }),
                lent: o.lent.as_deref(),
            },
            opt_text(&c["previousPlayerVerse"]),
        );
        won.push(result.player_wins);
        let e = &c["expect"];
        let got = json!({
            "playerVerse": result.player_verse,
            "opponentVerse": result.opponent_verse,
            "player": score_json(&result.player),
            "opponent": score_json(&result.opponent),
            "judge": judge_json(&result.judge),
            "playerTotal": result.player_total,
            "opponentTotal": result.opponent_total,
            "winner": if result.player_wins { "player" } else { "opponent" },
            "matchWinner": match_winner(&won).map(|p| if p { "player" } else { "opponent" }),
        });
        let want = json!({
            "playerVerse": e["playerVerse"],
            "opponentVerse": e["opponentVerse"],
            "player": expected_score(&e["player"]),
            "opponent": expected_score(&e["opponent"]),
            "judge": e["judge"],
            "playerTotal": e["playerTotal"],
            "opponentTotal": e["opponentTotal"],
            "winner": e["winner"],
            "matchWinner": e["matchWinner"],
        });
        r.same(|| format!("resolveRound case {i}: form {}, {} against {}", form.id, short(&p.verse), short(&o.verse)), &got, &want);
    }
    r.finish(200);
}

fn winner_name(w: RoundWinner) -> &'static str {
    match w {
        RoundWinner::A => "a",
        RoundWinner::B => "b",
        RoundWinner::Draw => "draw",
    }
}

fn round_winner(name: &str) -> RoundWinner {
    match name {
        "a" => RoundWinner::A,
        "b" => RoundWinner::B,
        "draw" => RoundWinner::Draw,
        other => panic!("unknown round winner {other}"),
    }
}

fn plan_of(v: &Value) -> RoundPlan {
    RoundPlan {
        index: v["index"].as_u64().expect("index") as usize,
        form_id: text(&v["formId"]).to_string(),
        acrostic: opt_text(&v["acrostic"]).map(String::from),
    }
}

#[test]
fn online_plans_rounds_and_matches_match() {
    let t = golden("online.json");
    let mut r = Report::new("online.json");
    for p in t["plans"].as_array().expect("plans") {
        let seed = p["seed"].as_u64().expect("seed") as u32;
        let want: Vec<RoundPlan> = p["plan"].as_array().expect("plan").iter().map(plan_of).collect();
        r.same(|| format!("onlinePlan({seed})"), &online_plan(seed), &want);
    }
    for (i, c) in t["rounds"].as_array().expect("rounds").iter().enumerate() {
        let plan = plan_of(&c["plan"]);
        let read = |v: &Value| (text(&v["charId"]).to_string(), strings(&v["deck"]), text(&v["verse"]).to_string(), opt_text(&v["previousOpponentVerse"]).map(String::from));
        let (a, b) = (read(&c["a"]), read(&c["b"]));
        let out = resolve_online_round(
            &plan,
            &OnlineSide { card: card_by_id(&a.0).expect("card exists"), deck: &a.1, verse: &a.2, previous_opponent_verse: a.3.as_deref() },
            &OnlineSide { card: card_by_id(&b.0).expect("card exists"), deck: &b.1, verse: &b.2, previous_opponent_verse: b.3.as_deref() },
        );
        let criteria: serde_json::Map<String, Value> = CRITERIA
            .iter()
            .zip(out.criteria)
            .map(|(name, v)| {
                let who = match v {
                    Verdict::Player => "a",
                    Verdict::Opponent => "b",
                    Verdict::Split => "split",
                };
                (name.to_string(), json!(who))
            })
            .collect();
        let got = json!({
            "a": { "verse": out.a.verse, "score": score_json(&out.a.score), "judge": out.a.judge, "total": out.a.total },
            "b": { "verse": out.b.verse, "score": score_json(&out.b.score), "judge": out.b.judge, "total": out.b.total },
            "criteria": criteria,
            "winner": winner_name(out.winner),
        });
        let e = &c["expect"];
        let want_side = |s: &Value| json!({ "verse": s["verse"], "score": expected_score(&s["score"]), "judge": s["judge"], "total": s["total"] });
        let want = json!({ "a": want_side(&e["a"]), "b": want_side(&e["b"]), "criteria": e["criteria"], "winner": e["winner"] });
        r.same(|| format!("resolveOnlineRound case {i}: form {}, {} against {}", plan.form_id, short(&a.2), short(&b.2)), &got, &want);
    }
    for m in t["matches"].as_array().expect("matches") {
        let rounds: Vec<(RoundWinner, u32, u32)> = m["rounds"]
            .as_array()
            .expect("rounds")
            .iter()
            .map(|x| (round_winner(text(&x["winner"])), x["totalA"].as_u64().expect("totalA") as u32, x["totalB"].as_u64().expect("totalB") as u32))
            .collect();
        let got = online_match_winner(&rounds).map(|w| match w {
            MatchWinner::A => "a",
            MatchWinner::B => "b",
            MatchWinner::Draw => "draw",
        });
        r.same(|| format!("onlineMatchWinner({rounds:?})"), &got, &opt_text(&m["winner"]));
    }
    r.finish(1000);
}
