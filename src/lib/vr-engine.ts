/**
 * VR Engine — Babylon.js scene with WebXR for card gallery and battle spectator.
 *
 * Platform support:
 * - Quest 3: Full WebXR VR+AR
 * - Vision Pro: WebXR VR (gaze+pinch)
 * - Desktop: 3D viewer fallback (mouse orbit)
 */

import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Color3, Color4, MeshBuilder, StandardMaterial, Texture, WebXRDefaultExperience, PointerEventTypes } from '@babylonjs/core';
import '@babylonjs/loaders';

import { CARD_CATALOG } from './cards';

export interface VREngineOptions {
  canvas: HTMLCanvasElement;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

export class VRCardEngine {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private xrExperience: WebXRDefaultExperience | null = null;
  private options: VREngineOptions;
  private cardMeshes: Map<string, any> = new Map();

  constructor(options: VREngineOptions) {
    this.options = options;

    // Create Babylon engine
    this.engine = new Engine(options.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.03, 0.03, 0.06, 1); // Dark obsidian

    // Camera — orbits around the gallery center
    this.camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      12,
      Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(options.canvas, true);
    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 25;
    this.camera.wheelDeltaPercentage = 0.01;

    // Lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.9;
    light.groundColor = new Color3(0.15, 0.1, 0.05);

    // Second fill light for card readability
    const fill = new HemisphericLight('fill', new Vector3(0, -0.5, 1), this.scene);
    fill.intensity = 0.4;

    // Build scene
    this.buildGallery();
    this.buildFloor();
    this.setupInteraction();
  }

  /** Arrange cards in a circular gallery */
  private buildGallery(): void {
    const characterCards = CARD_CATALOG.filter(c => c.type === 'Character');
    const radius = 6;
    const angleStep = (2 * Math.PI) / characterCards.length;

    characterCards.forEach((card, i) => {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Card plane (portrait ratio 2.5:3.5)
      const cardMesh = MeshBuilder.CreatePlane(
        `card-${card.id}`,
        { width: 2, height: 2.8 },
        this.scene
      );
      cardMesh.position = new Vector3(x, 1.8, z);
      // Face the center
      cardMesh.lookAt(Vector3.Zero());

      // Material with card image
      const mat = new StandardMaterial(`mat-${card.id}`, this.scene);
      const imagePath = `/images/cards/${card.id.toLowerCase()}.webp`;
      mat.diffuseTexture = new Texture(imagePath, this.scene);
      mat.emissiveColor = new Color3(0.3, 0.3, 0.3); // Slight self-illumination
      mat.backFaceCulling = false;
      cardMesh.material = mat;

      // Metadata for interaction
      cardMesh.metadata = { cardId: card.id, cardName: card.name };

      // Pedestal
      const pedestal = MeshBuilder.CreateCylinder(
        `pedestal-${card.id}`,
        { height: 0.3, diameter: 0.8, tessellation: 12 },
        this.scene
      );
      pedestal.position = new Vector3(x, 0.15, z);
      const pedestalMat = new StandardMaterial(`pedMat-${card.id}`, this.scene);
      pedestalMat.diffuseColor = new Color3(0.12, 0.1, 0.08);
      pedestalMat.emissiveColor = new Color3(0.05, 0.04, 0.02);
      pedestal.material = pedestalMat;

      // Name label below card
      const namePlate = MeshBuilder.CreatePlane(
        `name-${card.id}`,
        { width: 2, height: 0.3 },
        this.scene
      );
      namePlate.position = new Vector3(x, 0.35, z);
      namePlate.lookAt(Vector3.Zero());
      const nameMat = new StandardMaterial(`nameMat-${card.id}`, this.scene);
      nameMat.diffuseColor = new Color3(0.8, 0.7, 0.3); // Gold
      nameMat.emissiveColor = new Color3(0.4, 0.35, 0.15);
      namePlate.material = nameMat;

      this.cardMeshes.set(card.id, cardMesh);
    });

    // Item cards arranged in an inner circle
    const itemCards = CARD_CATALOG.filter(c => c.type !== 'Character');
    const innerRadius = 3;
    const innerStep = (2 * Math.PI) / itemCards.length;

    itemCards.forEach((card, i) => {
      const angle = i * innerStep + (innerStep / 2); // Offset from characters
      const x = Math.cos(angle) * innerRadius;
      const z = Math.sin(angle) * innerRadius;

      const cardMesh = MeshBuilder.CreatePlane(
        `card-${card.id}`,
        { width: 1.4, height: 1.96 },
        this.scene
      );
      cardMesh.position = new Vector3(x, 1.2, z);
      cardMesh.lookAt(Vector3.Zero());

      const mat = new StandardMaterial(`mat-${card.id}`, this.scene);
      const imagePath = `/images/cards/${card.id.toLowerCase()}.webp`;
      mat.diffuseTexture = new Texture(imagePath, this.scene);
      mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
      mat.backFaceCulling = false;
      cardMesh.material = mat;
      cardMesh.metadata = { cardId: card.id, cardName: card.name };

      this.cardMeshes.set(card.id, cardMesh);
    });
  }

  /** Build a reflective floor */
  private buildFloor(): void {
    const floor = MeshBuilder.CreateGround(
      'floor',
      { width: 20, height: 20 },
      this.scene
    );
    const floorMat = new StandardMaterial('floorMat', this.scene);
    floorMat.diffuseColor = new Color3(0.05, 0.04, 0.06);
    floorMat.specularColor = new Color3(0.1, 0.08, 0.12);
    floorMat.emissiveColor = new Color3(0.02, 0.015, 0.03);
    floor.material = floorMat;
  }

  /** Click/gaze interaction on cards */
  private setupInteraction(): void {
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERPICK && info.pickInfo?.hit) {
        const mesh = info.pickInfo.pickedMesh;
        if (mesh?.metadata?.cardId) {
          this.options.onStatusChange?.(
            `Selected: ${mesh.metadata.cardName} (${mesh.metadata.cardId})`
          );
        }
      }
    });
  }

  /** Try to enable WebXR immersive-vr mode */
  async enableVR(): Promise<boolean> {
    try {
      this.xrExperience = await WebXRDefaultExperience.CreateAsync(this.scene, {
        uiOptions: {
          sessionMode: 'immersive-vr',
        },
        disableTeleportation: false,
      });

      this.options.onStatusChange?.('WebXR ready — click "Enter VR" button');
      return true;
    } catch (e: any) {
      this.options.onError?.(`WebXR not available: ${e.message}`);
      return false;
    }
  }

  /** Start the render loop */
  start(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    this.options.onStatusChange?.('3D Gallery loaded — orbit with mouse, scroll to zoom');
  }

  /** Stop and dispose */
  dispose(): void {
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
