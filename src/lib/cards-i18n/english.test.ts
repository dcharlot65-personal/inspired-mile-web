// An English duel never goes through the card text of other languages (src/lib/verse/echo.ts returns at once for
// English). This holds it to that: every English result is the same before any language's card text is loaded and
// after all of them are, and a French duel's are not, which shows the comparison can see a difference.
import { describe, expect, it } from 'vitest';
import { CARD_CATALOG } from '../cards';
import { DEVICES, checkSignature, invocationNames, signatureNeeded, signatureWords } from '../verse/devices';
import { getPack, loadAllPacks } from '../verse/packs';
import { allusionLexicon } from '../verse/referee';
import { rulesJudge } from '../verse/judge';
import { getCardText, loadAllCardText } from './index';

const NAMES = invocationNames(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.name));

function verses(): string[] {
  const p = getPack('en');
  const own = [...Object.values(p.written).flat(), ...Object.values(p.acrosticLines).flat()];
  // And verses that echo each card: its telling words, and its line recited.
  const echoes = CARD_CATALOG.flatMap((c) => [`one ${signatureWords(c).slice(0, signatureNeeded(c)).join(' and ')} here`, c.quote]);
  return [...own, ...echoes, 'Hear me, Hamlet', 'Mark my words, Antony', 'Ele põe a mesa', 'Bức màn khép lại', 'la nourrice', 'Romeos Ring'];
}

function results(lang: string) {
  const vs = verses();
  return {
    signature: CARD_CATALOG.map((c) => vs.map((v) => JSON.stringify(checkSignature(c, v, lang)))),
    invocation: vs.map((v) => JSON.stringify(DEVICES.invocation.check(v, { lang, names: NAMES }))),
    telling: CARD_CATALOG.map((c) => [signatureWords(c), signatureNeeded(c)]),
  };
}

function judged() {
  const vs = verses();
  return {
    judge: vs.slice(0, 60).map((v, i) => JSON.stringify(rulesJudge(v, vs[(i + 7) % vs.length], 'en', allusionLexicon('en')))),
    lexicon: [...allusionLexicon('en')].sort(),
  };
}

describe('an English duel is the same whatever card text is loaded', () => {
  it('signature, invocation, telling words, the rule judge and its allusion lexicon, before and after', { timeout: 120000 }, async () => {
    expect(getCardText('fr')).toBeNull();
    const before = { ...results('en'), ...judged() };
    const frBefore = results('fr');
    await loadAllPacks();
    await loadAllCardText();
    expect(getCardText('fr')).not.toBeNull();
    const after = { ...results('en'), ...judged() };
    expect(after).toEqual(before);
    // The French results change once the French card text is there: the comparison is not blind.
    const frAfter = results('fr');
    const changed = frAfter.signature.flat().filter((r, i) => r !== frBefore.signature.flat()[i]).length;
    expect(changed).toBeGreaterThan(100);
  });
});
