/**
 * Splat Viewer — Babylon.js Gaussian Splatting viewer for 3D card models.
 *
 * Optimized for broad device compatibility:
 * - Adaptive render resolution (scales down on weak GPUs)
 * - FPS monitoring with automatic quality reduction
 * - Render-on-demand (stops rendering when camera idle — saves CPU/battery)
 * - Page visibility handling (pauses when tab hidden)
 * - Mobile-aware defaults (lower resolution, simplified lighting)
 * - Proper cleanup on model switch and page leave
 */

import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color4,
  AbstractMesh,
} from '@babylonjs/core';
import '@babylonjs/loaders';

export interface SplatViewerOptions {
  canvas: HTMLCanvasElement;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onFpsUpdate?: (fps: number) => void;
}

/** Detected device performance tier */
type PerfTier = 'high' | 'medium' | 'low';

function detectPerfTier(): PerfTier {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const cores = navigator.hardwareConcurrency || 2;
  const mem = (navigator as any).deviceMemory || 4; // GB, Chrome-only

  if (isMobile || cores <= 4 || mem <= 4) return 'low';
  if (cores <= 8 || mem <= 8) return 'medium';
  return 'high';
}

/** Resolution scale per tier (applied to canvas backing pixels) */
const RESOLUTION_SCALE: Record<PerfTier, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

/** Target FPS — if we drop below this for several frames, reduce quality */
const MIN_ACCEPTABLE_FPS = 24;
const FPS_CHECK_INTERVAL_MS = 2000;

/** Idle timeout — stop rendering after this many ms of no camera movement */
const IDLE_TIMEOUT_MS = 3000;

export class SplatViewer {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private options: SplatViewerOptions;
  private currentMeshes: AbstractMesh[] = [];
  private perfTier: PerfTier;
  private fpsCheckTimer: ReturnType<typeof setInterval> | null = null;
  private resizeHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private hasReducedQuality = false;
  private isRendering = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCameraState = { alpha: 0, beta: 0, radius: 0 };

  constructor(options: SplatViewerOptions) {
    this.options = options;
    this.perfTier = detectPerfTier();

    const scale = RESOLUTION_SCALE[this.perfTier];

    // Create engine with adaptive settings
    this.engine = new Engine(options.canvas, true, {
      preserveDrawingBuffer: false, // false = faster, only true if screenshots needed
      stencil: false,               // not needed for splats
      antialias: this.perfTier !== 'low',
      adaptToDeviceRatio: false,    // we control resolution ourselves
      powerPreference: 'high-performance',
    });

    // Apply resolution scale
    if (scale < 1.0) {
      this.engine.setHardwareScalingLevel(1 / scale);
    }

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.03, 0.03, 0.06, 1);

    // Disable features we don't need
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = true;

    // Camera
    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      2.5,
      Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(options.canvas, true);
    this.camera.lowerRadiusLimit = 0.5;
    this.camera.upperRadiusLimit = 10;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.minZ = 0.01;
    this.camera.inertia = 0.9;

    // Single hemisphere light — cheaper than point lights
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.9;
  }

  /** Load a Gaussian splat .ply file */
  async loadSplat(plyUrl: string): Promise<void> {
    this.options.onStatusChange?.('Loading splat model...');

    // Dispose previous meshes fully
    for (const mesh of this.currentMeshes) {
      mesh.dispose(false, true); // dispose geometry + materials
    }
    this.currentMeshes = [];

    // Force a GC-friendly pause
    this.scene.render();

    try {
      const { ImportMeshAsync } = await import('@babylonjs/core');
      const result = await ImportMeshAsync(plyUrl, this.scene);

      if (result.meshes.length > 0) {
        this.currentMeshes = result.meshes;
        const primary = result.meshes[0];

        primary.position = Vector3.Zero();
        primary.refreshBoundingInfo({});
        const bounds = primary.getBoundingInfo();
        const size = bounds.boundingSphere.radiusWorld;
        this.camera.radius = Math.max(size * 2.5, 1.0);
        this.camera.target = bounds.boundingSphere.centerWorld.clone();

        // Freeze transforms — tells Babylon to skip matrix recomputation each frame
        for (const mesh of result.meshes) {
          mesh.freezeWorldMatrix();
        }

        // Snapshot camera for idle detection
        this.snapshotCamera();

        // Ensure rendering is active after load
        this.wakeRenderer();

        const fileName = plyUrl.split('/').pop() || plyUrl;
        const tierLabel = this.perfTier === 'high' ? '' : ` (${this.perfTier} quality)`;
        this.options.onStatusChange?.(
          `Loaded ${fileName}${tierLabel} — orbit with mouse, scroll to zoom`
        );
      } else {
        this.options.onError?.('No meshes found in file');
      }
    } catch (e: any) {
      this.options.onError?.(`Failed to load: ${e.message || e}`);
    }
  }

  /** Reset camera to default orbit position */
  resetCamera(): void {
    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = 2.5;
    this.camera.target = Vector3.Zero();
    this.wakeRenderer();
  }

  /** Start the render loop with FPS monitoring and idle detection */
  start(): void {
    this.startRendering();

    this.resizeHandler = () => {
      this.engine.resize();
      this.wakeRenderer();
    };
    window.addEventListener('resize', this.resizeHandler);

    // Page visibility — pause rendering when tab is hidden
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopRendering();
      } else if (this.currentMeshes.length > 0) {
        this.wakeRenderer();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // FPS watchdog — reduce quality if consistently below threshold
    this.fpsCheckTimer = setInterval(() => {
      if (!this.isRendering) return;

      const fps = this.engine.getFps();
      this.options.onFpsUpdate?.(fps);

      // Check if camera has stopped moving → go idle
      if (this.currentMeshes.length > 0 && !this.cameraHasMoved()) {
        if (!this.idleTimer) {
          this.idleTimer = setTimeout(() => {
            this.stopRendering();
            this.idleTimer = null;
          }, IDLE_TIMEOUT_MS);
        }
      } else {
        // Camera is moving — clear idle timer
        if (this.idleTimer) {
          clearTimeout(this.idleTimer);
          this.idleTimer = null;
        }
        this.snapshotCamera();
      }

      if (fps < MIN_ACCEPTABLE_FPS && !this.hasReducedQuality && this.currentMeshes.length > 0) {
        this.reduceQuality();
      }
    }, FPS_CHECK_INTERVAL_MS);

    // Wake renderer on any user interaction with the canvas
    const canvas = this.options.canvas;
    for (const event of ['pointerdown', 'wheel', 'touchstart'] as const) {
      canvas.addEventListener(event, () => this.wakeRenderer(), { passive: true });
    }

    this.options.onStatusChange?.('3D viewer ready — select a card to view');
  }

  private snapshotCamera(): void {
    this.lastCameraState.alpha = this.camera.alpha;
    this.lastCameraState.beta = this.camera.beta;
    this.lastCameraState.radius = this.camera.radius;
  }

  private cameraHasMoved(): boolean {
    const EPS = 0.0001;
    return (
      Math.abs(this.camera.alpha - this.lastCameraState.alpha) > EPS ||
      Math.abs(this.camera.beta - this.lastCameraState.beta) > EPS ||
      Math.abs(this.camera.radius - this.lastCameraState.radius) > EPS
    );
  }

  /** Start the Babylon.js render loop */
  private startRendering(): void {
    if (this.isRendering) return;
    this.isRendering = true;
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  /** Stop the render loop (saves CPU/GPU/battery when idle) */
  private stopRendering(): void {
    if (!this.isRendering) return;
    this.isRendering = false;
    this.engine.stopRenderLoop();
    // Render one final frame so the display isn't stale
    this.scene.render();
  }

  /** Wake from idle — restart render loop and reset idle timer */
  private wakeRenderer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.snapshotCamera();
    this.startRendering();
  }

  /** Dynamically reduce quality if FPS is too low */
  private reduceQuality(): void {
    this.hasReducedQuality = true;
    const currentLevel = this.engine.getHardwareScalingLevel();
    const newLevel = Math.min(currentLevel * 1.5, 3.0); // lower res
    this.engine.setHardwareScalingLevel(newLevel);
    this.options.onStatusChange?.(
      `Reduced render quality for smoother performance`
    );
  }

  /** Stop and dispose all resources */
  dispose(): void {
    if (this.fpsCheckTimer) {
      clearInterval(this.fpsCheckTimer);
      this.fpsCheckTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.engine.stopRenderLoop();
    for (const mesh of this.currentMeshes) {
      mesh.dispose(false, true);
    }
    this.currentMeshes = [];
    this.scene.dispose();
    this.engine.dispose();
  }
}
