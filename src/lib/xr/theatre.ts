/**
 * The theatre: the duel staged in 3D, for headsets and for a flat screen.
 *
 * One scene serves three ways of looking at it:
 *   - on a desktop or phone, through a fixed camera in the canvas;
 *   - in a Quest, as passthrough AR where the browser offers it, else VR;
 *   - in a Vision Pro, as VR (its Safari has no AR sessions for the web).
 *
 * Everything is a flat panel or a card, picked by pointing: a mouse click, a
 * controller ray, or a hand pinch all arrive as the same pointer event, so no
 * input is special-cased. Verse is spoken, not typed, inside a headset.
 *
 * The theatre draws a DuelSession and reports what the player picks; it holds
 * no rules of its own.
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { WebXRDefaultExperience } from '@babylonjs/core/XR/webXRDefaultExperience';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Helpers/sceneHelpers';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Image as GuiImage } from '@babylonjs/gui/2D/controls/image';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';

import { getCardById, type Card } from '../cards';
import { POTION_CURSE, deviceForHouse } from '../verse/devices';
import { JUDGE_POOL, ROUNDS, type RoundResult, type VerseScore } from '../verse/duel';
import { FORM_POINTS } from '../verse/forms';
// Everything written on the stage is a message in the interface language (src/i18n).
import { list, num, t, tm } from '../../i18n';
import { curseName, curseRule, deviceBrief, deviceName, signatureText } from '../../i18n/duel';
import { readsRtl, wrapUnits } from './text-wrap';
import type { DuelSession } from '../verse/session';

export type Action =
  | { type: 'character'; id: string }
  | { type: 'item'; id: string }
  | { type: 'mic' }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'next' };

export interface TheatreStatus {
  /** What the microphone button says. */
  mic: string;
  listening: boolean;
  /** Who is judging, for the verdict. */
  judge: string;
}

const GOLD = '#e8b420';

/**
 * Wrap a TextBlock at word boundaries in every script, and draw a right-to-left text from the right
 * (./text-wrap.ts says why). `align` is the alignment the block has for left-to-right text.
 */
function readable(tb: TextBlock, align = Control.HORIZONTAL_ALIGNMENT_LEFT): void {
  tb.wordDivider = '';
  tb.wordSplittingFunction = wrapUnits;
  const first = !tb.metadata?.readable;
  tb.metadata = { ...(tb.metadata ?? {}), readable: true, align };
  if (first) tb.onTextChangedObservable.add(() => direct(tb));
  direct(tb);
}

function direct(tb: TextBlock): void {
  const align = tb.metadata?.align ?? Control.HORIZONTAL_ALIGNMENT_LEFT;
  tb.textHorizontalAlignment = align === Control.HORIZONTAL_ALIGNMENT_LEFT && readsRtl(tb.text) ? Control.HORIZONTAL_ALIGNMENT_RIGHT : align;
}
const INK = '#0d0b09';
const PAPER = '#f4f3f2';
const DIM = '#a9a197';
const CRIMSON = '#f87171';
const GREEN = '#34d399';

/** Pixels per metre for panel textures: enough to read verse in a headset. */
const PPM = 700;

interface Panel {
  mesh: Mesh;
  ui: AdvancedDynamicTexture;
  text: TextBlock;
  frame: Rectangle;
}

export class Theatre {
  readonly engine: Engine;
  readonly scene: Scene;
  private xr: WebXRDefaultExperience | null = null;
  private stage: Mesh[] = [];
  private panels: Record<string, Panel> = {};
  private buttons: Record<string, Panel> = {};
  private hand: Mesh[] = [];
  private handKey = '';
  mode: 'flat' | 'immersive-ar' | 'immersive-vr' = 'flat';

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onAction: (a: Action) => void,
  ) {
    this.engine = new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.03, 0.025, 0.02, 1);

    const camera = new FreeCamera('seat', new Vector3(0, 1.5, -0.75), this.scene);
    camera.setTarget(new Vector3(0, 1.28, 2));
    camera.minZ = 0.05;
    camera.fov = 0.9;

    const light = new HemisphericLight('house-lights', new Vector3(0, 1, -0.3), this.scene);
    light.intensity = 1;

    this.buildStage();
    this.buildPanels();

    // A press and release on the same mesh is a pick. Mouse, touch, controller rays and hand
    // pinches all arrive as pointer down/up with the mesh they hit, so one rule covers them.
    let pressed: unknown = null;
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        pressed = info.pickInfo?.hit ? info.pickInfo.pickedMesh : null;
      } else if (info.type === PointerEventTypes.POINTERUP) {
        const mesh = info.pickInfo?.hit ? info.pickInfo.pickedMesh : null;
        const action = mesh && mesh === pressed ? (mesh.metadata?.action as Action | undefined) : undefined;
        pressed = null;
        if (action) this.onAction(action);
      }
    });

    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.engine.resize();

  private buildStage() {
    const floor = MeshBuilder.CreateGround('floor', { width: 8, height: 8 }, this.scene);
    const fm = new StandardMaterial('floor-mat', this.scene);
    fm.diffuseColor = new Color3(0.07, 0.05, 0.04);
    fm.specularColor = new Color3(0.05, 0.04, 0.03);
    floor.material = fm;

    const back = MeshBuilder.CreatePlane('curtain', { width: 7, height: 4 }, this.scene);
    back.position = new Vector3(0, 2, 3.4);
    const bm = new StandardMaterial('curtain-mat', this.scene);
    bm.diffuseColor = new Color3(0.28, 0.04, 0.05);
    bm.emissiveColor = new Color3(0.08, 0.01, 0.015);
    bm.specularColor = Color3.Black();
    back.material = bm;
    back.isPickable = false;
    floor.isPickable = false;
    this.stage = [floor, back];
  }

  /** A flat panel of text, sized in metres. */
  private panel(name: string, w: number, h: number, pos: Vector3, tiltX = 0, fontPx = 34): Panel {
    const mesh = MeshBuilder.CreatePlane(name, { width: w, height: h }, this.scene);
    mesh.position = pos;
    mesh.rotation.x = tiltX;
    const ui = AdvancedDynamicTexture.CreateForMesh(mesh, Math.round(w * PPM), Math.round(h * PPM), false);
    const frame = new Rectangle(`${name}-frame`);
    frame.background = '#1a1714f0';
    frame.color = '#584e48';
    frame.thickness = 3;
    frame.cornerRadius = 18;
    ui.addControl(frame);
    const text = new TextBlock(`${name}-text`, '');
    text.color = PAPER;
    text.fontSize = fontPx;
    text.fontFamily = 'Georgia, serif';
    text.textWrapping = true;
    readable(text);
    text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    text.paddingLeft = text.paddingRight = text.paddingTop = text.paddingBottom = '26px';
    text.lineSpacing = '8px';
    frame.addControl(text);
    return { mesh, ui, text, frame };
  }

  private button(name: string, pos: Vector3, action: Action, w = 0.42): Panel {
    const p = this.panel(name, w, 0.13, pos, 0.45, 40);
    readable(p.text, Control.HORIZONTAL_ALIGNMENT_CENTER);
    p.text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    p.text.paddingTop = p.text.paddingBottom = '0px';
    p.text.fontFamily = 'system-ui, sans-serif';
    p.mesh.metadata = { action };
    return p;
  }

  private buildPanels() {
    // Far wall: the opponent on the left, the rules of the round on the right.
    this.panels.opponent = this.panel('opponent', 1.25, 1.0, new Vector3(-0.7, 1.75, 2.3));
    this.panels.round = this.panel('round', 1.25, 1.0, new Vector3(0.7, 1.75, 2.3), 0, 30);
    this.panels.opponent.mesh.rotation.y = -0.22;
    this.panels.round.mesh.rotation.y = 0.22;
    // Near, tilted like a lectern: the player's own verse.
    this.panels.verse = this.panel('verse', 1.2, 0.4, new Vector3(0, 1.17, 1.3), 0.45, 36);
    // The verdict covers the far wall when a round ends.
    this.panels.verdict = this.panel('verdict', 2.3, 1.15, new Vector3(0, 1.75, 2.1), 0, 32);
    this.panels.verdict.frame.color = GOLD;

    // Controls flank the lectern, clear of the hand of cards laid in front of it.
    this.buttons.mic = this.button('btn-mic', new Vector3(-0.88, 1.24, 1.3), { type: 'mic' }, 0.46);
    this.buttons.clear = this.button('btn-clear', new Vector3(-0.88, 1.07, 1.24), { type: 'clear' }, 0.3);
    this.buttons.submit = this.button('btn-submit', new Vector3(0.88, 1.24, 1.3), { type: 'submit' }, 0.46);
    this.buttons.next = this.button('btn-next', new Vector3(0, 1.08, 1.9), { type: 'next' }, 0.6);
    this.buttons.next.mesh.rotation.x = 0;
    this.buttons.submit.frame.background = '#b7740af0';
    this.buttons.next.frame.background = '#b7740af0';
  }

  /** One card of the player's hand, as a pickable plane. */
  private cardMesh(card: Card, pos: Vector3, action: Action, state: 'ready' | 'chosen' | 'spent', sub: string, scale = 1): Mesh {
    const w = 0.2 * scale;
    const h = 0.28 * scale;
    const mesh = MeshBuilder.CreatePlane(`hand-${card.id}`, { width: w, height: h }, this.scene);
    mesh.position = pos;
    mesh.rotation.x = 0.45;
    mesh.metadata = state === 'spent' ? {} : { action };
    mesh.isPickable = state !== 'spent';
    const ui = AdvancedDynamicTexture.CreateForMesh(mesh, 400, 560, false);
    const frame = new Rectangle();
    frame.background = '#1a1714';
    frame.color = state === 'chosen' ? GOLD : '#584e48';
    frame.thickness = state === 'chosen' ? 14 : 4;
    frame.cornerRadius = 22;
    frame.alpha = state === 'spent' ? 0.25 : 1;
    ui.addControl(frame);
    if (card.image) {
      const img = new GuiImage(`img-${card.id}`, card.image);
      img.stretch = GuiImage.STRETCH_UNIFORM;
      img.height = '66%';
      img.width = '94%';
      img.top = '2%';
      img.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      // The texture is drawn once; redraw it when the picture arrives.
      img.onImageLoadedObservable.addOnce(() => ui.markAsDirty());
      frame.addControl(img);
    } else {
      const icon = new TextBlock(`icon-${card.id}`, card.icon);
      icon.fontSize = 170;
      icon.height = '68%';
      icon.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      frame.addControl(icon);
    }
    const label = new TextBlock(`label-${card.id}`, `${card.name}\n${sub}`);
    label.color = PAPER;
    label.fontSize = 42;
    label.fontFamily = 'system-ui, sans-serif';
    label.fontStyle = 'normal';
    label.textWrapping = true;
    readable(label, Control.HORIZONTAL_ALIGNMENT_CENTER);
    label.height = '32%';
    label.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    frame.addControl(label);
    return mesh;
  }

  private layHand(s: DuelSession) {
    const key = JSON.stringify([s.roundIndex, s.phase, s.move, s.moves.length, s.ink]);
    if (key === this.handKey) return;
    this.handKey = key;
    for (const m of this.hand) m.dispose(false, true);
    this.hand = [];
    if (s.phase !== 'player-turn') return;

    const chars = s.duel.player.characters.map((id) => getCardById(id)).filter((c): c is Card => !!c);
    const items = [...s.duel.player.relics, ...s.duel.player.potions].map((id) => getCardById(id)).filter((c): c is Card => !!c);
    // One row within arm's reach: characters, a gap, then the smaller relics and potions.
    const step = 0.215;
    const itemStep = 0.165;
    const width = chars.length * step + (items.length ? 0.06 + items.length * itemStep : 0);
    let x = -width / 2 + step / 2;
    for (const card of chars) {
      const state = s.characterUsed(card.id) ? 'spent' : s.move.charId === card.id ? 'chosen' : 'ready';
      this.hand.push(this.cardMesh(card, new Vector3(x, 0.93, 0.78), { type: 'character', id: card.id }, state, tm(deviceForHouse(card.house, s.duel.lang).name)));
      x += step;
    }
    x += 0.06 - (step - itemStep) / 2;
    for (const card of items) {
      const chosen = s.move.relicId === card.id || s.move.potionId === card.id;
      const state = s.itemUsed(card.id) || (!chosen && s.ink < 1) ? 'spent' : chosen ? 'chosen' : 'ready';
      const cast = POTION_CURSE[card.id];
      const sub = card.type === 'Relic' ? t('chip.powerWords') : cast ? curseName(cast) : t('chip.curse');
      this.hand.push(this.cardMesh(card, new Vector3(x, 0.915, 0.78), { type: 'item', id: card.id }, state, sub, 0.75));
      x += itemStep;
    }
  }

  private show(p: Panel, visible: boolean) {
    p.mesh.setEnabled(visible);
  }

  private side(title: string, v: VerseScore, judge: number, total: number): string {
    const lines = [
      title,
      `${t('verdict.form')} ${v.form.earned}/${FORM_POINTS}${v.form.kept ? ' ✓' : ''}`,
      `${deviceName(v.device.id)}: ${v.device.met ? '+½' : t('verdict.missed')}   ${t('verdict.signature')}: ${v.signature.met ? '+½' : t('verdict.missed')}`,
    ];
    if (v.powerWords) lines.push(`${t('verdict.powerWords')}: ${v.powerWords.met ? `+${v.powerWords.bonus}` : t('verdict.notUsed')}`);
    if (v.curse) lines.push(`${t('verdict.curse', { name: curseName(v.curse.id) })}: ${v.curse.penalty ? `−${v.curse.penalty}` : t('verdict.held')}`);
    lines.push(`${t('verdict.craft')} ${v.craft}  +  ${t('verdict.judge')} ${judge}/${JUDGE_POOL}  =  ${total}`);
    return lines.join('\n');
  }

  private verdictText(s: DuelSession, r: RoundResult, status: TheatreStatus): string {
    if (s.phase === 'finished') {
      return [
        s.winner === 'player' ? t('end.won') : t('end.lost'),
        '',
        t('end.tally', { you: s.playerRounds, them: s.opponentRounds, total: s.results.reduce((n, x) => n + x.playerTotal, 0) }),
      ].join('\n');
    }
    return [
      r.winner === 'player' ? t('verdict.roundYours') : t('verdict.roundTheirs', { card: s.opponentCard.name }),
      '',
      this.side(t('battle.you').toLocaleUpperCase(), r.player, r.judge.player, r.playerTotal),
      '',
      this.side(t('battle.opponent').toLocaleUpperCase(), r.opponent, r.judge.opponent, r.opponentTotal),
      '',
      status.judge,
    ].join('\n');
  }

  /** Redraw from the session. Cheap enough to call on every change. */
  render(s: DuelSession, status: TheatreStatus) {
    const ended = s.phase === 'verdict' || s.phase === 'finished';
    const last = s.results.at(-1);

    this.show(this.panels.opponent, !ended);
    this.show(this.panels.round, !ended);
    this.show(this.panels.verdict, ended);
    this.show(this.panels.verse, !ended);
    this.show(this.buttons.next, ended);
    for (const b of ['mic', 'clear', 'submit'] as const) this.show(this.buttons[b], s.phase === 'player-turn');

    const opp = s.opponentCard;
    const curse = s.plan.opponent.curse;
    this.panels.opponent.text.text = [
      `${opp.name}`,
      `${tm(deviceForHouse(opp.house, s.duel.lang).name)}`,
      curse ? `\n${t('theatre.cursesYou', { rule: curseRule(curse.curseId, curse.param, s.duel.lang) })}` : '',
      '',
      s.phase === 'opponent-writing'
        ? s.drafting && s.drafting.of > 1
          ? t('theatre.composingDraft', { n: s.drafting.draft, total: s.drafting.of })
          : t('theatre.composing')
        : s.opponentVerse,
    ].join('\n');

    const preview = s.preview();
    const checks: string[] = [];
    if (preview) {
      for (const c of preview.form.checks) checks.push(`${c.met ? '✓' : '○'} ${tm(c.label)}`);
      checks.push(`${preview.device.met ? '✓' : '○'} ${t('round.device', { name: deviceName(preview.device.id), brief: deviceBrief(preview.device.id, s.duel.lang) })}`);
      checks.push(`${preview.signature.met ? '✓' : '○'} ${t('verdict.signature')}: ${signatureText(preview.signature)}`);
      if (preview.powerWords) checks.push(`${preview.powerWords.met ? '✓' : '○'} ${t('verdict.powerWords')}: ${list(s.duel.playerRelics[s.move.relicId!].words)}`);
      if (preview.curse) checks.push(`${preview.curse.violations ? '✗' : '✓'} ${t('live.curse', { name: curseName(preview.curse.id) })}`);
      checks.push(`${t('round.craftSoFar')} ${num(preview.craft)}`);
    } else checks.push(t('theatre.pick'));
    this.panels.round.text.text = [
      [
        t('round.label', { n: s.roundIndex + 1, total: ROUNDS }).toLocaleUpperCase(),
        t('theatre.score', { you: t('battle.you'), a: s.playerRounds, b: s.opponentRounds, them: t('battle.opponent') }),
        `${t('round.ink')} ${num(s.ink)}`,
      ].join('   ·   '),
      t('round.device', { name: tm(s.form.name), brief: tm(s.form.brief(s.plan.ctx)) }),
      '',
      ...checks,
    ].join('\n');

    this.panels.verse.text.text = s.verse || (s.phase === 'player-turn' ? t('theatre.versePrompt') : '');
    this.panels.verse.text.color = s.verse ? PAPER : DIM;

    this.buttons.mic.text.text = status.mic;
    this.buttons.mic.frame.color = status.listening ? CRIMSON : '#584e48';
    this.buttons.mic.text.color = status.listening ? CRIMSON : PAPER;
    this.buttons.clear.text.text = t('theatre.clear');
    this.buttons.submit.text.text = s.phase === 'judging' ? t('theatre.judging') : t('theatre.submit');
    this.buttons.submit.text.color = INK;
    this.buttons.submit.frame.alpha = s.blocked() ? 0.35 : 1;
    this.buttons.next.text.text = s.phase === 'finished' ? t('end.again') : s.winner ? t('verdict.seeResult') : t('verdict.next');
    this.buttons.next.text.color = INK;

    if (ended && last) {
      this.panels.verdict.text.text = this.verdictText(s, last, status);
      this.panels.verdict.frame.color = (s.phase === 'finished' ? s.winner === 'player' : last.winner === 'player') ? GREEN : CRIMSON;
    }
    this.layHand(s);
  }

  /** Which immersive session this device offers, preferring passthrough. */
  static async supportedMode(): Promise<'immersive-ar' | 'immersive-vr' | null> {
    const xr = (navigator as any).xr;
    if (!xr?.isSessionSupported) return null;
    try {
      if (await xr.isSessionSupported('immersive-ar')) return 'immersive-ar';
      if (await xr.isSessionSupported('immersive-vr')) return 'immersive-vr';
    } catch {
      /* treated as unsupported */
    }
    return null;
  }

  /**
   * Enter the headset. Must be called from a click or pinch: browsers only
   * start an immersive session in answer to a user's own action.
   */
  async enterXR(): Promise<'immersive-ar' | 'immersive-vr' | null> {
    const mode = await Theatre.supportedMode();
    if (!mode) return null;
    if (!this.xr) {
      this.xr = await WebXRDefaultExperience.CreateAsync(this.scene, {
        disableDefaultUI: true,
        disableTeleportation: true,
        // Babylon's hand-tracking and near-interaction features download hand models and a
        // material from assets.babylonjs.com when a session starts (seen as page errors under
        // emulation). Nothing here may fetch from a third party at play time, so both are
        // off. A pinch still selects: the headset reports it as a select on the hand's ray.
        disableHandTracking: true,
        disableNearInteraction: true,
        // Likewise controller models, which come from controllers.babylonjs.com. The pointer
        // ray and its cursor are drawn locally and are all the player needs to aim.
        inputOptions: { doNotLoadControllerMeshes: true, disableOnlineControllerRepository: true },
        optionalFeatures: true,
      });
      this.xr.baseExperience.sessionManager.onXRSessionEnded.add(() => this.setMode('flat'));
    }
    await this.xr.baseExperience.enterXRAsync(mode, 'local-floor');
    this.setMode(mode);
    return mode;
  }

  async exitXR() {
    await this.xr?.baseExperience.exitXRAsync();
  }

  private setMode(mode: Theatre['mode']) {
    this.mode = mode;
    // In passthrough the room is the stage: hide ours and let the camera feed through.
    const ar = mode === 'immersive-ar';
    for (const m of this.stage) m.setEnabled(!ar);
    this.scene.clearColor = ar ? new Color4(0, 0, 0, 0) : new Color4(0.03, 0.025, 0.02, 1);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
