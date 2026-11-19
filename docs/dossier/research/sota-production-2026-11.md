# State of the art for producing Sonnet Man: platforms, technology, law and documentation, November 2026

Research date: **2026-11-19**. Web research only; nothing was built, run or measured except one package inspection (section 3.4). This is research, not legal advice.

Scope: what a small US studio (Voyage Tracable LLC, trading as Inspired Mile, under US$10M revenue, one founder working with AI agents) needs to know in late 2026 to produce, ship and run Sonnet Man, a free, mobile-first web card game at sonnetman.inspiredmile.com in which players write or speak short verses in 16 languages and duel an AI opponent that runs in the browser.

Companion files, not repeated here:
- `docs/research/in-browser-ai-2026-11.md` (2026-11-16): models, runtimes, WebGPU table, iOS memory, caching, speech and TTS options, judge hardening, auth.
- `docs/research/card-games-landscape-2026-11.md` (2026-11-16): card-game design, judge bias and prompt-injection papers, PEGI June 2026 loot-box rules, the EU Digital Fairness Act proposal (2026-11-11), Brazil, Australia, the FTC Genshin order.

This file adds what those two do not cover, and corrects them where newer evidence was found (section 2.1).

---

## How to read this file

Every factual claim carries a source (publisher, title, the source's own date, URL) and a mark:

- **[V]** The page was opened on 2026-11-19, by me or by one of four research agents I ran in parallel for this file, and the claim is on it. Pages I re-opened myself are marked **[V, re-checked]**.
- **[S]** From a search-result summary or a secondary source (law-firm blog, Wikipedia, news) only.
- **[U]** Not verified this session. Background knowledge or a lead. Check before relying on it.
- **"Inference"** marks my own application to Sonnet Man. Every "For Sonnet Man" block is inference.

"Undated" means the page shows no date; it was accessed 2026-11-19.

**Coverage limit.** The session's shared web-search allowance (200 searches) ran out partway through. After that, only known URLs could be opened. Several sites also refused automated fetches (Ofcom, federalregister.gov, eCFR, congress.gov, leginfo.legislature.ca.gov, ISO, PMI, Newzoo, cnil.fr, gutenberg.org, the EC press corner). The list in section 9 says what to re-check first.

---

## 0. The findings most likely to change what Sonnet Man does

1. **EU AI Act transparency is live, and a deadline is 13 days away.** Article 50 has applied since 2026-08-02. The Digital Omnibus on AI (in force 2026-07-27) gives providers of content-generating systems already on the market before 2026-08-02 until **2026-12-02** for the Art 50(2) machine-readable marking duty. (Section 5.4.)
2. **The amended COPPA Rule has been fully enforceable since 2026-04-22.** It requires a written security program, a written retention policy and separate consent for third-party disclosure. A school may consent only for school-benefit use, never commercial use. (Section 5.1.)
3. **California's companion-chatbot law (SB 243, in force 2026-01-01) excludes game bots only conditionally.** The bot must stay on the game and be unable to discuss mental health, self-harm or sexual content. An unconstrained verse generator is outside the exclusion. (Section 5.2.)
4. **Vermont's Age-Appropriate Design Code takes effect 2027-01-01 with no revenue threshold.** It imposes a duty of care against compulsive use. Streaks, seasons and notifications need review. (Section 5.2.)
5. **Verses shown to other players make Sonnet Man a user-to-user service.** The UK Online Safety Act's risk-assessment, reporting and takedown duties scale with size but have no small-business exemption. The EU DSA's notice-and-action and statement-of-reasons duties apply at any size. (Sections 4.3, 5.3.)
6. **The big web portals are structurally incompatible with the full game.** Poki forbids personal data, email accounts and chat. CrazyGames forbids external login and pays only with its ads. YouTube Playables forbids external calls and logins, and may decline WebAssembly and workers. An ad-free game earns nothing on any of them. (Section 1.1.)
7. **The first match must not wait for a model.** CrazyGames' mobile homepage allows 20 MB before play. Poki says players leave after 10 s. In Poki's 2026 survey, 46% of web gamers had abandoned a mobile game for slow loading. (Section 2.2.)
8. **On-device speech in the browser is desktop-only.** Chrome 139+ desktop has it; Android and ChromeOS do not. On phones, voice input needs the game's own model. Moonshine's per-language streaming models (MIT, about 100M parameters, August 2026) are the new candidates. (Section 3.)
9. **Licences bite in four places.**
   - Liquid's LFM licence stops at US$10M group revenue.
   - Folger texts are non-commercial only.
   - Wiktionary-derived word lists must ship as separate CC BY-SA data.
   - The `phonemizer` package under kokoro-js embeds a compiled eSpeak NG, which is GPL-3.0-or-later, under an Apache label.

   (Sections 3.4, 5.9, 5.10.)
10. **The Devon Glover licence must describe AI uses specifically.** New York's General Obligations Law §5-302 and California's Labor Code §927 void vague digital-replica clauses unless the performer had counsel or union cover. New York Civil Rights Law §51 requires written consent for name, likeness or voice in trade. (Section 5.8.)

Also new since the 2026-11-16 files:
- **Liquid d1-2B** (2026-10-27) is a browser-runnable "decision model" that gives rubric scores in one forward pass, with no free-text output.
- **content-safety-guard-small** (2026-09) is a 268 MB multilingual moderation classifier that runs in Transformers.js.
- **Kitten TTS 2 nano/pico** (2026-11-13) does Apache-licensed TTS in 4 to 17 MB per language.

(Sections 2.3, 3.2, 4.2.)

---

## 1. Web game distribution in 2026

### 1.1 Portals and platforms

**Poki**
- **Scale:** "100 million monthly players", "1B+ gameplays per month", "100+ countries". Its audience is "majority mobile, so a desktop-only game is at a disadvantage". (Poki, "Poki for Developers" and "What we look for", undated, https://developers.poki.com/ , https://developers.poki.com/guide/what-we-look-for) [V]
- **Deal and revenue** (Poki, "Working with Poki" and "Revenue & deal types", undated, https://developers.poki.com/guide/working-with-poki , https://developers.poki.com/guide/revenue-deal-types) [V]:
  - Preferred deal: web exclusivity covering the open web, Discord and YouTube Playables, for an indicative **5 years**. The developer keeps Steam, app stores and consoles.
  - Players Poki sends are split **50/50**. Players who arrive directly earn the developer "100% of the revenue".
  - A non-exclusive alternative pays a "one-time flat license fee with no revenue share".
- **Money is ads only:** midroll `commercialBreak()`, rewarded `rewardedBreak()` and display ads. "There are no in-app purchases and no third-party ad systems to integrate". Nothing addresses an ad-free game. (Poki, "How monetization works", undated, https://developers.poki.com/guide/how-monetization-works) [V]
- **Technical and data rules** (Poki, "Requirements & quality" and "External resources policy", undated, https://developers.poki.com/guide/requirements-quality , https://developers.poki.com/guide/external-resources-policy) [V]:
  - Desktop, mobile and tablet required; 16:9.
  - Players leave if loading takes more than 10 s.
  - Must work in incognito and with ad blockers.
  - "Poki blocks all external requests by default"; approved game servers are allowed.
  - "Games must not collect personal information". No external accounts, including email login.
  - No download-size, SharedArrayBuffer or WebGPU rule is stated.
- **Content** (Poki, "Content & player safety", undated, https://developers.poki.com/guide/content-player-safety) [V]:
  - "a playground for everyone, including kids".
  - "Chat systems … games can't include them".
  - AI rules: no AI watermarks or prompt text visible, no untested generated content.
- **Playtesting** (Poki, "Playtesting" and "Player fit test", undated, https://developers.poki.com/guide/playtesting , https://developers.poki.com/guide/player-fit-test) [V]:
  - Poki Playtest gives 10 recorded sessions with inputs, console, device and country.
  - The free "player fit test" gives 500 players.
  - To advance, a game needs average playtime over 3 minutes and at least 25% of plays over 3 minutes.

**CrazyGames**
- **Scale:** "50+ million monthly players" (CrazyGames, "FAQ", undated, https://docs.crazygames.com/faq/) [V].
- **Launch stages** (CrazyGames Developer Docs and "Basic Launch metrics", undated, https://docs.crazygames.com/ , https://docs.crazygames.com/resources/basic-launch-metrics/) [V]:
  - Basic Launch runs 7 to 21 days, with ads and purchases off. Full Launch turns on revenue.
  - Benchmarks: 10+ minutes average playtime; D1 retention of 10 to 15% is "strong"; top titles load in under 10 s and are under 20 MB.
  - Thumbnail click-through becomes a metric for Basic Launches from **2026-11-23**.
- **Technical limits** (CrazyGames, "Technical requirements", undated, https://docs.crazygames.com/requirements/technical/) [V]:
  - Total up to 250 MB and 1,500 files.
  - **Initial download at most 50 MB, or 20 MB for the mobile homepage**, measured to the SDK's gameplay-start event.
  - Externally loaded content is judged by time to gameplay, target at most 20 s.
  - Games that cannot run on a 4 GB Chromebook are disabled on ChromeOS.
- **Accounts:** "login with external login options (e.g. Facebook, Google, email) is not allowed". Own accounts must map to the CrazyGames `userId`, and guests must be able to play. (CrazyGames, "Account integration", undated, https://docs.crazygames.com/requirements/account-integration/) [V]
- **Audience and links:** "an audience aged 13 or more … PEGI 12 compliant". Kids games go to a separate domain with monetisation disabled. English is required. Community links may not lead to a playable web version. (CrazyGames, "Gameplay requirements", undated, https://docs.crazygames.com/requirements/gameplay/) [V]
- **Terms** (CrazyGames, "Developer Portal Terms and Conditions", 2025-08-18, https://files.crazygames.com/documents/developer_terms_20250818.pdf) [V]:
  - Non-exclusive.
  - Compensation only with Full Launch, the SDK's ads and no other ads; otherwise "no Compensation will be due". **No percentage is published.**
  - Two months' exclusivity adds +50%.
  - The developer is liable for player content and is "advised to use a wordfilter".

**itch.io**
- **Revenue share:** open, 0 to 100%, default **10%**. Payment fees are "$0.30 + 2.9%". 30% withholding applies without a tax form. (itch.io, "Payments", undated, https://itch.io/docs/creators/payments) [V]
- **HTML5 limits:** up to 1,000 files, 500 MB extracted, 200 MB per file. Mobile always opens click-to-launch fullscreen. (itch.io, "Uploading HTML5 games", undated, https://itch.io/docs/creators/html5) [V]
- **Free games** are allowed (itch.io, "Creator FAQ", undated, https://itch.io/docs/creators/faq) [V].
- A "SharedArrayBuffer support" checkbox is reported but not documented. [U]

**Discord Activities**
- **What they are:** "web apps hosted in an iframe that use the Embedded App SDK", on desktop, mobile and web (Discord, "Activities overview", undated, https://docs.discord.com/developers/activities/overview) [V].
- **Networking:** "All network traffic is routed through the Discord Proxy", which needs URL mappings. WebSockets work; "WebRTC is not supported". (Discord, "Networking", undated, https://docs.discord.com/developers/activities/development-guides/networking) [V]
- **Monetisation** (Discord, "Monetizing your Discord app" and "Enabling monetization", undated, https://docs.discord.com/developers/monetization/overview , https://docs.discord.com/developers/monetization/enabling-monetization) [V]:
  - One-time and subscription SKUs for Activities.
  - The team owner must be 18 or over.
  - Payouts in the US, EU and UK through Stripe after $100.
  - **The revenue share is not stated in the docs** [V, absence; U for the figure].

**YouTube Playables**
- **Access:** "Developer access … is in an early access stage", through an interest form; live in 100+ countries (Google for Developers, "YouTube Playables", updated 2026-11-03, https://developers.google.com/youtube/gaming/playables) [V].
- **Size and performance:** initial bundle under 30 MiB (should be under 15), total under 250 MiB, peak JS heap at most 512 MB, load under 5 s (Google, "Stability and performance requirements", undated, https://developers.google.com/youtube/gaming/playables/certification/requirements_stability) [V].
- **Privacy rules** (Google, "Privacy and data requirements", undated, https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata) [V]:
  - "MUST NOT make external calls to any URLs or services".
  - No collection of names or usernames, and no login screen.
  - YouTube "may decline" games using WebAssembly, eval() or Web workers.
- **Money and audience:** YouTube ads only, with no published share. It must not be "made for kids", and must suit a 13+ general audience. (Google, Monetization and Trust & Safety requirements, undated, same certification section) [V]

**Telegram Mini Apps**
- **Platform:** latest is Bot API 10.1 (2026-06-11). Bot API 9.0 (2025-04-11) added 5 MB per-user DeviceStorage. (Telegram, "Telegram Mini Apps", https://core.telegram.org/bots/webapps) [V]
- **Payments:** digital goods must use Stars, or Telegram "cannot display your bot or mini-app to mobile users" (Telegram, "Payments for digital goods", undated, https://core.telegram.org/bots/payments-stars) [V]. Developers receive about US$0.013 per Star (Telegram, "Bot Platform Developer Terms", undated, https://telegram.org/tos/bot-developers) [V].
- **Data:** Mini Apps receive the user's IP and may receive Telegram ID, name and photo (Telegram, "Mini Apps Terms of Service", undated, https://telegram.org/tos/mini-apps) [V].

**Reddit (Devvit Web)**
- **Client:** "No external requests from your client" (CSP); responses at most 10 MB (Reddit, devvit-docs "Devvit Web overview", GitHub, undated, https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/devvit-web/devvit_web_overview.mdx) [V].
- **Server AI:** server-side AI only through OpenAI or Gemini (devvit-docs "HTTP fetch policy") [V].
- **Rules:** may not target under-13s; free-text input is discouraged (devvit-docs "Devvit rules") [V].
- **Developer Funds:** the 2025-04-01 to 2026-06-30 programme paid up to $167,000 per app; H2 2026 terms exist but could not be opened (devvit-docs, version of 2025-12-17) [V; U for H2 2026].

**Others**
- **Facebook Instant Games** is still documented as the HTML5 platform inside Facebook and Messenger (Meta, "Instant Games", undated, https://developers.facebook.com/docs/games/instant-games) [V]. Its terms were not reachable. [U]
- **Yandex Games:** up to 100 MB; monetisation through its SDK required (Yandex, "Requirements", 2026-10-09, https://yandex.com/dev/games/doc/en/concepts/requirements) [V].
- **TikTok Mini Games:** live in 10 markets including the US, with in-app ads and TikTok payments (TikTok for Developers, "Mini Games overview", 2026-10-05, https://developers.tiktok.com/doc/mini-games-overview) [V].
- **Newgrounds and GameDistribution:** terms could not be verified (403 or JavaScript-only pages). [U]

### 1.2 App stores through a PWA or wrapper

**Google Play (Trusted Web Activity)**

| Item | Rule | Source |
|---|---|---|
| Target API | From **2026-08-31**, new apps and updates must target API 36 (Android 16) | Android Developers, "Target API level requirement", undated, https://developer.android.com/google/play/requirements/target-sdk [V] |
| TWA tooling | Digital Asset Links; Bubblewrap CLI v1.27.0 (2026-10-09); Play Billing via the Digital Goods API, enabled with `playBilling` | Chrome for Developers, "Trusted Web Activity" and "Use Play Billing in your TWA", undated, https://developer.chrome.com/docs/android/trusted-web-activity ; GitHub releases, https://github.com/GoogleChromeLabs/bubblewrap/releases [V] |
| Billing | Play Billing mandatory for digital goods, except under the alternative-billing and external-link programmes | Play Console Help, "Payments policy", undated, https://support.google.com/googleplay/android-developer/answer/9858738 [V] |
| Fees, US/EEA/UK from 2026-06-30 | 10% + 5% on the first $1M; 20% + 5% (new installs) or 25% + 5% (existing installs) at the standard rate; subscriptions 10% + 5% | Play Console Help, "Service fees", undated, https://support.google.com/googleplay/android-developer/answer/112622 [V] |
| US external links (Epic v. Google order) | Fee reporting from 2026-10-01; linked purchases from 10%; **$3.65 per game install** within 24 h of a link | Play Console Help, answers 16470497 and 16497028, undated [V] |
| Families policy | An app for children "must not merely provide a webview of a website"; adult action required before children can exchange personal information | Play Console Help, "Families Policies", undated, https://support.google.com/googleplay/android-developer/answer/9893335 [V] |
| AI content | Apps that generate AI content "must contain in-app user reporting or flagging features" | Play Console Help, "AI-Generated Content", undated, answer 13985936 [V] |
| Data safety | Required even with no data collected; data "only processed locally on the user's device" need not be disclosed | Play Console Help, Data safety, undated, answer 10787469 [V] |
| Developer verification | Enforced from 2026-09-30 in Brazil, Indonesia, Singapore and Thailand; global in 2027 | Android Developers, "Android developer verification", undated, https://developer.android.com/developer-verification [V] |
| New personal accounts | Closed test with 12 testers for 14 days | Play Console Help, answer 14151465, undated [V] |

**Apple App Store** (Apple, "App Review Guidelines", last updated 2026-10-16, https://developer.apple.com/app-store/review/guidelines/) [V]

| Guideline | Rule |
|---|---|
| 4.2 | An app must "elevate it beyond a repackaged website" |
| 4.2.3(ii) | Extra resources downloaded on first launch: "disclose the size of the download and prompt users before doing so" |
| 4.7 | HTML5 mini apps and mini games allowed. 4.7.1 requires content filtering, reporting and blocking, and in-app purchase for digital goods |
| 1.2 | User-generated content, now explicitly including "AI content creation apps": filtering, reporting, blocking, published contact details |
| 3.1.1 | In-app purchase required for currencies; credits "may not expire". 3.1.1(a): link-out entitlements "are not required … in their United States storefront apps" |
| 5.1.1(v) | In-app account deletion where accounts can be created |
| 1.3, 5.1.4 | Kids Category and children's apps: avoid third-party analytics and ads |

- **Fees:** Small Business Program, 15% up to $1M proceeds (Apple, undated, https://developer.apple.com/app-store/small-business-program/) [V].
- **Texas:** age assurance and parental consent for new Texas accounts from 2026-06-04, through the Declared Age Range API (Apple Developer News, "Update for Apps Distributed in Texas", 2026-06-03, https://developer.apple.com/news/?id=sg176nne) [V].
- **Age ratings:** new rating content descriptors from 2026-11-16, required by 2027-01-12 (Apple Developer News, 2026-11-02, https://developer.apple.com/news/?id=yxkh08us) [V].
- **Epic v. Apple:** the April 2025 contempt order bars commission on US link-outs. The Supreme Court declined a stay on 2026-05-06 and agreed on 2026-06-30 to hear Apple's appeal (Wikipedia, "Epic Games v. Apple", edited 2026-11-07, https://en.wikipedia.org/wiki/Epic_Games_v._Apple) [S].
- **WebGPU in WKWebView** is not mentioned by WebKit's Safari 26 posts. See section 2.4.

**Microsoft Store**
- Individual registration is free (Microsoft Learn, 2025-08-07, updated 2026-04-18, https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer) [V].
- The App Developer Agreement v8.11, effective 2026-04-17, sets the store fee at **12% for games**, and "games on any device must use Microsoft's commerce engine" for in-app products (https://learn.microsoft.com/en-us/legal/windows/agreements/app-developer-agreement) [V].
- PWABuilder is maintained; its repo was pushed 2026-11-18 (https://github.com/pwa-builder/PWABuilder) [V].

### 1.3 SEO and discovery

- **JavaScript rendering:** Googlebot renders JavaScript pages in headless Chromium, but "server-side or pre-rendering is still a great idea" (Google Search Central, "JavaScript SEO basics", undated, https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) [V].
- **Structured data:** there is no VideoGame rich result. "Software app" is the fitting type, and requires `name`, `offers.price` (0 if free) and `aggregateRating` or `review`; `applicationCategory: GameApplication` is in Google's example (Google Search Central, "Software app structured data", undated, https://developers.google.com/search/docs/appearance/structured-data/software-app) [V].
- **Core Web Vitals** at the 75th percentile: LCP at most 2.5 s, INP at most 200 ms, CLS under 0.1 (Google Search Central, "Core Web Vitals", undated, https://developers.google.com/search/docs/appearance/core-web-vitals ; web.dev, "INP", undated, https://web.dev/articles/inp) [V].
- **hreflang:** every language version must list itself and all the others, plus an `x-default`. Google advises "Avoid automatically redirecting" by guessed language and "Don't use IP analysis" (Google Search Central, "Localized versions", undated, https://developers.google.com/search/docs/specialty/international/localized-versions) [V].
- **Where players come from:** Poki treats search, bookmarks, social and community as the developer's own traffic, at 100% revenue [V, above]. CrazyGames now scores thumbnail click-through [V, above]. Poki's survey is in section 2.2. No independent 2026 market sizing for web games was verified; Newzoo blocked fetches. [U]

### For Sonnet Man (inference)

- **Make the game's own domain plus a PWA the main channel.** Every large portal conflicts with the full game:
  - Poki: no personal data or email accounts, no chat (verses shown to strangers are close to chat), ads only, five-year exclusivity.
  - CrazyGames: no external login, pay only through its ads, 13+ only.
  - YouTube Playables: no external calls, so no model download; no login; may refuse Wasm or workers; 13+.
  - Reddit: client cannot fetch models.
- **Use portals only as a "lite" funnel, if at all.** Make it guest-only, with a scripted opponent or one tiny model, no accounts, no free text to strangers, and a link to the full game where the rules allow it.
  - CrazyGames forbids links to a playable web version, so there is no funnel there.
  - Poki counts direct traffic at 100%, but has no non-ad model.
- **The secondary channels that fit the full game are itch.io, a Discord Activity and a Telegram Mini App.**
  - itch.io: 0% share possible, 200 MB per file.
  - Discord: map the model CDN and the WebSocket API through its proxy, then test that large model files pass.
  - Telegram: Stars only if something is sold.
  - All three skew 13+, so keep classroom mode on the own domain.
- **Google Play through a TWA is workable for teens and adults, with four costs:**
  - API 36;
  - Play Billing for credits (10 to 25% plus 5% in the US, or the external-link programme);
  - an in-app "report AI output" control;
  - no child-targeted listing, because of the Families webview rule.
- **Apple is the riskiest store.** It brings guideline 4.2, the 4.2.3(ii) size prompt for a 0.3 to 1.4 GB model, credits that may not expire, unproven WebGPU in WKWebView, and Texas age assurance. Defer it.
- **SEO:**
  - Pre-render each of the 16 language landing pages in Astro, with reciprocal hreflang and `x-default`, and no auto-redirect.
  - Add SoftwareApplication/GameApplication markup only when real on-page ratings exist.
  - Load models after first paint and off the input thread, so LCP and INP stay green.

---

## 2. In-browser and on-device AI in shipped games, late 2026 (delta to the 2026-11-16 file)

### 2.1 Corrections and confirmations

- **Gemma 4's release date is 2026-04-02.** Google announced E2B, E4B, 26B MoE and 31B, all Apache 2.0, "natively trained on over 140 languages" (Google, "Gemma 4: Byte for byte, the most capable open models", 2026-04-02, https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/) [V]. It is therefore just inside the owner's post-2026-04-01 rule.
- **The Gemma 4 E2B card lists "License: apache-2.0"**, and its technical report is dated 2026-07-02 (Hugging Face, google/gemma-4-E2B-it, https://huggingface.co/google/gemma-4-E2B-it) [V].
- **Chrome storage quota, now verified.** An origin may use "up to 60% of the total disk size", and Chrome as a whole at most 80% (MDN, "Storage quotas and eviction criteria", modified 2026-01-05, https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) [V]. On the same page:
  - Firefox best-effort storage is the smaller of 10% of disk or 10 GiB per site group, and persistent storage up to 50%.
  - Chromium and Safari grant `persist()` silently from engagement; Firefox prompts.
  - Web views inside other apps get about 15% of disk.
  - Eviction is per whole origin.
- **Kokoro has had no new release since 2025-02-27** (Hugging Face model listing for hexgrad, https://huggingface.co/api/models?author=hexgrad) [V].
- **Tiny Aya** was released 2026-02-13, before the cutoff. Its L2-Thinker variant is CC-BY-NC-4.0 (Hugging Face, CohereLabs/tiny-aya-l2-thinker) [V].

### 2.2 What download and load time players accept

- **Poki's survey** ("State of Web Gaming Report 2026", 2026-06-25, https://poki.com/blog/state-of-web-gaming-report-2026) [V]:
  - 46% of weekly web gamers had stopped playing a mobile game because it "took too long to open or load", and 28% because the download was too large. On PC/console: 32% and 26%.
  - Method: 2,000 US and UK weekly web gamers, May 2026, by Atomik Research for Poki (a vendor).
- **Portal gates:**
  - Poki: more than 10 s and players leave [V, section 1.1].
  - CrazyGames: at most 50 MB before play, or 20 MB for the mobile homepage [V, section 1.1].
  - YouTube Playables: under 30 MiB initial and 512 MB heap [V, section 1.1].
- **web.dev, "Client-side AI performance"** (undated, https://web.dev/articles/client-side-ai-performance) [V]:
  - "5MB can be a useful rule of thumb" for an in-page model.
  - "Desktop users are more likely to be OK with large downloads than mobile users".
  - Warn before large downloads, show progress, resume, never block the UI.
- **Background Fetch survives.** Chrome filed to remove it in Chrome 146 (2025-11-24). The intent was withdrawn on 2025-11-30 after objections that Google itself recommended it for AI model downloads (blink-dev, https://mail-archive.com/blink-dev@chromium.org/msg15289.html , https://mail-archive.com/blink-dev@chromium.org/msg15331.html) [V]. It is Chromium-only. [S, caniuse]
- **Cross-Origin Storage** would let sites share one cached copy of a model.
  - Chrome announced it as an Intent to Prototype; it is "not yet natively implemented in any browser" (Chrome for Developers, "Introducing Cross-Origin Storage", 2026-11-10, https://developer.chrome.com/blog/introducing-cross-origin-storage) [V].
  - Transformers.js has an opt-in `env.experimental_useCrossOriginStorage` (Hugging Face blog, 2026-06-23, https://huggingface.co/blog/cross-origin-storage) [V].

### 2.3 New small open models released after 2026-04-01

Only models with a dated primary page are listed. Dates are Hugging Face repo creation unless a card or paper gives one.

| Model | Date | Size | Languages | Licence | Browser build | Fit for verse |
|---|---|---|---|---|---|---|
| Gemma 4 E2B / E4B | 2026-04-02 | 2.3B / 4.5B effective | 140+ trained | Apache 2.0 | Yes (see 2026-11-16 file) | Writer and judge, desktop |
| **Liquid d1-2B** ("decision model", LFM3 family) | 2026-10-27 | 1.92B | 16 (as LFM3) | LFM Open v1.0 | `LiquidAI/d1-2B-ONNX`, q4f16 about 1.95 GB, needs `onnxruntime-web/webgpu`, rows under 8,192 tokens | **Judge**: "returns calibrated answers in one forward pass, without generating tokens"; supports "ordered rubric-style scoring"; uses include "judging and reranking" and "moderation"; "not a chat model" |
| Apertus v1.1 0.5B / 1.5B / 4B Instruct | 2026-05-01/03 (paper 2026-05-27) | 0.5 to 4B | "1811 natively supported languages" | Apache 2.0 | None (MLX, vLLM) | Weak: 1.5B multilingual average 0.382 against 0.534 for the 8B |
| Granite 4.2 3B | card 2026-08-25 | 3B | 12 tested | Apache 2.0 | None | Possible server judge |

Sources:
- d1-2B: https://huggingface.co/LiquidAI/d1-2B and https://huggingface.co/LiquidAI/d1-2B-ONNX [V].
- Apertus: https://huggingface.co/swiss-ai/Apertus-v1.1-1.5B-Instruct [V].
- Granite: https://huggingface.co/ibm-granite/granite-4.2-3b [V].
- Gemma: Google blog above [V].

**Families with no small model after the cutoff**, per their Hugging Face org listings [V]:
- Qwen: only 27B and larger (Qwen3.6, April; Qwen3.8, August).
- SmolLM: SmolLM3, July 2025.
- Phi: none small.
- Ministral 3: late 2025.
- EuroLLM: 9B.
- Sarvam: 30B and larger.

Two ONNX exports, "Ling-3.0-tiny" and "Ming-3.0-tts", have no maker, date or licence on the card. Do not use them. [V]

### 2.4 Browser and device coverage the earlier file did not cover

- **Android (MDN browser-compat-data):** WebView Android, Samsung Internet and Opera Android "mirror" Chrome Android 121 for WebGPU, but mirror entries are derived automatically, not tested. Firefox Android: not supported (MDN BCD, `api/GPU.json`, https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json) [V].
- **caniuse** (https://caniuse.com/webgpu) [V]:
  - Supported: Chrome Android 157, Samsung Internet 24 to 31, Safari iOS 26.0 to 27.2.
  - Firefox Android 160 "Disabled by default".
  - Not supported: UC, QQ and Baidu.
  - **Conflict:** caniuse lists "Android Browser 157: Not supported", against MDN's WebView entry. Android in-app browsers (Instagram, TikTok, Facebook) are therefore unresolved and must be tested on devices.
- **gpuweb wiki** (edited 2026-10-02, https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) [V]: "Mozilla expects to do work on Android in 2026", and Samsung Xclipse (Exynos) is still "TBD".
- **iOS WKWebView** (Chrome and Firefox on iOS, and in-app browsers):
  - An Apple engineer said a feature "will work when it's enabled by default" in WKWebView (Apple Developer Forums thread 770862, undated, https://developer.apple.com/forums/thread/770862) [S].
  - WebGPU is on by default in iOS 26, so WKWebView should have it. That is inference.
  - Storage in such web views is about 15% of disk (MDN, above) [V].
  - A WebContent/GPU process crash in WKWebView on iPhone 15 with iOS 26.4 is reported unresolved (Apple Developer Forums 822200, April 2026, https://developer.apple.com/forums/thread/822200) [V].
- **WebGPU compatibility mode:** Chrome added opt-in `featureLevel: "compatibility"` for older OpenGL ES 3.1 devices, "starting with Android" (Chrome for Developers, "New in WebGPU 146", 2026-02-25, https://developer.chrome.com/blog/new-in-webgpu-146) [V].
- **Android tab memory limit:** none documented. [U]

### 2.5 Shipped products using on-device models

- **No shipped web game with an in-browser LLM was verified this session**; the search allowance ran out. [U]
- **Apple Foundation Models framework** (iOS 26, a 3B on-device model): Apple named the apps using it, including education apps (Grammo, Vocabulary, Platzi) and a children's story app, Lil Artist, where kids "pick characters and themes from menus rather than typing free text" (Apple Newsroom, 2025-09-29, https://www.apple.com/newsroom/2025/09/apples-foundation-models-framework-unlocks-new-intelligent-app-experiences/) [V]. That is a child-safety pattern worth copying for classroom mode.
- **NVIDIA ACE** lists games using its models. Only Total War: PHARAOH is described as using "a small on-device language model" (NVIDIA, "ACE", undated, https://developer.nvidia.com/ace) [V]. These are native games, not browser games.

### For Sonnet Man (inference)

- **The first match needs zero model bytes.** Use a scripted opponent and rule-based scoring (code-checked form, line count, rhyme). Offer the model after the first match, with its size, a progress bar, resume, and `persist()`. Use Background Fetch where present and chunked fetch into Cache or OPFS elsewhere. Turn on Transformers.js Cross-Origin Storage behind a flag.
- **Prototype d1-2B as the judge.** It is the first verified browser model whose output is a calibrated score rather than text. That closes the free-text channel an injected verse could use, and suits "score each verse alone" from the earlier file.
  - It is 1.95 GB, so it is a desktop and strong-Android tier, not iPhone.
- **Detect, probe and route.**
  - Exynos Galaxy, Firefox Android, UC/QQ/Baidu and unproven Android in-app browsers go to the no-model tier.
  - Show "open in your browser" from in-app browsers on Android until WebView is tested.
- **Gemma 4 E2B qualifies under the owner's date rule.** Older defaults such as Kokoro and Whisper do not; see section 3 for replacements.

---

## 3. Voice in games: on-device speech recognition and synthesis in the browser, 2026

### 3.1 Speech recognition (speech-to-text)

**Web Speech API on-device mode, by browser**

| Browser | State | Source |
|---|---|---|
| Chrome desktop (Windows, Mac, Linux) | On-device Web Speech since **Chrome 139** (stable 2025-08-05), "allowing websites to ensure that neither audio nor transcribed speech are sent to a third-party service". About 60 MB per language pack. | Chrome 139 release notes, https://developer.chrome.com/release-notes/139 ; blink-dev Intent to Ship, 2025-01-06, https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM/m/cz7ZnL59AAAJ [V] |
| Chrome Android, ChromeOS | "Android & ChromeOS currently do not support on-device Web Speech". A quality hint (`'command'`, `'dictation'`, `'conversation'`) targets desktop Chrome 150. | blink-dev Intent to Ship, 2026-05-05, https://groups.google.com/a/chromium.org/g/blink-dev/c/P8P-x7AnC6I [V] |
| Edge | On-device model in Canary/Dev 150.0.4076+ behind a flag. Six languages: en-US, de-DE, it-IT, pt-PT, es-ES, ko-KR. "The speech input into the model never leaves the device". | Microsoft Learn, "Speech Recognition API", updated 2026-11-18, https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api [V] |
| Firefox | "a _strictly_ on device implementation", intended "to ship this in 161 on all desktop platforms". Android awaits hardware acceleration. Firefox 161 is due 2026-11-24; its release notes did not yet list the feature, and the model and languages are not named. | dev-platform, 2026-09-16, confirmed 2026-10-12, https://groups.google.com/a/mozilla.org/g/dev-platform/c/6f4l8P9hO6o [V]; MDN Firefox 161 notes [V]; actual ship [U] |
| Safari | In macOS 26 testing, Safari asks about sending data to Apple, and "Transcription does not work offline". | Addpipe blog, 2026-08-17, https://blog.addpipe.com/apple-speechanalyzer-api/ [S] |

MDN documents `SpeechRecognition.processLocally` (page modified 2026-11-06, https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally) [V].

**Speech-recognition models released after 2026-04-01 with a browser route**

| Model | Date | Size | Languages | Licence | Browser |
|---|---|---|---|---|---|
| **Moonshine Streaming tiny/small, per language** | repos 2026-08-24 | small-es 112.9M | es, de, ja, zh, ar, vi, tl (plus English) | MIT ("MIT by default … in every language and at every size", except legacy non-streaming non-English models) | `.ort` packages; the repo lists JavaScript/WASM; small-es word error rate 4.73 to 4.93 |
| Granite Speech 5.0 2B | 2026-10-20 | 2B (q4 about 1.7 GB in all) | en, fr, de, es, pt, ja | Apache 2.0 | `granite-speech-5.0-2b-ONNX`, Transformers.js 4.3+, WebGPU including Safari 26 |
| Granite Speech 5.0 470M TurboCTC | English 2026-08-25; multilingual 2026-10-21 | 470M | en, fr, de, es, pt, it, ja | Apache 2.0 | WebGPU streaming demo Spaces linked; no real-time factor given |
| NVIDIA parakeet-unified-en-0.6b | 2026-04-07 | 0.6B | English | not checked | not checked |

Sources:
- Moonshine: GitHub, undated, https://github.com/moonshine-ai/moonshine ; Hugging Face, https://huggingface.co/moonshine-ai/moonshine-streaming-small-es [V].
- Granite: Hugging Face, https://huggingface.co/ibm-granite/granite-speech-5.0-2b , https://huggingface.co/ibm-granite/granite-speech-5.0-2b-ONNX , https://huggingface.co/ibm-granite/granite-speech-5.0-470m-turboctc [V].
- Parakeet: Hugging Face listing [V, listing only].

Older than the cutoff, for reference only:
- **Qwen3-ASR-0.6B:** paper 2026-01-29; 30 languages; no ONNX (https://huggingface.co/Qwen/Qwen3-ASR-0.6B) [V].
- **Voxtral Mini 4B Realtime 2602:** February 2026; 13 languages; delay 240 ms to 2.4 s, 480 ms recommended; a WebGPU Space exists (https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602) [V].

**No measured in-browser real-time factor was found** for any of these. One 2026-06-02 article gives only illustrative figures (Fora Soft, https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/client-side-asr-faster-whisper-wasm-browser) [V, not measurements].

### 3.2 Speech synthesis (text-to-speech)

| Model | Date | Size | Languages | Licence | Cloning | Note |
|---|---|---|---|---|---|---|
| **Kitten TTS 2 nano / pico** | 2026-11-13 | nano 17M (int8 17.4 MB, int4 8.8 MB per language); pico 7.2M (8.0 or 4.0 MB) | 8: en, de, es, it, pt-BR, ru, hi, fr | Apache 2.0 (models, voices, G2P) | No | ONNX on CPU; browser use not stated |
| Kitten TTS 2 (full) | 2026-09-30 | 1.7B | 16 | Stellon Labs Community (limited commercial) | Yes, 5 to 30 s of reference audio | No web build |
| NeuTTS-2E | 2026-07-21 | about 125M active | English, four fixed voices | Apache 2.0, gated | No | Perth watermark on every output |
| Chatterbox-nano | 2026-04-14 | 110M | English | MIT | Yes | Perth watermark |
| Chatterbox-flash | 2026-05-28 | about 520M | English | MIT | Yes, zero-shot | First audio packet 103 ms on GPU |
| Piper (piper1-gpl) v1.5 to v1.8 | 2026-07-17 to 2026-09-04 | n/a | Added Hebrew, Japanese, Thai phonemisers | GPL | n/a | No web build in release notes |
| Supertonic 3 | 2026-04-29 | about 99M | 31 | OpenRAIL-M (model), MIT (code) | No | Covered in the 2026-11-16 file; licence now read, see below |

Sources (Hugging Face model cards unless noted) [V]:
- Kitten: https://huggingface.co/KittenML/kitten-tts-2-nano , https://huggingface.co/KittenML/kitten-tts-2-pico , https://huggingface.co/KittenML/kitten-tts-2
- NeuTTS: https://huggingface.co/neuphonic/neutts-2e
- Chatterbox: https://huggingface.co/ResembleAI/chatterbox-nano , https://huggingface.co/ResembleAI/chatterbox-flash
- Piper: GitHub releases, https://api.github.com/repos/OHF-Voice/piper1-gpl/releases
- Kyutai: no TTS release after April 2026 in its Hugging Face listing [V].

**Supertonic 3's OpenRAIL-M licence, now read** (https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE) [V]. It forbids:
- "exploiting, harming or attempting to exploit or harm minors";
- impersonation "(e.g. deepfakes) … without their consent";
- publishing output "without expressly and intelligibly disclaiming that the information and/or content is machine generated".

Redistributors must pass these restrictions on to users.

### 3.3 Latency, permissions, privacy and cloning

- **Response-time limits:** 0.1 s feels instant, 1 s keeps the user's flow, and beyond 10 s needs progress feedback (Jakob Nielsen, "Response Times: The 3 Important Limits", NN/g, 1993, https://www.nngroup.com/articles/response-times-3-important-limits/) [V].
- **Streaming speech state of the art:** streaming recognition at about 480 ms delay (Voxtral, above) plus TTS first audio at about 100 ms (Chatterbox-flash, above). Both are GPU figures; phone browsers will be slower. [Inference from V figures]
- **Microphone permission:** ask in context, after a user gesture. web.dev reports 12% acceptance for prompts without clear intent against 30% after interaction. Detect permanent denial with `navigator.permissions.query()` (web.dev, "Permissions best practices", undated, https://web.dev/articles/permissions-best-practices) [V].
  - iOS Safari re-prompt behaviour and WKWebView microphone policy were not verified. [U]
- **Children's voices under COPPA** (16 CFR 312.2 and 312.5, Cornell LII, https://www.law.cornell.edu/cfr/text/16/312.2 , https://www.law.cornell.edu/cfr/text/16/312.5) [V]:
  - "Personal information" includes an "audio file where such file contains a child's … voice", and biometric identifiers including "voiceprints".
  - §312.5(c)(9) exempts an audio file used only to answer the child's request and then deleted. See section 5.1.
- **EU AI Act Art 50(2)** requires machine-readable marking of synthetic audio. See section 5.4.
- **Cloning risk:** several new small TTS models clone a voice from seconds of audio (Kitten TTS 2 full, Chatterbox). NeuTTS and Chatterbox watermark their output [V, above]. Cloning a real performer's voice raises the digital-replica laws in section 5.8.

### 3.4 A licence defect in the current TTS stack (checked by me)

- **kokoro-js 1.2.1** (Apache-2.0) depends on `phonemizer` ^1.2.1 (hexgrad/kokoro, `kokoro.js/package.json`, https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro.js/package.json) [V].
- **`phonemizer` 1.2.1** (published 2025-01-16) is labelled Apache-2.0 and describes itself as a "Simple text to phones converter using eSpeak NG" (npm registry, https://registry.npmjs.org/phonemizer) [V, re-checked].
- **I downloaded the tarball and inspected it** without running it:
  - The 1.3 MB `dist/phonemizer.js` contains an Emscripten `eSpeakNGWorker` module with an embedded base64 WebAssembly binary.
  - It ships no GPL notice; its only LICENSE file is Apache 2.0 [V, my inspection 2026-11-19].
- **eSpeak NG is "GPL version 3 or later"** (GitHub, espeak-ng, https://github.com/espeak-ng/espeak-ng) [V].

Inference: serving kokoro-js to browsers distributes GPL-3.0 object code without GPL notices or an offer of source. Fix it either way:
- comply (ship the GPL notice and the eSpeak NG source, as a separable module); or
- replace the grapheme-to-phoneme step with a permissive one, such as Kitten TTS 2's Apache-licensed G2P [V that it is Apache, U that it fits].

### For Sonnet Man (inference)

- **Speech input:**
  - Desktop Chrome (and Firefox 161 if it ships): Web Speech only with `processLocally = true` and an `available()` check. Never use the default cloud mode.
  - Phones: ship the game's own model. Moonshine streaming per language (MIT, about 100M) covers 7 of the likely 16. Granite Speech 5.0 470M is a candidate once its browser build is confirmed. Measure the real-time factor on a mid Android and an iPhone, because nobody has published one.
  - Typing stays a first-class equal path.
- **Speech output:**
  - Kitten TTS 2 nano or pico (Apache, 4 to 17 MB per language, after the cutoff) where its 8 languages apply; Supertonic 3 for the rest.
  - Fixed preset voices only, no cloning path, and a visible "AI voice" label. That meets OpenRAIL-M and Art 50 together.
  - Retire kokoro-js, or fix its GPL component (section 3.4).
- **Children's audio never leaves the device.** Transcribe in memory, discard the audio, and send only text to the server for online judging. Say so in the privacy notice.
- **Latency budget:** under 1 s from the end of speech to the transcript on screen, and a visible progress state for any judge step longer than 1 s.
- **Never synthesise Devon Glover's voice** without a separate signed voice addendum (section 5.8). Use his real recorded lines, labelled as his.

---

## 4. Trust and safety for player verses judged by AI

### 4.1 Prompt injection against an AI judge

- **OWASP LLM01:2025 Prompt Injection** (OWASP GenAI Security Project, 2025, https://genai.owasp.org/llmrisk/llm01-prompt-injection/) [V].
  - Mitigations: constrain model behaviour; define and validate output formats; filter input and output; least privilege; segregate external content; adversarial testing.
  - No 2026 edition of the Top 10 was found.
- **NIST AI 100-2 E2025**, "Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations", final 2025-03-24 (https://csrc.nist.gov/pubs/ai/100/2/e2025/final) [V for title and date; content not read].
- **2026 results on judges and guards** (arXiv):
  - **arXiv 2606.25487** (2026-06-24, https://arxiv.org/abs/2606.25487) [V]. Benign framing wrappers flipped LLM jailbreak judges 57% to 100% of the time, and one prepended refusal sentence 39% to 88%. A dedicated classifier resisted surface attacks (at most 6.7%), but a white-box GCG attack flipped 70% of its confident positives.
  - **arXiv 2605.25415** (2026-05-25, https://arxiv.org/abs/2605.25415) [V]. Hidden-font injections lifted weak papers to acceptance ratings across 12 LLM reviewers "in a substantial fraction of cases".
  - **arXiv 2611.08834** (2026-11-06, https://arxiv.org/abs/2611.08834) [V].
    - 11 open-weight injection guards had document-level false-positive rates "as high as 92.39%".
    - "A five-regex baseline is not Pareto-dominated by any guard".
    - A cascade that checks a mid-tier model's positives with a larger model cost 6.5 times less than the large model alone.
  - **arXiv 2604.24074** (2026-04-27) [S]. Rewording the judge prompt alone shifted measured harm rates by up to 24.2 points.
- **Defences:**
  - Spotlighting cut attack success from over 50% to under 2% in tests on GPT models (arXiv 2403.14720, 2024) [S].
  - Structured queries (StruQ, arXiv 2402.06363, 2024) [S] separate prompt from data.
  - But architecture-aware attacks reach 85% to 95% success against StruQ and SecAlign (arXiv 2507.07417, 2025) [S].
- The 2025 judge-injection paper (Maloyan and Namiot, up to 73.8% success, smaller models more vulnerable) is in the card-games file.

### 4.2 Multilingual moderation that can run on the game's own hardware

Released after 2026-04-01:

| Model | Date | Size | Languages | Licence | Runs in browser? | Caveat |
|---|---|---|---|---|---|---|
| **content-safety-guard-small** (Horizon-Labs, on mmBERT-small) | 2026-09-27 | 141M; int8 ONNX 268 MB | 17 evaluated, 25 tagged | Apache 2.0 | Yes: `onnx-community/content-safety-guard-small-ONNX`, Transformers.js `text-classification` | 15 categories including `sexual_minors`. PolyGuard prompt F1 0.771. Flags about 22% of XSTest's safe prompts. Its card says fraud, misinformation and `sexual_minors` have F1 below 0.45: "Do not rely on it alone for child-safety" |
| OpenAI privacy-filter (PII spans) | 2026-04-17 | 1.5B total, 50M active | "Primarily English" | Apache 2.0 | Yes: Transformers.js 4.2+, WebGPU q4 | "a redaction and data minimization aid, not an anonymization, compliance, or a safety guarantee" |
| **Roblox PII classifier v2** | 2026-08-03 | 0.6B (XLM-R large) | "from 17 to 189 languages" | Apache 2.0 | Not stated | Labels `privacy_asking_for_pii`, `privacy_giving_pii`, `directing_users_off_platform`; internal F1 from 63.41% to 90.52% |
| Roblox voice-safety-classifier-v3 | 2026-05-19 | 0.3B | 30 | Apache 2.0 | Not stated | At 1% false positives, recall varies widely: English 67.9%, Turkish 32.9% |
| Mistral Shieldstral-1.0-3B | repo 2026-07-16 | 3B | 12 | Apache 2.0 | No (about 16 GB VRAM BF16) | Checks text against a natural-language policy given at run time; ToxicChat F1 84.1 |
| IBM Granite Guardian 4.1 8B | April 2026 | 8B | English only | Apache 2.0 | No | Harm, bias, jailbreak and custom criteria |

Sources: Hugging Face model cards [V]:
- https://huggingface.co/Horizon-Labs/content-safety-guard-small
- https://huggingface.co/openai/privacy-filter
- https://huggingface.co/Roblox/roblox-pii-classifier-v2
- https://huggingface.co/Roblox/voice-safety-classifier-v3
- https://huggingface.co/mistralai/Shieldstral-1.0-3B
- https://huggingface.co/ibm-granite/granite-guardian-4.1-8b

Older than the cutoff, for reference only [V dates]:
- Qwen3Guard (paper 2025-10-16; 0.6B; 119 languages; a token-streaming variant);
- gpt-oss-safeguard (2025-09-18; 20B and 120B);
- Llama Guard 4 and Prompt Guard 2 (April 2025).

**Roblox Sentinel**, open-sourced 2025-08-07 (Apache 2.0), flags grooming patterns from the skew of a user's recent messages. It helped file about 1,200 NCMEC reports in the first half of 2025, and about 35% of its detections came before any user report (Roblox Newsroom, https://about.roblox.com/newsroom/2025/08/open-sourcing-roblox-sentinel-preemptive-risk-detection ; GitHub, https://github.com/Roblox/Sentinel) [V].

**Wordlists:** LDNOOBW covers 28 languages under CC BY 4.0. Its own README says "what goes in these lists is subjective" (GitHub, https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) [V]. Wordlists miss meaning: grooming uses no bad words. [U, common knowledge]

### 4.3 Legal duties and expectations for a small studio with player-to-player content

**United States, child sexual exploitation reporting** (18 U.S.C. §2258A, Cornell LII, https://www.law.cornell.edu/uscode/text/18/2258A) [V]:
- A provider with "actual knowledge" of apparent child sexual exploitation must report to NCMEC's CyberTipline "as soon as reasonably possible".
- The REPORT Act (Pub. L. 118-59, 2024-05-07) added child trafficking and enticement, and extended preservation to 1 year.
- Knowing and wilful failure costs up to $600,000 the first time for providers with under 100 million monthly users.
- §2258A(f): no duty to monitor or scan.
- Whether a verse game is a "provider" (an electronic communication or remote computing service, §2258E) is unresolved. [U] Text exchanged between users makes it likely.
- NCMEC's 2025 figures: 21.3 million reports; over 2,000 companies registered but just over 300 reported; enticement reports up 158% after the REPORT Act (NCMEC, "CyberTipline Data", https://www.missingkids.org/gethelpnow/cybertipline/cybertiplinedata) [V].

**United Kingdom, Online Safety Act 2023** (legislation.gov.uk) [V]:
- s.9: every regulated user-to-user service needs a "suitable and sufficient illegal content risk assessment", kept current and redone before significant changes (https://www.legislation.gov.uk/ukpga/2023/50/section/9).
- s.10(10): what is proportionate depends on the risk assessment and "the size and capacity of the provider". s.10(3)(b): "swiftly take down" illegal content once aware.
- s.20: easy reporting of illegal content, and of content harmful to children where children can access the service.
- s.12: age checks must be "highly effective" where needed.
- The government explainer (gov.uk, updated 2025-04-24, https://www.gov.uk/government/publications/online-safety-act-explainer/online-safety-act-explainer) [V]:
  - illegal-content duties enforceable from **2025-03-17**;
  - children's risk assessments due by **2025-07-24**;
  - "small services with limited functionality are not required to take the same actions as the largest companies";
  - fines up to £18m or 10% of revenue.
- Enforcement has reached small services: 4chan was fined £20,000 in August 2025 and £520,000 in March 2026 (Wikipedia, "Online Safety Act 2023", https://en.wikipedia.org/wiki/Online_Safety_Act_2023) [S].
- Ofcom's code measures for small, low-risk services could not be opened (403). [U]

**European Union, Digital Services Act**, Regulation (EU) 2022/2065 (EUR-Lex) [V excerpts]:
- **Art 16 (notice and action)** and **Art 17 (statement of reasons)** apply to all hosting providers; Recital 50 says "regardless of size".
- **Art 19(1):** the online-platform duties (Arts 19 to 28) do not apply to micro or small enterprises. Micro means under 10 staff and at most €2M turnover; small means under 50 staff and at most €10M (European Commission, "SME definition", https://single-market-economy.ec.europa.eu/smes/sme-fundamentals/sme-definition_en) [V].
- **Art 28 guidelines on minors** (published 2025-07-14, updated 2026-04-22) recommend private-by-default accounts, streaks and notifications off by default, and block and mute for any user. They "apply to all online platforms accessible to minors, except micro and small enterprises" (European Commission, https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors) [V].
- A non-EU provider must name an EU legal representative (Art 13). [U]

**Australia:** the social media minimum age of 16 took effect 2025-12-10; Roblox and Steam were assessed as "not required" to comply (Wikipedia, "Online Safety Amendment (Social Media Minimum Age) Act 2024") [S]. The age-assurance industry codes could not be opened. [U]

**Industry resources**
- **Fair Play Alliance:** its site now redirects to the **Thriving in Games Group** ("What began in 2017 as the Fair Play Alliance", https://thrivingingames.org/about) [V].
- **"Disruption and Harms in Online Gaming Framework"** (FPA and ADL, December 2020): impact over intent, cover every channel, and no voice chat on by default among strangers (ADL, https://www.adl.org/resources/report/disruption-and-harms-online-gaming-framework) [V].
- **Tech Coalition Pathways** is free for startups and small user-generated-content platforms. It covers child-safety policy, user reporting, NCMEC reporting, and a free PhotoDNA sublicence for eligible companies (https://www.technologycoalition.org/pathways) [V].
- **Platform rules that set the bar:**
  - Google Play requires in-app reporting of AI output (section 1.2).
  - Apple 1.2 and 4.7.1 require filtering, reporting and blocking (section 1.2).
  - CrazyGames makes the developer liable for player content (section 1.1).

### For Sonnet Man (inference)

1. **The proportionate minimum, before multiplayer verses are visible to others:**
   - a written risk assessment (UK s.9), updated before classroom and tournament features ship;
   - a report button on every verse and every player;
   - a named responsible person and a written takedown process;
   - a statement of reasons to the author when a verse is removed (DSA Art 17);
   - block and mute;
   - NCMEC registration with a 1-year preservation procedure and a reporting runbook;
   - plain terms of service and community rules.
2. **Design the risk out rather than moderate it.**
   - Classroom mode: no free messaging; verses visible only within the match or class; no profiles or friend discovery; generated or preset names (the Lil Artist pattern from section 2.5); private by default.
   - Never relay voice between players.
   - This also keeps PEGI's "unrestricted communication" (PEGI 18) out of reach.
3. **Layer moderation on shared verses, on the server:**
   - regex and wordlist first (cheap and, per 2611.08834, competitive);
   - then content-safety-guard-small (also usable on the client as a pre-filter);
   - then Roblox PII v2 for contact-details and "move off-platform" patterns;
   - optionally Shieldstral-3B with a written policy;
   - human review for anything flagged `sexual_minors`, because no small model is reliable there.
4. **Harden the judge:**
   - score each verse alone, with integer or decision-model output (d1-2B);
   - spotlight or delimit the verse;
   - cap or re-run scores on verses with instruction-like text;
   - red-team with benign-framing and refusal-prefix attacks, which flip judges 57% to 100%;
   - for ranked play and tournaments, only the server's judgement counts.
5. **Join Tech Coalition Pathways** (free) before launching user-to-user features, and run Ofcom's online regulation checker, which could not be fetched here.

---

## 5. Law and ratings as they apply to Sonnet Man, late 2026

This is research, not legal advice. Each item ends with an applies / does not apply / depends line, which is inference. Loot boxes, PEGI's June 2026 rules, the Digital Fairness Act proposal, Brazil and Australia are in the card-games file; PEGI's June 2026 rules were re-confirmed on pegi.info (PEGI, "What do the labels mean", undated, https://pegi.info/what-do-the-labels-mean) [V].

### 5.1 COPPA as amended in 2025

**Dates.** The amended rule was published 2025-04-22 at 90 FR 16918 and took effect 2025-06-23. **Compliance has been required since 2026-04-22**, except some safe-harbor duties with their own dates (FTC, "Children's Online Privacy Protection Rule", Federal Register vol. 90 no. 76, 2025-04-22, https://www.govinfo.gov/content/pkg/FR-2025-04-22/html/2025-05904.htm) [V].

**What changed** (same source) [V]:
- **Separate parental consent** is required for disclosure to third parties, unless the disclosure is integral to the service (§312.5(a)(2)). Notices must name the third parties or their categories.
- **Written information security program** (§312.8(b)): a designated coordinator, a yearly risk assessment, safeguards, testing, and a yearly review.
- **Written data retention policy** (§312.10), published in the online notice. Indefinite retention is barred.
- **Biometric identifiers**, including "voiceprints", are now personal information.
- **Audio file exception** (§312.5(c)(9)): an audio file of a child's voice "and no other personal information", used only to respond to the request and deleted immediately. No direct notice is needed; the online notice is.
- **"Mixed audience"** is newly defined. Such a service may not collect personal information, beyond the exceptions, before a neutral age screen.
- **Internal-operations exception:** the online notice must now state "the specific internal operations for which the operator has collected a persistent identifier" (§312.4(d)(3)).
- **School authorisation:** the FTC did not finalise the proposed ed-tech and school-consent amendments, and keeps its existing guidance.

**FTC activity in 2026**
- **2026-02-25:** a policy statement on age verification. The FTC will not bring COPPA actions against general- and mixed-audience operators that collect personal information "for the sole purpose of determining a user's age", if the data is used only for that, deleted promptly, kept secure and disclosed only to assured third parties (FTC press release, 2026-02-25, https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children) [V]. It does not bind state attorneys general (law-firm commentary, Feb–Mar 2026) [S].
- **No 2026 COPPA case against a game or ed-tech company** was among the FTC's 20 most recent COPPA items. The latest listed are Disney ($10M order approved 2025-12-31), Apitor and Sendit (FTC COPPA tag page, https://www.ftc.gov/terms/childrens-online-privacy-protection-act-coppa) [V].
- An FTC webinar on the Take It Down Act is set for 2026-12-10 (same page) [V].

**School consent for classroom mode** (FTC, "Complying with COPPA: FAQs", section N, undated, https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) [V]:
- A school may consent in place of parents only where data is collected "for the use and benefit of the school, and for no other commercial purpose".
- The operator must give the school full notice and, on request, let it review and delete the data.
- The consent method must reach the school, "not a child pretending to be a teacher".
- If data is also used commercially, "the school cannot consent on behalf of the parent" (N.5).
- Schools should choose vendors at the institution level.

**Applies.** Classroom mode means the game knowingly serves children under 13.
- **In full now:**
  - a written security program;
  - a written retention policy;
  - a neutral age screen before any collection;
  - separate consent for any third-party disclosure (including the email sender, analytics and error-reporting processors, unless integral);
  - an online notice naming the internal operations behind persistent identifiers (passkey credential IDs, session tokens).
- **Under-13 accounts** need parent or school consent. Email-code sign-in for a child collects online contact information.
- **School-consented accounts** must have no marketplace, credits purchases, referrals or model training on their data.
- **Voice** kept on the device is not collected. If audio is ever uploaded, the §312.5(c)(9) exception is doubtful for a logged-in child, because other personal information is present.

### 5.2 US state children's, design-code and AI-chatbot laws

| Law | Status, Nov 2026 | Threshold | Applies to Sonnet Man? (inference) | Source |
|---|---|---|---|---|
| **California AADC** | 2026-03-12: Ninth Circuit narrowed the injunction. High-privacy defaults, age estimation, geolocation signal and child-appropriate tools are enforceable. DPIA, profiling, dark-pattern and cure provisions are still enjoined. | CCPA "business" (about $26.6M revenue [U], or 100,000 consumers' data bought or sold) | Probably not (below threshold) | Cooley, 2026-03-30, https://www.cooley.com/news/insight/2026/2026-03-30-netchoice-v-bonta-ninth-circuit-narrows-injunction-against-californias-ageappropriate-design-code-act [S] |
| **Maryland Kids Code** | In force since 2024-10-01; motion to dismiss NetChoice's challenge denied 2025-11-24 | $25M revenue, or buys, receives, sells or shares data of 50,000+ Maryland consumers or devices | Below, unless 50,000 Maryland users or devices ("receives" counts) | Troutman Privacy, 2025-11-30, https://www.troutmanprivacy.com/2025/11/district-court-denies-motion-to-dismiss-challenge-to-marylands-kids-code/ [S] |
| **Vermont AADC** (Act 63, S.69) | Signed 2025-06-12; **effective 2027-01-01**; AG rulemaking in 2026 | **No revenue threshold.** Covers a business with most revenue from online services and a service "reasonably likely to be accessed" by minors (COPPA child-directed, or 2%+ of audience aged 2–17) [S] | **Likely applies from 2027-01-01** if there are Vermont players. Duty of care against compulsive use; highest-privacy defaults; no notifications to minors midnight to 6 a.m. | Vermont Legislature, S.69 status, https://legislature.vermont.gov/bill/status/2026/S.69 [V, re-checked]; National Law Review, 2025-06-18, https://natlawreview.com/article/vermont-enacts-age-appropriate-design-code [S] |
| **Nebraska AADC** (LB 504) | Operative 2026-01-01 | $25M revenue, or 50,000+ consumers' data | Probably below | Nebraska Legislature, LB 504 as introduced, 2025-01-22, https://nebraskalegislature.gov/FloorDocs/109/PDF/Intro/LB504.pdf [V; enacted text U] |
| **App store accountability acts**: Texas SB 2420 (in effect 2026-06-04), Utah SB 142, Louisiana HB 570; California Digital Age Assurance Act AB 1043 (effective 2027-01-01) | See source | Apply to app stores and the apps they distribute | **Not to the website.** They apply if a store app ships: honour age signals | Apple Developer News, 2026-06-03 [V]; Wikipedia, "Social media age verification laws in the United States" [S]; Utah and Louisiana dates [U] |
| **New York Child Data Protection Act** (GBL §899-ee) | In force (2025-06-20 [U]) | No size threshold [U] | **Applies to NY minors.** Teen data only where strictly necessary or with informed consent | NY Senate, GBL §899-EE, revision 2025-06-27, https://www.nysenate.gov/legislation/laws/GBS/899-EE [V] |
| **NY SAFE for Kids Act** | AG rules 2026-07-29; effective 2027-01-25 [S] | Addictive feeds of user content | Only if the game builds an algorithmic feed of other players' verses | Wikipedia [S] |
| **California SB 243** (companion chatbots, Bus. & Prof. Code §22601 ff.) | In force 2026-01-01 [U]; annual reports from 2027-07-01 [V] | Any "companion chatbot" | **Depends on guardrails.** See below | FindLaw, BPC §22601–22603, https://codes.findlaw.com/ca/business-and-professions-code/bpc-sect-22601/ [V] |
| **NY GBL Article 47** (AI companions) | In force | Systems designed to simulate a sustained human-like relationship | Not, if the opponent keeps no relationship memory | NY Senate, GBL §1700, revision 2025-11-07, https://www.nysenate.gov/legislation/laws/GBS/1700 [V] |
| **Connecticut CTDPA** (minors' provisions) | In force | 35,000 consumers, or **any processing of sensitive data** (known child data counts [U]) | **Most likely state privacy law to apply.** No design features that "significantly increase, sustain, or extend" minors' use; no targeted ads; impact assessments | CT Attorney General, "The Connecticut Data Privacy Act", undated, https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act [V]; SB 1295 date [U] |
| Colorado minors' amendments (SB 24-041, 2025-10-01); Arkansas teen privacy act (2026-07-01) | [U] | [U] | Check | [U] |

**California SB 243's video-game exclusion, verbatim** (§22601(b)(2)(B)) [V]: "A bot that is a feature of a video game and is limited to replies related to the video game that cannot discuss topics related to mental health, self-harm, sexually explicit conduct, or maintain a dialogue on other topics unrelated to the video game."

Outside the exclusion, the duties (§22602) [V] are:
- an AI notice where a person could be misled;
- a published suicide and self-harm protocol;
- for known minors: an AI disclosure, a break reminder at least every 3 hours, and measures against sexual content.

Inference: players choose verse themes, so an unconstrained generator would fail the "cannot discuss" test. The opponent and judge must refuse or deflect those topics, hold no off-topic dialogue, and keep no memory of past sessions.

**Federal**
- **TAKE IT DOWN Act** (Pub. L. 119-12, signed 2025-05-19, https://www.govinfo.gov/content/pkg/PLAW-119publ12/html/PLAW-119publ12.htm) [V]:
  - Covered platforms "primarily" provide a forum for user content, explicitly including "games".
  - Validly reported intimate *visual* depictions must be removed within 48 hours; the process was required by 2026-05-19.
  - Inference: a text-and-voice verse game with no image upload has near-zero exposure. A one-page notice form costs little.
- **KOSA** (S. 1748) and the House KIDS Act are not enacted; COPPA 2.0 passed the Senate 2026-03-05 and stalled in the House (Wikipedia, "Kids Online Safety Act" [S]; Loeb & Loeb, 2026-06, https://www.loeb.com/en/insights/publications/2026/06/childrens-online-privacy-in-2026-congress-stalls-again-ftc-signals-priorities [S]).

### 5.3 GDPR, UK GDPR and the UK Children's code

**Ages of digital consent (GDPR Art 8)** (euConsent, "Digital Age of Consent under the GDPR", 2021-10-26, https://euconsent.eu/digital-age-of-consent-under-the-gdpr/) [S, and dated]:

| Age | Countries |
|---|---|
| 13 | Belgium, Denmark, Estonia, Finland, Latvia, Malta, Portugal, Sweden; UK (DPA 2018 s.9) |
| 14 | Austria, Bulgaria, Cyprus, Italy, Lithuania, Spain |
| 15 | Czechia, France, Greece; Slovenia since 2023 [U] |
| 16 | Croatia, Germany, Hungary, Ireland, Luxembourg, Netherlands, Poland, Romania, Slovakia |

A pending Spanish bill would raise Spain to 16. [U] Re-check every country against its data-protection authority before relying on the table.

**UK Children's code (Age Appropriate Design Code)** has 15 standards: best interests, DPIAs, age-appropriate application, transparency, detrimental use, policies, default settings, data minimisation, data sharing, geolocation, parental controls, profiling, nudge techniques, connected toys, online tools (ICO, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/) [V].

**ICO "Top tips for games designers"** (undated, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/top-tips-for-games-designers-how-to-comply-with-the-children-s-code/) [V]:
- establish UK players' ages with reasonable certainty, and discourage false birthdates;
- all optional data uses off by default;
- marketing profiling off by default;
- no nudges towards poor privacy or spending; natural break points;
- neutral purchase buttons, and refunds;
- voice chat off by default for children; friend requests default to "no-one".

**The ICO's games work:** its "Children's code strategy progress update – August 2026" says it has started a review of children's privacy in mobile gaming, with "early commitments from several platforms". It also reports fines on Reddit (£14.47M) and Imgur's owner (£247,590) in February 2026 (ICO, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/protecting-childrens-privacy-online-our-childrens-code-strategy/children-s-code-strategy-progress-update-august-2026/) [V].

**UK Data (Use and Access) Act 2025**
- Royal Assent 2025-06-19. Most data-protection provisions commenced 2026-02-05 (gov.uk, "DUAA: plans for commencement", https://www.gov.uk/guidance/data-use-and-access-act-2025-plans-for-commencement) [V].
- The ICO says all of them are now in force (ICO, "The Data (Use and Access) Act 2025: what does it mean for organisations?", updated 2026-06-19, https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/) [V]. That page says:
  - services likely to be used by children must take children's needs into account, and conforming to the Children's code "should already satisfy" this;
  - some cookies (statistical, functionality) may be set without consent (section 6.2);
  - complaints must be acknowledged within 30 days;
  - significant automated decisions may rely on any lawful basis with safeguards.

**EU and UK representatives.** A non-EU controller under Art 3(2) must appoint an EU representative in writing, unless processing is "occasional" and low-risk (gdpr-info.eu, Art 27, https://gdpr-info.eu/art-27-gdpr/) [V]. UK GDPR has the same rule. [U]

**Applies.**
- Lawful bases: contract for accounts and play; legitimate interests for security and anti-cheat; consent for optional analytics, marketing and referrals.
- Art 8 limits consent-based features for under-age EU users.
- An account service in 16 languages with children's data is not "occasional", so appoint **an EU and a UK representative**.
- Apply the Children's code to UK players: defaults, no nudges, break points, a DPIA.
- AI-decided ranked or tournament outcomes are significant automated decisions for children: offer human review on request, and explain the scoring.

### 5.4 EU AI Act

**Dates** (AI Act Service Desk, "Timeline", undated, https://ai-act-service-desk.ec.europa.eu/en/ai-act/timeline/timeline-implementation-eu-ai-act ; European Commission, "AI Act", https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) [V, re-checked]:
- **2025-02-02:** prohibitions and AI literacy apply.
- **2025-08-02:** general-purpose AI model rules apply (to Google and Liquid as model providers, not to the game).
- **2026-08-02:** "Transparency rules (Article 50) start to apply"; most rules apply and enforcement starts.
- **2026-12-02:** new prohibitions on non-consensual sexual deepfakes and child sexual abuse material. A **transition period ends for providers of synthetic-content-generating systems "already placed on the market before 02 Aug 2026"**.
- **2027-12-02:** Annex III high-risk rules. **2028-08-02:** Annex I product rules.
- **Digital Omnibus on AI:** adopted as a proposal 2025-11-19, political agreement 2026-05-07, "entered into force on 27 July 2026". Its Official Journal number was not found. [U]

**Article 50**, as amended (artificialintelligenceact.eu, https://artificialintelligenceact.eu/article/50/) [S, secondary reproduction; check the OJ text]:
- **50(1):** providers must ensure people "are informed that they are interacting with an AI system", unless obvious.
- **50(2):** providers of systems generating synthetic audio, image, video or text must mark outputs "in a machine-readable format and detectable as artificially generated or manipulated".
- **50(4):** deployers disclose deepfakes. For evidently artistic or fictional work, disclosure may be made "in an appropriate manner that does not hamper the display or enjoyment of the work". AI text published to inform the public on matters of public interest must be disclosed.
- **50(5):** disclosure must come at the latest at first interaction, clearly and accessibly.

**Code of Practice on transparency of AI-generated content.** Final version published **2026-06-10**, with about 190 signatories by end of July 2026. Section 1 covers provider marking (50(2)); Section 2 covers deployer labelling (50(4)). The Commission and AI Board judged it adequate on 2026-07-09 (European Commission, https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) [V].

**Article 5(1)(b)** bans AI that exploits vulnerabilities "due to their age" and materially distorts behaviour, causing significant harm (since 2025-02-02) [V, artificialintelligenceact.eu/article/5/].

**Applies.** The studio builds an AI system from open models and offers it under its own brand, so it is a **provider** (and deployer) of an AI system. [Inference]
- **Art 50(1) now:** label the opponent and judge as AI at first interaction. This matters more because the persona is a real person: players must not think Devon Glover is writing.
- **Art 50(2):** mark AI verses (text) and synthetic speech (audio) machine-readably, "as far as technically feasible". Examples: metadata on shared or exported verses and audio, or a watermark (Code Section 1). If the AI features were live before 2026-08-02, the deadline is **2026-12-02**; otherwise it applies now.
- **Art 50(4):** applies only to deepfakes, such as a synthesised Glover voice.
- **Art 5(1)(b):** no AI-driven, age-targeted purchase pressure.
- **Annex III 3(b), "evaluate learning outcomes" (high-risk, from 2027-12-02):** could reach classroom mode if it is sold to schools to grade students. Keep classroom scores formative and out of grading, say so in school terms, and assess the Art 6(3) derogation.
- **Art 4:** keep a short record of AI-literacy measures.

### 5.5 European Accessibility Act and US ADA

**EAA**, Directive (EU) 2019/882 (EUR-Lex, https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng) [V]:
- Games are not a listed service. "E-commerce services" are (Art 2(2)(f), defined in Art 3(30)), and Recital 43 extends them to online sales of any service.
- **Microenterprises providing services are exempt** (Art 4(5)): under 10 people and at most €2M annual turnover or balance sheet (Art 3(23)).
- It has applied since **2025-06-28** (Art 31).
- Annex I §IV(g): accessible product information and accessible identification, security and payment.
- The reference standard is EN 301 549 (v3.2.1, mapped to WCAG 2.1 AA). [U for a newer EAA-specific harmonised version]

**US ADA:** DOJ's guidance (2022-03-18) says Title III covers goods and services on the web, with no web regulation and WCAG cited as helpful (ADA.gov, "Guidance on Web Accessibility and the ADA", https://www.ada.gov/resources/web-guidance/) [V].

**Does not apply yet.** Selling credits would make the checkout an e-commerce service, but the microenterprise exemption covers the studio until it reaches 10 staff or €2M. Build account, purchase and payment flows to WCAG 2.2 AA anyway: school districts will ask, and ADA suits use WCAG.

### 5.6 Age ratings for a web game

- **IARC** is free for developers, but the questionnaire is reachable only "through a participating digital storefront's ingestion portal" (IARC, "FAQ", undated, https://globalratings.com/faq/) [V].
- **IARC storefronts:** Epic, Facebook Gaming, Fortnite, Google Play, Luna, Meta Horizon, Microsoft, Nintendo, One Store, Pico, PlayStation, YouTube Playables (IARC, "Storefronts", undated, https://globalratings.com/storefronts/) [V].
- **A self-hosted web game cannot get a standalone IARC rating**, and no US or EU law requires one. [Inference] A rating comes through a store listing (Google Play, Microsoft) or a paid direct PEGI/ESRB/USK rating. [U on fees]
- **Apple** uses its own questionnaire, with new descriptors required by 2027-01-12 (section 1.2) [V].
- **South Korea** requires ratings for games offered there (GRAC). [U] Check if Korean is a launch language.
- **PEGI from June 2026** (pegi.info, above) [V]:
  - unrestricted communication is PEGI 18;
  - daily quests and log-in streaks are PEGI 7, or PEGI 12 if rewards are lost for not returning;
  - time-limited offers are PEGI 12;
  - paid random items are PEGI 16.
- Inference: moderated, in-match-only verse exchange, no punishing streaks, no timed offers to children and no paid random packs keep a future rating at PEGI 7 to 12.

### 5.7 Credits, marketplace and referrals

- **EU CPC Network, "Key principles on in-game virtual currencies":** reportedly published 2025-03-13 with action against Star Stable. The page could not be opened. [U] As understood, the principles are:
  - prices shown in real money as well as in-game currency;
  - no bundles that obscure the real cost;
  - no forced surplus purchases;
  - clear pre-contract and withdrawal information;
  - special care with children.
- **The Digital Fairness Act proposal** (2026-11-11) would add virtual-currency price clarity. See the card-games file.
- **US, FinCEN guidance FIN-2019-G001** on convertible virtual currency (2019-05-09; metadata page https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models) [V for the page; text U].
  - Value that has a real-money equivalent or substitutes for it can make a business a money transmitter.
  - Closed-loop value redeemable only for the issuer's own goods is generally outside money-transmission laws. [U]
  - The Restore Online Shoppers' Confidence Act (ROSCA) governs subscriptions. The FTC click-to-cancel rule was vacated 2025-07-08. [U]
- **Store rules:** Apple 3.1.1 says bought credits "may not expire" [V]. Google Play and Microsoft require their billing for digital goods in store builds [V] (section 1.2).

**Depends on design.** [Inference]
- **Earned or bought credits spent only in-game, with no cash-out or transfer:** consumer law only. Show real-money prices, require parental consent for minors' purchases, no dark patterns, offer refunds.
- **A player-to-player marketplace without cash-out:** still generally outside money transmission. But it is a trading and communication feature for ratings and children's codes. Turn it off for child and classroom accounts.
- **Any cash-out, or credits tradable for money:** convertible-virtual-currency territory, with possible gambling and securities questions. Avoid.
- **Referral rewards:** paid to under-13s, they are an incentive to disclose others' contact details. Exclude children.

### 5.8 Right of publicity: Devon Glover, "The Sonnet Man"

- **His base:** the Southern Shakespeare Festival describes him setting "Shakespeare's love sonnets to Hip Hop to both entertain and educate", with no location (https://southernshakespearefestival.org/sonnet-man/) [V]. His handle "@thesonnetmannyc" (from the project's brief) points to New York. Brooklyn specifically is [U]. Confirm his domicile in the contract, because it decides which state's law governs.
- **New York Civil Rights Law §51:** a person whose "name, portrait, picture, likeness or voice is used within this state for advertising purposes or for the purposes of trade without the written consent" may sue for an injunction and damages (NY Senate, https://www.nysenate.gov/legislation/laws/CVR/51) [V].
- **NY Civil Rights Law §50-f (post-mortem):** covers digital replicas of deceased New York performers; rights last 40 years; last revised 2025-12-19 (https://www.nysenate.gov/legislation/laws/CVR/50-F) [V].
- **NY General Obligations Law §5-302** (revision 2025-01-03, https://www.nysenate.gov/legislation/laws/GOB/5-302) [V]: a contract provision allowing a digital replica "in place of work the individual would otherwise have performed in person" is **void** if all three hold:
  - it lacks a reasonably specific description of the intended uses;
  - the performer was not represented by counsel with terms in a signed writing;
  - the performer had no union agreement covering digital replicas.
- **California Labor Code §927** (AB 2602) has the same test for performances fixed on or after 2025-01-01 (FindLaw, https://codes.findlaw.com/ca/labor-code/lab-sect-927/) [V].
- **Other laws** [U]:
  - California Civil Code §3344.1 (AB 1836, post-mortem replicas);
  - Tennessee's ELVIS Act (voice, including simulations; effective 2024-07-01);
  - Lanham Act §43(a) false endorsement;
  - FTC Endorsement Guides (16 CFR 255) and the 2024 fake-reviews rule (16 CFR 465).
- **Federal NO FAKES Act:** reintroduced April 2025, still in committee (Wikipedia, edited 2026-05-08) [S].

**Applies.** An AI opponent that writes or speaks "as" The Sonnet Man uses his name and persona in trade. That needs a signed licence, and digital-replica terms specific enough to survive §5-302 and §927. [Inference] The licence should cover:
1. **Grant:** name, "The Sonnet Man", likeness, voice (recorded and, only by separate addendum, synthetic), biography and any marks (check USPTO).
2. **AI uses described specifically:**
   - an AI opponent "in the style of" or "as" him;
   - which models and prompts are used;
   - whether his lyrics or recordings are used for prompting or fine-tuning;
   - what is excluded (default: no voice clone, no fine-tune on his recordings).
3. **Independent counsel** for him, named in the agreement.
4. **Approvals:** persona guidelines, banned topics, sample outputs and marketing; a kill switch.
5. **Labelling:** "AI, not Devon Glover" on every AI verse (also meets Art 50(1)). No AI output presented as his statement or endorsement.
6. **Ownership of outputs, credit lines,** and his moral-rights preferences (stronger in the EU).
7. **Term and territory:** worldwide, a fixed term, wind-down, and deletion of any persona assets at the end.
8. **Termination:** morals clauses both ways; breach; change of control.
9. **Post-mortem successors** under §50-f.
10. **Fees or royalties,** with reporting and audit.
11. **Warranties and indemnities.**
12. **Classroom approval,** and a rule that he has no access to player data.

### 5.9 Shakespeare and other public-domain texts

- **The plays and sonnets are public domain.** Modern editions' editorial layer (modernised spelling, emendations, notes) can be protected. [U, general principle]
- **Folger:** its download page says the files are "free to use for all non-commercial purposes" (Folger Shakespeare Library, "Download", undated, https://www.folger.edu/explore/shakespeares-works/download/) [V]. Inference: a game that sells credits is commercial, so do not ship Folger text without written permission.
- **Project Gutenberg:** the texts are public domain in the US, but its trademark licence applies if you redistribute with its name and header. Commercial use of the trademark carries a 20% royalty. Strip all Gutenberg references to use the plain text. [U; gutenberg.org returned 503]
- **Wikisource:** contributions are CC BY-SA 4.0 and GFDL. User translations are "automatically licensed under the CC BY-SA license unless explicitly licensed otherwise" (Wikisource, "Copyright policy", https://en.wikisource.org/wiki/Wikisource:Copyright_policy) [V]. Faithful transcriptions of the 1609 Quarto or First Folio carry little new copyright in the US. [Inference]
- **US public domain:** works published in 1930 entered it on 2026-01-01. In life+70 countries, authors who died in 1955 became public domain in 2026 (Duke Center for the Study of the Public Domain, "Public Domain Day 2026", https://cspd.law.duke.edu/publicdomainday/2026/) [V].
- **Translations each carry their own term**, from the translator's death. [Inference] Nineteenth-century translations (Schlegel-Tieck in German, François-Victor Hugo in French) are safe. Spain gives life+80 to authors who died before 1987 [U], so Astrana Marín's Spanish translations are still protected.

**Applies.** For each of the 16 languages, record the Shakespeare text used, its edition, translator, translator's death year and first publication year. Prefer a translator dead more than 70 years (80 for older Spanish authors) and published before 1931. Otherwise commission translations under assignment. Avoid Folger text.

### 5.10 Open data and model licences

**Data**

| Source | Licence | Duty | Source URL |
|---|---|---|---|
| CLDR | Unicode License v3 | Keep "this copyright and permission notice" with copies, or in the documentation; no promotional use of Unicode's name | https://www.unicode.org/license.txt [V] |
| Wikidata | CC0 for main, Property, Lexeme and EntitySchema namespaces; other namespaces CC BY-SA 4.0 | None for CC0 data | https://www.wikidata.org/wiki/Wikidata:Licensing [V] |
| Wiktionary | CC BY-SA 4.0 and GFDL 1.1+ | Attribution; ShareAlike for adapted material | https://en.wiktionary.org/wiki/Wiktionary:Copyrights [V] |
| kaikki.org (Wiktextract) | No licence stated; inherits Wiktionary [inference]; asks academics to cite Ylonen, LREC 2022 | As Wiktionary | https://kaikki.org/dictionary/rawdata.html [V] |
| Open English WordNet | CC BY 4.0; credit Princeton WordNet and the OEWN team; Princeton licence governs the base data | Attribution | https://raw.githubusercontent.com/globalwordnet/english-wordnet/main/LICENSE.md [V] |
| CMUdict | BSD-style, © 1993–2015 Carnegie Mellon University | Keep the notice and disclaimer | https://raw.githubusercontent.com/cmusphinx/cmudict/master/LICENSE [V] |
| LDNOOBW wordlists | CC BY 4.0 | Attribution | section 4.2 [V] |

**What the Creative Commons FAQ says** (Creative Commons, "Frequently Asked Questions", undated, https://creativecommons.org/faq/) [V]:
- "CC licenses do not require the collection or the compilation itself to be made available under an SA license". ShareAlike applies to adapted material that is shared.
- Facts are not copyrightable.
- Under 4.0, sui generis database rights are licensed too. Sharing a database that contains a substantial portion of a BY-SA database must be under BY-SA or a compatible licence.
- Attribution means keeping the copyright, licence and disclaimer notices and a URI, and indicating modifications. This is broader than the "TASL" shorthand.
- CC advises against CC licences for software.

**Models**
- **Gemma 4 E2B:** Apache 2.0 [V, section 2.1]. Ship the licence and any NOTICE file.
- **Liquid LFM Open License v1.0** (Liquid AI, https://www.liquid.ai/lfm-license) [V]:
  - "Threshold" is "annual revenue of 10 million United States dollars ($10,000,000) or more"; the summary says "exceeds", so the boundary wording is inconsistent.
  - The legal entity includes affiliates under 50% common control.
  - Above the threshold, commercial use "is not licensed".
  - Redistribution duties: a copy of the licence, modified-file notices, retained notices, NOTICE attributions.
  - LFM3-1.7B and LFM2.5-350M both list "lfm1.0" (Hugging Face cards) [V].
- **Whisper:** MIT (https://raw.githubusercontent.com/openai/whisper/main/LICENSE) [V].
- **Kokoro-82M:** Apache 2.0 weights; trained partly on CC BY data (https://huggingface.co/hexgrad/Kokoro-82M) [V]. Its JavaScript phonemiser carries a GPL component; see section 3.4.
- **Transformers.js:** Apache 2.0 [V].
- **Supertonic 3:** OpenRAIL-M use restrictions; see section 3.2.

**Applies.** [Inference]
- **Ship derived rhyme, pronunciation and word lists from Wiktionary or kaikki as separate data files** under CC BY-SA 4.0, with attribution and a "modified" note. ShareAlike reaches those files, not the Rust or JavaScript code that reads them, so keep them separate and never compile them into code.
- **Publish an "Open data and models" credits page** listing CLDR (with the Unicode notice), Wikidata (credit given though not required), Wiktionary, kaikki, OEWN plus Princeton, CMUdict, every model licence, and the eSpeak NG GPL notice while it ships.
- **Serve each model's licence and NOTICE files next to the weights.** Shipping weights to browsers is distribution.
- **Plan the Liquid exit before group revenue nears US$10M:** a replacement model or a commercial licence. The licence gives no grace period and does not say how revenue is measured.


### For Sonnet Man (inference)

What section 5 adds up to, in order of urgency:

1. **By 2026-12-02 (EU AI Act).**
   - AI label at first interaction on the opponent and judge: "AI, not Devon Glover".
   - Machine-readable marking of AI verses and AI speech.
   - A written record of how both are done.
2. **Already overdue if children are served (COPPA, since 2026-04-22).**
   - The written information security program and the written retention policy.
   - A neutral age screen.
   - Separate consent for any third-party disclosure.
   - The internal-operations notice.
   - School-consent terms that switch off credits purchases, the marketplace, referrals and model improvement for school accounts.
3. **Before verses are shown to other players.**
   - UK Online Safety Act risk assessment.
   - Reporting, takedown and statement of reasons.
   - Block and mute.
   - NCMEC registration.
   - Guardrails that keep the AI inside SB 243's game exclusion: no mental-health, self-harm or sexual topics, no off-topic dialogue, no memory between sessions.
4. **Before charging money or opening the marketplace.**
   - Real-money price display.
   - No cash-out and no transfers for children.
   - Parental consent for minors' purchases.
   - PEGI-safe design: no paid random packs, no punishing streaks, no timed offers to children.
   - WCAG 2.2 AA checkout.
5. **Before 2027-01-01 (Vermont AADC).**
   - Duty-of-care review of seasons, streaks and notifications.
   - No notifications to minors between midnight and 6 a.m.
   - Highest-privacy defaults.
6. **Contracts and registers.**
   - The Devon Glover licence with specific AI terms and his own counsel.
   - The text-provenance and data-licence registers.
   - The Folger and kokoro-js fixes.
   - EU and UK GDPR representatives.
   - The Liquid US$10M exit plan.

---

## 6. Analytics, playtesting and live operations for a privacy-first web game

### 6.1 Self-hosted tools

Versions and licences are from each project's GitHub releases and licence endpoints, queried 2026-11-19 [V], unless noted.

**Product and web analytics**

| Tool | Latest (date) | Licence | Cookies | Events, funnels, retention |
|---|---|---|---|---|
| **Umami** | v3.5.0 (2026-11-12); v3.4.1 security release 2026-10-23 | MIT | "does not use any cookies" | Events, funnels, retention, journeys, cohorts, segments; session replay and error tracking (new in 3.5.0). Needs PostgreSQL 12.14+ and Node 20.19+ |
| **Plausible Community Edition** | v3.2.1 (2026-05-15) | AGPL-3.0 | Vendor: "No cookies … no consent banners required" | Custom events. CE lacks funnels, journeys and ecommerce goals. v3.2.1 fixes remote-code-execution CVE-2026-8467 via `/storybook` |
| Matomo | 5.14.3 (2026-11-16); 6.0.0-rc2 | GPL-3.0 | Cookies by default; `disableCookies`; "CNIL mode" | Funnels is a paid plugin |
| PostHog (hobby deploy) | Continuous from master | MIT outside `ee/` | Configurable | Full product analytics. Self-host is "officially unsupported"; needs 4 vCPU and 16 GB RAM; docs point to Cloud above about 300k events a month |
| OpenPanel | v3.30.0 (2026-11-06, pre-release) | AGPL-3.0 | "cookieless by default" | Funnels, cohorts, A/B variants, replay |
| GoatCounter | v2.7.0 (2025-12-15) | Modified EUPL-1.2 | No cookies or unique IDs | Page views and events only |

Sources (all undated) [V]:
- Plausible, https://plausible.io/self-hosted-web-analytics
- Umami, https://umami.is/features and https://github.com/umami-software/umami
- Matomo FAQ 157, https://matomo.org/faq/general/faq_157/
- PostHog, https://posthog.com/docs/self-host
- OpenPanel, https://github.com/Openpanel-dev/openpanel
- GoatCounter, https://www.goatcounter.com/help/events

**Error and crash reporting**

| Tool | Latest | Licence | Footprint |
|---|---|---|---|
| **GlitchTip** | v7.0.0 (2026-11-09) | MIT | Postgres 14+; 512 MB RAM recommended |
| Bugsink | 2.6.3 (2026-11-06) | PolyForm Shield 1.0.0 (source-available, not open source) | Single container; "Fully compatible with Sentry's open-source SDKs" |
| Sentry self-hosted | 26.11.0 (2026-11-18) | FSL-1.1-Apache-2.0 (each version becomes Apache-2.0 after 2 years) | 4 cores, 16 GB RAM plus 16 GB swap (32 GB recommended) |

- SDKs: `@sentry/browser` (sentry-javascript 11.14.0) and the Rust `sentry` crate 0.49.6, both MIT [V].
- GlitchTip's compatibility with the Sentry SDK is [S].
- Sources: https://glitchtip.com/documentation/install , https://www.bugsink.com/ , https://develop.sentry.dev/self-hosted/ (undated) [V].

**Feature flags and A/B testing**

| Tool | Latest | Licence | Notes | Rust SDK |
|---|---|---|---|---|
| GrowthBook | v5.2.1 (2026-11-16) | MIT except `enterprise/` | **Sequential testing, CUPED and bandits are Enterprise-only** | `growthbook-rust` 0.4.0 |
| Unleash | v8.3.1 (2026-10-29) | AGPL-3.0 per repo | | `unleash-api-client` 0.17.1 |
| Flagsmith | v2.292.0 (2026-11-17) | BSD-3-Clause | Segments, multivariate | `flagsmith` 3.4.0 |
| OpenFeature | spec v0.9.0 (2026-07-29) | Apache-2.0, CNCF incubating | Vendor-neutral flag API; OFREP remote protocol | `open-feature` 0.3.0 |

Sources: GrowthBook pricing, https://www.growthbook.io/pricing ; OpenFeature specification, https://openfeature.dev/specification/ [V].

### 6.2 Consent rules for analytics

- **EU, ePrivacy Art 5(3).**
  - EDPB Guidelines 2/2023 on its technical scope: v1.0 adopted 2023-11-14, **final v2.0 adopted 2024-10-07**. The scope covers more than cookies: pixels, tracking links, IP-only tracking, unique identifiers, and therefore identifiers kept in localStorage and IndexedDB (EDPB, https://edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf) [V].
  - The Digital Omnibus proposal (2025-11-19) would exempt first-party aggregated audience measurement. It is not law (Matomo blog, 2026-01-07, https://matomo.org/blog/2026/01/privacy-regulations-changes-2026-analytics/) [V for Matomo's account]. A Council mandate of 2026-10-21 reportedly keeps it among six consent-free purposes. [S]
- **France, CNIL.**
  - The audience-measurement exemption (CNIL, "Sheet n°16", 2020-06-11, archived copy) [V] requires: users informed and able to object; measurement or A/B testing only; no cross-referencing; truncated IP; trackers kept 13 months or less.
  - CNIL guidance of **2025-07-04** tightened this, per Matomo's summary (https://matomo.org/faq/how-do-i-configure-matomo-without-tracking-consent-for-french-visitors-cnil-exemption/) [V, secondary]: no User IDs or cross-domain tracking; IP truncated by at least 2 bytes; data kept 25 months or less; **heatmaps, session recording and A/B testing must be off**.
  - CNIL reportedly withdrew its list of exempt tools on 2026-01-01 in favour of vendor self-assessment. [S; cnil.fr returned 503]
- **UK, PECR Schedule A1**, inserted by DUAA s.142 and in force **2026-02-05** (SI 2026/82). Para 5 allows storage and access for "statistical purposes" to improve the service without consent, if the user gets clear information and a simple, free way to object (legislation.gov.uk, https://www.legislation.gov.uk/uksi/2003/2426/schedule/A1) [V].
  - The ICO's storage-and-access guidance, final **2026-04-29**, says A/B testing and aggregate statistics are likely covered, but not profiling or session recording. Third-party tools must act as processors. A default-on toggle the user can turn off is acceptable (https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/) [V].
- **US, COPPA.**
  - The internal-operations exception (16 CFR 312.5(c)(7)) lets an operator collect a persistent identifier alone, for analysing and maintaining the service, without parental consent. The data must not be used "to contact a specific individual … amass a profile … or for any other purpose" (Cornell LII, 16 CFR 312.2) [V].
  - The amended notice must name those operations (section 5.1).
  - FTC FAQ J.5–J.8 cover analytics, optimisation and debugging; A/B testing is not mentioned explicitly (FTC COPPA FAQ, above) [V].

### 6.3 What to measure

**Funnel.** Landing → first verse submitted → first duel completed → model download accepted → model loaded → second session → account created → first online duel → class joined (classroom path). This is the standard first-time-user funnel applied to this game. [Inference]

**Retention benchmarks**
- **GameAnalytics, "2026 Mobile & PC Gaming Benchmarks"** (2025 data, updated 2026-08-24, https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks) [V]:
  - Mobile medians: D1 about 22%, D7 just under 4%, D30 0.68–0.79%.
  - Mobile top quartile: D1 just above 30%, D7 6–7%.
  - PC median: D1 about 7%.
  - Mobile session median 3.1–3.5 minutes. No genre split.
- **The 2025 edition** (2024 data, uses D28; https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks) [V]:
  - **Card games: D1 18.2–19.4%, D7 6.5–7.1%, D28 2.9–3.2%.**
  - Word games: D1 17.6–19.7%, D7 3.8–4.7%, D28 1.0–1.3%.
- **Portal gates:** CrazyGames calls D1 of 10–15% "strong" and expects 10+ minutes of play. Poki's fit test needs an average over 3 minutes, and successful games average 5+ minutes [V, section 1.1].

**Duel balance.** Log for every server-judged duel:
- which side moved first;
- language pair;
- form and cards played;
- human or AI;
- model and size;
- input mode (voice or typed);
- judge score per criterion.

Watch first-mover win rate (chess, the reference case, is 52–56% for White; Wikipedia, "First-move advantage in chess" [S]), win rate by language and by card, and human-versus-AI win rate per difficulty tier.

**Rating systems**
- Glicko-2: start at 1500, RD 350, volatility 0.06; works best with 10–15 games per rating period (Mark Glickman, "Example of the Glicko-2 system", 2022-03-22, http://www.glicko.net/glicko/glicko2.pdf) [V].
- TrueSkill: μ 25, σ 25/3; leaderboards show μ − 3σ (Microsoft Research, https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/) [V].
- OpenSkill (Weng–Lin): MIT [V].
- In Rust, `skillratings` 0.29.2 (MIT OR Apache-2.0) implements Elo, Glicko-2, TrueSkill and Weng–Lin (https://docs.rs/skillratings/) [V].

**Small-sample A/B testing**
- Evan Miller's fixed-N sequential rule: stop when T − C ≥ 2√N; stop with no winner when T + C = N. It saves 17% to 50% of samples, depending on effect size (Evan Miller, "Simple Sequential A/B Testing", 2015-10-13, https://www.evanmiller.org/sequential-ab-testing.html) [V].
- GrowthBook's docs: confidence-sequence intervals are "always wider"; run a power analysis first (default 80% power). Their week-1 example has a minimum detectable effect of 34.5% (https://docs.growthbook.io/statistics/sequential , https://docs.growthbook.io/statistics/power) [V].

### 6.4 How small studios playtest

- **Five users per round.** Nielsen: five users find about 85% of usability problems. Run three rounds of five rather than one of fifteen, and 3–4 per distinct user group. Quantitative studies need about 20 (NN/g, "Why You Only Need to Test with 5 Users", 2000-03-18, https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/) [V]. Use think-aloud (NN/g, 2012-01-15, https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/) [V].
- **Steve Bromley** (formerly PlayStation user research), "How To Run A Games User Research Playtest" (Games User Research, 2024-06-05, https://gamesuserresearch.com/how-to-run-a-games-user-research-playtest/) [V]:
  - observe and probe, then survey;
  - pilot first;
  - recruit to match the launch audience;
  - a Discord panel is acceptable if its bias is managed.
- **Metrics-driven balance:** Anthony Giovannetti (Mega Crit), "'Slay the Spire': Metrics Driven Design and Balance", GDC 2019 (https://www.gdcvault.com/play/1025731/) [V, abstract only].
- **Platform tools:**
  - Poki Playtest gives 10 recorded sessions, and its fit test 500 players [V, section 1.1].
  - Steam Playtest is a free child app with no reviews and no NDA (Steamworks, https://partner.steamgames.com/doc/features/playtest) [V]. It is not relevant to a web game unless a desktop wrapper ships.

### 6.5 Live operations for a small team

- **Unity, "2026 Unity Game Development Report"** (survey 2025-09-16 to 2025-10-03, https://unity.com/resources/gaming-report) [V]:
  - 67% of respondents ship regular content updates.
  - **92% of studios under 10 people run daily rewards or missions.**
  - 78% run leaderboards.
  - 31% of multiplayer studios call update pace their biggest challenge.
- **Card-game cadences** (Wikipedia pages for each game) [S]:
  - Marvel Snap: monthly ranked seasons with a soft reset, new cards weekly.
  - Hearthstone: an expansion every four months, mini-sets between, monthly ranked seasons.
- No verified Game Developer or GDC source on live-ops calendars for small teams; the search allowance ran out. [U]

### For Sonnet Man (inference)

- **Stack:**
  - Umami (MIT, cookieless, funnels, retention and cohorts, on the Postgres already in place) for product analytics.
  - GlitchTip (MIT, about 512 MB RAM), fed by `@sentry/browser` and the Rust `sentry` crate, for errors.
  - Flags through OpenFeature, with Flagsmith (BSD) or a few rows in Postgres behind it.
  - Sentry self-hosted (16–32 GB RAM) and PostHog self-hosted are oversized.
- **Consent:**
  - UK: aggregate first-party statistics with a visible, default-on statistics toggle fits Schedule A1.
  - EU: the banner-free route is aggregate measurement with no stored identifier.
  - France: A/B tests and session replay fall outside the exemption, so run them only after consent, or not at all for EU players.
  - Never enable Umami's session replay.
- **Children:**
  - Classroom and under-13 sessions carry only a persistent identifier, used for internal operations, which are named in the notice.
  - No experiments, no replay and no raw verse text in analytics for child sessions.
  - A written retention schedule.
- **Balance:**
  - Glicko-2 through `skillratings` for ranked play.
  - Flag any language, card or tier whose first-mover win rate leaves 45–55%, or whose human-versus-AI rate drifts from its target.
  - Report judge-score distributions per language, so a weak language model shows up as a skewed distribution, not as player complaints.
- **Experiments:**
  - Two arms; a pre-registered N from a power analysis; Miller's rule implemented in Rust.
  - Expect a minimum detectable effect around 30% at launch-scale traffic. Test only big changes (onboarding, first-match flow).
- **Targets:** card-genre D1 about 18–19%, D7 about 6.5–7%, D28 about 3%. They are optimistic for a no-install web game; CrazyGames' 10–15% D1 is the web reference.
- **Playtesting:** think-aloud rounds of five, plus 3–4 each for teachers, students (with consent), adult wordsmiths and non-English players. Then Discord waves. Use the Poki fit test only if a lite portal build exists.
- **Live ops:**
  - monthly seasons with a soft rating reset;
  - a weekly verse prompt in all 16 languages;
  - daily missions that never punish absence (PEGI and Vermont, sections 5.2 and 5.6);
  - classroom calendars on school terms;
  - one Devon Glover headline duel per season, approved by him.

---

## 7. The standard document set of game development in 2026

### 7.0 Sources that describe the set as a whole, and current practice

**Classic breakdowns**
- **Tim Ryan's two-part series** is still the canonical one.
  - Part 1 (Gamasutra, 1999-10-19, now on Game Developer) covers the Game Concept (introduction, background, description, key features, genre, platforms, concept art) and the Game Proposal (revised concept, market, technical and legal analysis, cost and revenue, art): https://www.gamedeveloper.com/design/the-anatomy-of-a-design-document-part-1-documentation-guidelines-for-the-game-concept-and-proposal [V]
  - Part 2 (1999-12-17) covers the Functional Spec (by the lead designer), the Technical Spec (by the senior programmer) and Level Designs: https://www.gamedeveloper.com/design/the-anatomy-of-a-design-document-part-2-documentation-guidelines-for-the-functional-and-technical-specifications [V]
- **WPI IMGD 1001** (Mark Claypool and Robert Lindeman, about 2008, https://web.cs.wpi.edu/~imgd1001/a08/slides/imgd1001_05_GameDesignDocs.pdf) [V] teaches five documents:
  - Concept (1–3 pages);
  - Proposal (5–50 pages, with schedule, budget, risks and pessimistic/likely/optimistic revenue);
  - Technical Specification;
  - Game Design Document;
  - Level Designs.

**Textbooks**
- Jesse Schell, *The Art of Game Design*, 3rd ed. (CRC/Routledge, 2020): chapter 27 is "The Team Sometimes Communicates through Documents" (https://www.routledge.com/The-Art-of-Game-Design-A-Book-of-Lenses-Third-Edition/Schell/p/book/9781138632059) [V].
- Tracy Fullerton, *Game Design Workshop*, 5th ed. (Routledge): "now available" per the author's site (https://www.gamedesignworkshop.com/) [V]. Year [U].
- Scott Rogers, *Level Up!* (Wiley, 2010; 2nd ed. 2014): one-sheet, then ten-pager, then beat chart, then GDD. A mobile GDD "might only need" about 30 pages, against 300+ for console [S].
- Not checked [U]: Ernest Adams, *Fundamentals of Game Design*, 3rd ed. (2014); Heather Chandler, *The Game Production Toolbox* (2020); Clinton Keith, *Agile Game Development*, 2nd ed. (2020).
- Wikipedia calls a GDD a "highly descriptive living software design document" (https://en.wikipedia.org/wiki/Game_design_document) [V].

**Current practice: living documents, one-pagers, wikis, docs-as-code**
- James Sweatman (Jagex), "Death of the game design document" (MCV/DEVELOP, 2014-07-18, https://www.mcvuk.com/development-news/death-of-the-game-design-document/) [V]: keep early documentation light; let prototypes lead; record decisions; use wikis. Outsourced or multi-studio work still needs central documents.
- Mike Birkhead (NetherRealm), "How I document a game" (Game Developer, 2011-08-08, https://gamedeveloper.com/business/opinion-how-i-document-a-game) [V]: a concept design document plus audience-specific views; HTML and CSS, with Excel for data.
- Codecks, "Writing modern game design documents" (2020, updated January 2025, https://www.codecks.io/blog/writing-modern-game-design-documents/) [V]: a one-page GDD; the prototype as source of truth; design items in the project tool; a wiki of linked Markdown cards with pillars.
- Game Developer (2023-08-08, https://www.gamedeveloper.com/design/video-one-page-designs) [V] calls Librande's 2010 talk still relevant: long GDDs and wikis "go unread".
- No 2024–26 Game Developer feature on "the GDD is dead" was found. [U, absence in a limited search]
- **Docs-as-code** means docs written with the code's tools (Git, Markdown, review, CI) (Write the Docs, https://www.writethedocs.org/guide/docs-as-code/) [V].
- **AGENTS.md** is "a README for agents", "now stewarded by the Agentic AI Foundation under the Linux Foundation" (https://agents.md/) [V].
- **Tools that expose design data to AI agents:**
  - Avo's tracking plan has an "Avo MCP" (https://www.avo.app/docs/) [V].
  - Machinations calls itself "The AI Economic Harness" (https://www.machinations.io/) [V].
- No study of how agent-assisted game teams document was found. [U]

**Format of each entry below:** purpose; usual sections; readers; current practice; templates and examples; then "For Sonnet Man" (inference).

### 7.1 Pitch, one-pager, pitch deck

- **Purpose:** win funding, a partner or a go-ahead. It says what the game is, why it matters, who makes it, cost and date.
- **Sections:**
  - high concept (one sentence);
  - genre, platform, business model;
  - core loop and key features;
  - unique selling points;
  - audience;
  - comparables;
  - visual target (key art, GIFs);
  - team;
  - budget and burn;
  - schedule;
  - current build;
  - the ask;
  - risks;
  - route to market.
- **Readers:** publishers' scouts, funds, investors, partners (here: schools, arts funders, the performer).
- **What publishers and funds ask for:**
  - **Raw Fury** ("How to pitch to Raw Fury", 2024-12-13, https://rawfury.com/how-to-pitch-to-raw-fury/) [V]:
    - a playable build that "conveys the essence";
    - a budget in USD of roughly months left × monthly burn;
    - a deck answering six questions: what, why, who, where you want to go, what you need, when you finish.
  - **Kepler Interactive, which now absorbs Kowloon Nights** (undated, https://kepler-interactive.com/kowloon) [V]: a "concise, easy-to-digest pitch deck", a separate GDD, and a demo. It is "generally unable to assess projects without a build". No NFTs.
  - **UK Games Fund, Prototype Fund** (https://www.ukgamesfund.com/prototype-fund/) [V]:
    - a pitch video of at most 2 minutes covering team, game, route to market and audience;
    - a browser-playable build under 100 MB;
    - UK companies only.
  - **Devolver, Hooded Horse and Annapurna:** no official pitch page was reachable. The Square Enix Collective pitch article is now a dead link. [U]
- **Current practice:** a deck plus a build is the norm. The one-sheet has become the internal greenlight artifact.
- **Templates and examples:**
  - Tim Ryan's Concept and Proposal [V].
  - Diablo pitch (Condor, 1994; released by David Brevik in 2016; PC Gamer, 2016-03-20; PDF http://www.graybeardgames.com/download/diablo_pitch.pdf) [V].
  - BioShock 2002 pitch, archived by the Video Game History Foundation (https://archive.org/stream/vghf_design_doc_archive/bioshock-pitch-document) [V].
  - Race'n'Chase (GTA) 1995 pitch (Engadget, 2011-03-22) [S].
- **For Sonnet Man:**
  - the hook ("duel an AI in verse, in your own language, in your browser");
  - a 60-second capture of a spoken verse being scored;
  - Devon Glover and his signed consent;
  - the free model with credits, seasons and marketplace;
  - three audiences (players, classrooms, spoken-word fans);
  - comparables;
  - the owner-plus-agents team, stated honestly;
  - burn;
  - a live build link.
  - Target education, arts and literacy funders and school partners rather than console publishers, who want premium PC and console projects. [Inference]

### 7.2 Game design document (GDD)

- **Purpose:** the authoritative description of what the game is and how it plays.
- **Sections:**
  - vision and design pillars;
  - core loop;
  - rules and mechanics;
  - progression;
  - modes;
  - characters;
  - story summary;
  - controls and input;
  - UI and HUD summary;
  - economy;
  - multiplayer;
  - AI behaviour;
  - content list;
  - art and audio summaries (pointing to the bibles);
  - accessibility and localisation summaries;
  - technical constraints;
  - open questions;
  - change log.
  - Ryan's functional spec is the classic detailed outline: mechanics, UI, art and video, sound and music, story, level requirements [V].
- **Readers:** every discipline, each reading its slice.
- **Current practice:** a one-page hub with pillars, linked to one-page sub-designs, with numbers in data files and the build as source of truth (Codecks 2025; Sweatman 2014) [V].
  - **Stone Librande, "One-Page Designs"** (GDC 2010, https://www.gdcvault.com/play/1012356) [V]: one page per system, a strong central image, white space, short notes, and a printed date. Slides at https://stonetronix.com/ [V].
- **Published examples:**
  - Deus Ex "Shooter: Majestic Revelations", annotated by Warren Spector (Game Developer, 2016-11-14, https://www.gamedeveloper.com/design/annotated-version-of-an-original-i-deus-ex-i-design-doc-surfaces) [V].
  - Doom Bible (Tom Hall, 1992-11-28) [S].
  - Fallout Bible (Chris Avellone, 2002) [S].
  - The mikewesthad collection (Doom, Leisure Suit Larry, Marble Madness, GoldenEye, Prince of Persia 2, Deus Ex, plus one-page and class templates; https://github.com/mikewesthad/game-design-document-resources) [V].
  - Unity Learn's GDD template (https://learn.unity.com/tutorial/fill-out-a-game-design-document) [S].
- **For Sonnet Man:**
  - A one-page hub with four pillars (say it aloud; every language is home; the duel is fair; the performer is real).
  - One-pagers for the duel loop, card anatomy (forms, curses, relics; see the card-games file), the two-layer scoring model (code-checked form, then AI quality), opponent behaviour, and each mode.
  - Linked specs for seasons, credits, marketplace and referrals.
  - All Markdown in the repo, with card data in data files.

### 7.3 Technical design document, architecture decision records, RFCs

- **Purpose:** how the game is built.
- **Sections:**
  - Ryan's technical spec [V]: platform, external code, code objects, control loop, data, data flow, AI, multiplayer, UI shell, graphics, sound, tools.
  - Google's design-doc pattern (Malte Ubl, "Design Docs at Google", 2020-07-06, https://www.industrialempathy.com/posts/design-docs-at-google/) [V]:
    - context and scope;
    - goals and **non-goals**;
    - the design (system-context diagram, APIs, storage);
    - **alternatives considered**;
    - cross-cutting concerns (security, privacy, observability);
    - a separate privacy review;
    - 10–20 pages, or a 1–3 page mini-doc.
- **ADRs:**
  - Michael Nygard, "Documenting Architecture Decisions" (Cognitect, 2011-11-15, https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) [V]: Title, Context, Decision, Status, Consequences, stored as numbered files in the repo.
  - MADR 4.0.0 (2024-09-17, https://adr.github.io/madr/) [V] adds decision drivers, options, pros and cons, and "Confirmation".
- **RFCs:** a proposal reviewed before a large change (motivation, design, drawbacks, alternatives, unresolved questions), as in https://github.com/rust-lang/rfcs [U as a games norm].
- **Readers:** engineers, the technical lead, and coding agents.
- **Practice:** Markdown beside the code; ADRs never edited, only superseded; diagrams as code; AGENTS.md as the entry point [V for AGENTS.md].
- **For Sonnet Man:**
  - A TDD covering:
    - the tier ladder (no-model, phone, desktop, wide-language);
    - model loading, caching and memory budgets per device;
    - the judge pipeline (deterministic layer, model layer, server re-judge);
    - speech per language;
    - the language-data pipeline (CLDR, Wikidata, dictionaries);
    - multiplayer and anti-cheat;
    - classroom tenancy;
    - the credits ledger;
    - passkeys and email codes;
    - Art 50 marking;
    - the moderation cascade.
  - One ADR per choice, including "why d1-2B or LFM3 as judge" and "why no cloud inference".

### 7.4 Art bible and style guide

- **Purpose:** visual consistency across artists, contractors and image tools, plus readability rules.
- **Sections:**
  - pillars and mood words;
  - references;
  - shape language and silhouettes;
  - palette and value rules (colour-blind-safe pairs);
  - lighting and materials;
  - characters (proportions, expressions);
  - environments and props;
  - UI art and icons;
  - typography;
  - VFX and animation;
  - technical specs (sizes, budgets, naming, export);
  - do's and don'ts;
  - approval workflow.
- **Readers:** artists, contractors, UI, marketing, licensors, image pipelines.
- **Examples:**
  - Valve, "Illustrative Rendering in Team Fortress 2" (Mitchell, Francke and Eng, NPAR 2007, https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf) [V]: references to early-20th-century illustrators, silhouette-tested readability, rim highlights.
  - Dota 2 Workshop requirements, a public technical art spec (https://www.dota2.com/workshop/requirements) [V].
- **Practice:** a board (Figma, Miro, PureRef) plus a PDF or wiki page; colour and type tokens in the design system. [U]
- **For Sonnet Man:**
  - Devon Glover likeness rules: approved photos, what may be stylised, what may never be generated, and the approval chain.
  - Card frames readable at phone size.
  - Type that covers all 16 scripts.
  - WCAG-contrast palette.
  - Central people in brand imagery depicted per the owner's standing direction.

### 7.5 Audio bible, sound design document, music brief

- **Purpose:** how the game sounds and how sound carries information.
- **Sections:**
  - pillars and references;
  - music direction (genres, tempo, adaptive rules, stems);
  - SFX palette;
  - feedback sounds per event;
  - voice-over (casting, direction, scripts, recording specs, naming, loudness);
  - mix and loudness targets;
  - implementation notes;
  - accessibility (a visual equivalent for every audio cue; separate volume sliders);
  - asset list and budget;
  - rights.
  - Ryan's spec carries Sound and Music plus Sound Engineering Instructions [V].
- **Readers:** composer, sound designer, VO director, engineers, legal.
- **Templates:** no primary published audio-bible template was found. [U] Loudness targets for web and mobile are common practice but unsourced here. [U]
- **For Sonnet Man:**
  - Mic capture specs and noise handling.
  - The beat bed under spoken verses, with tempo per form.
  - Session specs and rights for Devon Glover's recorded lines; no synthetic Glover voice without an addendum.
  - Synthetic-voice policy: preset voices, "AI voice" label, Art 50(2) marking.
  - Per-language TTS coverage.
  - Captions for every voice line.

### 7.6 Narrative bible, character and performer bible, voice and tone guide

- **Purpose:** consistent story, characters and writing voice across writers, translators, live content and prompt authors.
- **Sections:**
  - premise and themes;
  - world rules;
  - timeline;
  - character sheets (backstory, motivation, speech patterns, sample lines);
  - glossary;
  - tone rules;
  - content boundaries;
  - canon control.
  - The IGDA LocSIG asks for specific voice notes ("don't just say 'British'": name period, region and register, with samples) [V, section 7.12].
- **Voice and tone guide:** voice is constant; tone shifts with the reader's state. The exemplar is Mailchimp's Content Style Guide: four voice traits, tone keyed to emotional state (©2023, CC BY-NC 4.0, https://styleguide.mailchimp.com/voice-and-tone/) [V].
- **Readers:** writers, designers, localisers, marketing, community, prompt authors.
- **For Sonnet Man:**
  - A performer bible for Devon Glover: approved biography, persona, signature phrases, approved topics, red lines, and a rule that no invented words are put in his mouth.
  - A persona sheet for each AI opponent: its verse voice, banned topics (the SB 243 list), and refusal style.
  - A UI voice guide per language.
  - A presented, skippable intro script. The owner's rule that every PlayDimension game opens with one is worth applying here too. [Inference]

### 7.7 UX flows, wireframes, UI style guide and design system

- **Purpose:** specify every screen, path and state; keep the UI consistent.
- **Sections:**
  - personas and goals;
  - information architecture;
  - flowcharts (first-time experience, onboarding, core loop, store, settings, error and offline states);
  - wireframes, then mockups, then prototype;
  - interaction specs (gestures, inputs, feedback);
  - HUD layout;
  - tutorial plan;
  - accessibility per screen;
  - text-expansion limits;
  - usability test plan and findings.
  - The design system adds tokens (colour, type, spacing, motion), components and states, icons, and do/don't examples.
- **Readers:** UX/UI, engineers, QA, accessibility reviewers.
- **Practice and references:**
  - **Celia Hodent** (former UX director at Epic), *The Gamer's Brain* (2017) and "Understanding the Success of Fortnite" (2019-07-22, updated 2020-06-20, https://celiahodent.com/understanding-the-success-of-fortnite-ux/) [V]. Her framework is usability plus "engage-ability".
    - Usability has seven heuristics: signs and feedback, clarity, form follows function, consistency, minimum workload, error prevention and recovery, flexibility.
    - Engage-ability covers motivation, emotion and game flow.
  - **W3C Design Tokens Community Group format**: first stable version **2025.10**, announced 2025-10-28 (https://www.designtokens.org/) [V].
  - Figma for flows and components; tokens exported as JSON. [U for prevalence]
- **For Sonnet Man:** mobile-first flows for:
  - the first verse in under 60 seconds with no model download;
  - the model-download offer (size, progress, resume);
  - the microphone prompt in context, with a typed path;
  - duel turn and score reveal (showing which checks fired);
  - online matchmaking;
  - a teacher creating a class and students joining by code;
  - season pass, credits and marketplace (real-money price shown);
  - referral;
  - passkey sign-in and email-code fallback;
  - report and block;
  - the AI disclosure at first interaction.
  - A DTCG-format token set covering 16 scripts, and right-to-left if Arabic is a launch language.

### 7.8 Content and balance sheets

- **Purpose:** one tabular source of truth for every card, number and price; balance by model, not by feel.
- **Sections and columns:**
  - card list: ID, name key, type or form, cost, rarity, effect key, parameters, tags, set or season, status, art ID, notes, playtest win rate;
  - economy tables: sources and sinks per day, prices, reward tracks, time to unlock;
  - progression curves;
  - a simulation or balance model;
  - change log per patch.
- **Readers:** designers, economy and live-ops, data, engineers who import the data, localisers (string keys).
- **Practice:**
  - Spreadsheets or JSON exported into the build. [U for prevalence]
  - Machinations models economies, imports spreadsheets and CSV, simulates "many possible futures", and has community models such as "Deck Crafting Economy" (https://www.machinations.io/) [V].
  - Magic R&D's set "skeleton" and Hearthstone's telemetry-led tuning are commonly cited but were not verified this session. [U]
  - Mega Crit's GDC 2019 talk on metrics-driven balance [V, section 6.4].
- **For Sonnet Man:**
  - A card database (forms, curses, relics, themes) as JSON or CSV in the repo, generating game data, localisation keys and a balance report.
  - Economy tables for credits (free-player earn and spend per day; no paid power in duels).
  - Marketplace pricing, season rewards and referral bounties.
  - A source-and-sink model.
  - Per-language form tables (alexandrine, haiku, ghazal, décima), each with its code check.

### 7.9 Level and mode design documents

- **Purpose:** specify each mode's goals, flow, rules deltas, rewards and edge cases.
- **Sections:**
  - Ryan's level process [V]: thumbnail, paper version, core, details, playtest; level diagram and asset schedule.
  - A modern mode spec:
    - purpose and audience;
    - entry conditions;
    - rules delta from core;
    - match structure and timers;
    - win, lose and tie rules;
    - scoring and rewards;
    - matchmaking;
    - UI changes;
    - disconnects and edge cases;
    - telemetry events;
    - moderation needs;
    - accessibility;
    - open questions.
- **Readers:** designers, engineers, QA, live-ops.
- **Practice:** one page per mode, after Librande [V].
- **For Sonnet Man:** one-pagers for:
  - first duel (tutorial);
  - solo versus AI, by tier, where the AI is given controls and what is drawn, never how to win (owner rule);
  - ranked online (server-judged);
  - friendly invite;
  - classroom (teacher-chosen forms, no free messaging, formative scores only);
  - tournament (brackets, server judging, tie-breaks, appeals);
  - seasonal events.

### 7.10 QA and test plan

- **Standard:** ISO/IEC/IEEE 29119-3:2021, "Software testing – Part 3: Test documentation", published 2021-10-28. It supersedes the 2013 edition, and in lineage IEEE 829 (IEEE SA, https://standards.ieee.org/ieee/29119-3/7499) [V; section numbers S].
  - Templates: test plan, status and completion reports, test design and case specifications, procedures, data, environment, execution log, incident report.
  - It works with agile lifecycles.
- **Test-plan sections:**
  - scope;
  - risks and priorities;
  - strategy (functional, compatibility, performance, localisation (linguistic QA, LQA), accessibility, security, load, network, compliance);
  - environments and devices;
  - entry and exit criteria per milestone;
  - schedule and roles;
  - defect workflow (severity × priority);
  - metrics and deliverables.
- **Game artifacts:**
  - per-feature checklists;
  - a bug database;
  - a device × OS × browser matrix;
  - smoke and regression suites;
  - certification checklists (console TRC/TCR/Lotcheck; for the web, portal and store requirements such as CrazyGames' technical rules, section 1.1);
  - playtest plans.
- **Readers:** QA, engineers, producer, reviewers.
- **For Sonnet Man:**
  - A matrix of iOS Safari (memory classes), Chrome Android (Adreno, Mali, Exynos), Samsung Internet, Firefox desktop and Android, and Android and iOS in-app browsers. Cover WebGPU, WASM-only, no-model and no-microphone paths.
  - Recognition accuracy per language.
  - LQA in all 16 locales, including scoring correctness.
  - A judge red-team set (benign framing, refusal prefix, hidden text, every launch language).
  - Moderation false-positive tests per language.
  - Multiplayer load tests.
  - Classroom privacy tests.
  - Credits and marketplace exploit tests.
  - The full Playwright e2e on the build host before every deploy, and production e2e after, per the owner's CI rule.

### 7.11 Accessibility plan and accessibility statement

| Source | Key facts | Mark |
|---|---|---|
| Game Accessibility Guidelines | Collaborative, "since 2012"; Basic, Intermediate and Advanced tiers. https://gameaccessibilityguidelines.com/ | [V] |
| Xbox Accessibility Guidelines | **Version 3.2, published 2023-06-08**, still current (page re-dated 2026-11-13 with no new version). Each guideline has goal, scoping questions, implementation, examples, player impact; "not … compliance". https://learn.microsoft.com/en-us/gaming/accessibility/guidelines | [V] |
| AbleGamers APX | 22 patterns. Access patterns include Second Channel, Flexible Text Entry, Clear Text. Challenge patterns include Slow It Down, Helping Hand, Training Ground. https://accessible.games/accessible-player-experiences/ | [V] |
| WCAG 2.2 | W3C Recommendation 2023-10-05, updated 2024-12-12. New AA criteria include 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum), 3.3.8 Accessible Authentication. ISO/IEC 40500:2025 equals the October 2023 text. https://www.w3.org/TR/WCAG22/ , https://www.w3.org/WAI/standards-guidelines/wcag/ (updated 2026-09-17) | [V] |
| WCAG 3 | Working Draft (updated September 2026); "not expected to be a completed W3C standard for a few more years"; "will not supersede WCAG 2". https://www.w3.org/WAI/WCAG3 (updated 2026-11-16) | [V] |
| Accessibility statement | Minimum: commitment, standard applied, contact; plus known limitations, measures, technical prerequisites. W3C has a generator. https://www.w3.org/WAI/planning/statements/ | [V] |
| Can I Play That? | Accessibility reviews on a 10-point scale; a DiGRA paper maps its 2019–2025 reviews to the GAG. https://dl.digra.org/index.php/dl/article/view/2833 | [S] |

- **Plan sections:**
  - target standards;
  - a player-impact matrix (vision, hearing, motor, cognitive, speech);
  - feature commitments per tier;
  - settings menu spec;
  - testing (assistive-technology matrix, disabled playtesters);
  - owner;
  - statement and known-issues process.
- **Readers:** design, UX, engineering, QA, marketing, school procurement.
- **For Sonnet Man:** WCAG 2.2 AA applies directly to a web game:
  - a tap alternative to card dragging (2.5.7);
  - 24×24 px targets (2.5.8);
  - passkeys meet 3.3.8.
  - **Typed input must be equal to speech**, with no penalty for non-speaking players or players who stutter (APX Second Channel and Flexible Text Entry).
  - Timer options; screen-reader support for verses; captions.
  - Publish a statement; schools and the EAA-exempt checkout both benefit.

### 7.12 Localisation kit

- **Purpose:** give translators what they need, and engineers a pipeline that does not break.
- **IGDA LocSIG, "Best Practices for Game Localization"** (drafts 2011-02-01 and 2012-02-01; posted 2021-04-09; https://igda.org/resources-archive/best-practices-for-game-localization/) [V]:
  - stages: familiarisation, glossary and style guide, translation, voice-over, LQA, sign-off;
  - size text for translations "30–40% longer than English";
  - let translators reorder variables, and use grammatical tokens for gender and plural;
  - a font approval step;
  - Kate Edwards' four culturalisation variables (history, religion, ethnicity, geopolitics).
- **Kit contents:**
  - string export (key, source, context note, maximum length, placeholders, plural and gender forms, screenshot link, status);
  - glossary or termbase with a do-not-translate list;
  - per-language style guide;
  - character sheets;
  - context screenshots or video;
  - font and glyph coverage;
  - build access and debug cheats;
  - query sheet;
  - VO scripts with timing;
  - LQA plan and bug template;
  - schedule.
- **Message formats:**
  - **Unicode MessageFormat 2.0** became Stable in CLDR 47 (2025-03-13), in ICU 77 (Unicode blog, https://blog.unicode.org/2025/03/unicode-cldr-47-release-messageformat-2.html) [V]. CLDR 48.2 (2026-03-17) made `:currency` and `:percent` stable (https://cldr.unicode.org/downloads/cldr-48) [V]. The current spec is LDML Part 9, CLDR 49, revision tr35-79, 2026-10-21 (https://www.unicode.org/reports/tr35/tr35-messageFormat.html) [V].
  - **Project Fluent:** Syntax 1.0 (April 2019), asymmetric localisation, with a Rust implementation (`fluent-rs`) (https://projectfluent.org/) [V].
- **Readers:** translators, LQA testers, engineers, community translators.
- **For Sonnet Man:** the hardest document, because verse does not translate. Per language:
  - native forms, metre and stress rules;
  - rhyme definitions (phonetic, so pronunciation sources);
  - the code checks for each form;
  - scoring anchors;
  - offensive-word lists;
  - culturalisation notes;
  - the Shakespeare edition and translator used (section 5.9);
  - which models and speech engines cover it (sections 2 and 3);
  - native-poet LQA reviewers.
  - UI strings in MF2 or Fluent. Language data from CLDR, Wikidata and dictionaries with licences recorded (section 5.10), per the owner's rule.
  - Transcreation, not translation, for Devon Glover's lines, approved by him.

### 7.13 Production plan and roadmap

- **Purpose:** scope, schedule, budget, team and milestones.
- **Milestones:**
  - first playable, alpha, code freeze, beta, code release, gold master; phases of pre-production, production, post-production (Wikipedia, "Video game development", https://en.wikipedia.org/wiki/Video_game_development) [V];
  - plus concept, vertical slice, release candidate and live [U as named in that source].
- **Sections:**
  - goals and scope (MoSCoW: must, should, could, won't);
  - milestone definitions with exit criteria;
  - now / next / later roadmap;
  - schedule;
  - team and RACI (responsible, accountable, consulted, informed);
  - budget (burn, per milestone, contingency);
  - dependencies;
  - tools and pipeline;
  - process (Scrum, Kanban);
  - reporting cadence;
  - risk link;
  - change control.
- **Readers:** producer, owner, funders.
- **Practice:** agile with milestone gates. Funders still want milestone and budget tables (Raw Fury's months × burn [V]; the UK Games Fund's monthly claims [V]).
- **For Sonnet Man:** milestones such as:
  - vertical slice (one language, solo versus AI, typed and spoken input, code-checked scoring, no-model first match);
  - alpha (4 languages, server-judged online duels, moderation cascade);
  - classroom beta with pilot schools (DPIA, school pack);
  - soft launch;
  - 16-language launch;
  - Season 1.
  - Each has exit criteria: performance on a reference low-end phone, accessibility pass, LQA pass, legal checklist (section 5). Describe the owner-plus-agents team honestly.

### 7.14 Risk register

- **Purpose:** name, score, own and track risks.
- **Basis:** ISO 31000:2018 (under revision) and PMI's PMBOK Guide, 8th ed. (digital 2025-11-13). Both are [S]; their pages returned 403.
- **Columns:**
  - ID and date raised;
  - category (technical, design, people, legal, market, operations);
  - risk statement as cause → event → effect;
  - owner;
  - likelihood (1–5) × impact (1–5) = score;
  - trigger;
  - response (avoid, mitigate, transfer, accept);
  - actions and due dates;
  - residual score, status, review date.
- **Evidence for seeding:** Politowski et al., "Game Industry Problems: an Extensive Analysis of the Gray Literature" (arXiv 2009.02440, v3 2021-01-22, https://arxiv.org/abs/2009.02440) [V]. 200 postmortems (1997–2019) and 927 problems in 20 types; most root causes are people, not technology.
- **Readers:** owner, producer, funders.
- **For Sonnet Man:** seed with:
  - key-person and reputation dependency on Devon Glover, and the licence ending;
  - harmful, plagiarised or off-brand AI verse;
  - SB 243 exclusion failure;
  - children's data in classroom mode (COPPA, Children's code, Vermont from 2027-01-01);
  - the Art 50(2) deadline of 2026-12-02;
  - iOS memory kills;
  - Android WebView WebGPU;
  - weak speech in low-resource languages;
  - the LFM licence revenue cliff at US$10M;
  - the GPL component in kokoro-js;
  - credits or marketplace treated as gambling or money transmission;
  - referral fraud;
  - toxic shared verses (UK Online Safety Act duties);
  - copyrighted lyrics quoted in player verses;
  - school procurement cycles;
  - a one-founder bus factor.

### 7.15 Market and competitor analysis

- **Purpose:** show the audience exists, position the game, size the opportunity.
- **Sections:**
  - market overview;
  - segments and personas;
  - 5–10 comparables (platform, model, price, reviews, what to borrow or avoid);
  - positioning map;
  - differentiators;
  - TAM, SAM and SOM (total, serviceable and obtainable market) [U, standard startup practice];
  - channels;
  - risks.
  - Ryan puts market analysis first in the proposal [V].
- **Sources:**
  - Newzoo's annual Global Games Market Report (blocked; no figures verified) [U].
  - Chris Zukowski's How To Market A Game, Steam-centred, with recent posts on AI cloners (2026-10-28) and clone-proofing (2026-11-11) (https://howtomarketagame.com/blog/) [V].
  - Poki's 2026 survey (section 2.2) [V].
  - GameAnalytics benchmarks (section 6.3) [V].
  - The card-games file covers card-game comparables in depth.
- **Readers:** owner, funders, marketing.
- **For Sonnet Man:**
  - Comparables in four groups: word and literary games; card battlers (season structure); classroom game platforms (Kahoot!, Blooket, Gimkit, for the teacher funnel); language and literacy apps; plus spoken-word programmes such as Poetry Out Loud.
  - Personas: secondary English teacher, student aged 13 to 17, adult wordsmith or rapper, language learner, Devon Glover's existing audience.

### 7.16 Marketing plan and press kit

- **Press kit:**
  - **presskit()** by Rami Ismail is a free tool; version 2.0 is in beta, GPL-3.0 (https://dopresskit.com/ , https://github.com/ramiismail/dopresskit) [V].
  - The static port presskit.html carries: title, release dates per platform, contacts, socials, header image, logos, gallery, and zipped image and logo packs (https://github.com/pixelnest/presskit.html) [V].
  - Classic sections: factsheet, description, history, features, videos, images, logo and icon, awards, quotes, links, about (boilerplate), credits, contact, and a monetisation-permission line for video creators [U for the full list].
  - A kit centres on images, video and a playable build (Game Developer, George Portman, 2016-02-05, https://gamedeveloper.com/business/presskits-the-what-and-the-why) [V].
- **Marketing plan sections:**
  - goals and KPIs;
  - audience and positioning;
  - message hierarchy;
  - channels (social, creators, press, festivals, communities, email, portals);
  - a beats calendar (announce, trailer, playtest, festivals, launch, updates) [U for Zukowski's term];
  - asset list, budget, measurement.
- **Readers:** marketing, creators, press, partners.
- **For Sonnet Man:**
  - Beats on poetry moments: World Poetry Day (21 March), Shakespeare's birthday (23 April), National Poetry Month in the US (April), the school year, and Devon Glover's own performances.
  - The press kit carries approved Glover bio, photos and quotes, a plain statement of what is AI and what is human, and the AI-disclosure wording.

### 7.17 Store page and listings

- **Steam assets** (sizes changed August 2024): header capsule 920×430; main 1232×706; vertical 748×896; screenshots at least 1920×1080; library capsule 600×900 and hero 3840×1240 (Steamworks, "Graphical assets", https://partner.steamgames.com/doc/store/assets) [V]. Zukowski's Steam page checklist, v1, March 2020 [S].
- **Apple product page:** name and subtitle 30 characters; promotional text 170; keywords 100; up to 10 screenshots; up to 3 previews of 30 s (Apple, "Product page", https://developer.apple.com/app-store/product-page/) [V].
- **Google Play:** short description 80 characters; icon 512×512; feature graphic 1024×500; 2–8 phone screenshots (Play Console Help, answer 9866151) [V].
- **Web portals:** each has its own rules (section 1.1).
- **Readers:** marketing, art, platform reviewers.
- **For Sonnet Man:**
  - The primary "store page" is the game's own landing page: the hook on the first screen; a 30-second spoken-duel clip; language selector (16 pre-rendered pages with hreflang); a "for schools" path; share cards; PWA install; SoftwareApplication markup once real ratings exist.
  - Store and portal listings only as section 1 allows.

### 7.18 Live-ops plan

- **Purpose:** run the game as a service.
- **Sections:**
  - season structure (length, theme, reward track);
  - event calendar (weekly, monthly, tentpole);
  - content pipeline and cadence;
  - economy levers and tuning rules;
  - A/B policy;
  - tournament operations;
  - communications;
  - incident and rollback (link to the runbook);
  - KPIs and targets;
  - rota.
- **KPIs** [U, standard terms]: DAU/MAU, D1/D7/D30, session length, payer conversion, ARPDAU, season completion, churn, tournament participation.
- **Evidence:** Unity's 2026 report (92% of studios under 10 people run daily rewards or missions) and card-game cadences [V/S, section 6.5]. Machinations is pitched for live economy tuning [V].
- **Readers:** live-ops, design, data, community, owner.
- **For Sonnet Man:**
  - Seasons themed on forms or traditions (sonnet season, haiku season, griot and oral traditions).
  - One Devon Glover headline duel per season.
  - Weekly prompts in all 16 languages.
  - School-term calendars.
  - Credits levers.
  - Tournament judging operations (server re-judge, appeals).
  - KPIs split by player and classroom cohorts.
  - No mechanics that punish absence.

### 7.19 Analytics plan and tracking plan

- **Purpose:** say exactly which events and properties are collected, why, under what names, for which KPI.
- **Columns:** event name; trigger; properties (name, type, allowed values, required); user properties; platform; KPI served; owner; status; privacy class (personal data? child?); retention; lawful basis.
- **Vendor guidance:**
  - Amplitude, "Data planning playbook" (updated 2026-09-09, https://amplitude.com/docs/data/data-planning-playbook) [V]: "Noun + Past-Tense Verb" names (`Song Played`); consistent casing; one event with a property rather than near-duplicates; unambiguous property names.
  - Mixpanel, "Tracking plan" (https://docs.mixpanel.com/docs/tracking-best-practices/tracking-plan) [V]: KPIs, then flows, then events; a blank spreadsheet template.
  - Avo: branches, review, type-safe codegen, an MCP for agents (https://www.avo.app/docs/) [V].
- **Readers:** data, engineers, product, privacy review.
- **For Sonnet Man:**
  - A YAML or CSV tracking plan in the repo, with codegen for the client and the Rust API.
  - Events such as `Duel Started`, `Verse Submitted` (input mode, language, form, length band; never the text), `Verse Scored`, `Model Download Accepted`, `Duel Completed`, `Class Created`, `Credits Earned`, `Credits Spent`, `Listing Purchased`, `Referral Redeemed`.
  - A stricter plan for classroom tenants.
  - The consent rules in section 6.2 attached to each event.

### 7.20 Legal and licence register

- **Purpose:** track every right the game depends on and every duty it carries.
- **Contents:**
  - third-party code licences and a NOTICE file;
  - an **SBOM**;
  - an asset register (source, licence, author, proof, AI-generated flag);
  - fonts, music and VO licences;
  - trademarks;
  - talent and likeness agreements;
  - privacy notice, terms, community rules;
  - credits and marketplace terms;
  - referral terms;
  - school data agreements;
  - ratings;
  - contractor IP assignments.
- **SBOM formats:**
  - **SPDX:** 3.0 is "Current Version" (page updated 2025-08-05); ISO/IEC 5962:2021 is SPDX 2.2.1 (https://spdx.dev/use/specifications/) [V]. 3.0.1 is from December 2024 [S].
  - **CycloneDX 1.7**, released 2025-10-21 (https://cyclonedx.org/news/cyclonedx-v1.7-released) [V], standardised as **ECMA-424, 2nd edition, December 2025** (https://ecma-international.org/publications-and-standards/standards/ecma-424/) [V].
- **Readers:** owner, counsel, partners, schools, platforms.
- **For Sonnet Man:**
  - The Devon Glover licence (section 5.8) is the keystone.
  - Generate a CycloneDX or SPDX SBOM in CI covering Rust crates, npm packages, wasm modules and **model weights with their licences**.
  - Asset register with an AI-provenance column.
  - Data-licence register (section 5.10).
  - Text-provenance register for Shakespeare editions and translations (section 5.9).
  - Players keep copyright in their verses and grant a display licence; quoting copyrighted lyrics is not allowed.
  - Track the LFM US$10M threshold and the eSpeak NG GPL item.

### 7.21 Postmortem

- **Purpose:** capture lessons after a milestone, launch or season.
- **Format:**
  - the Game Developer/Gamasutra postmortem: vital stats, "What Went Right", "What Went Wrong", conclusion [U for the usual five-and-five convention];
  - GDC "Classic Game Postmortem" talks [U];
  - Google's design-doc guidance says to revisit a design doc after a year or two and record what was right and wrong [V].
- **Evidence:** Politowski et al. analysed 200 postmortems [V]. Washburn et al., "What Went Right and What Went Wrong: An Analysis of 155 Postmortems from Game Development" (ICSE-SEIP 2016, https://dl.acm.org/doi/10.1145/2889160.2889253) [U, page refused].
- **Retrospectives:** sprint retros (start, stop, continue) and blameless incident postmortems (timeline, impact, root cause, actions) [U].
- **Readers:** team, future team, sometimes the public.
- **For Sonnet Man:**
  - A template in the repo, run after each milestone and season.
  - A blameless incident template that covers AI-output incidents as well as outages.
  - A public "making of" postmortem after launch, approved by Devon Glover.

### 7.22 Further documents the 2024–26 evidence and the law in section 5 call for

1. **Game concept document** (1–3 pages; Ryan, WPI [V]). It precedes the pitch, and can double as the GDD hub.
2. **Vertical-slice brief** [U as a named document]: which slice, quality bar, risks retired, exit criteria.
3. **Monetisation and economy design document.**
   - Contents: currencies, sources and sinks, prices, store, a no-pay-to-win statement, refunds, age gates.
   - Checks: real-money price display (CPC), credits that do not expire in store builds (Apple 3.1.1), PEGI triggers, no cash-out (FinCEN).
4. **Trust-and-safety plan and child-safety policy.**
   - Contents: code of conduct, enforcement ladder, reporting, the moderation cascade, appeals, NCMEC escalation and preservation, Take It Down notice process, statement-of-reasons template.
   - Evidence: section 4; Tech Coalition Pathways [V].
5. **Online Safety Act risk assessment** (UK s.9) [V]: a separate written assessment, redone before significant changes.
6. **Data protection impact assessment (DPIA)** under the Children's code, which requires a DPIA (ICO, standard 2, https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/2-data-protection-impact-assessments/) [V].
   - Start early and finish before launch.
   - Cover age range, age assurance, profiling, nudges and harms.
   - Consult children and parents, or record why not.
   - The ICO's template is Annex D.
7. **COPPA compliance pack.**
   - The **written information security program** and **written data retention policy**, both required by the amended rule (section 5.1).
   - The online notice, the direct notice, the consent flow, and the school-consent terms.
8. **AI system card and AI disclosure.**
   - A model card for each model in use: intended use, evaluations across groups (here, languages), failure modes, guardrails. After Mitchell et al., "Model Cards for Model Reporting" (arXiv 1810.03993, 2018/2019, https://arxiv.org/abs/1810.03993) [V].
   - The Art 50 disclosure text and the machine-readable marking method (section 5.4).
   - The SB 243 topic guardrails (section 5.2).
   - Steam's content survey, which asks live-generated games to describe "what kind of guardrails you're putting on your AI", is a usable template even off Steam (https://partner.steamgames.com/doc/gettingstarted/contentsurvey) [V].
9. **Accessibility statement** (W3C minimum contents and generator) [V].
10. **Support, FAQ and school pack.**
    - Help pages: microphone permission per browser, model download and storage, passkey recovery, refunds.
    - A teacher guide, and a school pack: data agreement, privacy summary, accessibility statement, curriculum alignment, the "scores are formative, not grades" statement (section 5.4). [U as a named standard; inference from section 5]
11. **Launch checklist and operations runbook:** store and portal assets, legal pages live, analytics verified, load test, rollback, comms; deploy, rollback, incident response, model hot-swap, moderation escalation, on-call. [U] These fit the owner's existing site-ops deploy flow. [Inference]
12. **Brand and talent bible:** approved uses of Devon Glover's persona, the approval turnaround, co-marketing rules, crisis protocol. [Inference]
13. **EU and UK representative appointments, and a regulatory calendar.** Dates that recur or fall due:
    - 2026-12-02: Art 50(2) transition ends;
    - 2027-01-01: Vermont AADC;
    - 2027-01-12: Apple age-rating descriptors;
    - 2027-01-25: NY SAFE for Kids Act;
    - 2027-12-02: AI Act Annex III;
    - yearly: COPPA security review.
14. **AGENTS.md / contributor guide:** the entry document for agents working in the repo (https://agents.md/) [V].

---

## 8. The dossier this implies (inference)

All documents are Markdown in the game repo (docs-as-code), with a hub index. Supporting files:
- ADRs as numbered files (Nygard or MADR);
- data files for cards, economy, tracking plan and strings that generate game data and reports;
- design tokens in DTCG 2025.10 JSON;
- an AGENTS.md at the root.

| Tier | When | Documents |
|---|---|---|
| 0, now | Already due | AI disclosure and Art 50(2) marking plan (deadline 2026-12-02); COPPA written security program and retention policy; Devon Glover licence terms; licence fixes (kokoro-js GPL, Folger) |
| 1 | Before the vertical slice | Concept and pitch; GDD hub and one-pagers; TDD and ADRs; vertical-slice brief; risk register; accessibility plan; localisation kit v0 (first 2 languages); AI system cards |
| 2 | Before alpha and the classroom beta | Art, audio, narrative and performer bibles; UX flows and design system; content and economy sheets; mode specs; QA plan and device matrix; tracking plan; DPIA; OSA risk assessment; trust-and-safety plan; school pack; monetisation design |
| 3 | Before launch | Market analysis; marketing plan and press kit; landing and store pages; live-ops plan; legal and licence register with SBOM; accessibility statement; support and FAQ; launch checklist and runbook; EU/UK representatives; regulatory calendar |
| After each milestone and season | | Postmortem; register and calendar updates |

---

## 9. What I could not verify, and what to re-check first

Search allowance exhausted, or the site refused automated access:

1. Ofcom's code measures for small, low-risk user-to-user services, and its online regulation checker.
2. The EU CPC "key principles on in-game virtual currencies" text and date (reported 2025-03-13).
3. Texas SB 2420's injunction history; Utah SB 142 and Louisiana HB 570 dates; California AB 1043's developer duties.
4. Whether the Connecticut and Colorado minors' provisions apply below the volume thresholds; the Arkansas teen privacy act.
5. The enacted text of Nebraska LB 504 (and LB 838).
6. The Digital Omnibus on AI's Official Journal reference, and the final Art 4 and Art 50(7) wording on EUR-Lex.
7. Project Gutenberg's licence wording; Folger's formal licence (CC BY-NC is reported, not seen).
8. Tennessee's ELVIS Act, California Civil Code §3344.1, and the 2025 amendment to NY Civil Rights Law §50-f.
9. Devon Glover's domicile (New York is indicated; Brooklyn is not confirmed).
10. Spain's Art 8 age change; Slovenia's 15; the EEA states.
11. The revenue share for Discord Activities; Newgrounds and GameDistribution terms; itch.io's SharedArrayBuffer option.
12. WebGPU in Android WebView (sources conflict) and in iOS WKWebView in practice. An Android tab's memory limit.
13. Any measured in-browser real-time factor for Moonshine, Granite Speech or Kitten TTS. Whether Kitten TTS 2 runs in a browser.
14. Whether Firefox 161 (2026-11-24) ships on-device speech recognition, and in which languages.
15. Any shipped web game using an in-browser LLM in 2025–26.
16. Newzoo's 2025–26 market figures. GDC and Game Developer sources on live-ops calendars and card-game balance practice (Magic's set skeleton, Hearthstone telemetry).
17. Official pitch guidance from Devolver, Hooded Horse and Annapurna.

Checked by me directly, beyond the agents' reading:
- the AI Act Service Desk timeline and the Commission AI Act page (Omnibus dates, the 2026-12-02 transition);
- Vermont S.69 status (Act 63, effective 2027-01-01);
- the `phonemizer` 1.2.1 package contents (section 3.4).
