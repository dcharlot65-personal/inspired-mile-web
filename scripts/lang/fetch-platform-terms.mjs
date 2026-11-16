#!/usr/bin/env node
/**
 * Fetch the platform vendor's own translations of platform terms (passkey,
 * sign in, microphone, screen lock, fingerprint, home screen, download) from
 * the Android Open Source Project's string resources, where every language's
 * file carries the same string names.
 *
 *   node scripts/lang/fetch-platform-terms.mjs     writes docs/language/sources/aosp-terms.json
 *
 * Source: github.com/aosp-mirror/platform_frameworks_base at a pinned commit
 * (Apache License 2.0). These are Google's shipped translations; they are the
 * reference for the glossary's platform terms (docs/language/glossary.json).
 */
import { writeFileSync } from 'node:fs';

const COMMIT = '1cdfff555f4a21f71ccc978290e2e212e2f8b168';
const BASE = `https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/${COMMIT}`;
// our language -> Android resource qualifier
const DIRS = { en: 'values', es: 'values-es', fr: 'values-fr', de: 'values-de', it: 'values-it', pt: 'values-pt-rBR', pl: 'values-pl', ru: 'values-ru', ar: 'values-ar', hi: 'values-hi', zh: 'values-zh-rCN', ja: 'values-ja', ko: 'values-ko', vi: 'values-vi', th: 'values-th', id: 'values-in' };
const WANT = {
  'packages/CredentialManager/res': ['passkey', 'passkeys', 'password', 'sign_ins', 'passkey_creation_intro_title', 'passkey_creation_intro_body_fingerprint', 'passkey_creation_intro_body_device', 'choose_create_option_passkey_title', 'get_dialog_title_use_passkey_for', 'other_password_manager', 'another_device'],
  'core/res/res': ['kg_login_submit_button', 'permgrouplab_microphone', 'screen_lock', 'autofill_save_notnow', 'back_button_label', 'install_carrier_app_notification_button'],
  'packages/SystemUI/res': ['group_system_access_home_screen', 'screenrecord_mic_label'],
  'packages/SettingsLib/res': ['tts_default_lang_title'],
};

const unescape = (s) => s.replace(/<xliff:g[^>]*>(.*?)<\/xliff:g>/g, '$1').replace(/\\(['"])/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u2019/g, '’').replace(/^"(.*)"$/s, '$1').replace(/\s+/g, ' ').trim();
const out = { source: `${BASE}/<module>/<values-dir>/strings.xml`, commit: COMMIT, licence: 'Apache License 2.0 (Android Open Source Project)', fetched: new Date().toISOString(), dirs: DIRS, terms: {} };
for (const [module, names] of Object.entries(WANT)) {
  for (const [lang, dir] of Object.entries(DIRS)) {
    const r = await fetch(`${BASE}/${module}/${dir}/strings.xml`);
    if (!r.ok) throw new Error(`${r.status} ${module}/${dir}`);
    const xml = await r.text();
    for (const name of names) {
      const m = xml.match(new RegExp(`<string name="${name}"[^>]*>([\\s\\S]*?)</string>`));
      ((out.terms[name] ??= { module, text: {} }).text)[lang] = m ? unescape(m[1]) : null;
    }
  }
}
writeFileSync(new URL('../../docs/language/sources/aosp-terms.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const n of ['passkey', 'passkeys', 'kg_login_submit_button', 'permgrouplab_microphone', 'screen_lock', 'group_system_access_home_screen', 'install_carrier_app_notification_button']) console.log(n, JSON.stringify(out.terms[n].text));
