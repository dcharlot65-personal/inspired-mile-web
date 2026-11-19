/**
 * The engine check's second round (2026-11-17) refused the merge with two blockers and a list of
 * concerns. Its Japanese probe (zz-e2-ja: 135 common loanwords and names, each alone on the first
 * line of a haiku whose other two lines are Japanese) is here as a test of the fixed behaviour, with
 * this pass's own words, the random katakana and keyboard mash that must stay out, and the
 * concerns' probes. Each block prints what it measured ("MEASURE ..."), recorded in
 * docs/language/RULES-MEASUREMENTS.md.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { carriesLines, createDuel, isCopy, resolveRound, rng, scoreVerse, type DuelDeck } from './duel';
import { getForm, scoreForm } from './forms';
import { rulesJudge } from './judge';
import { writeOpponentVerse, writtenCandidates } from './opponent';
import { PACK_LANGS, getPack, loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { allusionLexicon } from './referee';
import { loadSound } from './sound';
import { japaneseLexicon, japaneseListed, setJapaneseLexicon } from './sound/kana';
import { APART_WHOLE, LISTED_LONG, LISTED_LONG_MARKS, LISTED_WHOLE, LOANWORD_PART, copyOf, isContentWord, linesOf, substance, wordsOf } from './text';

const log = (k: string, v: unknown) => console.log(`MEASURE ${k} ${JSON.stringify(v)}`);

beforeAll(async () => {
  await loadAllPacks();
  await Promise.all(PACK_LANGS.map((l) => loadSound(l)));
  expect(await loadPronunciation()).toBe(true);
}, 300_000);

/** A line alone, then two lines of Japanese: the checker's frame. */
const haiku = (first: string) => `${first}\n夜の街を\n歩いてく`;
const counts = (v: string) => substance(v, 'ja').ok && !scoreForm(getForm('haiku'), v, { lang: 'ja' }).thin;

/** What the third check's 211 and the fourth pass's 155 leave void alone on a line (review5, engine check 3). */
const VOID3 = ['アデル', 'ルイアームストロング', 'レゴ', 'バービー', 'レディー・ガガ', 'スポティファイ', 'クラウトン', 'バチャータ', 'ズーク', 'ソカ', 'ブードゥー', 'エリカバドゥ', 'ウータンクラン', 'チャンスザラッパー', 'バスタライムス', 'ミッシーエリオット', 'ラキム', 'ケーアールエスワン'];
const VOID4 = ['ピクリズ', 'アキー', 'ハリエットタブマン', 'ニッキーミナージュ', 'ドクタードレー', 'アリシアキーズ', 'ジャクメル', 'カパイシャン', 'シタデル', 'ペチョンビル', 'ゴナイーヴ', 'ラーラ', 'コンパディレクト', 'ニュージャックスウィング', 'ファンドレイザー', 'フェイダウェイ', 'アリウープ'];
/** Kana written full size (text.ts fullKana): not a small kana or the long mark. */
const fullKana = (w: string) => [...w].filter((c) => !/[ァィゥェォッャュョヮヵヶー]/u.test(c)).length;

// --- Blocker 2: loanwords and names IPADIC lacks, alone on a line ---

describe('engine check 2, blocker 2: a loanword or a name a dictionary has counts alone on a line of a Japanese verse', () => {
  /** The checker's 135 (zz-e2-ja), in its order. 31 of them were void at 0346ee1. */
  const CHECKER = (
    'ユーチューブ インスタ インスタグラム ツイッター ティックトック ネットフリックス スマホ アイフォン パソコン ノートパソコン タブレット ワイファイ アプリ ダウンロード ' +
    'ログイン パスワード ハッシュタグ フォロワー インフルエンサー ユーチューバー コンビニ ファミレス マクドナルド スタバ スターバックス ハンバーガー フライドポテト ポテト ' +
    'コーラ ラーメン カップラーメン ギョーザ カレー カレーライス オムライス タピオカ アイスクリーム チーズケーキ ヒップホップ ラップ ラッパー フリースタイル サイファー ' +
    'パンチライン リリック ビート トラック マイク ステージ ライブ フェス ダンス ブレイクダンス スニーカー ジーンズ パーカー サングラス ネックレス タトゥー ' +
    'ニューヨーク ブルックリン ロサンゼルス トーキョー ジャマイカ ハイチ ブラジル ナイジェリア マイケル ジョン レノン ビヨンセ ドレイク エミネム ピカチュウ ' +
    'ゲーム ゲームセンター プレステ ポケモン アニメ マンガ コスプレ カラオケ バイト サラリーマン オフィス ミーティング プロジェクト タクシー バス エレベーター ' +
    'エスカレーター マンション アパート ホテル デパート スーパー ディズニーランド オリンピック ワールドカップ サッカー バスケ バスケットボール テニス ボクシング ' +
    'マラソン チャンピオン ヒーロー モンスター ゾンビ ドラゴン ロボット ロケット ブラックホール クリスマス ハロウィン バレンタイン サンキュー オーケー グッバイ ' +
    'ハロー ベイビー ダーリン ブラザー ママ パパ ボス ストリート マネー ダイヤモンド ゴールド ベンツ フェラーリ タイムズスクエア ジョン・レノン ワンツー'
  ).split(' ');
  /**
   * This pass's own, none on the checker's list, written before they were looked up: the net, food,
   * music, the street, sport, places and people of the diaspora, games, and plain loanwords.
   */
  const MINE = (
    'スナップチャット ディスコード スタンプ グループチャット ミュート スパム ハッカー パスキー クラウドファンディング クリエイター ストリーマー ゲーマー コメント リアクション ' +
    'バズ トレンド ハイライト サムネ サムネイル ガジェット ウェアラブル スマートスピーカー ノイズキャンセリング モバイル テザリング ストレージ ' +
    'ブリトー タコス ケバブ ファラフェル フムス ガパオ フォー バインミー トムヤムクン ナシゴレン ジャンバラヤ ガンボ コーンブレッド チキンウィング バーベキュー ホットソース ジャークチキン ' +
    'レゲエ ダンスホール アフロビート トラップ ゴスペル ファンク ディスコ テクノ ダブステップ アドリブ イントロ アウトロ リミックス マッシュアップ ボーカル ハーモニー ファルセット メロディー リズム ' +
    'スナップバック フーディー スウェット トラックスーツ チェーン ドレッド ブレイズ コーンロウ アフロ バンダナ ' +
    'スラムダンク ダンク リバウンド タッチダウン ノックアウト スパーリング ジャブ アッパーカット ' +
    'ポルトープランス クイーンズ ニューオーリンズ メンフィス ヒューストン オークランド ボストン フィラデルフィア キンシャサ アクラ ダカール ヨハネスブルグ アディスアベバ ' +
    'マイケルジョーダン レブロン コービー セリーナ ボブマーリー ジェームスブラウン アレサ ニーナシモン トゥパック ナズ スヌープドッグ アイスキューブ ケンドリックラマー トゥーサン デサリーヌ ' +
    'ワンピース ドラゴンクエスト ファイナルファンタジー マインクラフト フォートナイト スプラトゥーン カービィ ' +
    'ラッキー ハッピー ハッピーエンド ドリーマー ファイター レジェンド アイコン ミステリー ファンタジー ミラクル パラダイス フリーダム ジャスティス エナジー スピリット グルーヴ ' +
    'ブラザーフッド シスターフッド コミュニティ ブロックパーティー ' +
    'スマートフォンケース ワイヤレスイヤホン ポップアップ フードトラック カフェラテ チャイ ボバ ホットドッグ プレッツェル ベーグル ' +
    'ミックステープ ターンテーブル グラフィティ スプレー ブレイクビーツ ビートジャック クラブ ラウンジ ネオン シティポップ ' +
    'ミュージックビデオ プレイリスト ヘッドフォン スピーカー アンプ ジャムセッション ステージダイブ モッシュ アンコール ソールドアウト'
  ).split(' ');
  /**
   * The engine's third check (2026-11-18), its own 211, written before it looked any up: the home, food,
   * music, sport, places and people, brands and apps, and the music of the diaspora.
   */
  const CHECKER3 = (
    'テーブル ソファ カーテン ベッド シャワー キッチン リモコン ビデオ バイオリン ヴァイオリン トランペット ステーキ サラダ スープ クッキー キャンディ ヨーグルト バター チーズ ' +
    'ソーセージ ベーコン ジュース レモネード グミ マシュマロ チャット モニター プリンター バグ シュート ピッチャー バッター ヨガ ジム トレーニング ストレッチ スプリント ' +
    'ハーフタイム オーバータイム マイクロフォン スタジオ レコード シングル アルバム ミックス マスタリング ドロップ ビーフ ギャング ストリートアート マドリード モスクワ ' +
    'ジャカルタ ハノイ リオデジャネイロ ラスベガス ハリウッド ファルスタッフ モーツァルト ベートーヴェン ピカソ ゴッホ アインシュタイン ネルソンマンデラ テイラースウィフト ' +
    'アデル ブルーノマーズ ホイットニー スティービーワンダー マイケルジャクソン ルイアームストロング デュークエリントン ウータン ローリンヒル ナイキ アディダス グッチ ' +
    'シャネル レゴ バービー スーパーマン バットマン スパイダーマン アイアンマン ウルトラマン トトロ テトリス パックマン ボブ・ディラン レディー・ガガ ' +
    'マーティン・ルーサー・キング ヴィーナス ハイキング キャンプ バケーション パスポート スーツケース チケット ホテルマン レストラン ウェイター シェフ レシピ オーブン ' +
    'フライパン ナイフ フォーク スプーン ボトル カクテル ウイスキー ポケットモンスター ニンテンドースイッチ プレイステーション エックスボックス ゲームボーイ スマブラ ' +
    'マリオカート ストリートファイター ウーバー エアビーアンドビー マイクロソフト テスラ スポティファイ ペイペイ ラインペイ メルカリ ズームミーティング リール ヴァイブス ' +
    'フレックス クラウトン ブラックミュージック ネオソウル アールアンドビー パンク メタル カントリー ミュージカル サンバ ボサノバ サルサ メレンゲ バチャータ コンパ ズーク ' +
    'カリプソ ソカ ハイチアン クレオール ブードゥー ラム コーヒーショップ ストリートフード タコトラック アフロヘア ブレイド ロックス ウェーブ フェード スキンフェード ' +
    'ラインアップ ラグビー クリケット ゴルフ ボウリング ビリヤード ダーツ カーリング フェンシング ホーチミン メルボルン バンクーバー ケベック ダブリン エディンバラ ' +
    'リバプール アムステルダム ブリュッセル プラハ ワルシャワ ブダペスト テルアビブ カサブランカ エリカバドゥ ディアンジェロ アウトキャスト ウータンクラン ジェイコール ' +
    'チャンスザラッパー バスタライムス ミッシーエリオット ラキム ケーアールエスワン オルタナティブ ミニマル サイケデリック ノスタルジー ヴィンテージ レトロ アンティーク ' +
    'モダン クラシック バースデー アニバーサリー サプライズ ディナー ランチ ブランチ デート プロポーズ'
  ).split(' ');
  /**
   * The fourth pass's own, written before any was looked up and kept only where no earlier list, test
   * or document of the project had the word: the net, food (Haitian among it), music, sport, places,
   * Shakespeare's people and others, plain loanwords.
   */
  const MINE4 = (
    'ニュースレター ハンドルネーム バイラル ホットケーキ ミルクシェイク ラザニア グラタン コロッケ トンカツ オムレツ ハヤシライス ' +
    'プリン ゼリー キムチ ビビンバ プランテン グリオ ピクリズ アキー ループ バラード ソウルミュージック ジャズクラブ オーケストラ ' +
    'シンフォニー コンサート コラボ ハーフパイプ ストライカー ダブルダッチ パルクール キックボクシング キューバ トリニダード バルバドス ' +
    'セネガル エチオピア ケニア ガンジー マルコムエックス ハリエットタブマン ローザパークス ミシェル ジョーダン ウィルスミス ' +
    'ニッキーミナージュ ドクタードレー ファレル アリシアキーズ ジョンレジェンド エルヴィス ビートルズ クイーン ボウイ スピード ホープ ' +
    'ラブ ムーン スカイ レイン ストーム サンダー ファイヤー シャドウ ドア ゲート タワー タウン ビレッジ トンネル トレイン ' +
    'ステーション エアポート フライト ネイルサロン バーバーショップ ヘアカット ドライヤー ローション シャンプー タオル スリッパ ' +
    'パジャマ マットレス カーペット クッション ランプ キャンドル ガム ジャム メモ カナル ジャクメル カパイシャン ラバディ シタデル ' +
    'ペチョンビル ゴナイーヴ ラーラ コンパディレクト ラスタ ジャンカヌー スティールパン マルディグラ ジュークボックス ブギウギ ' +
    'ドゥーワップ モータウン フィラデルフィアソウル ニュージャックスウィング ボルチモア オーランド ナッシュビル フェニックス シアトル ' +
    'デンバー クリーブランド ミネアポリス ブルックリンブリッジ ゴールデンゲート オスカー ネットワーク セキュリティ アップロード ' +
    'ヘッドライン パンデミック ワクチン ソーシャルディスタンス ウェビナー インターン キャリア ポートフォリオ スタートアップ ベンチャー ' +
    'ピッチ マーケティング ブランディング ロゴ スローガン キャッチコピー フリーランス ボランティア チャリティ ファンドレイザー ' +
    'カフェテリア ジムバッグ ロッカールーム スコアボード タイムアウト オーバーヘッド クロスオーバー フェイダウェイ アリウープ ' +
    'ゴールポスト ハットトリック'
  ).split(' ');
  /**
   * Are all the words of this katakana in a dictionary the engine counts (whole: IPADIC's, or JMdict's
   * or JMnedict's of LISTED_WHOLE full-size kana or LISTED_LONG characters; a compound of two words of
   * IPADIC's or JMdict's of LOANWORD_PART or more; or each part between middle dots so)?
   */
  /** What each set leaves void alone on a line, as measured (the fourth pass, 2026-11-18): names written together, places and spellings no dictionary has, and the short words LISTED_WHOLE leaves out. */
  const VOID_ALONE: Record<string, string[]> = { checker3: VOID3, mine4: VOID4 };
  const inDictionary = (w: string) =>
    w.split('・').every((part) => {
      const whole = japaneseListed(part);
      if (whole === 'ipadic' || (whole && (fullKana(part) >= LISTED_WHOLE || (part.length >= LISTED_LONG && [...part].filter((c) => c === 'ー').length <= LISTED_LONG_MARKS)))) return true;
      for (let k = LOANWORD_PART; k + LOANWORD_PART <= part.length; k++) {
        const a = japaneseListed(part.slice(0, k));
        const b = japaneseListed(part.slice(k));
        if ((a === 'ipadic' || a === 'word') && (b === 'ipadic' || b === 'word')) return true;
      }
      return false;
    });

  it("the checker's 135: every one a dictionary has at the length counted counts alone on the line (31 were void at 0346ee1); with a particle, all do", () => {
    const rows = CHECKER.map((w) => ({ w, alone: counts(haiku(w)), particle: counts(haiku(`${w}の`)), listed: inDictionary(w) }));
    const voidAlone = rows.filter((r) => !r.alone).map((r) => r.w);
    log('engine check 2: the checker\'s 135 loanwords alone on a line (void, not in any dictionary)', { words: rows.length, voidAlone, notListed: rows.filter((r) => !r.listed).map((r) => r.w) });
    expect(rows.length).toBe(135);
    expect(rows.filter((r) => !r.particle).map((r) => r.w)).toEqual([]);
    // Void alone only when no dictionary has it at the length counted: トーキョー (IPADIC, JMdict and
    // JMnedict spell Tokyo 東京), and フェス (JMdict's, two full-size kana in three characters: the
    // engine's third check, text.ts LISTED_WHOLE).
    expect(rows.filter((r) => !r.alone && r.listed).map((r) => r.w)).toEqual([]);
    expect(voidAlone).toEqual(['フェス', 'トーキョー']);
  });

  it("this pass's own words, none on the checker's list: at least 90% count alone on the line, and each one that does not is in no dictionary", () => {
    expect(MINE.filter((w) => CHECKER.includes(w))).toEqual([]);
    const rows = MINE.map((w) => ({ w, alone: counts(haiku(w)), listed: inDictionary(w) }));
    const voidAlone = rows.filter((r) => !r.alone).map((r) => r.w);
    log("engine check 2: this pass's own loanwords alone on a line (words, void)", { words: rows.length, voidAlone });
    expect(rows.length).toBeGreaterThanOrEqual(150);
    expect(rows.filter((r) => !r.alone && r.listed).map((r) => r.w)).toEqual([]);
    expect(voidAlone.length / rows.length).toBeLessThanOrEqual(0.1);
  });

  it("the third check's 211 and the fourth pass's 155, none on an earlier list: each void alone is in no dictionary at the length counted, these and no others; with a particle all count", () => {
    const sets = { checker3: CHECKER3, mine4: MINE4 };
    expect([CHECKER3.length, MINE4.length]).toEqual([211, 155]);
    expect(MINE4.filter((w) => [...CHECKER, ...MINE, ...CHECKER3].includes(w))).toEqual([]);
    for (const [name, ws] of Object.entries(sets)) {
      const rows = ws.map((w) => ({ w, alone: counts(haiku(w)), middle: counts(`雨上がり\n${w}\n君を待つ`), particle: counts(haiku(`${w}の`)), listed: inDictionary(w) }));
      const voidAlone = rows.filter((r) => !r.alone).map((r) => r.w);
      log(`engine check 3: ${name}, loanwords alone on a line (words, void alone, of them listed at two characters)`, { words: rows.length, voidAlone, listedShort: voidAlone.filter((w) => japaneseListed(w)) });
      expect([name, rows.filter((r) => !r.alone && r.listed).map((r) => r.w)]).toEqual([name, []]);
      expect([name, rows.filter((r) => r.alone !== r.middle).map((r) => r.w)]).toEqual([name, []]);
      expect([name, rows.filter((r) => !r.particle).map((r) => r.w)]).toEqual([name, []]);
      expect([name, voidAlone]).toEqual([name, VOID_ALONE[name]]);
    }
  });

  it("the checker's three void haiku and the earlier pass's lacked ones count; one whose loanword no dictionary has does not", () => {
    const NOW = [
      'ユーチューブ\nフリースタイル\n朝までだ',
      'ニューヨーク\nタイムズスクエア\n雪の夜',
      'ジョン・レノン\nイマジンを聴く\n冬の駅',
      'マイクチェック\nワンツー ワンツー\n俺の番だ',
      'グッドナイト\nスイートドリーム\nまた明日',
      'フライドポテト\nケチャップ マヨネーズ\n腹ぺこだ',
      'メリーゴーランド\nワンダーランド\n子供の夢',
      'インスタに\nアップしたけど\nいいねゼロ',
      'ビートメイカー\nミックステープ\n夜明け前',
    ];
    const rows = NOW.map((v) => ({ v: v.replace(/\n/g, ' / '), ok: counts(v), known: +substance(v, 'ja').known.toFixed(3) }));
    log('engine check 2: haiku with loanwords IPADIC lacks (verse, counts, known)', rows.map((r) => [r.v, r.ok, r.known]));
    for (const r of rows) expect([r.v, r.ok, r.known >= 0.7]).toEqual([r.v, true, true]);
    expect(counts('トーキョー\nネオンサイン\n眠らない')).toBe(false);
  });

  it('a verse of loanword lines alone, with no line of Japanese, is still not read as Japanese', () => {
    for (const v of ['ユーチューブ\nインスタグラム\nティックトック', 'スマホ アプリ\nワイファイ\nフォロワー インフルエンサー']) expect([v, substance(v, 'ja').ok]).toEqual([v, false]);
  });
});

describe('engine check 2, blocker 2: random katakana and keyboard mash alone on a line stay out', () => {
  const KATA = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ'];
  const FULL = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ'];
  const SMALL = [...'ャュョァィゥェォッ'];
  /** KATA-ONE's three alphabets (review4.test.ts). */
  function random(kind: string, r: () => number): string {
    let x = '';
    const n = 4 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      if (kind === 'full') {
        x += FULL[Math.floor(r() * FULL.length)];
        const t = r();
        if (t < 0.15) x += SMALL[Math.floor(r() * SMALL.length)];
        else if (t < 0.35) x += 'ー';
      } else x += KATA[Math.floor(r() * KATA.length)] + (kind === 'long' && r() < 0.3 ? 'ー' : '');
    }
    return x;
  }
  /**
   * The rows of the Japanese kana keyboard (JIS), typed in katakana: what a hand run across four keys
   * or more of a row writes, either way. (Runs of three are often names: クマノ, ロメル, モネル; the
   * lists add 5 of those 92 to the 13 the analyser's own words already let count.)
   */
  const KANA_ROWS = ['ヌフアウエオヤユヨワホ', 'タテイスカンナニラセ', 'チトシハキクマノリレケム', 'ツサソヒコミモネルメロ'];

  it('random katakana in three alphabets (20,000 lines each) and runs of four keys or more along the kana keyboard: the dictionaries add at most 1 in 1,000 to what counted before', () => {
    const r = rng(20261118);
    const lines: Record<string, string[]> = { basic: [], long: [], full: [], mash: [] };
    for (const kind of ['basic', 'long', 'full']) for (let i = 0; i < 20_000; i++) lines[kind].push(random(kind, r));
    for (const keys of KANA_ROWS)
      for (let a = 0; a < keys.length; a++)
        for (let b = a + 4; b <= keys.length; b++) lines.mash.push(keys.slice(a, b), [...keys.slice(a, b)].reverse().join(''));
    // Before: the analyser's own words only, as at 0346ee1 (the lists taken away; the rule is otherwise the same).
    const listed = japaneseLexicon();
    const before = Object.fromEntries(Object.entries(lines).map(([k, ls]) => [k, ls.map((x) => counts(haiku(x)))]));
    setJapaneseLexicon(null);
    let without: Record<string, boolean[]>;
    try {
      without = Object.fromEntries(Object.entries(lines).map(([k, ls]) => [k, ls.map((x) => counts(haiku(x)))]));
    } finally {
      setJapaneseLexicon(listed);
    }
    const rows = Object.fromEntries(
      Object.entries(lines).map(([k, ls]) => {
        const added = ls.filter((_, i) => before[k][i] && !without[k][i]);
        return [k, { lines: ls.length, counted: before[k].filter(Boolean).length, withoutLists: without[k].filter(Boolean).length, added: added.length, addedExamples: [...new Set(added)].slice(0, 15) }];
      }),
    );
    log('engine check 2: random katakana and kana-keyboard runs alone on a line (lines, counted now, counted without the lists, added by them)', rows);
    for (const [kind, row] of Object.entries(rows)) expect([kind, row.added / row.lines <= 0.001, row.counted >= row.withoutLists]).toEqual([kind, true, true]);
  }, 600_000);
});

// --- The engine's third check: short random katakana ---

/**
 * The readings with the lists taken away and IPADIC kept, whole runs included: what the analyser's own
 * dictionary lets count, so a difference is the lists' alone. (Taking the lexicon away altogether also
 * drops IPADIC's whole runs; that reading is 0346ee1's, to the line, in the third check's probe.)
 */
function ipadicOnly<T>(f: () => T): T {
  const all = japaneseLexicon();
  setJapaneseLexicon(all && ((w) => (all(w) === 'ipadic' ? 'ipadic' : null)));
  try {
    return f();
  } finally {
    setJapaneseLexicon(all);
  }
}

describe('engine check 3, blocker: a word or a name of the lists counts whole only at LISTED_WHOLE full-size kana or LISTED_LONG characters, so short random katakana stays out', () => {
  const PLAIN = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ'];
  /** The third check's alphabet for random runs: the plain kana with ン and ヴ, a small kana or a long mark after some. */
  const KANA = [...PLAIN, 'ン', 'ヴ'];
  const SMALL = [...'ャュョァィゥェォッ'];
  function run(r: () => number, n: number, marked: boolean): string {
    let x = '';
    for (let k = 0; k < n; k++) {
      x += KANA[Math.floor(r() * KANA.length)];
      if (marked) {
        const t = r();
        if (t < 0.12) x += SMALL[Math.floor(r() * SMALL.length)];
        else if (t < 0.3) x += 'ー';
      }
    }
    return x;
  }
  /** Shapes of a line of random runs, spaces between: the third check's and the fourth pass's. */
  const SHAPES: Record<string, (r: () => number) => string> = {
    two: (r) => run(r, 2, false),
    twoMarked: (r) => run(r, 2, true),
    twoOrThree: (r) => run(r, 2 + Math.floor(r() * 2), false),
    twoOrThreeMarked: (r) => run(r, 2 + Math.floor(r() * 2), true),
    four: (r) => run(r, 4, false),
  };

  it('every pair of the 69 plain katakana alone on a line: the lists add none (at b082b33b they added 1,039: 426 words and 613 names)', () => {
    const pairs = PLAIN.flatMap((a) => PLAIN.map((b) => a + b));
    const now = pairs.filter((x) => counts(haiku(x)));
    const before = ipadicOnly(() => pairs.filter((x) => counts(haiku(x))));
    log('engine check 3: pairs of plain katakana alone on a line (pairs, count now, with IPADIC alone)', [pairs.length, now.length, before.length]);
    expect(pairs.length).toBe(4761);
    expect(now).toEqual(before);
  });

  it('random katakana alone on a line: the lists add none at two kana, few with a mark, and at three what is recorded', () => {
    const r = rng(20261119);
    const sets: Record<string, string[]> = { two: [], twoMarked: [], three: [], threeMarked: [] };
    for (let i = 0; i < 6000; i++) sets.two.push(run(r, 2, false));
    for (let i = 0; i < 6000; i++) sets.twoMarked.push(run(r, 2, true));
    for (let i = 0; i < 8000; i++) sets.three.push(run(r, 3, false));
    for (let i = 0; i < 8000; i++) sets.threeMarked.push(run(r, 3, true));
    const rows = Object.fromEntries(
      Object.entries(sets).map(([k, xs]) => {
        const lines = [...new Set(xs)];
        const now = lines.filter((x) => counts(haiku(x)));
        const before = new Set(ipadicOnly(() => lines.filter((x) => counts(haiku(x)))));
        const added = now.filter((x) => !before.has(x));
        return [k, { lines: lines.length, counted: now.length, withIpadicAlone: before.size, added: added.length, addedExamples: added.slice(0, 12) }];
      }),
    );
    log('engine check 3: random katakana alone on a line (lines, counted, with IPADIC alone, added by the lists)', rows);
    expect(rows.two.added).toBe(0);
    // Measured at this rule (the fourth pass's probe, the third check's seed): 21 of 5,123 marked pairs,
    // 144 of 7,907 threes (イトコ, ラノベ, ミノリ: words and names, by chance), 65 of 7,986 marked threes.
    // At b082b33b the marked pairs were 713 of 5,123; counting characters alone (no full-size kana), 237.
    for (const [k, bound] of [['twoMarked', 0.008], ['three', 0.025], ['threeMarked', 0.012]] as const) expect([k, rows[k].added / rows[k].lines <= bound]).toEqual([k, true]);
  }, 600_000);

  it('mash at the scale of a verse: tercets of one to four random runs a line around one line of Japanese: the lists let at most 1 in 200 more count', () => {
    const rows: Record<string, { verses: number; counted: number; withIpadicAlone: number }> = {};
    const ok = (v: string) => substance(v, 'ja').ok && !scoreForm(getForm('tercet'), v, { lang: 'ja' }).thin;
    for (const [shape, gen] of Object.entries(SHAPES))
      for (const k of [1, 2, 3, 4]) {
        const r = rng(99173 + k * 17 + shape.length);
        const verses = Array.from({ length: 1500 }, () => {
          const line = () => Array.from({ length: k }, () => gen(r)).join(' ');
          return `${line()}\n君を待つ夜\n${line()}`;
        });
        rows[`${shape} x${k}`] = { verses: verses.length, counted: verses.filter(ok).length, withIpadicAlone: ipadicOnly(() => verses.filter(ok).length) };
      }
    log('engine check 3: mash tercets around one line of Japanese (verses, counted, with IPADIC alone)', rows);
    for (const [k, row] of Object.entries(rows)) expect([k, (row.counted - row.withIpadicAlone) / row.verses <= 0.005]).toEqual([k, true]);
  }, 600_000);

  it('a duel: one real line and random runs for the rest, the best of 60 tries by craft, 14 houses x 10 seeds: the lists win at most one round more than the analyser alone, in every shape', async () => {
    const lines: Record<string, (r: () => number) => string> = {
      two: (r) => Array.from({ length: 2 + Math.floor(r() * 3) }, () => run(r, 2, false)).join(' '),
      twoMarked: (r) => Array.from({ length: 2 + Math.floor(r() * 2) }, () => run(r, 2, true)).join(' '),
      twoOrThree: (r) => Array.from({ length: 2 + Math.floor(r() * 2) }, () => run(r, 2 + Math.floor(r() * 2), false)).join(' '),
      twoOrThreeMarked: (r) => Array.from({ length: 2 + Math.floor(r() * 2) }, () => run(r, 2 + Math.floor(r() * 2), true)).join(' '),
      four: (r) => Array.from({ length: 1 + Math.floor(r() * 3) }, () => run(r, 4, false)).join(' '),
    };
    const HOUSES = [...new Set(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.house))];
    const chars = CARD_CATALOG.filter((c) => c.type === 'Character');
    const rows: Record<string, { rounds: number; wins: number; voided: number }> = {};
    for (const house of HOUSES) {
      const deck: DuelDeck = { characters: [...chars.filter((c) => c.house === house), ...chars.filter((c) => c.house !== house)].slice(0, 3).map((c) => c.id), relics: [], potions: [] };
      const card = getCardById(deck.characters[0])!;
      for (let seed = 1; seed <= 10; seed++) {
        const d = createDuel(seed, 'ja', deck);
        const plan = d.rounds[0];
        const form = getForm(plan.formId);
        const opp = (await writeOpponentVerse({ duel: d, roundIndex: 0, difficulty: 'player' })).verse;
        const real = linesOf(writtenCandidates(form, plan.ctx, seed * 31).find((v) => v !== opp)!);
        for (const [shape, gen] of Object.entries(lines))
          for (const [reading, cut] of [['lists', false], ['ipadic', true]] as const) {
            const r = rng(seed * 7001 + house.length * 13 + shape.length);
            const play = () => {
              let best = '';
              let bestCraft = -1;
              for (let t = 0; t < 60; t++) {
                const v = real.map((l, i) => (i === 0 ? l : gen(r))).join('\n');
                const sc = scoreVerse({ verse: v, form, ctx: plan.ctx, card, deckCharacters: deck.characters, opponentVerse: opp });
                if (sc.craft > bestCraft) [best, bestCraft] = [v, sc.craft];
              }
              return resolveRound(d, 0, { charId: deck.characters[0] }, best, opp, rulesJudge(best, opp, 'ja', allusionLexicon()));
            };
            const res = cut ? ipadicOnly(play) : play();
            const row = (rows[`${shape} ${reading}`] ??= { rounds: 0, wins: 0, voided: 0 });
            row.rounds++;
            if (res.winner === 'player') row.wins++;
            if (res.player.voided) row.voided++;
          }
      }
    }
    log('engine check 3: best of 60 with random runs (shape and reading: rounds, wins, void)', rows);
    for (const shape of Object.keys(lines)) expect([shape, rows[`${shape} lists`].wins <= rows[`${shape} ipadic`].wins + 1]).toEqual([shape, true]);
  }, 900_000);
});

describe('engine check 4, blocker: two kana each held long (XーYー) stay out; a word of the lists counts from LISTED_LONG characters only with at most LISTED_LONG_MARKS long marks', () => {
  const PLAIN = [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ'];
  const held = PLAIN.flatMap((a) => PLAIN.map((b) => `${a}ー${b}ー`));

  it('all 4,761 alone on a line: the lists add at most 1 in 200 (at 955172d8 they added 435: アーミー, リービー, ゴーラー)', () => {
    const now = held.filter((x) => counts(haiku(x)));
    const before = new Set(ipadicOnly(() => held.filter((x) => counts(haiku(x)))));
    const added = now.filter((x) => !before.has(x));
    log('engine check 4: XーYー alone on a line (lines, counted, with IPADIC alone, added by the lists)', [held.length, now.length, before.size, added.length, added.slice(0, 12)]);
    expect(held.length).toBe(4761);
    expect(added.length / held.length).toBeLessThanOrEqual(0.005);
  }, 600_000);

  it('tercets of one XーYー run a line around one line of Japanese: the lists let at most 1 in 200 more count (at 955172d8, 62 against 20 of 2,000)', () => {
    const ok = (v: string) => substance(v, 'ja').ok && !scoreForm(getForm('tercet'), v, { lang: 'ja' }).thin;
    const r = rng(4442);
    const pick = () => held[Math.floor(r() * held.length)];
    const verses = Array.from({ length: 2000 }, () => `${pick()}\n君を待つ夜\n${pick()}`);
    const counted = verses.filter(ok).length;
    const alone = ipadicOnly(() => verses.filter(ok).length);
    log('engine check 4: XーYー tercets (verses, counted, with IPADIC alone)', [verses.length, counted, alone]);
    expect((counted - alone) / verses.length).toBeLessThanOrEqual(0.005);
  }, 600_000);

  it('the cost, alone on a line: words of two full-size kana and two long marks no longer count by themselves (with a particle they do); one long mark still counts', () => {
    const LOST = ['ゲーマー', 'コービー', 'バービー', 'フーディー', 'ブードゥー', 'ルーター'];
    const KEPT = ['ラッパー', 'タトゥー', 'ウェーブ', 'ユーチューブ', 'ワンツー'];
    log('engine check 4: the cost (word, alone, with a particle)', [...LOST, ...KEPT].map((w) => [w, counts(haiku(w)), counts(haiku(`${w}の`))]));
    for (const w of LOST) expect([w, counts(haiku(w)), counts(haiku(`${w}の`))]).toEqual([w, false, true]);
    for (const w of KEPT) expect([w, counts(haiku(w))]).toEqual([w, true]);
    expect(LISTED_LONG_MARKS).toBe(1);
  });
});

describe('engine check 3, concern: a word a dictionary has, written apart, counts beside one no dictionary has, from APART_WHOLE full-size kana', () => {
  it('two katakana words on a line, one no dictionary has: the long listed word counts, a short one does not', () => {
    const line = (l: string) => counts(haiku(l));
    // Counted now (void at b082b33b and at 0346ee1): the listed word has APART_WHOLE full-size kana or more.
    const NOW = ['プレイリスト スポティファイ', 'ビギー スモールズ', 'マイルスデイビス トランペット', 'ソカ カーニバル'];
    // Still void: the listed word is shorter (ジャズ, ハロー: three full-size kana; a random run of three is a
    // dictionary's word about one time in forty).
    const STILL = ['ルイアームストロング ジャズ', 'アデル ハロー', 'ネオン ズーク', 'ラキム フロー', 'ピクリズ キムチ'];
    log('engine check 3: two katakana words, one no dictionary has (line, counts)', [...NOW, ...STILL].map((l) => [l, line(l)]));
    /** The most full-size kana of a word on the line that a dictionary has whole. */
    const longest = (l: string) => Math.max(0, ...l.split(' ').filter((w) => japaneseListed(w)).map(fullKana));
    for (const l of NOW) expect([l, line(l), longest(l) >= APART_WHOLE]).toEqual([l, true, true]);
    for (const l of STILL) expect([l, line(l), longest(l) > 0 && longest(l) < APART_WHOLE]).toEqual([l, false, true]);
    // Both listed, as before: two loanwords count.
    for (const l of ['スマホ アプリ', 'インスタ ストーリー']) expect([l, line(l)]).toEqual([l, true]);
    // In a verse with no line of Japanese the rule does not apply.
    expect(substance('プレイリスト スポティファイ\nビギー スモールズ\nソカ カーニバル', 'ja').ok).toBe(false);
  });
});

// --- Concern: frame flips the every-line copy rule voided ---

describe('engine check 2, concern: a flip that keeps only the little words of a line is not a copy of it', () => {
  /** The checker's (zz-e2-honest), verbatim: honest verse in sixteen languages [lang, form, verse]. */
  const HONEST: Array<[string, string, string]> = [
    ['en', 'couplet', 'The subway hums a lullaby of steel\nI ride it home and write the things I feel'],
    ['en', 'couplet', 'My mother braided stories in my hair\nShe said the world is yours if you go there'],
    ['en', 'couplet', 'Nnamdi, Chidinma, Ifeoma and Obinna\nWe ate the jollof rice and laughed till after dinner'],
    ['en', 'couplet', 'Sak pase, manman, the kettle is on\nWe sing in Kreyòl from the dusk to the dawn'],
    ['en', 'couplet', 'Mm-hmm, uh-huh, my auntie said with pride\nTsk tsk, she told the boy who lied'],
    ['en', 'couplet', 'Sheesh, bruh, your drip is looking weak\nI yeet your bars into the creek'],
    ["en", 'couplet', "Ayo, DeShawn and Ja'Marr hit the court\nLaKeisha calls the game and keeps it short"],
    ['en', 'couplet', 'Shhh, the baby sleeps, the night is long\nHmmm, I hum to her an old Haitian song'],
    ['en', 'couplet', 'Brrr, the winter bites on Flatbush Avenue\nI keep my hands in pockets, what else can I do'],
    ['en', 'couplet', 'Psst, come closer, let me tell you something true\nThe crown was never made for one like you'],
    ['en', 'couplet', 'Toussaint, Dessalines, Christophe, Pétion\nCapois-La-Mort, Sanite Bélair, Défilée, Dérance'],
    ['en', 'couplet', 'Ngozi Okonjo-Iweala, Wangari Maathai\nChimamanda Adichie, reaching for the sky'],
    ['en', 'couplet', 'bell hooks and audre lorde taught me how to read\nand june jordan gave me every word I need'],
    ['en', 'couplet', "YO, I RUN THIS CITY, CAN'T NOBODY TELL ME NO\nFROM FLATBUSH TO CANARSIE, EVERYBODY KNOW"],
    ['en', 'couplet', 'Grrr goes the engine, vroom goes the car\nZoom down the highway, we are going far'],
    ['en', 'couplet', 'Kwabena, Kofi, Akosua, Ama\nDance at the wedding with their grandmama'],
    ['en', 'couplet', 'Ugh, your bars are stale, they make me sigh\nMeh, I yawn and wave the stage goodbye'],
    ['en', 'couplet', 'Xiomara, Yesenia, Marisol and Inés\nWe danced the bachata in our Sunday dress'],
    ['en', 'couplet', 'Ooooh, the crowd goes wild when I take the stage\nAaaah, you shrink and wither in your cage'],
    ['en', 'couplet', 'Llewellyn walked the hills of Pwllheli\nAnd Gwynedd sang beneath a sky so hazy'],
    ['en', 'haiku', 'Brooklyn rooftop, dusk\nPigeons circle the water tower\nMy grandmother waves'],
    ['es', 'couplet', 'La luna sale sobre el malecón\nY canta el mar su vieja canción'],
    ['es', 'couplet', 'Mi madre dice que la vida es dura\nPero en mi verso pongo la ternura'],
    ['fr', 'couplet', 'Le métro gronde sous la ville endormie\nJe compte mes rêves comme on compte un ami'],
    ['fr', 'couplet', 'Ma mère tressait des contes dans mes cheveux\nElle disait que le monde est à ceux qui veulent mieux'],
    ['de', 'couplet', 'Die U-Bahn summt ein Lied aus kaltem Stahl\nIch fahre heim und schreibe noch einmal'],
    ['de', 'couplet', 'Der Winter klopft mit Frost an meine Tür\nDoch in mir brennt ein Feuer, das ich spür'],
    ['it', 'couplet', 'La metro canta sotto la città\nE io la ascolto con tranquillità'],
    ['it', 'couplet', 'Mia madre intreccia storie nei capelli\nE dice che i sogni sono sempre i più belli'],
    ['pt', 'couplet', 'O metrô canta embaixo da cidade\nE eu escrevo versos com saudade'],
    ['pt', 'couplet', 'Minha mãe trançava histórias no cabelo\nE me dizia que o mundo era tão belo'],
    ['pl', 'couplet', 'Tramwaj śpiewa nocą pod oknami\nPiszę wiersze z moimi marzeniami'],
    ['pl', 'couplet', 'Mama plotła bajki w moje włosy\nMówiła, że świat zmienią nasze głosy'],
    ['ru', 'couplet', 'Метро гудит под городом ночным\nЯ еду домой, и рифмы вслед за ним'],
    ['ru', 'couplet', 'Мама плела мне сказки в волосах\nИ мир казался ярким в её глазах'],
    ['ar', 'couplet', 'القطار يغني تحت المدينة\nوأنا أكتب شعري بسكينة'],
    ['ar', 'couplet', 'أمي تجدل الحكايات في شعري\nوتقول إن الحلم يسكن صدري'],
    ['hi', 'couplet', 'मेट्रो गाती है शहर के नीचे\nमैं लिखता हूँ सपने आँखें मींचे'],
    ['hi', 'couplet', 'माँ ने मेरे बालों में कहानियाँ गूँथीं\nउसकी बातें हर दिन मुझमें फूलीं'],
    ['zh', 'couplet', '地铁在城市下面歌唱\n我把梦想写在车窗上'],
    ['zh', 'couplet', '妈妈把故事编进我头发\n她说世界属于每个家'],
    ['zh', 'couplet', '我在布鲁克林写我的歌\n每个字都像一团火'],
    ['zh', 'couplet', '我听 Beyoncé 唱到天亮\n妈妈在厨房里煮汤'],
    ['ja', 'haiku', '地下鉄の\n歌を聞きつつ\n夢を書く'],
    ['ja', 'haiku', '母の手が\n髪に物語\n編んでいた'],
    ['ja', 'haiku', 'スマホ見て\n既読スルーの\n夜が来る'],
    ['ja', 'haiku', 'カラオケで\nラップバトルだ\n負けないぜ'],
    ['ja', 'haiku', 'ラーメンと\nギョーザとビール\n金曜日'],
    ['ja', 'haiku', 'インスタに\nアップした夢\nいいねゼロ'],
    ['ja', 'haiku', 'トーキョーの\n夜はネオンで\n眠れない'],
    ['ja', 'haiku', 'ユーチューブ\nフリースタイル\n朝までだ'],
    ['ja', 'haiku', 'ハンバーガー\nポテトとコーラ\n夏の午後'],
    ['ja', 'haiku', 'ニューヨーク\nタイムズスクエア\n雪の夜'],
    ['ja', 'haiku', 'ジョン・レノン\nイマジンを聴く\n冬の駅'],
    ['ja', 'haiku', 'パンチライン\nサイファーの輪で\n光る夜'],
    ['ja', 'haiku', 'エアコンが\nこわれた部屋で\nセミの声'],
    ['ja', 'haiku', 'ゲームセンター\nコインの音だけ\n響く夜'],
    ['ja', 'haiku', 'チョコレート\nバレンタインデー\n胸さわぐ'],
    ['ja', 'haiku', 'サンドイッチ\nピクニックシート\n春の風'],
    ['ja', 'haiku', 'あめのあさ\nまちがめをさます\nおれのこえ'],
    ['ko', 'couplet', '지하철이 도시 아래서 노래하네\n나는 창문에 꿈을 그려 놓네'],
    ['ko', 'couplet', '엄마는 내 머리에 이야기를 땋았지\n세상은 네 거라고 늘 말했지'],
    ['vi', 'couplet', 'Tàu điện ngầm hát dưới phố đêm\nTôi viết giấc mơ bên cửa thềm'],
    ['vi', 'couplet', 'Mẹ kể chuyện xưa bên bếp lửa hồng\nCon nghe mà thấy ấm cả trong lòng'],
    ['th', 'couplet', 'รถไฟใต้ดินร้องเพลงใต้เมือง\nฉันเขียนฝันไว้ไม่มีวันเปลือง'],
    ['th', 'couplet', 'แม่ถักนิทานไว้ในผมของฉัน\nบอกว่าโลกนี้เป็นของเราทุกวัน'],
    ['id', 'couplet', 'Kereta bernyanyi di bawah kota\nAku menulis mimpi tanpa kata'],
    ['id', 'couplet', 'Ibu mengepang kisah di rambutku\nKatanya dunia ini milikmu dan milikku'],
  ];

    /** Frame flips: each line of a pack verse answered in its own frame, its meaning-bearing words changed. [lang, form, index, verse] */
  const FLIPS: Array<[string, string, number, string]> = [
    ['en', 'haiku', 0, 'My verse falls like hail\nEveryone runs to hide from it\nThe wind fears it all'],
    ['en', 'haiku', 0, 'My verse falls like stones\nNo one dares to gather them\nThe wind ducks them all'],
    ['en', 'haiku', 1, 'A loud voice, close by\nYou turn your head to flee it\nIt was my bars, friend'],
    ['en', 'crescendo', 0, 'I am tall\nMy verse is taller still\nAnd thou hast never crushed a thing but crumbs upon thy breakfast plate'],
    ['en', 'crescendo', 1, 'Hear me\nThe stage was never thine\nAnd every word that leaves my mouth is one more brick upon thy tomb tonight'],
    ['en', 'couplet', 0, 'Thy candles? I have lit them with my fire\nThy sun has set, and I am climbing higher'],
    ['en', 'tercet', 0, 'I have a tongue, thou grantest, and the art\nIt marches like a soldier through the dark\nAnd always finds its way to every heart'],
    ['fr', 'haiku', 0, 'Mes vers sont des pierres\nNul ne se penche sans peur\nLe vent les redoute'],
    ['fr', 'haiku', 0, 'Mes vers sont des pierres\nTous se penchent pour les prendre\nLe vent les respecte'],
    ['fr', 'couplet', 0, 'Mes rimes sont des flammes qui dévorent ta nuit\nTon soleil est couché, et c’est toi qui fuis'],
    ['fr', 'crescendo', 0, 'Je suis grand\nMon vers l’est plus encore\nEt toi tu n’as jamais rien écrasé que les miettes de ton petit déjeuner'],
    ['es', 'haiku', 0, 'Mi verso truena\nComo las piedras duras\nEl viento calla'],
    ['es', 'couplet', 0, 'Mis versos son la hoguera que no se apaga\nY tu cirio, compadre, ni la sombra halaga'],
    ['es', 'crescendo', 0, 'Soy gran cosa\nMi verso es más todavía\nY tú no has aplastado nada en tu vida más que migas en el desayuno'],
    ['it', 'haiku', 0, 'Il verso tuona\nCome le pietre dure\nIl vento tace'],
    ['it', 'couplet', 0, 'Le mie rime son fuochi nella sera\nE le tue candele son cera nera'],
    ['it', 'crescendo', 0, 'Sono grande\nIl mio verso lo è di più\nE tu non hai schiacciato altro che briciole della tua colazione'],
    ['de', 'haiku', 0, 'Mein Vers fällt wie Stein\nJeder duckt sich schnell davor\nDer Wind hält still an'],
    ['de', 'couplet', 0, 'Mein Reim ist Feuer, hell in deiner Nacht\nDeine Kerze hab ich längst ausgemacht'],
    ['de', 'crescendo', 0, 'Ich bin groß\nMein Vers ist noch größer\nUnd du hast vor dem Frühstück nie etwas anderes zermalmt als Krümel'],
    ['pt', 'couplet', 0, 'Meus versos são a chama que não cessa\nE a tua vela, irmão, apaga depressa'],
  ];

    /** Copies made by hand: synonyms, moved words, a rhyme swapped. [lang, form, index, copy, how] */
  const HAND: Array<[string, string, number, string, string]> = [
    ['en', 'couplet', 0, 'Your verses are like candles flickering at night\nThe sun is mine, and you have lost your sight', 'synonyms, "Mine is the sun" turned round, light->sight'],
    ['en', 'couplet', 1, 'Get up, poor player, strut your little minute\nThen watch your verses wither with no spirit in it', 'hour->minute, flower line rewritten end'],
    ['en', 'haiku', 0, 'Your poem drops like leaves\nNobody bends to pick them up\nThe breeze takes them all', 'synonyms'],
    ['en', 'tercet', 0, 'You have a tongue, I’ll grant, but not the craft\nIt stumbles like a drunkard in the dark\nAnd never once arrives where people laughed', 'synonyms, rhyme swap a'],
    ['en', 'crescendo', 0, 'You are small\nYour verse is smaller yet\nAnd I have crushed much bigger things than you before my morning coffee', 'register, synonyms, end'],
    ['fr', 'couplet', 0, 'Tes vers sont des bougies au fond de la nuit\nLe soleil, c’est moi, et toi, tu t’enfuis', 'synonyms, turned round'],
    ['fr', 'haiku', 0, 'Tes rimes sont des feuilles\nPersonne ne se baisse pour elles\nLe vent les emmène', 'synonyms'],
    ['fr', 'tercet', 0, 'Tu as une langue, d’accord, mais pas de talent\nElle titube comme un soûlard dans le noir\nEt n’arrive jamais, jamais au bon moment', 'synonyms, rhyme swap a'],
    ['it', 'couplet', 0, 'I tuoi versi son lumini nella sera\nIl mio è il sole, e la tua luce è nera', 'synonyms, rhyme swap'],
    ['it', 'haiku', 0, 'La rima cade\nCome foglie appassite\nIl vento sghignazza', 'synonyms'],
    ['it', 'tercet', 0, 'Hai una lingua, lo riconosco, ma non il mestiere\nErra come un ubriaco nel buio\nE non giunge mai a nessun quartiere', 'synonyms, rhyme swap a'],
    ['es', 'couplet', 0, 'Tus rimas son una vela que se apaga\nLas mías, el fuego que te traga', 'synonyms, rhyme swap'],
    ['es', 'haiku', 0, 'Tu rima cae\nComo hojas marchitas\nEl aire se ríe', 'synonyms'],
    ['es', 'tercet', 0, 'Tienes lengua, lo acepto, pero no el talento\nCamina como un borracho por lo oscuro\nY nunca llega a ningún momento', 'synonyms, rhyme swap a'],
    ['de', 'couplet', 0, 'Dein Vers ist nur ein Licht in dunkler Zeit\nMeiner die Sonne, die dich blendet weit und breit', 'synonyms, rhyme swap'],
    ['de', 'haiku', 0, 'Dein Reim fällt wie Laub\nKeiner bückt sich je danach\nDer Sturm trägt es fort', 'synonyms'],
    ['de', 'tercet', 0, 'Du hast ’ne Zunge, schön, doch keine Kunst\nSie wankt wie ein Betrunkener durchs Dunkel\nUnd trifft nie auf ein Herz, nur grauen Dunst', 'synonyms, ends kept'],
    ['pt', 'couplet', 0, 'Teus versos são uma vela que se apaga\nOs meus, o fogo que te traga', 'synonyms, rhyme swap'],
  ];

  const HOUSES = [...new Set(CARD_CATALOG.filter((c) => c.type === 'Character').map((c) => c.house))];
  function houseDeck(house: string): DuelDeck {
    const chars = CARD_CATALOG.filter((c) => c.type === 'Character');
    const mine = chars.filter((c) => c.house === house).map((c) => c.id);
    const rest = chars.filter((c) => c.house !== house).map((c) => c.id);
    return { characters: [...mine, ...rest].slice(0, 3), relics: [], potions: [] };
  }
  /** The first round of the first seed whose duel asks for the form, played by the rules. */
  function play(lang: string, formId: string, verse: string, opp: string) {
    for (let seed = 1; seed < 400; seed++) {
      const deck = houseDeck(HOUSES[seed % HOUSES.length]);
      const d = createDuel(seed, lang, deck);
      const round = d.rounds.findIndex((r) => r.formId === formId);
      if (round < 0) continue;
      const res = resolveRound(d, round, { charId: deck.characters[round] }, verse, opp, rulesJudge(verse, opp, lang, allusionLexicon()));
      return { voided: res.player.voided ?? null, total: `${res.playerTotal}-${res.opponentTotal}`, winner: res.winner };
    }
    return null;
  }
  /** The line rule as it was at 0346ee1: every line taken to carry a content word. */
  const before = (verse: string, source: string, lang: string) => carriesLines({ ...copyOf(verse, source, lang), carry: copyOf(verse, source, lang).carry.map((l) => ({ ...l, contentSaid: l.content })) });

  it("the checker's 21 flips: the English one that keeps two lines nearly whole is a copy, as at d56f5c8; so is the French haiku, which keeps what a copy with each line's last word swapped and the persons flipped keeps", () => {
    const rows = FLIPS.map(([lang, form, k, v]) => {
      const opp = getPack(lang).written[form][k];
      return { key: `${lang} ${form}[${k}]`, v: v.split('\n')[0], copy: isCopy(v, opp, lang), lineRuleBefore: before(v, opp, lang), round: play(lang, form, v, opp) };
    });
    log('engine check 2: frame flips (key, first line, copy, line rule at 0346ee1, round)', rows.map((r) => [r.key, r.v, r.copy, r.lineRuleBefore, r.round]));
    expect(rows.filter((r) => r.copy).map((r) => `${r.key} ${r.v}`)).toEqual(['en haiku[0] My verse falls like stones', 'fr haiku[0] Mes vers sont des pierres']);
    // "Mes vers sont des pierres / Nul ne se penche sans peur / Le vent les redoute" against "Tes vers
    // sont des feuilles / Nul ne se penche pour eux / Le vent les emporte": its words are the copy's that
    // swaps each line's last word and flips the persons (the checker's personFlip family, which it counts
    // as a copy), with one little word more changed (pour -> sans). Word for word the two keep the same
    // content words line by line (none, penche, vent), so no rule of words frees the one and not the other.
    const source = getPack('fr').written.haiku[0];
    const flip = FLIPS.find(([lang, form, , v]) => lang === 'fr' && form === 'haiku' && v.includes('sans peur'))![3];
    const copy = 'Mes vers sont des pierres\nNul ne se penche pour rien\nLe vent les redoute';
    const kept = (v: string) => copyOf(v, source, 'fr').carry.map((l) => [l.content, l.contentSaid]);
    expect(kept(flip)).toEqual(kept(copy));
    expect([isCopy(flip, source, 'fr'), isCopy(copy, source, 'fr')]).toEqual([true, true]);
    // The other French haiku, which says each line its own way, wins as before.
    const fr = rows.find((r) => r.key === 'fr haiku[0]' && !r.copy)!;
    expect(fr.round?.winner).toBe('player');
  });

  it('the content clause, at its edge: every line carried with only little words kept is its own; one content word kept, in one line of four, makes it a copy', () => {
    // Ton vers arrive en boitant sur une jambe / Et mendie à la foule un peu de pitié /
    // Je ne frappe pas celui que j’enjambe / Je le laisse assis, seul, sur le pavé
    const source = getPack('fr').written['quatrain-abab'][1];
    // The frame kept and every word that means something changed (each line's end too, rhyming with
    // none of the other's): an answer in the other's frame.
    const flip = 'Ton vers revient en rampant sur une table\nEt réclame à la ville un peu de silence\nJe ne touche pas celui que j’écrase\nJe le garde debout, seul, sur le sable';
    // The same with "foule" kept in the second line alone: one of the other's content words is carried.
    const one = 'Ton vers revient en rampant sur une table\nEt réclame à la foule un peu de silence\nJe ne touche pas celui que j’écrase\nJe le garde debout, seul, sur le sable';
    const lines = (v: string) => copyOf(v, source, 'fr').carry.map((l) => [l.content, l.contentSaid]);
    expect([lines(flip), lines(one)]).toEqual([
      [[3, 0], [3, 0], [2, 0], [3, 0]],
      [[3, 0], [3, 1], [2, 0], [3, 0]],
    ]);
    // Both carry every line with COPY_LINE_SHARE of its words in order, and no line nearly whole or
    // keeping its rhyme: at 0346ee1 the every-line rule made both copies.
    expect([before(flip, source, 'fr'), before(one, source, 'fr')]).toEqual([true, true]);
    // Now the flip is not. The one that keeps "foule" still is: asking a content word of every line,
    // or of half of them, would free it, and with it the copies with each line's last word swapped and
    // an inner word dropped or replaced (review4's families; RULES-MEASUREMENTS.md, third round).
    expect([carriesLines(copyOf(flip, source, 'fr')), isCopy(flip, source, 'fr')]).toEqual([false, false]);
    expect([carriesLines(copyOf(one, source, 'fr')), isCopy(one, source, 'fr')]).toEqual([true, true]);
    // A source of little words alone has no content word to keep: a copy of it with 5 of each line's
    // 8 words kept in order is carried still.
    const little = 'and so it is with you and me\nand all of it was not for you\nso be it as it was with me';
    const littleCopy = 'and so it is with them or him\nand all of us was not by them\nso be it as they were with him';
    expect(copyOf(littleCopy, little, 'en').carry.map((l) => [l.source, l.said, l.content])).toEqual([
      [8, 5, 0],
      [8, 5, 0],
      [8, 5, 0],
    ]);
    expect(carriesLines(copyOf(littleCopy, little, 'en'))).toBe(true);
  });

  it("the checker's 18 hand copies: the same verdicts as at d56f5c8 (8 void)", () => {
    const rows = HAND.map(([lang, form, k, v, how]) => ({ key: `${lang} ${form}[${k}]`, how, copy: isCopy(v, getPack(lang).written[form][k], lang) }));
    log('engine check 2: hand copies (key, how, copy)', rows.map((r) => [r.key, r.how, r.copy]));
    expect(rows.filter((r) => r.copy).map((r) => r.key)).toEqual(['en couplet[1]', 'fr haiku[0]', 'fr tercet[0]', 'it tercet[0]', 'es haiku[0]', 'es tercet[0]', 'de haiku[0]', 'de tercet[0]']);
  });

  it("the checker's 68 honest verses in sixteen languages are verses at full form and none is a copy of the pack verse it answers", () => {
    const rows = HONEST.map(([lang, form, v]) => {
      const opp = getPack(lang).written[form]?.[0] ?? getPack(lang).written.couplet[0];
      return { lang, v: v.split('\n')[0], ok: substance(v, lang).ok, thin: !!scoreForm(getForm(form), v, { lang }).thin, copy: isCopy(v, opp, lang) };
    });
    log('engine check 2: honest verse (lang, first line, ok, thin, copy)', rows.map((r) => [r.lang, r.v, r.ok, r.thin, r.copy]));
    expect(rows.length).toBe(68);
    expect(rows.filter((r) => !r.ok || r.thin || r.copy).map((r) => `${r.lang} ${r.v}`)).toEqual([]);
  });

  it('flips of every pack verse in en, es, fr, de, it and pt, every content word swapped and the little words kept: the line rule voids fewer than at 0346ee1, none it did not void then', () => {
    const rows: Record<string, { flips: number; lineRuleBefore: number; lineRuleNow: number; copyNow: number }> = {};
    for (const lang of ['en', 'es', 'fr', 'de', 'it', 'pt']) {
      const pack = getPack(lang);
      const verses = Object.values(pack.written).flat();
      const pool = [...new Set(verses.flatMap((v) => wordsOf(v, lang)).filter((w) => isContentWord(w, lang)))];
      const r = rng(5150 + lang.length);
      const row = (rows[lang] = { flips: 0, lineRuleBefore: 0, lineRuleNow: 0, copyNow: 0 });
      for (const source of verses) {
        if (linesOf(source).length < 2) continue;
        const flip = linesOf(source)
          .map((l) =>
            l
              .split(' ')
              .map((t) => {
                const core = t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
                if (!core || !isContentWord(core, lang)) return t;
                let w = core;
                for (let n = 0; n < 20 && wordsOf(source, lang).some((x) => x.toLowerCase() === w.toLowerCase()); n++) w = pool[Math.floor(r() * pool.length)];
                return t.replace(core, w);
              })
              .join(' '),
          )
          .join('\n');
        row.flips++;
        const was = before(flip, source, lang);
        const now = carriesLines(copyOf(flip, source, lang));
        if (was) row.lineRuleBefore++;
        if (now) row.lineRuleNow++;
        expect([flip, now && !was]).toEqual([flip, false]);
        if (isCopy(flip, source, lang)) row.copyNow++;
      }
    }
    log('engine check 2: flips with every content word swapped (lang: flips, line rule at 0346ee1, line rule now, copies now)', rows);
    // What still voids such a flip is the rule's older parts (each line nearly whole in order, or rhymed), as at d56f5c8.
    for (const [lang, row] of Object.entries(rows)) expect([lang, row.lineRuleNow <= row.lineRuleBefore]).toEqual([lang, true]);
    const sum = (k: 'lineRuleBefore' | 'lineRuleNow') => Object.values(rows).reduce((n, row) => n + row[k], 0);
    expect(sum('lineRuleNow')).toBeLessThan(sum('lineRuleBefore'));
  });
});
