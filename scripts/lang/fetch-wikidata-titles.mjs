#!/usr/bin/env node
/**
 * The other direction of fetch-wikidata.mjs: given a term in a language, is it
 * the title of an article in that language's Wikipedia, and what is that
 * article about? Used where the concept's own Wikidata item has no article in
 * the language (or links one that is about something else), to tell a real
 * term from a coined one.
 *
 *   node scripts/lang/fetch-wikidata-titles.mjs   writes docs/language/sources/wikidata-titles.json
 *
 * "missing" means: no article of that title, or one not connected to Wikidata.
 */
import { writeFileSync } from 'node:fs';

const TITLES = {
  hi: ['दोहा', 'द्विपदी', 'चौपाई', 'चतुष्पदी', 'त्रिपदी', 'हाइकु', 'अनुप्रास', 'आद्याक्षरी', 'एक्रोस्टिक कविता', 'तुक', 'तुकबंदी', 'शब्दांश', 'अक्षर', 'छंद', 'पंक्ति', 'पद (कविता)', 'मुक्तक', 'रुबाई', 'क़ाफ़िया', 'अनुप्रास अलंकार', 'यमक', 'पुनरुक्ति'],
  th: ['กลอนคู่', 'กลอน', 'โคลง', 'ไฮกุ', 'กลอนกระทู้', 'โคลงกระทู้', 'อักษรกล', 'สัมผัส', 'สัมผัสอักษร', 'สัมผัสใน', 'พยางค์', 'ฉันทลักษณ์', 'กลบท', 'บาท (ฉันทลักษณ์)', 'วรรค', 'คำคล้องจอง', 'กลอนสี่', 'กลอนสุภาพ'],
  vi: ['Câu đối', 'Tứ tuyệt', 'Thơ tứ tuyệt', 'Khổ thơ', 'Điệp ngữ', 'Thơ khoán thủ', 'Khoán thủ', 'Lục bát', 'Tuyệt cú', 'Haiku', 'Vần', 'Âm tiết', 'Điệp âm', 'Phép điệp', 'Thất ngôn tứ tuyệt', 'Song thất lục bát', 'Thơ lục bát', 'Vần lưng', 'Độc vận'],
  ko: ['쿠플레', '대구법', '사행시', '삼행시', '이합체시', '하이쿠', '절구', '절구 (시)', '두운', '압운', '각운', '음절', '연 (시)', '수구반복', '결구반복', '영웅시체', '행 (시)', '요운', '점층법'],
  ja: ['二行連', '二行連句', '四行連', '四行詩', '三行連', '首句反復', '結句反復', '折句', '俳句', '絶句', '頭韻法', '頭韻', '中間韻', '押韻', '音節', '英雄詩体', 'ヒロイック・カプレット', '六八体', 'クレッシェンド', '漸層法', '平坦韻', '交差韻'],
  zh: ['对句', '四行诗', '三行体', '首语重复', '尾语重复', '藏头诗', '離合詩', '俳句', '绝句', '英雄双行体', '六八体', '六八體', '头韵', '頭韻法', '押韻', '音节', '層遞', '排比', '反复 (修辞)', '頂真', '對偶'],
  ar: ['مربع (شعر)', 'بيت (شعر)', 'مزدوج (شعر)', 'دوبيت', 'رباعية (شعر)', 'رباعيات', 'ثلاثية', 'تكرار الصدارة', 'تكرار النهاية', 'تتويج (شعر)', 'تطريز (شعر)', 'هايكو', 'سجع ابتدائي', 'جناس استهلالي', 'جناس', 'قافية', 'مقطع لفظي', 'إيطاء', 'ارتقاء (بلاغة)', 'دوبيت ملحمي', 'مثنوي', 'مخمس'],
  id: ['Kuplet', 'Bait (sastra)', 'Distikon', 'Kuatrin', 'Sajak empat baris', 'Terzina', 'Anafora', 'Epifora', 'Akrostik', 'Haiku', 'Jueju', 'Aliterasi', 'Rima', 'Suku kata', 'Sajak tunggal', 'Gurindam', 'Pantun', 'Syair', 'Klimaks', 'Distikon (sastra)', 'Terzina (sastra)'],
  ru: ['Двустишие', 'Дистих', 'Катрен', 'Четверостишие', 'Терцет', 'Анафора', 'Эпифора (риторика)', 'Акростих', 'Хайку', 'Цзюэцзюй', 'Героический стих', 'Люк бат', 'Аллитерация', 'Внутренняя рифма', 'Монорим', 'Рифма', 'Слог', 'Строфа', 'Градация', 'Парная рифмовка', 'Перекрёстная рифмовка', 'Рифмовка'],
  pl: ['Dystych', 'Tetrastych', 'Czterowiersz', 'Tercet (literatura)', 'Tercyna', 'Anafora (środek stylistyczny)', 'Epifora', 'Akrostych', 'Haiku', 'Aliteracja', 'Rym wewnętrzny', 'Monorym', 'Rym', 'Sylaba', 'Strofa', 'Wers', 'Gradacja (środek stylistyczny)', 'Dystych bohaterski', 'Rymy parzyste', 'Rymy krzyżowe', 'Układy rymów', 'Dwuwiersz'],
  de: ['Zweizeiler (Verslehre)', 'Reimpaar', 'Paarreim', 'Kreuzreim', 'Vierzeiler', 'Terzett (Verslehre)', 'Anapher', 'Epipher', 'Epiphora (Rhetorik)', 'Akrostichon', 'Haiku', 'Jueju', 'Heroic couplet', 'Heroic Couplet', 'Alliteration', 'Stabreim', 'Binnenreim', 'Haufenreim', 'Reim', 'Silbe', 'Strophe', 'Klimax (Sprache)', 'Lục bát'],
  fr: ['Distique (littérature)', 'Quatrain', 'Tercet', 'Anaphore (rhétorique)', 'Épiphore', 'Acrostiche', 'Haïku', 'Distique héroïque', 'Allitération', 'Rime interne', 'Rime intérieure', 'Monorime', 'Rime', 'Syllabe', 'Strophe', 'Gradation (rhétorique)', 'Rimes plates', 'Rimes croisées', 'Lục bát', 'Jueju', 'Rime léonine'],
  es: ['Pareado', 'Cuarteto (poesía)', 'Cuarteta', 'Serventesio', 'Terceto', 'Anáfora (retórica)', 'Epífora (retórica)', 'Acróstico', 'Haiku', 'Dístico heroico', 'Aliteración', 'Rima interna', 'Monorrimo', 'Rima', 'Sílaba', 'Estrofa', 'Gradación (retórica)', 'Lục bát', 'Jueju', 'Redondilla'],
  it: ['Distico', 'Quartina (metrica)', 'Terzina (metrica)', 'Anafora (figura retorica)', 'Epifora (figura retorica)', 'Acrostico', 'Haiku', 'Distico eroico', 'Allitterazione', 'Rima interna', 'Rimalmezzo', 'Monorima', 'Rima', 'Sillaba', 'Strofa', 'Climax (figura retorica)', 'Rima baciata', 'Rima alternata'],
  pt: ['Dístico', 'Quarteto (poesia)', 'Quadra (poesia)', 'Terceto', 'Anáfora', 'Epístrofe', 'Epífora', 'Acróstico', 'Haiku', 'Haicai', 'Aliteração', 'Rima interna', 'Monorrima', 'Rima', 'Sílaba', 'Estrofe', 'Gradação', 'Dístico heroico', 'Quadra'],
};

const UA = 'language-qa-script/1.0 (terminology lookup)';
async function api(params) {
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt >= 15) throw new Error(`${r.status} ${url}`);
    const wait = Math.min(120, Number(r.headers.get('retry-after') ?? 30) + 3);
    console.error(`429 from Wikidata; waiting ${wait}s`);
    await new Promise((res) => setTimeout(res, wait * 1000));
  }
}

const out = { fetched: new Date().toISOString(), source: 'https://www.wikidata.org/w/api.php (wbgetentities by site and title)', licence: 'CC0 1.0 (Wikidata)', languages: {} };
for (const [lang, titles] of Object.entries(TITLES)) {
  const j = await api({ action: 'wbgetentities', sites: `${lang}wiki`, titles: titles.join('|'), props: 'labels|descriptions|sitelinks', languages: 'en', sitefilter: `enwiki|${lang}wiki` });
  const found = {};
  for (const ent of Object.values(j.entities ?? {})) {
    const title = ent.sitelinks?.[`${lang}wiki`]?.title;
    if (title) found[title] = { qid: ent.id, en: ent.labels?.en?.value ?? null, description: ent.descriptions?.en?.value ?? null, enwiki: ent.sitelinks?.enwiki?.title ?? null };
  }
  out.languages[lang] = Object.fromEntries(titles.map((t) => [t, found[t] ?? 'missing']));
  await new Promise((res) => setTimeout(res, 2000));
}
writeFileSync(new URL('../../docs/language/sources/wikidata-titles.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [l, t] of Object.entries(out.languages)) console.log(l, Object.entries(t).map(([k, v]) => `${k}=${v === 'missing' ? '∅' : `${v.qid}:${v.en}`}`).join(' | '));
