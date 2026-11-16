/**
 * A message the engine wants shown: a stable key and its variables, never a
 * sentence. The page turns it into text in the player's language with t();
 * ./english.ts turns it into English for the prompt sent to the model.
 */
export interface Msg {
  key: string;
  vars?: Record<string, string | number>;
}

export function msg(key: string, vars?: Msg['vars']): Msg {
  return vars ? { key, vars } : { key };
}

/** Replace {name} in a template. An unknown name is left as written, so a missing variable shows in tests. */
export function interpolate(template: string, vars?: Msg['vars']): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z_]+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
