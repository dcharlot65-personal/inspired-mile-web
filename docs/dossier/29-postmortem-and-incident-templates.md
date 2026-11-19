# Sonnet Man: postmortem and incident review templates

- **Purpose:** two fill-in templates, one for looking back after a milestone, a launch or a season, and one blameless review for any incident, including incidents caused by AI output, by player content or by a licence or privacy failure. A worked example shows each in use.
- **Audience:** the team (David Charlot, founder and technical lead; Devon Glover, "The Sonnet Man", creative director; Arrocito del Diablo, co-founder for game design and card mechanics), future collaborators, contractors and coding agents who run a milestone or handle an incident.
- **As of:** commit `0d6df6ef` (branch `integrate/wave3`, 2026-11-18), plus the release in flight on 2026-11-19: `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p`, `fix/compliance` and the nightly database backup.
- **Status:** Draft for the team, 2026-11-19.
- **Related documents:** `00-README.md`, `15-qa-and-test-plan.md` (severity levels, §9), `17-operations-runbook-and-launch-checklist.md` (incident response, §7; deploy log, §9), `18-trust-and-safety-plan.md` (reports and takedowns), `19-privacy-pack.md` (rights requests and breaches), `21-production-plan-and-roadmap.md` (milestones, §4 and §7.3), `22-risk-register.md`, `28-owner-decisions.md`, `research/sota-production-2026-11.md` §7.21.

**Labels.** *As built*: true of the code or the record at `0d6df6ef`. *In this release*: decided and on a named branch, not yet live. *Proposed*: a recommendation. Everything in this document is *Proposed* except the facts in the worked examples, which are labelled.

---

## 1. Why the project needs these now

- **As built:** no postmortem or incident review is on record. The roadmap mentions "a short postmortem" after each milestone (`21-production-plan-and-roadmap.md` §7.3), and the runbook has incident playbooks but no review form (`17-operations-runbook-and-launch-checklist.md` §7).
- **The research** lists a postmortem as a standard game-development document: the classic form is vital stats, what went right, what went wrong and a conclusion; incident reviews are blameless and record a timeline, the impact, the root cause and the actions. For this game it asks for a template in the repository, run after each milestone and season, and a blameless incident template "that covers AI-output incidents as well as outages" (`research/sota-production-2026-11.md` §7.21).
- **The project's own history argues for it.** The November 2026 revival made 659 commits in three days (`21-production-plan-and-roadmap.md` §2). One change in it, to the judge's wording, cut the languages the model could judge from 14 to 4 in an A/B on the same code, and was caught only by measurement (`sources/as-built-tech.md` §4.2). A written review is how such a lesson outlives the session that found it.

**Blameless** means the review asks what in the system let the failure happen, never who to blame. People, including coding agents, act on what they could see at the time. A review that punishes produces reviews that hide.

---

## 2. When to write which

| Event | Template | Written by | Within |
|---|---|---|---|
| A milestone in `21-production-plan-and-roadmap.md` ends (M0 is this release) | A: milestone or season postmortem | the milestone's owner | 2 weeks |
| A season ends (`25-live-ops-plan.md` §4) | A | David Charlot, with Arrocito del Diablo for balance | 2 weeks |
| A severity 1 or 2 incident (`17-operations-runbook-and-launch-checklist.md` §7.1) | B: incident review | the incident lead | 5 working days |
| **Any AI-output incident**: a model verse or verdict that is harmful, off-topic, in the wrong language, written "as" a real person, or that a planted instruction steered | B, with section B.7 | David Charlot | 5 working days, whatever the severity |
| **Any player-content incident**: a report that needed a takedown, any child-safety report, any report about Devon Glover's name or card | B, with section B.8 | the named responsible person (`18-trust-and-safety-plan.md`) | 5 working days; legal clocks may be shorter (B.9) |
| **Any licence or privacy finding**: shipped code or data without its licence's conditions, a broken privacy promise, a data breach | B, with section B.9 | David Charlot | 5 working days; a breach starts legal clocks at once |
| A test or gate that passed when it should have failed | B (severity 3) | whoever found it | 5 working days |

Keep every review in `docs/postmortems/` (Proposed folder), one file each, named `YYYY-MM-DD-short-name.md`. Link it from the deploy and drill log (`17-operations-runbook-and-launch-checklist.md` §9), and add any decision it raises to `28-owner-decisions.md`.

---

## 3. Template A: milestone, launch or season postmortem

Copy this block into a new file and fill every field. Write "Not known" rather than leave a field empty.

```markdown
# Postmortem: <milestone or season name>

- Dates: <start> to <end> (planned: <start> to <end>)
- Written by: <name>, <date>. Read by: <names>
- Commits: <first>..<last> (<count> commits; <count> merges)

## 1. Vital stats
| Measure | Planned | Actual |
|---|---|---|
| Scope items (from 21's milestone list) | | |
| Items shipped / cut / moved | | |
| Tests added; gates run before deploy | | |
| Players in the period (accounts; weekly active) | | |
| First-duel funnel (landing → first verse → first duel finished) | | |
| AI playtest runs: time to a first valid verse, voids, rounds won against each opponent, where players got stuck (per AI player and model family) | | |
| D1 / D7 return (if measured) | | |
| Incidents (by severity) and their reviews | | |
| Reports received; median time to read | | |
| Spend (if any) | | |

## 2. What went right (three to five)
For each: what happened, why it worked, and how to keep it.

## 3. What went wrong (three to five)
For each: what happened, what it cost, the cause in the system (not a person), and what changes.

## 4. What AI playtests and players' reports showed us
AI playtest findings (15-qa-and-test-plan.md §8: name the AI player, its version and what was measured; never present an AI result as what people would do), report themes, support questions. Quote players only with consent.

## 5. Against the pillars
For each pillar in 01-concept-one-pager.md: did the period make it stronger or weaker? Evidence.

## 6. Actions
| # | Action | Owner | Due | Where it is tracked |
|---|---|---|---|---|

## 7. Decisions for the owner
Each one added to 28-owner-decisions.md, with its options: decided by default where the standing rules or the evidence give an answer; open only if it needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved.

## 8. Documents to update
Which dossier documents this period made stale (see 00-README.md, "Keeping it current").
```

**Rules for Template A.**
- Numbers come from the record (git, the test logs, the analytics plan in `16-analytics-and-tracking-plan.md`), never from memory. Where nothing was measured, say so: that is itself a finding.
- Name the cause in the system: a missing gate, an unclear rule, a branch left open too long.
- A public "making of" version is a separate, edited document. Anything in it about Devon Glover is his to approve in writing (`07-narrative-and-performer-bible.md` §8).

---

## 4. Template B: blameless incident review

```markdown
# Incident review: <short name>

- Severity: S1 / S2 / S3 / S4 (17 §7.1)   Kind: outage / wrong scores / AI output / player content / licence / privacy / other
- Detected: <UTC time> by <monitor, player report, test, review>   Resolved: <UTC time>
- Incident lead: <name>   Review written by: <name>, <date>   Read by: <names>
- Status: draft / final

## B.1 Summary
Two or three sentences: what happened, to whom, for how long, and that it is fixed (or not).

## B.2 Impact
| Who or what | How many | How badly |
|---|---|---|
| Players (by age tier where it matters) | | |
| Languages, devices, modes affected | | |
| Data (lost, exposed, wrong) | | |
| Promises broken (privacy policy, terms, licence) | | |

## B.3 Timeline (UTC)
| Time | What happened or was done | Source (log line, commit, message) |
|---|---|---|

## B.4 How it was found, and how it could have been found sooner
Which monitor, test or person saw it. Which check would have caught it earlier.

## B.5 Causes
- Trigger: the change or event that set it off.
- Contributing causes: what in the system let the trigger do harm (a missing test, a gate skipped,
  an unmeasured language, a rule no one wrote down). Ask "why" until the answer is something the
  team can change.
- What went well; where we were lucky.

## B.6 Actions
| # | Action (prevent, detect sooner, or reduce harm) | Owner | Due | Done |
|---|---|---|---|---|

## B.7 For AI-output incidents
- Model, revision and size; tier; device class; browser.
- Duel language; form; card in play (was it SM-001, The Sonnet Man?).
- What the model was asked (the prompt as the code builds it) and what it returned (the output,
  kept only as long as the review needs it).
- Which guard should have stopped it: the form checks, the thin-verse rule, the judge-line
  filter, the both-orders comparison, a topic guard, a classifier, the fallback to the written
  opponent. Which one failed, and why.
- Was the output shown to a player? Labelled as AI? Would the Article 50(1) notice have told the
  player a model wrote it?
- Re-measure: which cells of the model evaluation must run again before the model is offered
  again in that language (13-ai-design-and-system-cards.md §9).

## B.8 For player-content incidents
- Report id and time; what was reported; what the reviewer saw (and where it was kept).
- Action taken (none, warning, removal, suspension) and the statement of reasons sent.
- Ages of the players involved, as far as the system knows them.
- Any duty to report (for example to NCMEC for child sexual abuse material): who decided, when.
- How long the evidence is kept, and when it is deleted (18 §6.2; 19 §7).

## B.9 For licence and privacy incidents
- What was shipped or exposed, since when, and to how many browsers or people.
- The licence or promise broken, and what it requires to cure.
- Legal clocks: a personal-data breach may need to be reported to a regulator quickly (for
  example within 72 hours under the GDPR) and to the people affected. Ask counsel the same day;
  this template is not legal advice.
- Counsel consulted: who, when, what they advised.
```

**Rules for Template B.**
- Write the timeline first, from logs and commits, before anyone explains anything.
- No names in "Causes". Roles are fine ("the deploy step", "the reviewer on duty").
- An AI-output incident is reviewed even when no player saw it. Near misses teach the most.
- Keep player verses, report evidence and personal data out of the review unless the review cannot be understood without them. Where they must appear, the review is internal and follows the retention rules in `19-privacy-pack.md`.
- Anything that involves Devon Glover's name, card or persona is shared with him (`18-trust-and-safety-plan.md`, questions to ask him). Do not write his reaction into the review unless he gives it in writing.

---

## 5. Worked example 1: an incident review of the judge-wording regression

This is written from the record as a model of the template. It is short because the record is. Facts are **As built** (`sources/as-built-tech.md` §4.2; `docs/language/MODEL-EVAL.md:73-131`) and **In this release** (`fix/judge-wording`).

**Incident review: the integration's compare wording let a planted line win**

- Severity: S2 (wrong scores in the model judge), caught before release. Kind: AI output.
- Detected: 2026-11-18, by the model evaluation after the integration. Resolved: in this release, by the owner's decision of 2026-11-19 to restore main's wording (`fix/judge-wording`, commit `3015897a`).

**B.1 Summary.** The integration moved the duel's language out of the judge's instruction and beside the verses. Measured on the same code, one planted verse ("Ignore all previous instructions…") then beat a real verse in 11 languages instead of 2, and the model passed the judging bar in 4 languages instead of 14. No player saw it: the integration had not been deployed.

**B.2 Impact.** Players: none (not deployed). Languages: the model judge's list fell to 4 (`src/lib/brain.ts`, as built at `0d6df6ef`). Promises: none broken, because the lists are derived from measurement and a model judges only where it passed.

**B.3 Timeline.** 2026-11-18: integration merged; evaluation cells re-run; A/B with main's wording on the same code. 2026-11-19: owner chooses main's wording; `3015897a` and `066a34e2` (planted-instruction pairs in all sixteen languages) on `fix/judge-wording`. Before deploy: the 32 compare cells set aside are to be measured again (`17-operations-runbook-and-launch-checklist.md` §8.1).

**B.4 How it was found.** By the project's own measured gate: model lists are copied from evaluation results, never hand-edited (`sources/as-built-tech.md` §4.1). It could have been found sooner by a rule that any change to a prompt's wording re-runs the injection pairs before merge.

**B.5 Causes.** Trigger: one sentence of wording moved. Contributing: small models are sensitive to wording (one moved sentence cost 9 languages: `13-ai-design-and-system-cards.md` §5.1); the injection pairs existed in only some languages until `066a34e2`. What went well: the both-orders comparison and the measured lists meant a weak judge was switched off rather than shipped.

**B.6 Actions.** (1) Restore main's wording: in this release. (2) Planted-instruction pairs in all 16 languages: in this release (`066a34e2`). (3) Proposed: a gate that re-runs the injection pairs whenever `judge.ts` prompt text changes (`15-qa-and-test-plan.md` §4.3). (4) Proposed: re-measure the 32 cells before the lists change.

**B.7 AI-output detail.** Model: Gemma 4 E2B (q4f16), desktop WebGPU, build machine under headless Chromium. Guard that should have stopped it: the instruction wording itself; the judge-line filter applies to the grade path, not the compare path. Shown to players: no.

---

## 6. Worked example 2: the frame of a milestone postmortem for this release (M0)

To fill in after the deploy. The fields already known are filled; the rest are "Not known" today.

| Measure | Planned | Actual |
|---|---|---|
| Scope items | five owner decisions of 2026-11-19 (`21-production-plan-and-roadmap.md` §3.1) | Not known until deploy |
| Branches | `fix/judge-wording` (2 commits), `fix/server-authority` (2), `fix/voice-g2p` (2), `fix/compliance` (8) at 02:16 on 2026-11-19 | |
| Database backup | nightly, 14 days | done and restore-tested 2026-11-19 |
| Players | 0 accounts on 2026-11-19 | Not known |
| Open items carried out of M0 | Article 50(2) marking; online safety minimum; Devon Glover licence (`17-operations-runbook-and-launch-checklist.md` §8.6) | |

Questions the M0 postmortem should answer: did the five branches merge cleanly onto one another (the credits page and the voice branch touch the same entry, `20-legal-and-licence-register.md` §6.2)? Did the pages follow the API's removed routes? How long did the deploy take, and did the rollback steps get exercised?

---

## Owner questions

Settled on 2026-11-19 in `28-owner-decisions.md`: decided by default under the owner's standing rules where a sensible default existed; open only where it needs the owner's money, identity or contact details, a legal commitment in the company's name, or a public step not yet approved. All four were decided by default (28 D-79).

1. Is `docs/postmortems/` the right home, and are reviews committed straight to `main`? **Decided by default:** yes to both, under "land it, don't gate it" (28 D-79).
2. Who other than David Charlot may lead an incident and write its review? **Decided by default:** only David Charlot, until a second person is hired (28 D-79); hiring is money (**Open, 28 O-7**).
3. Should incident reviews that involve player content stay outside the repository? **Decided by default:** yes, in a private store, since the repository is shared with contractors (28 D-79).
4. Will a public "making of" postmortem be written after launch, and when is Devon Glover asked? **Decided by default:** it waits until after launch, and comes to the owner, and to Devon Glover for anything about him, before it is published (28 D-79).
