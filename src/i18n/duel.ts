/**
 * Text that both duel screens (the battle page and the 3D theatre) build from
 * the engine's results, so the two say the same thing in every language.
 */
import { CURSES, DEVICES, type DeviceResult } from '../lib/verse/devices';
import { theirs } from '../lib/verse/english';
import { t, tm } from './index';

export function deviceName(id: string): string {
  return tm(DEVICES[id].name);
}

/** What a device asks for, in the terms of the language the duel is fought in (its thresholds differ). */
export function deviceBrief(id: string, duelLang: string): string {
  return tm(DEVICES[id].brief(duelLang));
}

export function curseName(id: string): string {
  return tm(CURSES[id].name);
}

/** A curse's rule as told to the one under it. */
export function curseRule(id: string, param: string, duelLang: string): string {
  return tm(CURSES[id].brief(param, duelLang));
}

/** A curse's rule as told to the one who cast it. */
export function curseRuleTheirs(id: string, param: string, duelLang: string): string {
  return tm(theirs(CURSES[id].brief(param, duelLang)));
}

/** Where a signature stands: which words would echo the line, or what went wrong. */
export function signatureText(sig: DeviceResult): string {
  switch (sig.code) {
    case 'hint':
      return t('signature.hint', { words: sig.detail });
    case 'quoted':
      return t('signature.quoted');
    case 'echoed':
      return t('signature.echoed', { word: sig.detail });
    case 'none':
      return t('signature.none');
    default:
      return sig.detail;
  }
}

/** A judge's criterion by name. World cards call allusion "shakespeare". */
export function criterionName(id: string): string {
  return t(`criterion.${id === 'shakespeare' ? 'allusion' : id}`);
}
