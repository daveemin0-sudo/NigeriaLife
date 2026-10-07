import * as THREE from 'three';
import { createColorCanvasTexture } from '../utils/TextureUtils';

/**
 * Procedural Signage and Textile Pattern Library for Lagos commercial streets.
 * Generates hand-painted artisan Nigerian shop signs, authentic Ankara wax print textures,
 * striped awnings, and municipal route boards.
 */
export class SignageLibrary {
  private static instance: SignageLibrary;

  public chopLifeSignMaterial!: THREE.MeshStandardMaterial;
  public beautySalonSignMaterial!: THREE.MeshStandardMaterial;
  public saboTextilesSignMaterial!: THREE.MeshStandardMaterial;
  public danfoTerminusSignMaterial!: THREE.MeshStandardMaterial;

  public greenStripedAwningMaterial!: THREE.MeshStandardMaterial;
  public yellowStripedAwningMaterial!: THREE.MeshStandardMaterial;
  public pinkStripedAwningMaterial!: THREE.MeshStandardMaterial;

  public ankaraFabrics: THREE.MeshStandardMaterial[] = [];

  private constructor() {
    this.initShopSignboards();
    this.initAwningMaterials();
    this.initAnkaraFabrics();
  }

  public static getInstance(): SignageLibrary {
    if (!SignageLibrary.instance) {
      SignageLibrary.instance = new SignageLibrary();
    }
    return SignageLibrary.instance;
  }

  // =========================================================================
  // 1. HAND-PAINTED LAGOS COMMERCIAL SHOP SIGNBOARDS
  // =========================================================================
  private initShopSignboards(): void {
    // A. Chop Life Restaurant (Mama Put Bukateria)
    this.chopLifeSignMaterial = this.createChopLifeSign();

    // B. Unique Beauty Salon & Spa
    this.beautySalonSignMaterial = this.createBeautySalonSign();

    // C. Sabo Textiles & Fabrics
    this.saboTextilesSignMaterial = this.createSaboTextilesSign();

    // D. Broad St Danfo Terminus Route Board
    this.danfoTerminusSignMaterial = this.createDanfoTerminusSign();
  }

  private createChopLifeSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Distressed warm yellow wooden board background
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 1024, 320);

    // Weathered board edge shading
    const grad = ctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, 'rgba(120, 53, 15, 0.45)');
    grad.addColorStop(0.1, 'rgba(245, 158, 11, 0)');
    grad.addColorStop(0.9, 'rgba(245, 158, 11, 0)');
    grad.addColorStop(1, 'rgba(120, 53, 15, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 320);

    // Hand-painted inner border
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, 992, 288);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4;
    ctx.strokeRect(26, 26, 972, 268);

    // Corner decorative rosettes
    const drawCornerStar = (x: number, y: number) => {
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCornerStar(36, 36);
    drawCornerStar(988, 36);
    drawCornerStar(36, 284);
    drawCornerStar(988, 284);

    // Top banner tag
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 24px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ 100% NATURAL FOODS • HOT SMOKY BUFFE ★', 512, 60);

    // Main Title: "CHOP LIFE RESTAURANT" in bold artisan hand-painted lettering
    const titleText = 'CHOP LIFE RESTAURANT';
    // 3D Drop shadow
    ctx.font = '900 68px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#450a0a';
    ctx.fillText(titleText, 516, 144);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillText(titleText, 514, 142);
    // Main fill
    ctx.fillStyle = '#dc2626';
    ctx.fillText(titleText, 512, 140);
    // Outline highlight
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeText(titleText, 512, 140);

    // Subtitle in Nigerian green
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.fillText('MAMA PUT • SPECIAL BUKATERIA • PARTY JOLLOF', 512, 192);

    // Specialties banner bar at bottom
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(40, 218, 944, 48);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SPICY ASUN • POUNDED YAM • EGUSI • CATFISH PEPPER SOUP • COLD DRINKS', 512, 250);

    // Chipped paint specks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
      const rx = Math.random() * 1000 + 12;
      const ry = Math.random() * 300 + 10;
      ctx.fillRect(rx, ry, Math.random() * 3 + 1, Math.random() * 3 + 1);
    }

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.05,
    });
  }

  private createBeautySalonSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Rich magenta to deep purple plum gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 320);
    bgGrad.addColorStop(0, '#581c87');
    bgGrad.addColorStop(0.5, '#701a75');
    bgGrad.addColorStop(1, '#831843');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 320);

    // Ornate gold border
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 992, 288);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(26, 26, 972, 268);

    // Golden sparkles
    ctx.fillStyle = '#fde047';
    ctx.font = '28px sans-serif';
    ctx.fillText('✨', 60, 70);
    ctx.fillText('✨', 940, 70);
    ctx.fillText('💅', 60, 260);
    ctx.fillText('💇‍♀️', 940, 260);

    // Top Tag
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOOKING GOOD IS GOOD BUSINESS', 512, 62);

    // Main Brand Name
    const title = 'UNIQUE BEAUTY SALON';
    ctx.font = '900 64px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = '#1e1b4b';
    ctx.fillText(title, 515, 142);
    ctx.fillStyle = '#facc15';
    ctx.fillText(title, 512, 138);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.strokeText(title, 512, 138);

    // Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText('& UNISEX EXECUTIVE SPA', 512, 185);

    // Specialties pills
    ctx.fillStyle = 'rgba(254, 240, 138, 0.18)';
    ctx.fillRect(50, 208, 924, 52);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, 208, 924, 52);

    ctx.fillStyle = '#fef9c3';
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('GHANA WEAVING • KNOTLESS BRAIDS • DREADLOCKS • WIG REVAMPING • ACRYLIC NAILS', 512, 241);

    // Contact bottom
    ctx.fillStyle = '#fde047';
    ctx.font = 'italic 16px Arial, sans-serif';
    ctx.fillText('BROAD STREET, LAGOS ISLAND • CALL/WHATSAPP: 0802-UNIQUE-EKO', 512, 290);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0.2,
    });
  }

  private createSaboTextilesSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Royal blue textile background
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 1024, 320);

    // Woven cross-hatch texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 0; x < 1024; x += 12) {
      ctx.fillRect(x, 0, 2, 320);
    }
    for (let y = 0; y < 320; y += 12) {
      ctx.fillRect(0, y, 1024, 2);
    }

    // Gold borders
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 9;
    ctx.strokeRect(16, 16, 992, 288);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(26, 26, 972, 268);

    // Header badge
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(280, 24, 464, 38);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '900 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIRECT IMPORTER • WHOLESALE & RETAIL', 512, 50);

    // Main Brand
    const title = 'SABO TEXTILES & FABRICS';
    ctx.font = '900 60px "Georgia", "Times New Roman", serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(title, 515, 142);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(title, 512, 138);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.strokeText(title, 512, 138);

    // Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText('BEST OF HOLLAND WAX, LACE & SENATOR MATERIALS', 512, 186);

    // Fabric categories bar
    ctx.fillStyle = '#b45309';
    ctx.fillRect(40, 212, 944, 46);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('SWISS VOILE LACE • GUINEA BROCADE • VINTAGE ANKARA • ATIKU • GEORGE • ASO-EBI', 512, 242);

    ctx.fillStyle = '#93c5fd';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('SPECIAL PACKS FOR WEDDINGS & BURIALS • WORLDWIDE SHIPPING', 512, 288);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.1,
    });
  }

  private createDanfoTerminusSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // White municipal enamel board
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1024, 256);

    // Danfo Yellow & Black chevron header bar
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1024, 56);

    ctx.fillStyle = '#18181b';
    ctx.font = '900 24px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAGOS STATE TRANSPORT AUTHORITY • ROAD TRANSPORT UNION (NURTW)', 512, 38);

    // Dark border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 1016, 248);

    // Main Station Header
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 44px Impact, "Arial Black", sans-serif';
    ctx.fillText('BROAD ST. DANFO & BRT MOTOR PARK', 512, 114);

    // Route Destinations Pill
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(40, 136, 944, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px "Arial Black", Impact, sans-serif';
    ctx.fillText('ROUTE: OSHODI ⇄ MARYLAND ⇄ OJUELEGBA ⇄ CMS ⇄ LEKKI ⇄ AJAH', 512, 172);

    // Commuter Notice
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('HOLD YOUR EXACT FARE • NO LOITERING • QUEUE BEFORE ENTERING BUS', 512, 224);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.15,
    });
  }

  // =========================================================================
  // 2. STRIPED AWNING FABRIC MATERIALS
  // =========================================================================
  private initAwningMaterials(): void {
    this.greenStripedAwningMaterial = this.generateAwningTexture('#008751', '#ffffff');
    this.yellowStripedAwningMaterial = this.generateAwningTexture('#eab308', '#ffffff');
    this.pinkStripedAwningMaterial = this.generateAwningTexture('#db2777', '#ffffff');
  }

  private generateAwningTexture(stripeColor: string, bgColor: string): THREE.MeshStandardMaterial {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Bold vertical awning stripes
    const stripeW = 64;
    ctx.fillStyle = stripeColor;
    for (let x = 0; x < size; x += stripeW * 2) {
      ctx.fillRect(x, 0, stripeW, size);
    }

    // Fabric weave texture overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let y = 0; y < size; y += 4) {
      ctx.fillRect(0, y, size, 1.5);
    }

    const texture = createColorCanvasTexture(canvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 1,
    });

    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.75,
      metalness: 0.05,
    });
  }

  // =========================================================================
  // 3. ANKARA WAX PRINT FABRIC ROLLS (For Sabo Textiles Display Stalls)
  // =========================================================================
  private initAnkaraFabrics(): void {
    // 1. Royal Indigo & Golden Rosettes
    this.ankaraFabrics.push(this.createAnkaraPattern1());
    // 2. Crimson & Marigold Geometric Diamonds
    this.ankaraFabrics.push(this.createAnkaraPattern2());
    // 3. Emerald & Ochre Peacock Fans
    this.ankaraFabrics.push(this.createAnkaraPattern3());
    // 4. Turquoise & Tangerine African Chevrons
    this.ankaraFabrics.push(this.createAnkaraPattern4());
  }

  private createAnkaraPattern1(): THREE.MeshStandardMaterial {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e3a8a'; // Deep Indigo
    ctx.fillRect(0, 0, size, size);

    // Golden sunburst rosettes
    const drawRosette = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Petal rays
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
        ctx.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
    };

    drawRosette(64, 64, 38);
    drawRosette(192, 192, 38);
    drawRosette(192, 64, 24);
    drawRosette(64, 192, 24);

    const texture = createColorCanvasTexture(canvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 1,
    });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.02 });
  }

  private createAnkaraPattern2(): THREE.MeshStandardMaterial {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#b91c1c'; // Rich Red
    ctx.fillRect(0, 0, size, size);

    // Interlocking African wax diamonds
    const drawDiamond = (cx: number, cy: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h / 2);
      ctx.lineTo(cx + w / 2, cy);
      ctx.lineTo(cx, cy + h / 2);
      ctx.lineTo(cx - w / 2, cy);
      ctx.closePath();
      ctx.fill();
    };

    for (let x = 0; x <= size; x += 64) {
      for (let y = 0; y <= size; y += 64) {
        drawDiamond(x, y, 60, 60, '#facc15');
        drawDiamond(x, y, 40, 40, '#15803d');
        drawDiamond(x, y, 20, 20, '#ffffff');
      }
    }

    const texture = createColorCanvasTexture(canvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 1,
    });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.02 });
  }

  private createAnkaraPattern3(): THREE.MeshStandardMaterial {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#065f46'; // Forest Emerald
    ctx.fillRect(0, 0, size, size);

    // Concentric peacock fans
    for (let x = 0; x <= size; x += 80) {
      for (let y = 0; y <= size; y += 80) {
        for (let r = 50; r > 10; r -= 12) {
          ctx.strokeStyle = r % 24 === 0 ? '#fbbf24' : '#f97316';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI, false);
          ctx.stroke();
        }
      }
    }

    const texture = createColorCanvasTexture(canvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 1,
    });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.02 });
  }

  private createAnkaraPattern4(): THREE.MeshStandardMaterial {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f766e'; // Teal
    ctx.fillRect(0, 0, size, size);

    // Chevron zigzags
    ctx.strokeStyle = '#ea580c'; // Tangerine
    ctx.lineWidth = 8;
    for (let y = 0; y < size; y += 32) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 32) {
        const peak = (x / 32) % 2 === 0 ? y - 12 : y + 12;
        if (x === 0) ctx.moveTo(x, peak);
        else ctx.lineTo(x, peak);
      }
      ctx.stroke();
    }

    const texture = createColorCanvasTexture(canvas, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      repeatX: 2,
      repeatY: 1,
    });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.02 });
  }
}
