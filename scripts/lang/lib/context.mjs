/** Where a string appears, in a sentence, from its key: what a translator or reviewer needs to know. */
const CONTEXT = [
  [/^form\..*\.name$/, 'Name of a verse form the player must write in (a heading). Should be the form\'s real name in the language\'s literary tradition where one exists.'],
  [/^form\..*\.brief/, 'One-sentence rule of a verse form, shown under its name.'],
  [/^check\./, 'A requirement in a live checklist beside the text box where the player writes a verse; a short label, not a sentence.'],
  [/^device\..*\.name$/, 'Name of a rhetorical device a card asks for (a short title).'],
  [/^device\..*\.brief/, 'Instruction telling the player what a rhetorical device requires of the verse.'],
  [/^curse\..*\.name$/, 'Name of a curse (a restriction placed on the other player\'s next verse).'],
  [/^curse\..*\.brief/, 'A curse\'s rule, told to the player who is under it.'],
  [/^curse\..*\.theirs/, 'A curse\'s rule, told to the player who cast it on the opponent.'],
  [/^house\./, 'Flavour line saying why a group of Shakespeare characters fights the way it does.'],
  [/^nav\./, 'Site navigation menu label.'],
  [/^footer\./, 'Site footer text or link.'],
  [/^age\./, 'Age gate shown on first visit: asks date of birth; under 13 refused, 13 to 17 need a parent\'s consent. Legal tone, plain words.'],
  [/^migrate\./, 'Banner offering to copy locally saved game progress to the signed-in account.'],
  [/^toast\./, 'Brief pop-up notification.'],
  [/^pwa\./, 'Banner offering to install the site as an app.'],
  [/^offline\./, 'Banner shown when the browser is offline.'],
  [/^auth\.error\./, 'Error message in the sign-in dialog.'],
  [/^auth\./, 'Sign-in dialog. Accounts use passkeys (WebAuthn) or a 6-digit code sent by email; there are no passwords. Use the platform\'s established word for "passkey" and "sign in".'],
  [/^battle\.difficulty\./, 'Option in the difficulty menu: how many drafts the computer opponent writes before choosing.'],
  [/^battle\./, 'Set-up screen of the duel (a three-round battle of verses played with cards).'],
  [/^brain\./, 'Status text about the AI model that plays the opponent; it is downloaded once and runs in the browser.'],
  [/^round\./, 'Screen of one round of the duel: the opponent plays a verse, the player answers with a card and a verse.'],
  [/^chip\./, 'Small label (a chip) on a card.'],
  [/^hand\./, 'Tooltip or note about a card in the player\'s hand (relics lend "power words"; potions curse the opponent).'],
  [/^variant\./, 'Bonus shown on a world card: plus N points on one judging criterion.'],
  [/^illegal\./, 'Message when the player tries a move the rules do not allow.'],
  [/^live\./, 'Line of the live checklist that scores the verse as the player types.'],
  [/^signature\./, 'Status of the "signature" bonus: echoing a word of the card\'s famous Shakespeare line without quoting it.'],
  [/^mic\./, 'Status of the microphone button used to dictate a verse (speech is transcribed on the device).'],
  [/^voice\./, 'Toggle for reading verses aloud.'],
  [/^verdict\./, 'Verdict screen after a round: score table, who won each judging criterion.'],
  [/^criterion\./, 'One of the four things the judge compares (lower case, used inside a sentence or table).'],
  [/^end\./, 'End-of-duel screen.'],
  [/^rarity\./, 'Card rarity label.'],
  [/^badge\./, 'Small badge saying what the player is up against (a model on this device, or the written opponent).'],
  [/^stats\./, 'Label of a statistic on the player\'s record.'],
  [/^theatre\./, 'The Theatre: the same duel on a 3D stage, for VR/AR headsets or a screen.'],
];
/**
 * The strings whose {rule} the page fills with a curse's rule as told to the one who cast it
 * (curseRuleTheirs: "Their verse may not…"), not to the one under it (curseRule: "Your verse may
 * not…"). Until 2026-11-16 the tools filled every {rule} with the second, so LanguageTool, the
 * back-translation and the reviewer judged sentences no player sees (es "Maldice a tu rival:
 * Ninguna de tus palabras…"). A unit test holds this list to the calls in src/.
 */
export const RULE_TOLD_TO_CASTER = ['hand.curses', 'hand.potionNote'];

export function contextOf(key) {
  for (const [re, text] of CONTEXT) if (re.test(key)) return text;
  return 'Interface text of the game.';
}
