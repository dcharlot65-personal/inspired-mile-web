/**
 * What must hold between an area's English messages and the same area in another
 * language. Used by src/i18n/pages.test.ts, which also feeds it broken input to
 * show that each rule can fail.
 */
export const placeholders = (s: string) => [...s.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]).sort();
export const marks = (s: string) => [...s.matchAll(/<\/?[a-zA-Z]+>/g)].map((m) => m[0]).sort();

/** The only marks a message may carry (see rich() in ./runtime.ts), properly paired and not nested. */
function marksWellFormed(s: string): boolean {
  let open: string | null = null;
  for (const m of s.matchAll(/<(\/?)([a-zA-Z]+)>/g)) {
    if (m[2] !== 'a' && m[2] !== 'b') return false;
    if (m[1]) {
      if (open !== m[2]) return false;
      open = null;
    } else {
      if (open) return false;
      open = m[2];
    }
  }
  return open === null;
}

export function compareMessages(label: string, en: Record<string, string>, other: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const k of Object.keys(en)) if (!(k in other)) problems.push(`${label}: missing ${k}`);
  for (const [k, v] of Object.entries(other)) {
    if (!(k in en)) {
      problems.push(`${label}: extra ${k}`);
      continue;
    }
    if (typeof v !== 'string' || v.trim().length === 0) {
      problems.push(`${label}: empty ${k}`);
      continue;
    }
    if (placeholders(v).join(',') !== placeholders(en[k]).join(',')) problems.push(`${label}: ${k} has {${placeholders(v)}} but English has {${placeholders(en[k])}}`);
    if (marks(v).join(',') !== marks(en[k]).join(',')) problems.push(`${label}: ${k} has marks ${marks(v)} but English has ${marks(en[k])}`);
    if (!marksWellFormed(v)) problems.push(`${label}: ${k} has a mark that is not <a> or <b>, or is not closed`);
    // A brace or an angle bracket that is not a placeholder or a mark would be shown to the player.
    if (/[{}<>]/.test(v.replace(/\{[a-zA-Z_]+\}/g, '').replace(/<\/?[ab]>/g, ''))) problems.push(`${label}: stray brace or bracket in ${k}`);
    if (v !== v.trim()) problems.push(`${label}: ${k} starts or ends with a space`);
    if (/\\u[0-9a-fA-F]{4}/.test(v)) problems.push(`${label}: ${k} carries a literal \\u escape`);
  }
  return problems;
}
