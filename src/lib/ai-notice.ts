/**
 * What the player is told before a duel about who plays and who judges.
 *
 * The EU AI Act (Regulation (EU) 2024/1689) asks, from 2 August 2026, that a person interacting
 * with an AI system be told so (Article 50(1)), "in a clear and distinguishable manner at the latest
 * at the time of the first interaction" (Article 50(5)). The game's opponent and judge are a model
 * in the browser only where that model is loaded AND has been measured to write or judge in the
 * duel's language (brain.ts writesIn / judgesIn, the same gate DuelSession applies); everywhere
 * else a program plays prepared verses and fixed rules judge, and the player is told that instead.
 *
 * One sentence pair per case, never pieced together, so each language says it whole
 * (src/i18n/locales, keys notice.*). Online duels have their own line (notice.online): no model.
 *
 * No import of the i18n module here: Playwright specs import this file in Node (CLAUDE.md, Gotchas).
 */
import { modelJudges, modelWrites, type ModelSpec } from './brain';

export type NoticeKey = 'notice.aiBoth' | 'notice.aiWrites' | 'notice.aiJudges' | 'notice.none';

export interface AiNotice {
  key: NoticeKey;
  vars: { model?: string };
  /** Who writes the opponent's verses: the model, or the written opponent. */
  opponent: 'model' | 'written';
  /** Who judges: the model, or the rules. */
  judge: 'model' | 'rules';
}

/**
 * The notice for a duel in `lang`, with `model` the model in use (null when none is loaded, or the
 * player chose to play without one).
 */
export function aiNotice(model: ModelSpec | null | undefined, lang: string): AiNotice {
  const writes = !!model && modelWrites(model, lang);
  const judges = !!model && modelJudges(model, lang);
  const opponent = writes ? 'model' : 'written';
  const judge = judges ? 'model' : 'rules';
  if (!model || (!writes && !judges)) return { key: 'notice.none', vars: {}, opponent, judge };
  const key: NoticeKey = writes && judges ? 'notice.aiBoth' : writes ? 'notice.aiWrites' : 'notice.aiJudges';
  return { key, vars: { model: model.label }, opponent, judge };
}
