// Lets plain Node import the engine's TypeScript modules, which name each other without an
// extension ("./lang"). Node strips the types itself; this only finishes the file names.
//   node --import ./scripts/sound/ts-resolve.mjs scripts/sound/build.mjs ...
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
        for (const ext of ['.ts', '/index.ts']) {
          try {
            return nextResolve(specifier + ext, context);
          } catch {
            // try the next ending
          }
        }
      }
      throw err;
    }
  },
});
