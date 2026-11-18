/**
 * The engine check's second round (2026-11-17) refused the merge with two blockers and a list of
 * concerns. Its Japanese probe (zz-e2-ja: 135 common loanwords and names, each alone on the first
 * line of a haiku whose other two lines are Japanese) is here as a test of the fixed behaviour, with
 * this pass's own words, the random katakana and keyboard mash that must stay out, and the
 * concerns' probes. Each block prints what it measured ("MEASURE ..."), recorded in
 * docs/language/RULES-MEASUREMENTS.md.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { rng } from './duel';
import { getForm, scoreForm } from './forms';
import { loadAllPacks } from './packs';
import { loadPronunciation } from './pronounce';
import { loadSound } from './sound';
import { japaneseLexicon, japaneseListed, setJapaneseLexicon } from './sound/kana';
import { substance } from './text';

const log = (k: string, v: unknown) => console.log(`MEASURE ${k} ${JSON.stringify(v)}`);

beforeAll(async () => {
  await loadAllPacks();
  await loadSound('ja');
  expect(await loadPronunciation()).toBe(true);
}, 300_000);

/** A line alone, then two lines of Japanese: the checker's frame. */
const haiku = (first: string) => `${first}\n夜の街を\n歩いてく`;
const counts = (v: string) => substance(v, 'ja').ok && !scoreForm(getForm('haiku'), v, { lang: 'ja' }).thin;

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
  /** Are all the words of this katakana in a dictionary the engine has (whole, a compound of two, or each part between middle dots)? */
  const inDictionary = (w: string) =>
    w.split('・').every((part) => {
      if (japaneseListed(part)) return true;
      for (let k = 3; k + 3 <= part.length; k++) {
        const a = japaneseListed(part.slice(0, k));
        const b = japaneseListed(part.slice(k));
        if ((a === 'ipadic' || a === 'word') && (b === 'ipadic' || b === 'word')) return true;
      }
      return false;
    });

  it("the checker's 135: every one a dictionary has counts alone on the line (31 were void at 0346ee1); with a particle, all do", () => {
    const rows = CHECKER.map((w) => ({ w, alone: counts(haiku(w)), particle: counts(haiku(`${w}の`)), listed: inDictionary(w) }));
    const voidAlone = rows.filter((r) => !r.alone).map((r) => r.w);
    log('engine check 2: the checker\'s 135 loanwords alone on a line (void, not in any dictionary)', { words: rows.length, voidAlone, notListed: rows.filter((r) => !r.listed).map((r) => r.w) });
    expect(rows.length).toBe(135);
    expect(rows.filter((r) => !r.particle).map((r) => r.w)).toEqual([]);
    // Void alone only when no dictionary has it: トーキョー (IPADIC, JMdict and JMnedict spell Tokyo 東京).
    expect(rows.filter((r) => !r.alone && r.listed).map((r) => r.w)).toEqual([]);
    expect(voidAlone).toEqual(['トーキョー']);
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
