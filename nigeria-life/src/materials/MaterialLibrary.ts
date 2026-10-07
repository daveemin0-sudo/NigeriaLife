import * as THREE from 'three';
import { createColorCanvasTexture, createDataCanvasTexture } from '../utils/TextureUtils';

/**
 * Procedural PBR Material and Texture Library for NigeriaLife.
 * All textures are generated procedurally on lightweight HTML5 canvases,
 * tagged with correct sRGB / Linear color spaces, and cached as singletons.
 */
export class MaterialLibrary {
  private static instance: MaterialLibrary;

  // Cached Materials
  public asphaltMaterial!: THREE.MeshStandardMaterial;
  public sidewalkMaterial!: THREE.MeshStandardMaterial;
  public curbYellowMaterial!: THREE.MeshStandardMaterial;
  public curbBlackMaterial!: THREE.MeshStandardMaterial;
  public curbStripedMaterial!: THREE.MeshStandardMaterial;
  public roadLineMaterial!: THREE.MeshStandardMaterial;
  public crosswalkMaterial!: THREE.MeshStandardMaterial;

  public corrugatedRoofRusty!: THREE.MeshStandardMaterial;
  public corrugatedRoofSilver!: THREE.MeshStandardMaterial;

  public wallPlasterCream!: THREE.MeshStandardMaterial;
  public wallPlasterOchre!: THREE.MeshStandardMaterial;
  public wallPlasterDistressedWhite!: THREE.MeshStandardMaterial;
  public wallPlasterTeal!: THREE.MeshStandardMaterial;

  public concreteTrimMaterial!: THREE.MeshStandardMaterial;
  public glassReflectiveMaterial!: THREE.MeshStandardMaterial;
  public louveredWindowMaterial!: THREE.MeshStandardMaterial;
  public ironRailingMaterial!: THREE.MeshStandardMaterial;

  public waterTankBlackMaterial!: THREE.MeshStandardMaterial;
  public acUnitMaterial!: THREE.MeshStandardMaterial;
  public acGrillMaterial!: THREE.MeshStandardMaterial;
  public groundGrassMaterial!: THREE.MeshStandardMaterial;

  private constructor() {
    this.initRoadMaterials();
    this.initRoofMaterials();
    this.initWallMaterials();
    this.initPropMaterials();
    this.initGroundMaterials();
  }

  public static getInstance(): MaterialLibrary {
    if (!MaterialLibrary.instance) {
      MaterialLibrary.instance = new MaterialLibrary();
    }
    return MaterialLibrary.instance;
  }

  // ==========================================
  // 1. ROAD & SIDEWALK TEXTURES
  // ==========================================
  private initRoadMaterials(): void {
    // A. Cracked Asphalt Texture
    const { colorMap: asphaltColor, bumpMap: asphaltBump, roughnessMap: asphaltRough } =
      this.generateAsphaltMaps();

    this.asphaltMaterial = new THREE.MeshStandardMaterial({
      map: asphaltColor,
      bumpMap: asphaltBump,
      bumpScale: 0.04,
      roughnessMap: asphaltRough,
      roughness: 0.88,
      metalness: 0.05,
    });

    // B. Concrete Sidewalk Slabs
    const { colorMap: sidewalkColor, bumpMap: sidewalkBump } = this.generateSidewalkMaps();
    this.sidewalkMaterial = new THREE.MeshStandardMaterial({
      map: sidewalkColor,
      bumpMap: sidewalkBump,
      bumpScale: 0.03,
      roughness: 0.8,
      metalness: 0.05,
    });

    // C. Nigerian Black & Yellow Curbs
    const { colorMap: curbMap, bumpMap: curbBump } = this.generateCurbTexture();
    this.curbStripedMaterial = new THREE.MeshStandardMaterial({
      map: curbMap,
      bumpMap: curbBump,
      bumpScale: 0.04,
      roughness: 0.65,
    });

    this.curbYellowMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.55,
      bumpMap: sidewalkBump,
      bumpScale: 0.02,
    });

    this.curbBlackMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      bumpMap: sidewalkBump,
      bumpScale: 0.02,
    });

    // Road Markings (Standard material instead of Basic)
    this.roadLineMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
      metalness: 0.05,
    });

    this.crosswalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.6,
      metalness: 0.02,
    });
  }

  private generateAsphaltMaps(): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
    roughnessMap: THREE.CanvasTexture;
  } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');

    colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
    colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

    const ctx = colorCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;
    const rCtx = roughCanvas.getContext('2d')!;

    // Base charcoal
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = '#cccccc';
    rCtx.fillRect(0, 0, size, size);

    // Gravel aggregate specks
    for (let i = 0; i < 7000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.8 + 0.5;
      const shade = Math.floor(25 + Math.random() * 45);

      ctx.fillStyle = `rgb(${shade + 5}, ${shade + 7}, ${shade + 10})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Bump
      bCtx.fillStyle = Math.random() > 0.5 ? '#a0a0a0' : '#606060';
      bCtx.beginPath();
      bCtx.arc(x, y, r, 0, Math.PI * 2);
      bCtx.fill();
    }

    // Branching street cracks
    const drawCrack = (startX: number, startY: number, length: number) => {
      let cx = startX;
      let cy = startY;
      ctx.strokeStyle = '#121417';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      bCtx.strokeStyle = '#202020';
      bCtx.lineWidth = 2.0;
      bCtx.beginPath();
      bCtx.moveTo(cx, cy);

      for (let s = 0; s < length; s++) {
        cx += (Math.random() - 0.5) * 8 + 2;
        cy += (Math.random() - 0.5) * 8 + 4;
        ctx.lineTo(cx, cy);
        bCtx.lineTo(cx, cy);
      }
      ctx.stroke();
      bCtx.stroke();
    };

    drawCrack(80, 50, 24);
    drawCrack(320, 180, 28);
    drawCrack(160, 360, 20);

    const colorMap = createColorCanvasTexture(colorCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 4,
      repeatY: 32,
      anisotropy: 4,
    });

    const bumpMap = createDataCanvasTexture(bumpCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 4,
      repeatY: 32,
    });

    const roughnessMap = createDataCanvasTexture(roughCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 4,
      repeatY: 32,
    });

    return { colorMap, bumpMap, roughnessMap };
  }

  private generateSidewalkMaps(): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = bumpCanvas.width = size;
    colorCanvas.height = bumpCanvas.height = size;

    const ctx = colorCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Concrete gray base
    ctx.fillStyle = '#8f949a';
    ctx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Fine grain noise
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = Math.floor(130 + Math.random() * 35);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Slab division lines (Concrete expansion joints)
    ctx.strokeStyle = '#555a60';
    ctx.lineWidth = 3;
    bCtx.strokeStyle = '#202020';
    bCtx.lineWidth = 3;

    for (let i = 0; i <= size; i += 128) {
      // Horizontal slab seam
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(0, i);
      bCtx.lineTo(size, i);
      bCtx.stroke();

      // Vertical slab seam
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(i, 0);
      bCtx.lineTo(i, size);
      bCtx.stroke();
    }

    const colorMap = createColorCanvasTexture(colorCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 32,
      anisotropy: 4,
    });

    const bumpMap = createDataCanvasTexture(bumpCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 32,
    });

    return { colorMap, bumpMap };
  }

  private generateCurbTexture(): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const size = 256;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = bumpCanvas.width = size;
    colorCanvas.height = bumpCanvas.height = size;

    const ctx = colorCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Alternating Yellow and Black blocks
    const blockH = size / 2;
    // Yellow block
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, size, blockH);
    // Black block
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, blockH, size, blockH);

    // Weathering stains along edges
    ctx.fillStyle = 'rgba(30, 20, 10, 0.35)';
    ctx.fillRect(0, blockH - 6, size, 12);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#404040';
    bCtx.fillRect(0, blockH - 4, size, 8);

    const colorMap = createColorCanvasTexture(colorCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 1,
      repeatY: 48,
    });

    const bumpMap = createDataCanvasTexture(bumpCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 1,
      repeatY: 48,
    });

    return { colorMap, bumpMap };
  }

  // ==========================================
  // 2. CORRUGATED METAL ROOF TEXTURES
  // ==========================================
  private initRoofMaterials(): void {
    const { colorMap: rustyColor, bumpMap: corrugatedBump } = this.generateCorrugatedRoof(true);
    this.corrugatedRoofRusty = new THREE.MeshStandardMaterial({
      map: rustyColor,
      bumpMap: corrugatedBump,
      bumpScale: 0.08,
      metalness: 0.5,
      roughness: 0.72,
    });

    const { colorMap: silverColor } = this.generateCorrugatedRoof(false);
    this.corrugatedRoofSilver = new THREE.MeshStandardMaterial({
      map: silverColor,
      bumpMap: corrugatedBump,
      bumpScale: 0.08,
      metalness: 0.75,
      roughness: 0.45,
    });
  }

  private generateCorrugatedRoof(withRust: boolean): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = bumpCanvas.width = size;
    colorCanvas.height = bumpCanvas.height = size;

    const ctx = colorCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Draw corrugated flute ridges (vertical waves)
    const fluteCount = 24;
    const fluteWidth = size / fluteCount;

    for (let i = 0; i < fluteCount; i++) {
      const grad = ctx.createLinearGradient(i * fluteWidth, 0, (i + 1) * fluteWidth, 0);
      grad.addColorStop(0, '#5f656b');
      grad.addColorStop(0.5, '#adb5bd');
      grad.addColorStop(1, '#495057');
      ctx.fillStyle = grad;
      ctx.fillRect(i * fluteWidth, 0, fluteWidth, size);

      const bGrad = bCtx.createLinearGradient(i * fluteWidth, 0, (i + 1) * fluteWidth, 0);
      bGrad.addColorStop(0, '#404040');
      bGrad.addColorStop(0.5, '#ffffff');
      bGrad.addColorStop(1, '#404040');
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(i * fluteWidth, 0, fluteWidth, size);
    }

    // Add Nigerian tropical weathering and red rust patches
    if (withRust) {
      for (let r = 0; r < 25; r++) {
        const rx = Math.random() * size;
        const ry = Math.random() * size;
        const rw = Math.random() * 80 + 30;
        const rh = Math.random() * 120 + 40;

        const rustGrad = ctx.createRadialGradient(rx, ry, 5, rx, ry, rw);
        rustGrad.addColorStop(0, 'rgba(154, 52, 18, 0.95)');
        rustGrad.addColorStop(0.5, 'rgba(120, 53, 15, 0.75)');
        rustGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');

        ctx.fillStyle = rustGrad;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, Math.random() * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const colorMap = createColorCanvasTexture(colorCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 3,
      repeatY: 3,
    });

    const bumpMap = createDataCanvasTexture(bumpCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 3,
      repeatY: 3,
    });

    return { colorMap, bumpMap };
  }

  // ==========================================
  // 3. WALL PLASTER WITH PEELING & WATER STAINS
  // ==========================================
  private initWallMaterials(): void {
    // A. Warm Cream Plaster
    const { colorMap: creamColor, bumpMap: wallBump } = this.generatePlasterMaps('#dfd5c4', '#60584b');
    this.wallPlasterCream = new THREE.MeshStandardMaterial({
      map: creamColor,
      bumpMap: wallBump,
      bumpScale: 0.035,
      roughness: 0.78,
    });

    // B. Warm Ochre / Terracotta
    const { colorMap: ochreColor } = this.generatePlasterMaps('#d07f42', '#522b12');
    this.wallPlasterOchre = new THREE.MeshStandardMaterial({
      map: ochreColor,
      bumpMap: wallBump,
      bumpScale: 0.035,
      roughness: 0.8,
    });

    // C. Distressed Commercial White
    const { colorMap: whiteColor } = this.generatePlasterMaps('#e6ebf2', '#4b5563');
    this.wallPlasterDistressedWhite = new THREE.MeshStandardMaterial({
      map: whiteColor,
      bumpMap: wallBump,
      bumpScale: 0.03,
      roughness: 0.75,
    });

    // D. Coastal Teal Plaster
    const { colorMap: tealColor } = this.generatePlasterMaps('#4d828a', '#1e383d');
    this.wallPlasterTeal = new THREE.MeshStandardMaterial({
      map: tealColor,
      bumpMap: wallBump,
      bumpScale: 0.035,
      roughness: 0.8,
    });

    // Concrete architectural trim
    this.concreteTrimMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.7,
      bumpMap: wallBump,
      bumpScale: 0.02,
    });
  }

  private generatePlasterMaps(baseHex: string, stainHex: string): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = bumpCanvas.width = size;
    colorCanvas.height = bumpCanvas.height = size;

    const ctx = colorCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Base plaster color
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Surface stippling texture
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Vertical rainwater runoff stains (dripping down facade)
    for (let s = 0; s < 14; s++) {
      const sx = Math.random() * size;
      const sw = Math.random() * 16 + 6;
      const sh = Math.random() * 280 + 100;

      const dripGrad = ctx.createLinearGradient(sx, 0, sx, sh);
      dripGrad.addColorStop(0, stainHex);
      dripGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = dripGrad;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(sx, 0, sw, sh);
      ctx.globalAlpha = 1.0;
    }

    // Peeling paint flakes exposing darker under-cement
    for (let p = 0; p < 8; p++) {
      const px = Math.random() * (size - 60) + 30;
      const py = Math.random() * (size - 60) + 30;
      const pr = Math.random() * 22 + 8;

      ctx.fillStyle = '#4b5563'; // Raw concrete core
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();

      // Flaked paint edge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, pr + 1, 0, Math.PI * 2);
      ctx.stroke();

      bCtx.fillStyle = '#303030';
      bCtx.beginPath();
      bCtx.arc(px, py, pr, 0, Math.PI * 2);
      bCtx.fill();
    }

    const colorMap = createColorCanvasTexture(colorCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 2,
    });

    const bumpMap = createDataCanvasTexture(bumpCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 2,
    });

    return { colorMap, bumpMap };
  }

  // ==========================================
  // 4. ARCHITECTURAL PROPS & DETAILS
  // ==========================================
  private initPropMaterials(): void {
    // Reflective architectural tinted glass
    this.glassReflectiveMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.1,
      metalness: 0.95,
    });

    // Louvered window texture (horizontal slatted glass/metal blades)
    this.louveredWindowMaterial = this.createLouveredMaterial();

    // Iron Balcony Railings
    this.ironRailingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.4,
    });

    // GeePee Water Tank (Black poly tank with yellow banding)
    this.waterTankBlackMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.45,
      metalness: 0.1,
    });

    // Air Conditioner Split Unit
    this.acUnitMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.35,
      metalness: 0.2,
    });

    // Air Conditioner Vent Grill
    this.acGrillMaterial = this.createACGrillMaterial();
  }

  private initGroundMaterials(): void {
    const { colorMap, bumpMap } = this.generateGrassGroundMaps();
    this.groundGrassMaterial = new THREE.MeshStandardMaterial({
      map: colorMap,
      bumpMap: bumpMap,
      bumpScale: 0.05,
      roughness: 0.9,
      metalness: 0.03,
    });
  }

  private generateGrassGroundMaps(): {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = bumpCanvas.width = size;
    colorCanvas.height = bumpCanvas.height = size;

    const ctx = colorCanvas.getContext('2d')!;
    const bCtx = bumpCanvas.getContext('2d')!;

    // Tropical grassy green base
    ctx.fillStyle = '#3a6630';
    ctx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Laterite red soil patches (typical Lagos roadside ground)
    for (let p = 0; p < 12; p++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const pr = Math.random() * 60 + 20;

      const grad = ctx.createRadialGradient(px, py, 5, px, py, pr);
      grad.addColorStop(0, 'rgba(138, 73, 40, 0.55)');
      grad.addColorStop(0.6, 'rgba(100, 60, 30, 0.25)');
      grad.addColorStop(1, 'rgba(58, 102, 48, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // High frequency grass blades and earth speckle
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const g = Math.floor(80 + Math.random() * 50);
      const r = Math.floor(45 + Math.random() * 30);
      ctx.fillStyle = `rgb(${r}, ${g}, 35)`;
      ctx.fillRect(x, y, 1.5, 1.5);

      bCtx.fillStyle = Math.random() > 0.5 ? '#989898' : '#686868';
      bCtx.fillRect(x, y, 1.5, 1.5);
    }

    const colorMap = createColorCanvasTexture(colorCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 18,
      repeatY: 18,
      anisotropy: 4,
    });

    const bumpMap = createDataCanvasTexture(bumpCanvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 18,
      repeatY: 18,
    });

    return { colorMap, bumpMap };
  }

  private createACGrillMaterial(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 128, 128);

    // Circular vent opening
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(64, 64, 48, 0, Math.PI * 2);
    ctx.fill();

    // Fan blades inside
    ctx.fillStyle = '#334155';
    for (let a = 0; a < 3; a++) {
      const angle = (a * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.arc(64, 64, 42, angle, angle + 0.6);
      ctx.closePath();
      ctx.fill();
    }

    // Outer grill slats
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    for (let y = 24; y <= 104; y += 10) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(104, y);
      ctx.stroke();
    }

    const texture = createColorCanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.3,
    });
  }

  private createLouveredMaterial(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Frosted coastal green-blue glass base
    ctx.fillStyle = '#2a4365';
    ctx.fillRect(0, 0, 128, 128);

    // Horizontal louver slats
    const slatH = 16;
    for (let y = 0; y < 128; y += slatH) {
      // Blade shadow
      ctx.fillStyle = '#1a202c';
      ctx.fillRect(0, y, 128, 3);

      // Blade reflection highlight
      ctx.fillStyle = '#4a7bb0';
      ctx.fillRect(0, y + 3, 128, slatH - 3);
    }

    const texture = createColorCanvasTexture(canvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 1,
      repeatY: 1,
    });

    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.2,
      metalness: 0.7,
    });
  }
}
