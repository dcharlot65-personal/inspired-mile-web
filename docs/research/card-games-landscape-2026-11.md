# Card games as a design space: landscape study for the Sonnet Man revival

Date of research: 2026-11-16. Scope excludes AR/VR/XR card games and in-browser AI models (covered by other agents).

## How to read the evidence marks

Every factual claim carries one of three marks.

- **[V]** I opened the source page this session and the claim is on it.
- **[S]** The claim comes from a search-result summary of the linked page. I did not open the page itself, or the page was truncated when I tried.
- **[U]** Unverified this session. It is background knowledge or an inference, and should be checked before it is repeated publicly.

Sales and revenue figures are third-party estimates unless the text says a company announced them.

---

## 1. Taxonomy of card game genres and their core loops

| Genre | Core loop | Named examples | What the cards do |
|---|---|---|---|
| Physical TCG/CCG | Buy random packs, build a deck, duel, trade | Magic: The Gathering, Pokémon TCG, Disney Lorcana, Riftbound (League of Legends, 2025), Altered (2024-2026) | Cards are both game pieces and collectibles; scarcity drives the economy |
| Living card game (LCG) / fixed-set | Buy a known, complete set; build; play | Netrunner as continued by Null Signal Games; Fantasy Flight's LCG line [U] | Same deck-building depth, no randomised purchase |
| Digital CCG | Daily quests, packs or crafting, ranked ladder | Hearthstone [U], Marvel Snap, Pokémon TCG Pocket, Shadowverse, Legends of Runeterra | As TCG, plus effects only software can track |
| Deckbuilder (tabletop) | Start with a weak deck; buy cards during the game | Dominion (2008) [U] | The deck is built inside each session, not before it |
| Roguelike deckbuilder | Run-based: fight, pick one of three rewards, repeat until death | Slay the Spire, Slay the Spire 2 (early access 5 March 2026), Balatro (Feb 2024), Monster Train 2 (May 2025) | Cards and passive "relics" or "jokers" multiply each other; the run is the unit of play |
| Auto-battler | Draft and position units between rounds; combat resolves itself | Teamfight Tactics, Hearthstone Battlegrounds (Nov 2019), The Bazaar (2025), Clash Royale's Merge Tactics (July 2025) | All decisions happen in the shop and on the board, none in combat |
| Drafting | Pick one card, pass the rest | 7 Wonders, Sushi Go [U]; Marvel Snap added a Draft mode [S] | The decision is what to take and what to deny |
| Social / party (judge-based) | A prompt is shown; players submit; a judge or the table picks | Apples to Apples, Cards Against Humanity, Quiplash, Snake Oil [U for Snake Oil rules] | Cards are prompts and raw material for a joke |
| Trick-taking | Follow suit, win tricks, meet a bid or goal | The Crew (2019), The Fellowship of the Ring: Trick-Taking Game (2025) | Small information leaks each turn; tight constraint on what may be played |
| Storytelling / word | Tell, describe, rhyme or spell under a card-set limit | Once Upon a Time (1993), Dixit (2008), Poetry for Neanderthals, Vers (2017), Word Play (July 2025) | Cards are constraints or seeds for language |
| Educational | Any of the above with curriculum content | Bards Dispense Profanity (2016), Explicate (poetry), Top Trumps-style revision cards | Cards carry the facts or quotations to be learned |

Sources and notes:

- Auto-battler history, Battlegrounds date and Merge Tactics: [Wikipedia, Auto battler](https://en.wikipedia.org/wiki/Auto_battler) [S]. PC Gamer's "What happened to autobattlers?" argues the genre itself has little pull even though a few titles do ([PC Gamer](https://www.pcgamer.com/what-happened-to-autobattlers)) [S].
- Trick-taking: seven of the ten top-ranked trick-taking games date from 2019 or later, and The Crew is often credited with the revival, though commentators dispute the word "renaissance" ([Troy Press](https://troypress.com/the-fellowship-of-trick-taking-games/), [Don't Eat the Meeples](https://donteatthemeeples.substack.com/p/the-rise-of-imported-trick-taking), [GeekDad, March 2025](https://geekdad.com/2025/03/the-rebirth-of-trick-taking-games/)) [S].
- Roguelike deckbuilder volume: a Steam-tag tracker counts 224 games tagged Roguelike Deckbuilder released in 2025 against 143 in 2024 ([steampageanalyzer.com](https://www.steampageanalyzer.com/niches/roguelike-deckbuilder)) [S, third-party site of unknown method].
- Null Signal Games is a registered nonprofit that publishes Netrunner as pay-what-you-want print-and-play PDFs, and home-printed cards are tournament-legal ([nullsignal.games](https://nullsignal.games/about/what-is-null-signal)) [S].
- Once Upon a Time is listed with hand management, interrupts, storytelling and voting, and ships story cards plus ending cards ([analog.games](https://analog.games/gameItem/show/419cd83f97786a400197996fe6d7200d/once-upon-a-time-the-storytelling-card-game?lang=EN)) [S].
- Dixit: Jean-Louis Roubira, Libellud, 2008, Spiel des Jahres 2010 ([Wikipedia](https://en.wikipedia.org/wiki/Dixit_(board_game))) [V]. Sales claims conflict (one retailer says over 6 million, Meeple Mountain says over 12 million) and neither cites the publisher [S].

---

## 2. Mechanics that make cards matter, and which survive when the move is text or speech

### What the mechanics are

- **Resource systems.** A budget (mana, energy, ink) that limits how much you can do per turn and forces sequencing. [U, standard theory]
- **Tempo and card advantage.** Mike Flores's 1999 essay "Who's the Beatdown?" reduces every matchup to two roles: one side wins by damage, the other by card advantage, and misreading your role loses the game. A Dojo-era summary defines card advantage as access to more playable cards and tempo as the set of actions available on a turn ([Star City Games](https://articles.starcitygames.com/articles/eight-core-principles-of-whos-the-beatdown/), [The Mana Base](https://themanabase.com/whos-the-beatdown-still-relevant-after-almost-25-years/)) [S].
- **Combos and synergies.** Balatro turns a hand into Chips multiplied by Mult, and jokers add to or multiply either term; commentators credit the multiplicative structure for its pull, and the poker hand ranks give players a format they already know ([design summary](https://saschb2b.github.io/game-mechanics/games/balatro/), [GamesRadar](https://www.gamesradar.com/exploring-balatros-hype-its-ingenious-twists-on-poker-and-its-mysterious-creator)) [S, third-party readings].
- **Constraints.** Mark Rosewater's GDC 2016 talk "Twenty Years, Twenty Lessons" lists "Restrictions breed creativity" among its lessons ([GDC Vault](https://gdcvault.com/play/1022941/Twenty-Years-Twenty)) [S].
- **Hidden information and bluffing.** Dixit's scoring is the cleanest small example: the storyteller scores only if some but not all players find the card, so a clue must be neither obvious nor opaque ([Wikipedia](https://en.wikipedia.org/wiki/Dixit_(board_game))) [V].
- **Drafting, positioning, keywords, alternate win conditions.** Standard tools; not separately sourced this session. [U]
- **Randomness placement.** Keith Burgun separates input randomness (seen before the decision, such as a dealt hand or a generated map) from output randomness (applied after the decision, such as a to-hit roll), and argues strategy games should avoid the second ([Game Developer, 15 Oct 2014](https://gamedeveloper.com/design/randomness-and-game-design)) [V]. A 2021 study built a collectible card game with four randomness conditions and found input randomness can also significantly reduce satisfaction ([arXiv 2107.08437](https://arxiv.org/abs/2107.08437)) [V], so neither kind is free.

### What translates to a creative-text move

| Mechanic | Translates? | How, with the closest precedent |
|---|---|---|
| Constraints | Strongly | The card is the rule the verse must obey. Poetry for Neanderthals allows only one-syllable words and penalises a slip with a lost point ([rules](https://officialgamerules.org/game-rules/poetry-for-neanderthals/)) [S] |
| Scaffolds | Strongly | Vers deals a topic card and a card of three rhyming words to work into the verse ([Kotaku, 3 May 2017](https://kotaku.com/a-card-game-thatll-help-you-freestyle-rap-1794898158)) [V] |
| Combos / multipliers | Strongly, if the trigger can be checked | Balatro's conditional jokers; Word Play applies the same idea to spelling ([GMTK](https://gmtk.substack.com/p/how-i-made-word-play)) [S] |
| Keywords steering content | Yes | In 1001 Nights the player steers the AI King's story toward keywords that become battle equipment ([arXiv 2308.12915](https://arxiv.org/abs/2308.12915)) [V] |
| Hidden information / bluff | Yes | Dixit's "some but not all" scoring maps onto a hidden allusion |
| Counters and interrupts | Yes | Once Upon a Time interrupts; Oh...Sir!! rewards hitting an opponent's weak spot ([Nintendo Life review](https://www.nintendolife.com/reviews/switch-eshop/oh_sir_the_insult_simulator)) [S] |
| Resources and tempo | Yes, across rounds | Needs a multi-round battle and costs on cards |
| Drafting | Yes, before the battle | Pick constraints for yourself and for the opponent |
| Positioning | Weakly | Could map to line position (a card that scores only the final couplet) |
| Output randomness | Avoid | The LLM judge is already a noisy output step; adding more hides skill |

The central point for Sonnet Man: a flat +1 to +3 is added after the creative act and is invisible while writing. Every mechanic in the "strongly" rows changes what the player has to write.

---

## 3. Precedents closest to this game

### 3.1 Physical games where language is the move

- **Vers (Jerry Spatch, Kickstarter 2017).** Two teams; a topic card plus a three-rhyme card; 400 cards. The rhyme words remove the hardest step for a beginner ([Kotaku](https://kotaku.com/a-card-game-thatll-help-you-freestyle-rap-1794898158)) [V]. A player judge picks the winner and the role rotates ([Tabletop Gaming](https://tabletopgaming.co.uk/news/vers-is-a-party-game-that-wants-to-teach-you-how-to-rap)) [S].
- **Other rap card games.** Rap Battles (DK, 2023), Versus Verses (Ridley's) and Rap Battle Card Game (Breaking Games) all deal words or lyrics that must be used in a short freestyle ([DK](https://dk.com/en-us/products/9780744089479-rap-battles), [Breaking Games](https://breakinggames.com/products/rap-battle-card-game)) [S]. I found no sales or reception data for any of them.
- **Poetry for Neanderthals (Exploding Kittens).** One-syllable constraint, a rotating judge who enforces it, a 90-second timer ([rules](https://officialgamerules.org/game-rules/poetry-for-neanderthals/)) [S].
- **Bards Dispense Profanity (2016).** A Cards Against Humanity-style game built from Shakespeare quotations, 100 question and 375 answer cards, made by a team led by an SMU English professor ([SMU](https://www.smu.edu/news/archives/2016/tim-cassedy-mentalfloss-25may2016), [Dice Tower](https://dicetower.com/board-game/200096)) [S]. It shows a market for Shakespeare as party material, but the player selects text and never writes it.
- **Judge-based party games.** Critiques of Cards Against Humanity note that the single rotating judge puts one player on the spot and that players write for that judge's taste; Quiplash spreads judging across everyone by pairing answers head to head ([Stanford "Critical Play" student essays](https://mechanicsofmagic.com/2023/04/28/critical-play-judging-game/)) [S, student blog posts]. An EMNLP 2022 paper on Cards Against Humanity found short, crude punchlines tend to win ([arXiv 2210.13016](https://arxiv.org/abs/2210.13016v1)) [S]. The lesson for a wit-scoring judge: without a rubric, the cheapest joke wins.

### 3.2 Digital games where language is the move

- **Mad Verse City (Jackbox Party Pack 5, 2018).** Three to eight players write rhymes that a text-to-speech robot performs; others react with Fire and Boo; "Write for Me" and "Suggestions" buttons rescue stuck players ([Jackbox](https://jackboxgames.com/games/mad-verse-city)) [V]. Reviews describe a Mad Libs structure in which the game supplies the line and the player fills the end, and several called it the best game in the pack ([Push Square](https://pushsquare.com/reviews/ps4/jackbox_party_pack_5), [Gaming Age](https://gaming-age.com/2019/01/jackbox-party-pack-5-review-for-xbox-one-ps4-switch/amp/)) [S].
- **Oh...Sir!! The Insult Simulator (2016).** Players assemble insults from a shared pool of phrases; combos, continuations and opponent weak spots add points. Reviewers called the scoring "a bit random" and "flawed" ([Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/oh_sir_the_insult_simulator), [PlayStation LifeStyle](https://www.playstationlifestyle.net/?p=579283)) [S]. This is the clearest warning that opaque scoring of wit reads as arbitrary.
- **Word Play (Game Maker's Toolkit, 14 July 2025).** Mark Brown combined Balatro with a spelling game; about seven months of development; around $8; Very Positive on Steam; scores grow linearly, not exponentially ([GMTK](https://gmtk.substack.com/p/how-i-made-word-play), [Steam](https://store.steampowered.com/app/3586660/Word_Play), [Thinky Games](https://thinkygames.com/games/word-play/)) [S]. Wordatro and Birdigo appeared at the same time, so "language plus roguelike perks" is now a recognised niche.
- **Mage Arena (jrsjams, early access 24 July 2025).** Spells are cast by saying their names aloud. Peak above 16,000 concurrent players in week one, over 2,600 reviews in five days, nominated for Most Innovative Gameplay at the Steam Awards 2025 ([Wikipedia](https://en.wikipedia.org/wiki/Mage_Arena)) [V]. Speech as an input is a selling point by itself when the recognition target is small and exact.

### 3.3 LLM-driven and AI-judged games, 2023-2026

| Game | Date | What the model does | What worked | What failed or cost |
|---|---|---|---|---|
| 1001 Nights (Ada Eden) | Paper Aug 2023, AIIDE 2023; demo on Steam | Plays the King; the player steers the story toward keywords that become weapons | A clear, mechanical reason to steer language | No dated full release found; Steam still lists it as unreleased [S] |
| Suck Up! (Proxima) | 2023 | Voices residents the player must talk into opening the door | Voice or text persuasion as the whole game | Each NPC interaction spends an "AI token"; players can hit a hard cap ([The Magic Rain](https://themagicrain.com/?p=42121)) [S] |
| Infinite Craft (Neal Agarwal) | 31 Jan 2024 | Decides what two elements make | The same pair always gives the same result for everyone; "First Discovery" badge ([Wikipedia](https://en.wikipedia.org/wiki/Infinite_Craft)) [S] | Occasional incoherent results |
| What Beats Rock | 2024 [year from search framing, not confirmed] | Judges whether the player's item beats the previous one | Viral; endless novelty | PC Gamer's writer found the judge more willing to rule for the player the stranger the input ([PC Gamer](https://pcgamer.com/games/pc-gamer-does-not-beat-rock-in-this-viral-ai-driven-rock-paper-scissors-browser-game-that-has-absolutely-destroyed-our-productivity-this-afternoon)) [S; page truncated when opened] |
| Death by AI (Playroom) | Discord launch, 2024-25 [exact date not found] | An AI game master sets a deadly scenario and judges each written escape | See below | See below |
| Tensor Trust | Paper Nov 2023 | Players write attacks and defences against an LLM gatekeeper | 126,000 attacks and 46,000 defences collected ([arXiv 2311.01011](https://arxiv.org/abs/2311.01011)) [V] | Proves players will attack any LLM gate |
| Gandalf (Lakera) | 2023 | Guards a password over seven levels | Hundreds of thousands of players, over 40 million prompts; about 8% finish ([Yahoo](https://ca.news.yahoo.com/gandalf-ai-game-reveals-anyone-172409334.html), [Zilliz](https://zilliz.com/blog/insights-into-llm-security-from-the-worlds-largest-red-team.md)) [S] | Same |

**Death by AI in detail.** It is the nearest commercial precedent for "write something, an AI judges it, friends watch".

- Almost 7 million users within weeks; over 70% of sessions had more than three friends ([Discord case study](https://discord.com/build-case-studies/playroom)) [V]. Inworld's case study says 10 million players in the first month and 20 million three months later ([Inworld](https://inworld.ai/customers/death-by-ai)) [V, vendor claim]. The figures use different windows and do not fully agree.
- At peak it generated over 1.2 billion text tokens and 35 million voice characters per day; non-English languages needed more tokens per word, costing more and running slower ([Discord](https://discord.com/build-case-studies/playroom)) [V]. Inworld quotes the developers: "We moved too fast and underestimated how much people would play this game", and says every round is new content so caching could not cut cost [V].
- Long queues on the judging screen became a player joke, and players in some regions churned because jokes that worked in English did not work in Chinese or Russian ([Inworld](https://inworld.ai/customers/death-by-ai)) [V, vendor claim].
- A single video describes a player cheating by modifying network requests [S, weak source].

Implication: Sonnet Man's in-browser judge removes the token bill that nearly sank Death by AI, but inherits the latency and the multilingual-humour problems.

**Academic work on a rap battle specifically.** A NeurIPS 2025 demo, "Towards AI Rapper", offers a real-time human-versus-AI rap battle ([NeurIPS](https://neurips.cc/virtual/2025/123811)) [S]. I found no commercial AI-judged poetry or rap battle game with reportable player numbers. Sonnet Man's niche appears open, and that also means there is no proof of demand.

### 3.4 Judge fairness and noise

- **Catalogued biases.** A late-2024 survey groups LLM judge biases and defines position, verbosity and self-enhancement bias ([arXiv 2412.05579](https://arxiv.org/pdf/2412.05579)); "Justice or Prejudice?" lists 12 biases ([arXiv 2410.02736](https://alphaxiv.org/abs/2410.02736v2)); a dedicated paper studies self-preference ([arXiv 2410.21819](https://arxiv.org/pdf/2410.21819)) [S]. Self-preference matters here because the judge also scores an AI opponent's verse.
- **Poetry.** Sawicki et al. (EMNLP 2025) had LLMs rank 90 poems by forced choice within small randomised batches. Claude 3 Opus reached a Spearman correlation of 0.87 with ground truth (publication venue); the best non-expert human reached 0.38; inter-rater reliability among LLM runs was high ([arXiv 2502.19064](https://arxiv.org/abs/2502.19064)) [V]. Two cautions: the ground truth is venue, not expert taste, and the judge was a frontier model, not a small in-browser one.
- **Debate.** "Debatable Intelligence" (EMNLP 2025), on over 600 annotated speeches, found larger models approximate individual human judgments in some respects but "differ substantially in their overall judgment behavior" ([arXiv 2506.05062](https://arxiv.org/abs/2506.05062)) [V].
- **Stories.** LitBench reports the best off-the-shelf judge at 73% agreement with human preferences on story pairs ([arXiv 2507.00769](https://arxiv.org/pdf/2507.00769v1)) [S]. Sources conflict on whether LLM judges of creative writing are better or worse than humans; it depends on task, model and whether the humans are experts.

What follows for design: comparative judgment (which of these two is better, on a named criterion) is better supported than absolute scores out of ten, and one in four close calls will still go the "wrong" way.

### 3.5 Prompt injection and cheating against an AI judge

- Maloyan and Namiot (April 2025) attacked LLM judges with prompt injection: up to 73.8% success, smaller models more vulnerable, attacks transferring between models at 50.5% to 62.6%. They recommend multi-model committees and comparative scoring ([arXiv 2504.18333](https://arxiv.org/abs/2504.18333)) [V]. A related paper found pairwise comparison the most susceptible format ([arXiv 2508.19288](https://arxiv.org/abs/2508.19288v1)) [S]. The two findings pull in different directions, so comparative scoring is a fairness measure and not a security measure.
- Real-world case: in July 2025 Nikkei found 17 arXiv preprints with hidden instructions such as "positive review only" aimed at AI reviewers; a later preprint counted 18 ([The Decoder](https://the-decoder.com/researchers-hide-prompts-in-scientific-papers-to-sway-ai-powered-peer-review/), [arXiv 2507.06185](https://web3.arxiv.org/pdf/2507.06185)) [S]. Reporting did not establish whether the trick worked.
- In a free, single-player, client-side game the player also controls the model, the prompt and the score. Cheating cannot be prevented there, only made pointless (nothing of value rides on a local score) or moved server-side for ranked play. [U, inference]

---

## 4. What is succeeding and failing, 2025-2026

### Succeeding

- **Slay the Spire 2.** Early access on 5 March 2026; Mega Crit announced more than 3 million copies and over 25 million runs in the first week; 574,000 peak concurrent players ([Rogueliker, 14 March 2026](https://rogueliker.com/slay-the-spire-2-3-million-copies-sold)) [V]. Alinea Analytics estimated about 4.6 million copies and over $92 million within 14 days; Newzoo called it the best-performing deckbuilder on record ([PC Gamer](https://www.pcgamer.com/games/roguelike/analysts-say-slay-the-spire-2-is-the-best-performing-deckbuilder-of-all-time-and-the-competition-isnt-close/)) [S, estimates].
- **Balatro.** Over 5 million copies announced by LocalThunk and Playstack on 21 January 2025, up from 2 million in August 2024, after its Game Awards showing ([Game Developer](https://gamedeveloper.com/business/balatro-sells-5-million-copies-after-end-of-year-spike), [Gematsu](https://gematsu.com/2025/01/balatro-sales-top-five-million)) [S]. No later official total found. Premium price, no in-app purchases, one developer.
- **Pokémon TCG Pocket.** Launched 30 October 2024; AppMagic estimates about $1.3 billion in its first year, ahead of Pokémon Go's first year ([Nintendo Life](https://www.nintendolife.com/news/2025/11/pokemon-tcg-pocket-pulled-in-almost-usd1-3-billion-in-its-first-year-alone), [GamesRadar](https://www.gamesradar.com/games/pokemon/pokemon-tcg-pocket-reportedly-made-usd245-million-more-than-pokemon-go-managed-in-its-first-year)) [S, estimate]. The pull is opening packs, not battling. Its trading feature drew a backlash in late January 2025 and an apology with 1,000 trade tokens on 5 February ([VGC](https://videogameschronicle.com/news/pokemon-tcg-pockets-trading-feature-is-changing-after-fan-backlash), [Gameranx](https://gameranx.com/updates/id/527379/article/pokemon-tcg-pocket-furthers-its-apology-to-players-with-new-reward/)) [S].
- **Magic: The Gathering.** Hasbro's FY2025 results report Magic revenue up 59% and the Wizards segment up 45%, driven by Universes Beyond sets ([Hasbro release via Business Wire](https://www.businesswire.com/news/home/20260209085774/en/Hasbro-Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results/)) [S]. The CEO is reported to have said the Final Fantasy set did $200 million in one day; that figure reaches me only through secondary coverage ([Star City Games](https://articles.starcitygames.com/magic-the-gathering/mtg-final-fantasy-already-the-best-selling-set-of-all-time/)) [S].
- **Riftbound.** Debuted fifth in TCGplayer's Q4 2025 ranking and held fifth in Q1 2026 ([TCGplayer](https://seller.tcgplayer.com/blog/bestselling-trading-card-games-q4-2025)) [S, one marketplace only].
- **Small language and voice games.** Word Play and Mage Arena (section 3.2) show that a cheap, single-idea game with a novel input can find an audience.

Why these work, in my reading [U, synthesis]: a known input format (poker hands, Pokémon, a famous IP), multiplicative rewards that the player can see coming, short sessions, and either a one-off price or a collecting ritual that is the product.

### Failing or shrinking

- **Altered TCG.** Raised over $7 million on Kickstarter before its 2024 launch; Equinox announced closure on 18 March 2026 after a new campaign fell short of the €2 million it needed ([Gaming Trend](https://gamingtrend.com/news/altered-announces-its-shutting-down-after-failing-to-meet-new-funding-goal)) [V]. The article's own analysis blames a crowded market and an original IP.
- **Legends of Runeterra (competitive PvP).** In early 2024 Riot put competitive PvP into hibernation. Riot's words: "our core monetization thesis was to let people earn their card collection and pay for cosmetics" and cosmetics "have proven deeply inadequate, often costing us more to make than they earned for us" ([Out of Games](https://outof.games/news/7045-riot-details-the-future-of-legends-of-runeterra-one-more-set-path-of-champions-new-focus-more/)) [V]. The lesson is about cost base, not generosity: cosmetics-only could not fund a large live-service team.
- **The Bazaar.** Open beta in March 2025 drew pay-to-win complaints (ranked entry fees, paid early access to cards, paid pass skips). For its Steam launch on 13 August 2025 it dropped free-to-play for a $45 purchase with $20 heroes and made the pass free and cosmetic-only ([PCGamesN](https://www.pcgamesn.com/the-bazaar/steam-launch-monetization-changes)) [V].
- **Marvel Snap.** Went dark in the US on 19 January 2025 because its publisher Nuverse is owned by ByteDance; Second Dinner brought publishing in-house with Skystone Games ([PC Gamer](https://www.pcgamer.com/games/card-games/after-falling-victim-to-the-recent-us-tiktok-ban-marvel-snap-switches-to-a-new-us-based-publisher)) [S]. Layoffs followed in April 2026 ([GameLuster](https://gameluster.com/marvel-snap-second-dinner-layoffs-2026/)) [S]. Revenue estimates conflict badly (from $150 million to $25 million for 2025 depending on source), so I report none.
- **Shutdowns.** The Elder Scrolls: Legends servers closed 30 January 2025 ([UESP](https://en.m.uesp.net/wiki/UESPWiki:News/The_Elder_Scrolls:_Legends_has_been_shut_down)); TEPPEN ended online service 30 March 2026 with an offline version ([GamingOnPhone](https://gamingonphone.com/news/teppen-is-shutting-down-on-march-30-2026-as-an-offline-version-is-confirmed-for-players)); the original Shadowverse ended 30 June 2026 in favour of Worlds Beyond ([Gematsu](https://www.gematsu.com/2026/03/shadowverse-to-end-service-on-june-30)); Brave Frontier Versus closed 22 June 2026 after under a year ([GamingOnPhone](https://gamingonphone.com/news/brave-frontier-versus-is-ending-service-on-june-22-2026-after-less-than-a-year-of-release/)) [all S].
- **Disney Lorcana.** Ravensburger reported a sales drop in 2025 after the launch surge, and group sales down 5.9% ([Bounding Into Comics, quoting Ravensburger](https://boundingintocomics.com/tabletop-games/disney-lorcana-saw-notable-sales-drop-in-2025-as-customers-with-a-primary-interest-in-investment-finally-over-initial-hype)) [S].
- **Artifact and Gwent.** Often cited as failures; I did not verify dates or stated reasons this session. [U]

Pattern [U, synthesis]: live-service card games die from operating cost against revenue, from dependence on a third party (publisher, platform, licensor), or from monetisation that sells power. A static browser game with client-side inference avoids the first two by construction.

---

## 5. Economy and progression without pay-to-win or loot boxes

### Models

| Model | Example | Evidence |
|---|---|---|
| Premium, no in-app purchases | Balatro, Slay the Spire 2, Word Play | Section 4 |
| Buy-once plus fixed DLC | The Bazaar after August 2025 | PCGamesN [V] |
| Fixed-set, free print-and-play, donations | Null Signal Games' Netrunner | nullsignal.games [S] |
| Earn the collection, pay for cosmetics | Legends of Runeterra | Did not cover a large team's costs [V] |
| Free, philanthropy-funded, no student login | iCivics | Funded by philanthropy; students can play without an account ([iCivics](https://icivics.org/our-commitment-educators), [Tech & Learning](https://www.techlearning.com/how-to/what-is-icivics-and-how-does-it-work-best-tips-and-tricks)) [S] |
| Freemium aimed at children | Prodigy Math | A 2021 complaint to the FTC by 22 groups alleged 16 membership adverts and four maths problems in 19 minutes of play ([Fairplay](https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/), [EdWeek](https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02)) [S]. No public outcome found |

### Legal and child-safety position as of November 2026

- **EU, PEGI.** Announced 12 March 2026: games submitted from June 2026 with paid random items default to PEGI 16; time- or quantity-limited offers are PEGI 12 minimum; rewards for returning are PEGI 7, rising to 12 if the player is penalised for not returning; NFT mechanics are PEGI 18; fully unrestricted communication is PEGI 18. Existing games are not re-rated ([VGC](https://www.videogameschronicle.com/news/all-games-with-loot-boxes-in-them-will-be-rated-minimum-pegi-16-starting-this-summer)) [V]. Other outlets say the definition names card packs and gacha explicitly ([Pocket Gamer](https://www.pocketgamer.biz/pegi-expands-age-ratings-to-cover-loot-boxes-and-in-game-spending)) [S]. Note the daily-streak rule: a classroom game with punishing streaks would be rated up.
- **EU, Digital Fairness Act.** The Commission proposed it on 11 November 2026, five days before this report. It would restrict loot boxes and pay-to-progress pressure for minors, require clearer virtual-currency pricing, ban dark patterns, and allow fines up to 6% of global turnover. It must still pass Parliament and Council; no timeline given ([Euronews](https://www.euronews.com/2026/11/11/eu-targets-subscription-traps-addictive-design-and-hidden-fees-with-new-digital-rules)) [V]. Other coverage says the draft expressly names collectible card packs ([The Next Web](https://thenextweb.com/news/eu-digital-fairness-act-loot-boxes-dark-patterns)) [S]. It is a proposal, not law.
- **UK.** Loot boxes are still not classed as gambling; the government relies on Ukie's 2023 industry principles and keeps legislation "under review" ([January 2026 debate record](https://beta.westminsterbrief.co.uk/archive/debate/15-january-2026/game-purchases-protections-children-257c)) [S]. A registered-report study of the 100 highest-grossing iPhone games found none sought parental consent before under-18s bought loot boxes, 23.5% disclosed loot boxes in marketing and 8.6% consistently disclosed odds ([Royal Society, June 2025](https://royalsociety.org/blog/2025/06/video-game-industry-loot-boxes/)) [V]. Ukie disputes the study [S].
- **US, FTC.** In January 2025 Genshin Impact's publisher agreed to pay $20 million and to block under-16s from in-game purchases without parental consent ([PC Gamer](https://www.pcgamer.com/games/rpg/ftc-says-genshin-impact-deceived-children-and-orders-its-publisher-to-pay-a-usd20-million-fine-and-stop-selling-loot-boxes-to-kids)) [S].
- **US, COPPA.** Amendments published 22 April 2025, effective 23 June 2025, with compliance required by 22 April 2026: stronger parental notice, tighter third-party sharing, a "mixed audience" definition, more security duties ([Latham](https://www.lw.com/en/insights/2025/05/ftc-publishes-updates-to-coppa-rule), [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/ftc-publishes-final-coppa-rule-amendments)) [S]. I believe the amended rule also treats voiceprints as biometric personal information, which would matter for a speak-your-verse mode, but I did not verify that this session. [U]
- **Brazil.** Law 15.211/2025 (the "Digital ECA"), signed 17 September 2025, bars loot boxes in games aimed at or likely to be accessed by minors from 17 March 2026 ([Baker McKenzie](https://connectontech.bakermckenzie.com/brazil-digital-eca-brazils-child-and-adolescent-statute-a-new-framework-for-online-protection-of-children-and-adolescents/)) [S]. Commentators disagree on its exact scope.
- **Australia.** Since 22 September 2024, paid chance-based purchases mean at least an M rating and simulated gambling means R18+; a University of Sydney analysis a year later found widespread non-compliance ([University of Sydney](https://www.sydney.edu.au/news-opinion/news/2025/09/30/kids-exposed--video-game-age-ratings-still-failing-australian-fa.html)) [S].
- **Balatro's rating.** PEGI cut it from 18 to 12 on appeal in February 2025, citing "mitigating fantastical elements" ([Game Developer](https://gamedeveloper.com/business/balatro-s-contentious-pegi-18-rating-has-been-amended-thanks-to-mitigating-fantastical-elements-)) [S]. Card imagery alone can trigger a gambling flag.

The direction across every jurisdiction checked is the same: a randomised pack that costs money is becoming an adult product. Packs earned only through play are untouched by all of the above as far as I could see. [U, my reading, not legal advice]

---

## 6. Educational card games and literature or language learning

### What the evidence supports

- **Analog games in school.** Sousa et al. (2023) reviewed 45 empirical studies from 2012 to 2022. Most reported positive effects, most often on collaboration and communication. Weaknesses: 53.3% of studies used university students, 71.1% used games built for the study, few were experiments, most measured only afterwards, and the link between mechanics and the intended learning "was often weak or unclear" ([Frontiers in Psychology](https://www.frontiersin.org/articles/10.3389/fpsyg.2023.1160591)) [V]. A 2024 Spanish-language review of 57 articles reached the same "promising, under-tested" verdict ([Revista Educación](https://revistas.ucr.ac.cr/index.php/educacion/article/view/60948/62844)) [S].
- **Digital games for vocabulary.** Meta-analyses report positive effects of very different sizes (roughly d = 0.7 to 1.1); the ones I found pre-date 2023 except a 2024 master's thesis ([iJET 2020](https://online-journals.org/index.php/i-jet/article/view/11758), [NTNU thesis](https://etds.lib.ntnu.edu.tw/thesis/detail/c0435c55510a162f425181087e643acc)) [S]. I did not find a peer-reviewed 2023-2025 meta-analysis.
- **Automated feedback on writing.** Fleckenstein, Liebenow and Meyer (2023) found a medium overall effect, g = 0.55, with large heterogeneity; Zhai and Ma (2023) found g = 0.861 over 26 studies and a bigger effect for argumentative writing ([Frontiers in AI via PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10351274/)) [S; the page blocked my fetch]. A 2024 review of 83 articles notes creative genres are under-studied ([ReCALL](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/28A670C4C7F2F1F30C7EA36EC489F867/S0958344023000265a.pdf/systematic_review_of_aibased_automated_written_feedback_research.pdf)) [S]. So feedback helps writing in general, but nobody has shown it for verse.
- **Hip-hop and spoken word.** Flocabulary's efficacy evidence is company-commissioned (2008-2009) and has been criticised as overstated; I found no What Works Clearinghouse rating ([Flocabulary](https://www.flocabulary.com/results-efficacy/), [Language Magazine](https://www.languagemagazine.com/?p=6649)) [S]. For slam poetry, one review says "relatively little research has been published"; the best lead is a 2009-era US Department of Education-funded study of Global Writes whose final report I could not find ([Edutopia](https://www.edutopia.org/poetry-slam-global-writes%20)) [S].
- **Literature card games specifically.** I found teaching resources (Explicate, Top Trumps templates, revision cards) and small qualitative studies, but no controlled study of a card game improving secondary English literature outcomes. [S, absence of evidence in one search]

### What teachers adopt

- A 2025 survey of 162 Czech teachers found they named free commercial tools such as Kahoot! and Duolingo, not research-built serious games ([ICERI 2025](https://library.iated.org/view/PESOUT2025DIG)) [S].
- Reported barriers are technical problems, infrastructure and lack of knowledge; professional development improves teacher confidence ([systematic review](https://katalog.lib.cas.cz/KNAV/EdsRecord/edsndl,edsndl.UPSALLA1.oai.DiVA.org.su.214434), [Universityxp summary](https://www.universityxp.com/research/2024/7/7/digital-games-in-the-classroom-benefits-and-barriers)) [S].
- iCivics, the most widely cited free model, lets students play with no account and gives teachers a free class dashboard [S].

Reading across these [U, synthesis]: teachers adopt what is free, needs no student accounts, runs in a browser in one lesson, and maps to something they already have to teach. The research gap (mechanics not tied to the learning goal) is the same weakness Sonnet Man has now.

---

## 7. Design research worth knowing

- **Mark Rosewater, "Twenty Years, Twenty Lessons" (GDC 2016).** Lessons named on the GDC listing include "Restrictions breed creativity", "Fighting human nature is a losing battle" and "If everyone likes your game, but no one loves it, it will fail" ([GDC Vault](https://gdcvault.com/play/1022941/Twenty-Years-Twenty)) [S].
- **Richard Garfield on luck and skill.** Secondhand accounts of his talk: luck and skill are separate axes, and luck moderates skill gaps without erasing them, which widens the audience ([Board Game Design Lab interview](https://boardgamedesignlab.com/luck-vs-skill-with-richard-garfield/), [blog summary](https://talarian.blogspot.com/2014/11/luck-versus-skill.html?m=0)) [S, no primary text opened]. The book is Elias, Garfield and Gutschera, Characteristics of Games (MIT Press) [U].
- **Keith Burgun on randomness.** Section 2 [V]. Mark Brown is cited as arguing that well-tuned output randomness can help and bad input randomness can hurt ([arXiv 2107.08437 discussion](https://arxiv.org/pdf/2107.08437)) [S].
- **Mike Flores, "Who's the Beatdown?" (1999).** Section 2 [S].
- **Juice.** Kao (2020), Entertainment Computing, compared None, Medium, High and Extreme juiciness in one action RPG with 3,018 players ([index entry](https://www.x-mol.com/paper/1307980428882448384)) [S]. Later papers describe the result as None and Extreme both significantly lowering player experience ([Lin et al.](https://faculty.washington.edu/zkwen/articles/lin22features.pdf)) [S, secondary citation; I could not open the abstract]. A 2024 CHI follow-up (n = 1,699) found curiosity the strongest predictor of enjoyment from juicy feedback ([Imperial repository](https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d)) [S]. Hicks's 2013 Lincoln thesis offers a framework of juiciness characteristics [S; I could not confirm the 2019 paper titles].
- **LLMs and games.** Gallotta et al., "Large Language Models and Games: A Survey and Roadmap" (arXiv Feb 2024, accepted by IEEE Transactions on Games) surveys the roles an LLM can take in a game ([arXiv 2402.18659](https://arxiv.org/abs/2402.18659)) [V for existence and scope; I did not read the role list].
- **Humour in judged card games.** "Cards Against AI" (Findings of EMNLP 2022) [S].

---

## Implications for Sonnet Man

The diagnosis in one sentence: today the card acts after the verse is written, so it cannot shape the verse. Each recommendation below moves a card's effect to before or during writing, or makes it interact with the opponent.

A structural note that underlies several of them: split scoring into two layers. Layer one is checked by ordinary code (line count, syllable count, rhyme scheme, required word present, forbidden word absent). Layer two is the LLM's comparative judgment of quality. Card effects should hang on layer one wherever possible, because code is exact, instant, the same in every language it is written for, and cannot be talked round.

1. **Form cards that set the shape of the round, scored as a multiplier.** Each round is fought under a Form card (heroic couplet, ABAB quatrain, limerick, haiku, a volta in line three). Code checks the form; the judge's quality score is multiplied when the form is met. *Precedent:* Balatro's Chips times Mult on a hand type the player already knows; Rosewater's "restrictions breed creativity".

2. **Character cards as conditional multipliers, not flat bonuses.** Mercutio multiplies the wit score if the verse contains a pun; Hamlet pays per rhetorical question; a Montague and a Capulet in the same deck pay for antithesis. Each character then implies a way of writing. *Precedent:* Balatro's jokers, and Word Play carrying the same structure into language.

3. **Curse cards played on the opponent.** "No letter E", "one-syllable words only", "you may not say love". The AI opponent must obey them too, and code verifies both sides. This gives an in-battle decision (which curse, when) and counters. *Precedent:* Poetry for Neanderthals' one-syllable rule with a point penalty.

4. **Relics as scaffolds: rhyme sets and must-use words.** A relic deals three rhyming words or a keyword that pays out when woven in. This helps beginners and second-language players most, and gives experts a combo piece. *Precedent:* Vers's topic card plus three-rhyme card; Mad Verse City's "Write for Me" and "Suggestions"; 1001 Nights' keywords that become weapons.

5. **A three-round battle with a spendable resource.** Give each player a small "ink" budget; forms, curses and potions cost ink; unspent ink carries over. The player must decide whether to win round one cheaply or save for the last. *Precedent:* tempo against card advantage in "Who's the Beatdown?"; Legends of Runeterra and Marvel Snap as short-match digital designs [U for their internal rules].

6. **Show the opponent's intent before the player writes; never randomise after.** Reveal which form or device the AI opponent will use this round so the player can choose a counter. Keep all chance in the deal, none in the scoring. *Precedent:* Burgun's input-versus-output distinction; the 2021 CCG study showing randomness placement changes satisfaction.

7. **A hidden-allusion card with Dixit scoring.** The player secretly commits to an allusion (a named scene or line) and scores only if the judge, or classmates in classroom mode, can identify it without it being quoted outright. Too obvious and too obscure both score nothing. This is the bluffing layer and it rewards real Shakespeare knowledge. *Precedent:* Dixit's "some but not all" storyteller rule.

8. **Reply cards that reward answering the opponent's verse.** From round two, a "riposte" card pays when the verse turns a word or image from the opponent's last verse back on them. This makes the battle a dialogue and makes pre-written verses useless. *Precedent:* Oh...Sir!!'s weak spots and comeback mechanic; interrupts in Once Upon a Time.

9. **Harden the judge: comparative, both orders, input treated as data.** Ask the judge "which verse is wittier" per criterion, run it with the verses in both orders, and count a split as a draw. Pass verses as quoted data, strip instruction-like text, and cap length so verbosity cannot buy points. Where a server exists (ranked or tournament play), re-judge there with a second model. *Precedent:* Maloyan and Namiot's 73.8% injection success, their finding that smaller models are more vulnerable, and their recommendation of committees and comparative scoring; Sawicki et al.'s 0.87 correlation from forced-choice ranking; the catalogued position, verbosity and self-preference biases.

10. **Make the verdict legible and repeatable.** Show which cards fired and why, the per-criterion result, and one sentence of feedback per criterion. Fix the seed so the same pair of verses always gets the same verdict. Keep presentation effects moderate. *Precedent:* Oh...Sir!! was marked down for scoring that felt random; Infinite Craft's same-input-same-output rule; the g = 0.55 effect of automated feedback on writing; Kao's finding that extreme juice performs like none.

11. **Fixed sets, earned by play, never sold at random.** Release houses as complete sets (Verona, Elsinore, the Romantics). Unlock by playing or by a teacher's class code. If money is ever needed, sell a known cosmetic or accept donations, and offer printable decks for classrooms. Avoid punishing daily streaks. *Precedent:* Null Signal Games' free print-and-play Netrunner; The Bazaar's forced retreat from selling power; PEGI 16 for paid random items and PEGI 12 for penalised return mechanics from June 2026; the EU Digital Fairness Act proposal of 11 November 2026; the FTC's Genshin Impact order.

12. **Classroom mode: the teacher's chosen cards are the lesson, and each language gets its own forms.** A teacher picks the Form and device cards for a session (today: iambic pentameter and metaphor), so the mechanic is the learning objective. Students need no account. Classmates vote alongside the AI judge, and the AI's output is framed as feedback, not a grade. For each language, author native form cards (alexandrine, haiku, ghazal, décima) and native check code; do not translate English ones. *Precedent:* Sousa et al.'s finding that mechanics are rarely tied to the learning goal; iCivics' no-login model; Quiplash's shared voting; "Debatable Intelligence" showing LLM judges diverge from humans overall; Death by AI losing players where English humour did not carry over.

### Things I would not do

- Do not keep absolute 1-10 scores as the only output. The supporting evidence is for comparison.
- Do not build ranked competition on a client-side judge. The player controls the model.
- Do not record or upload student speech without checking the amended COPPA rule on voice data [U].

---

## Claims I am least sure of

1. Kao (2020) inverted-U result: sample size and conditions come from an index excerpt, the finding from secondary citations. I could not open the abstract.
2. The $200 million one-day figure for Magic's Final Fantasy set: secondary reporting of an earnings call only.
3. Death by AI's 10 and 20 million player figures: vendor case study (Inworld); Discord's own page says "almost 7 million within weeks".
4. What Beats Rock's 2024 date and the "lenient when weird" observation: the PC Gamer page was truncated when opened.
5. Slay the Spire 2's 4.6 million and $92 million at 14 days: analyst estimates. Only the 3 million first-week figure is the developer's.
6. Pokémon TCG Pocket's $1.3 billion: AppMagic estimate, not a company figure.
7. The 224 versus 143 roguelike deckbuilder release counts: one third-party tracker.
8. That the amended COPPA rule covers voiceprints: not checked this session.
9. That the EU Digital Fairness Act names collectible card packs: one secondary source; Euronews did not say so. It is also only a proposal.
10. PEGI's definition naming card packs explicitly: reported by some outlets, absent from the VGC article I opened.
11. Dixit sales (6 million against 12 million): sources conflict.
12. Marvel Snap revenue: sources conflict by a factor of six, so none is given.
13. Artifact and Gwent details, Dominion's date, Hearthstone, 7 Wonders, Sushi Go, Snake Oil: background knowledge only.
14. The claim that no commercial AI-judged poetry or rap battle game exists with meaningful traction rests on two searches.
15. Garfield's luck-and-skill argument: secondhand summaries only.
16. The automated-feedback effect sizes (g = 0.55, g = 0.861): from a search summary; the article page blocked my fetch.
