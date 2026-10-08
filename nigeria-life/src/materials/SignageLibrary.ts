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

  // Living City 1.0 Authentic Storefront & Infrastructure Signs
  public victoryPhonesSignMaterial!: THREE.MeshStandardMaterial;
  public supremeCourtPharmacyMaterial!: THREE.MeshStandardMaterial;
  public mtnServiceCentreMaterial!: THREE.MeshStandardMaterial;
  public lagosBarbershopMaterial!: THREE.MeshStandardMaterial;
  public pedestrianBridgeBillboardMaterial!: THREE.MeshStandardMaterial;
  public pedestrianBridgeWarningMaterial!: THREE.MeshStandardMaterial;
  public laspppaConstructionSignMaterial!: THREE.MeshStandardMaterial;

  public greenStripedAwningMaterial!: THREE.MeshStandardMaterial;
  public yellowStripedAwningMaterial!: THREE.MeshStandardMaterial;
  public pinkStripedAwningMaterial!: THREE.MeshStandardMaterial;

  public danfoSideStripeMaterial!: THREE.MeshStandardMaterial;
  public danfoRearSloganMaterial!: THREE.MeshStandardMaterial;
  public danfoVisorMaterial!: THREE.MeshStandardMaterial;

  public ankaraFabrics: THREE.MeshStandardMaterial[] = [];

  private constructor() {
    this.initShopSignboards();
    this.initAwningMaterials();
    this.initVehicleDecals();
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

    // E. Living City 1.0 Storefronts
    this.victoryPhonesSignMaterial = this.createVictoryPhonesSign();
    this.supremeCourtPharmacyMaterial = this.createSupremeCourtPharmacySign();
    this.mtnServiceCentreMaterial = this.createMtnServiceCentreSign();
    this.lagosBarbershopMaterial = this.createLagosBarbershopSign();

    // F. Infrastructure & Construction
    this.pedestrianBridgeBillboardMaterial = this.createPedestrianBridgeBillboard();
    this.pedestrianBridgeWarningMaterial = this.createPedestrianBridgeWarning();
    this.laspppaConstructionSignMaterial = this.createLaspppaConstructionSign();
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

  private createVictoryPhonesSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Vibrant red glossy fascia board
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 1024, 256);

    // Subtle brushed metallic highlights
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    // White outline border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 1000, 232);

    // Top subtitle
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ AUTHORIZED SALES & REPAIR HUB • IPHONE • SAMSUNG • LAPTOPS ★', 512, 48);

    // Main brand title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px "Impact", "Arial Black", sans-serif';
    ctx.fillText('VICTORY PHONES & LAPTOPS', 512, 138);

    // Bottom banner
    ctx.fillStyle = '#111827';
    ctx.fillRect(24, 172, 976, 56);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 24px "Arial Black", sans-serif';
    ctx.fillText('IPHONES • MACBOOKS • SCREEN REPLACEMENT • ORIGINAL CHARGERS • AIRPODS', 512, 208);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.2 });
  }

  private createSupremeCourtPharmacySign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep medical royal blue background
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 1024, 256);

    // White border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 1004, 236);

    // Green medical cross on left and right
    const drawCross = (cx: number, cy: number) => {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(cx - 30, cy - 10, 60, 20);
      ctx.fillRect(cx - 10, cy - 30, 20, 60);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 30, cy - 10, 60, 20);
      ctx.strokeRect(cx - 10, cy - 30, 20, 60);
    };
    drawCross(80, 128);
    drawCross(944, 128);

    // Subtitle
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RC: 294018 • REGISTERED PHARMACY COUNCIL OF NIGERIA', 512, 45);

    // Brand Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 60px "Impact", "Arial Black", sans-serif';
    ctx.fillText('SUPREME COURT PHARMACY', 512, 125);

    // Bottom service banner
    ctx.fillStyle = '#facc15';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.fillText('GENUINE DRUGS • BLOOD PRESSURE & SUGAR TEST • 24 HOURS SERVICE', 512, 195);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.1 });
  }

  private createMtnServiceCentreSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Signature MTN Yellow
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, 1024, 256);

    // Blue oval logo container
    ctx.fillStyle = '#002b49';
    ctx.beginPath();
    ctx.ellipse(512, 75, 140, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // MTN text
    ctx.fillStyle = '#ffcc00';
    ctx.font = '900 48px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MTN', 512, 92);

    // Brand label
    ctx.fillStyle = '#002b49';
    ctx.font = '900 52px "Arial Black", sans-serif';
    ctx.fillText('CONNECT SERVICE CENTRE', 512, 175);

    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText('SIM REGISTRATION • 5G BROADBAND ROUTERS • DATA & AIRTIME RECHARGE', 512, 220);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.1 });
  }

  private createLagosBarbershopSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Dark sleek chalkboard black
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 1024, 256);

    // Classic barber stripes on top and bottom border
    const stripeW = 24;
    for (let x = 0; x < 1024; x += stripeW * 3) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, 0, stripeW, 16);
      ctx.fillRect(x, 240, stripeW, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + stripeW, 0, stripeW, 16);
      ctx.fillRect(x + stripeW, 240, stripeW, 16);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + stripeW * 2, 0, stripeW, 16);
      ctx.fillRect(x + stripeW * 2, 240, stripeW, 16);
    }

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✂️ EXECUTIVE GROOMING LOUNGE • AIR-CONDITIONED ✂️', 512, 54);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 70px "Impact", "Arial Black", sans-serif';
    ctx.fillText('LAGOS BARBERSHOP', 512, 140);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('SHARP LOW CUT • WAVES • BEARD DYE • KIDS HAIRCUT • HOT TOWEL MASSAGE', 512, 200);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4, metalness: 0.1 });
  }

  private createPedestrianBridgeBillboard(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Modern Nigerian digital media billboard: NLGTV
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 1024, 256);

    // High tech cyan and gold grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }

    // Bold media banner
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(32, 24, 240, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LLTV / NLG', 152, 65);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NIGERIA LIFE TELEVISION • LIVE BROADCAST 24/7', 300, 60);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 58px "Impact", "Arial Black", sans-serif';
    ctx.fillText('LAGOS LIFE: THE LIVING CITY', 300, 138);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('STREAM AFROBEATS • LIVE EVENTS • REAL-TIME CITY RADIO • DIAL 99.3 FM', 300, 195);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.25, metalness: 0.2 });
  }

  private createPedestrianBridgeWarning(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Highway safety caution yellow background
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1024, 256);

    // Hazard warning diagonal black chevrons on top and bottom borders
    const chW = 40;
    for (let x = -chW; x < 1024 + chW; x += chW * 2) {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x, 24);
      ctx.lineTo(x - 20, 24);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, 232);
      ctx.lineTo(x + 20, 232);
      ctx.lineTo(x, 256);
      ctx.lineTo(x - 20, 256);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 32px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ LAGOS STATE MINISTRY OF TRANSPORTATION (LASTMA) ⚠️', 512, 68);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 50px "Impact", "Arial Black", sans-serif';
    ctx.fillText('USE THE BRIDGE. LAGOS DRIVERS NO DEY WAIT.', 512, 145);

    ctx.fillStyle = '#b91c1c';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.fillText('DO NOT DASH ACROSS HIGHWAY • JAYWALKING PROHIBITED • SAFETY FIRST', 512, 205);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.05 });
  }

  private createLaspppaConstructionSign(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Clean white billboard with red and green header
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 768, 512);

    // Green header bar
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 768, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAGOS STATE PHYSICAL PLANNING PERMIT AUTHORITY (LASPPPA)', 384, 44);

    // Permit Status
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 38px "Impact", "Arial Black", sans-serif';
    ctx.fillText('DEVELOPMENT IN PROGRESS', 384, 135);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 160, 704, 250);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PROJECT: 4-STOREY COMMERCIAL PLAZA & RESIDENCES', 50, 200);
    ctx.fillText('PLANNING PERMIT NO: LPPA/2026/CZ-8491/APP', 50, 240);
    ctx.fillText('DEVELOPER: EKO MEGA INFRASTRUCTURE LTD', 50, 280);
    ctx.fillText('CONTRACTOR: GLO-CONSTRUCT NIG PLC', 50, 320);
    ctx.fillText('SAFETY OFFICER: ENGR. ADEBAYO BABATUNDE (COREN)', 50, 360);

    // Caution footer
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 440, 768, 72);
    ctx.fillStyle = '#000000';
    ctx.font = '900 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ CAUTION: MEN AT WORK • HARD HATS & BOOTS COMPULSORY', 384, 484);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.05 });
  }
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

  // =========================================================================
  // 4. DANFO MINIBUS LIVERY & ROUTE DECALS
  // =========================================================================
  private initVehicleDecals(): void {
    this.danfoSideStripeMaterial = this.createDanfoSideStripe();
    this.danfoRearSloganMaterial = this.createDanfoRearSlogan();
    this.danfoVisorMaterial = this.createDanfoVisor();
  }

  private createDanfoSideStripe(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Danfo bright yellow base
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1024, 128);

    // Twin bold black stripes
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 16, 1024, 38);
    ctx.fillRect(0, 74, 1024, 38);

    // Stencil text in white on the black stripe
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CMS ⇄ YABA ⇄ TEJUOSHO ⇄ OJUELEGBA ⇄ OSHODI', 512, 42);
    ctx.fillText('FEDERAL REPUBLIC OF NIGERIA • LAGOS STATE COMMUTER BUS', 512, 100);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.1,
    });
  }

  private createDanfoRearSlogan(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 512, 128);

    // Yellow registration plate
    ctx.fillStyle = '#facc15';
    ctx.fillRect(136, 18, 240, 48);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(136, 18, 240, 48);

    ctx.fillStyle = '#000000';
    ctx.font = '900 28px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EKO - 429 - BDG', 256, 52);

    // Famous rear slogan in red & white
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px "Arial Black", sans-serif';
    ctx.fillText('NO CONDITION IS PERMANENT', 256, 96);
    ctx.fillStyle = '#facc15';
    ctx.font = 'italic bold 14px Arial, sans-serif';
    ctx.fillText('• ALHAMDULILLAH • EKO ONI BAJE •', 256, 116);

    const texture = createColorCanvasTexture(canvas, { anisotropy: 4 });
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.1,
    });
  }

  private createDanfoVisor(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Green & white sun visor banner
    ctx.fillStyle = '#008751';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 20, 512, 24);

    ctx.fillStyle = '#008751';
    ctx.font = '900 18px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ BROAD STREET EXPRESS ★ DIRECT ★', 256, 38);

    const texture = createColorCanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
      metalness: 0.2,
    });
  }
}
