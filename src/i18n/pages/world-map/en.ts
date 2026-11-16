/**
 * The world map page: English.
 *
 * The reference: every other language has exactly these keys, with the same {placeholders}
 * and the same <b>/<a> marks (src/i18n/pages.test.ts).
 * Where the text came from and how it was checked: docs/language/pages-core/README.md.
 */
const messages: Record<string, string> = {
  'world-map.meta.description': 'Explore cities around the world and discover World Card variants for your Shakespeare characters.',
  'world-map.badge': 'World Cards',
  'world-map.title': 'World <b>Map</b>',
  'world-map.intro': "Shakespeare's characters travel the globe. Each city grants a unique battle ability. Unlock variants through battles, trivia, and exploration.",
  'world-map.cities': 'Cities discovered: <b>{n}</b> / {total}',
  'world-map.combinations': 'Possible combinations: {n}',
  'world-map.view': 'View',
  'world-map.attire': 'Attire Styles',
  'world-map.hair': 'Hairstyles',
  'world-map.yours': 'Your Variants in This City',
  'world-map.none': 'No variants unlocked in {city} yet.',
  'world-map.unknownCard': 'Unknown card',
  'world-map.close': 'Close',
};

export default messages;
