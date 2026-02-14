/**
 * AR Viewer — model-viewer integration for 3D card scene overlay.
 * Uses @google/model-viewer web component for cross-platform AR:
 * - iOS Safari: Quick Look (.usdz)
 * - Android Chrome: Scene Viewer / WebXR
 * - Desktop: Interactive 3D viewer (no AR)
 */

export interface ARModelConfig {
  cardId: string;
  glbPath: string;
  posterPath: string;
  iosSrc?: string;
  cameraOrbit: string;
  environmentImage: string;
}

/** AR model configs for 18 character cards. GLB files in /public/models/ */
export const AR_MODELS: Record<string, ARModelConfig> = {
  'SM-001': {
    cardId: 'SM-001',
    glbPath: '/models/sm-001.glb',
    posterPath: '/images/cards/sm-001.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'MO-001': {
    cardId: 'MO-001',
    glbPath: '/models/mo-001.glb',
    posterPath: '/images/cards/mo-001.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'CA-001': {
    cardId: 'CA-001',
    glbPath: '/models/ca-001.glb',
    posterPath: '/images/cards/ca-001.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'DC-001': {
    cardId: 'DC-001',
    glbPath: '/models/dc-001.glb',
    posterPath: '/images/cards/dc-001.webp',
    cameraOrbit: '15deg 80deg 3m',
    environmentImage: 'neutral',
  },
  'DC-002': {
    cardId: 'DC-002',
    glbPath: '/models/dc-002.glb',
    posterPath: '/images/cards/dc-002.webp',
    cameraOrbit: '0deg 70deg 2.5m',
    environmentImage: 'neutral',
  },
  'MO-002': {
    cardId: 'MO-002',
    glbPath: '/models/mo-002.glb',
    posterPath: '/images/cards/mo-002.webp',
    cameraOrbit: '-10deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'FA-001': {
    cardId: 'FA-001',
    glbPath: '/models/fa-001.glb',
    posterPath: '/images/cards/fa-001.webp',
    cameraOrbit: '0deg 75deg 2m',
    environmentImage: 'neutral',
  },
  'FA-002': {
    cardId: 'FA-002',
    glbPath: '/models/fa-002.glb',
    posterPath: '/images/cards/fa-002.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'VC-001': {
    cardId: 'VC-001',
    glbPath: '/models/vc-001.glb',
    posterPath: '/images/cards/vc-001.webp',
    cameraOrbit: '0deg 80deg 3m',
    environmentImage: 'neutral',
  },
  'VC-002': {
    cardId: 'VC-002',
    glbPath: '/models/vc-002.glb',
    posterPath: '/images/cards/vc-002.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'VC-003': {
    cardId: 'VC-003',
    glbPath: '/models/vc-003.glb',
    posterPath: '/images/cards/vc-003.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'TP-001': {
    cardId: 'TP-001',
    glbPath: '/models/tp-001.glb',
    posterPath: '/images/cards/tp-001.webp',
    cameraOrbit: '10deg 80deg 3m',
    environmentImage: 'neutral',
  },
  'TP-002': {
    cardId: 'TP-002',
    glbPath: '/models/tp-002.glb',
    posterPath: '/images/cards/tp-002.webp',
    cameraOrbit: '0deg 70deg 2m',
    environmentImage: 'neutral',
  },
  'TP-003': {
    cardId: 'TP-003',
    glbPath: '/models/tp-003.glb',
    posterPath: '/images/cards/tp-003.webp',
    cameraOrbit: '-15deg 80deg 3m',
    environmentImage: 'neutral',
  },
  'MO-003': {
    cardId: 'MO-003',
    glbPath: '/models/mo-003.glb',
    posterPath: '/images/cards/mo-003.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'CA-002': {
    cardId: 'CA-002',
    glbPath: '/models/ca-002.glb',
    posterPath: '/images/cards/ca-002.webp',
    cameraOrbit: '-10deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
  'DC-003': {
    cardId: 'DC-003',
    glbPath: '/models/dc-003.glb',
    posterPath: '/images/cards/dc-003.webp',
    cameraOrbit: '15deg 80deg 3m',
    environmentImage: 'neutral',
  },
  'FA-003': {
    cardId: 'FA-003',
    glbPath: '/models/fa-003.glb',
    posterPath: '/images/cards/fa-003.webp',
    cameraOrbit: '0deg 75deg 2.5m',
    environmentImage: 'neutral',
  },
};

export function hasARModel(cardId: string): boolean {
  return cardId in AR_MODELS;
}

export function getARModel(cardId: string): ARModelConfig | null {
  return AR_MODELS[cardId] ?? null;
}

/** Check if the device likely supports AR (mobile with camera) */
export function isARLikelySupported(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad/i.test(ua);
}

/** Build model-viewer HTML for a card */
export function buildModelViewerHTML(config: ARModelConfig): string {
  return `<model-viewer
    src="${config.glbPath}"
    ${config.iosSrc ? `ios-src="${config.iosSrc}"` : ''}
    ar
    ar-modes="webxr scene-viewer quick-look"
    camera-orbit="${config.cameraOrbit}"
    auto-rotate
    camera-controls
    poster="${config.posterPath}"
    shadow-intensity="1"
    style="width: 100%; height: 400px; --poster-color: transparent;"
  >
    <button slot="ar-button" class="ar-btn">
      View in AR
    </button>
  </model-viewer>`;
}
