# Inspired Mile — Project Brief & Business Plan

## Executive Summary

**Inspired Mile** is an interactive digital entertainment platform that combines collectible digital cards with AI-powered AR experiences. The flagship product line — **Shakespeare on the Go** — is built around Devon Glover's ("The Sonnet Man") unique Shakespeare-meets-hip-hop brand, pairing digital collectible cards with AI-powered rap battle experiences and augmented reality.

The company aims to create a replicable platform that can be themed and licensed across multiple IP verticals, starting with an original Shakespeare-inspired experience to prove the concept and build a cult following.

---

## Company Information

| Field | Detail |
|-------|--------|
| **Legal Name** | Voyage Tracable, LLC (DBA Inspired Mile) |
| **Headquarters** | Sarasota, FL |
| **Entity Type** | LLC |
| **Stage** | Pre-prototype / Concept |

---

## Team

| Name | Role |
|------|------|
| **David Charlot, PhD** | Founder — Technical lead, platform architecture, fundraising |
| **Devon Glover** ("The Sonnet Man") | Creative Director — Shakespeare content, performance, brand ambassador |
| **Arrocito del Diablo** | Co-founder — Game design, card mechanics, strategy |

---

## The Problem

Collectible card games (Pokemon, Magic: The Gathering, Yu-Gi-Oh!) have massive audiences but their digital experiences remain flat and non-interactive. There is no mainstream product that:

1. Combines digital collectible cards with AI-powered interactive experiences
2. Lets card owners unlock unique AR/video content from their collection
3. Ties collectible value to a digital marketplace and ranking system
4. Gets people outside, interacting face-to-face while using modern tech

---

## The Solution

### Platform Overview

Inspired Mile is building a **two-layer platform**:

#### 1. Digital Playground
- **Card Acquisition**: Earn cards through mini-games (Shakespeare trivia, quote challenges), battle victories, daily packs, and direct purchase
- **AI Battle Arena**: Challenge the "Master Thespian" AI agent in melodic Shakespeare rap battles (fully client-side via WebLLM)
- **Collection Management**: Browse, filter, and manage your card library with real-time ownership tracking
- **Cross-Platform**: Works via mobile webapp, Apple Vision Pro, Meta Quest 3, WebAR

#### 2. Digital Asset & Marketplace (Hybrid Model)
- Cards exist locally first (localStorage) — no crypto needed to play
- Optional wallet connection (Solana) to mint cards as compressed NFTs (cNFTs) for true on-chain ownership
- Marketplace value influenced by combat rankings
- Tiered scarcity: 10,000 general NFTs, 100 special Sonnet Man tier cards
- Target chain: Solana (cheapest mints, fastest transactions, best gaming ecosystem)

---

## Flagship Product: Shakespeare on the Go

### Concept
Built around Devon Glover's "Sonnet Man" persona ([sonnetman.com](https://sonnetman.com)) — a teaching artist and theater performer who brings Shakespeare to life through hip-hop, poetry, and adaptation. Glover has partnered with the Southern Shakespeare Festival, Shakespeare Behind Bars, GO Learning Lab, and schools nationwide. His music is available on Spotify, Tidal, and Apple Music.

**Socials**: YouTube [TheSonnetManTV](https://www.youtube.com/TheSonnetManTV) | X [@thesonnetmannyc](https://x.com/thesonnetmannyc) | LinkedIn [thesonnetman](https://www.linkedin.com/in/thesonnetman/) | Facebook [TheSonnetMan](https://www.facebook.com/TheSonnetMan/)

### Card Game Mechanics (Proposed)
- **Houses**: Based on Shakespeare's plays (Montague, Capulet, Danish Court, Forest of Arden, etc.) — these form the base of each deck
- **Characters**: Drawn from Shakespeare's canon — each with unique abilities
- **Relics & Potions**: Items used in combat encounters
- **Battle System**: Turn-based or real-time rap battle encounters powered by AI

### Card Tiers
| Tier | Quantity | Description |
|------|----------|-------------|
| **General Collection** | 10,000 | Shakespeare-themed digital cards with AR experiences |
| **Sonnet Man Special** | 100 | Exclusive Glover-themed cards with unique AI rap battle content |
| **Tour Exclusives** | Limited | Digital drops tied to Glover's live performances (European tour) |

### AI Master Thespian
A curated LLM agent trained as a master battle rapper / thespian. Users challenge it in:
- Shakespearean rap battles
- Sonnet completion challenges
- Quote adaptation games
- Melodic call-and-response

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend WebApp** | Astro + Tailwind CSS (responsive, mobile-first) |
| **AR Layer** | AR.js / WebXR (prototype) → Niantic SDK (production) |
| **AI LLM** | WebLLM (in-browser via WebGPU) — Llama 3.2 3B Q4 (~1.8GB, client-side, private) |
| **AI TTS** | Kokoro TTS 82M (in-browser via WASM/WebGPU) — ~86MB, multiple voices, Apache 2.0 |
| **AI STT** | Web Speech API (zero-setup) + Moonshine Web (27MB, fully private fallback) |
| **3D Scenes** | Generative AI video (15-second clips) |
| **VR Targets** | Apple Vision Pro, Meta Quest 3 (via Meta Horizon Start program) |
| **Blockchain** | Solana — compressed NFTs via Metaplex (hybrid: off-chain first, on-chain optional) |
| **Wallet** | Solana wallet-adapter (Phantom, Solflare, etc.) |
| **Local Storage** | localStorage/IndexedDB for off-chain card inventory |

### Client-Side AI Philosophy
All AI processing runs entirely in the user's browser — no data ever leaves the device. Models are downloaded once and cached locally. Zero server costs for AI inference. Requires WebGPU-capable browser (Chrome 113+, Edge 113+).

---

## Go-to-Market Strategy

### Phase 1: Prototype & Content (Current → Q3 2025)
- Build webapp prototype
- Create initial digital card artwork with AI assistance
- Capture footage alongside Sonnet Man's performances/European tour
- Develop Master Thespian AI agent prototype

### Phase 2: Platform Launch (Q1 2026)
- Go live with digital playground, card collection, and AI battle arena
- Sonnet Man as the face of launch marketing
- Glover promotes exclusive digital drops at live events
- Community building via Discord, social media

### Phase 3: Platform Expansion & Fundraising (Q3 2026)
- Fundraising: $300K – $1M (grants + angel investors)
- Expand card themes beyond Shakespeare
- Digital marketplace for card trading
- Seek licensing partnerships with Nintendo, others

### Phase 4: Platform & Licensing (2027)
- Open platform for third-party IP integration
- License the tech stack to other brands/creators
- Become an acquisition target through unique software moat

---

## Revenue Model

| Stream | Description |
|--------|-------------|
| **Digital Card Sales** | Digital card packs (general + premium tiers) |
| **NFT Sales** | Digital asset sales and secondary marketplace fees |
| **Subscriptions** | Premium AI battle experiences, exclusive content |
| **Licensing** | Platform licensing to other IP holders |
| **Events** | Live battle tournaments, karaoke events |

---

## Competitive Landscape

| Competitor | What They Do | Our Differentiation |
|------------|-------------|---------------------|
| **Niantic** (Pokemon GO) | AR mobile games using licensed IP | We own our platform + seek licensing after proving concept |
| **TopShot / NBA NFTs** | Sports digital collectibles | AI-powered interactive experiences, not just static clips |
| **Traditional TCGs** | Pokemon, MTG, Yu-Gi-Oh | Static gameplay — we add AI battle rap, AR, and generative scenes |
| **AI Companions** | Character.ai, etc. | We wrap AI interaction in a collectible card game with real stakes |

---

## Financial Targets

| Milestone | Amount | Source |
|-----------|--------|--------|
| **Seed Round** | $300K – $1M | Grants + angel investors |
| **18-Month Runway** | Target operational breakeven | Digital card sales + subscription revenue |

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| IP infringement claims | Use only original IP; no Nintendo/Pokemon assets |
| Team capacity | Lightweight commitment (~3-5 hrs/week per person) |
| Market adoption | Leverage Glover's existing fanbase as launchpad |
| Technical complexity | Phased approach — webapp first, AR/VR second |
| Digital asset regulation | Monitor NFT regulatory landscape; keep marketplace optional |

---

## Immediate Next Steps

1. Build webapp prototype (card collection → AI experience)
2. Create initial digital card artwork (AI-assisted)
3. Coordinate with Glover's tour schedule for content capture
4. Apply for Meta Horizon Start program
5. Prepare for Q1 2026 platform launch

---

*Document generated from team conversations, March – June 2025*
*Voyage Tracable, LLC (DBA Inspired Mile)*
