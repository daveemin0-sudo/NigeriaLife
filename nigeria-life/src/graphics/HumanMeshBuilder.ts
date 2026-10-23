import * as THREE from 'three';

export type Gender = 'male' | 'female';

export type Hairstyle = 
  | 'short_crop' 
  | 'fade' 
  | 'afro' 
  | 'braids' 
  | 'bob_wig' 
  | 'ponytail' 
  | 'hardhat' 
  | 'fila' 
  | 'gele'
  | 'pilot_cap'
  | 'police_cap'
  | 'chef_toque';

export type Outfit = 
  | 'engineer_vest' 
  | 'senator' 
  | 'blue_dress' 
  | 'peplum_skirt' 
  | 'casual_tee' 
  | 'casual_blouse'
  | 'doctor_coat'
  | 'nurse_scrubs'
  | 'pilot_uniform'
  | 'security_uniform'
  | 'student_casual'
  | 'lecturer_suit'
  | 'chef_attire'
  | 'mechanic_overalls'
  | 'traffic_warden'
  | 'agbada';

export interface HumanConfig {
  gender: Gender;
  username: string;
  skinTone?: string;
  hairColor?: string;
  hairstyle?: Hairstyle;
  outfit?: Outfit;
  outfitColor?: number;
  secondaryColor?: number;
  trousersColor?: number;
  shoeColor?: number;
  shoeStyle?: 'loafers' | 'sneakers' | 'oxfords' | 'boots' | 'sandals' | 'heels';
  bagStyle?: 'none' | 'crossbody' | 'briefcase' | 'backpack' | 'clutch';
  bagColor?: number;
  heightScale?: number;
  hasStethoscope?: boolean;
  hasTie?: boolean;
  hasBackpack?: boolean;
  hasTray?: boolean;
  hasShades?: boolean;
  hasGoldChain?: boolean;
  hasCoralBeads?: boolean;
  lod?: 'detailed' | 'street';
}

export interface HumanRig {
  group: THREE.Group;
  gender: Gender;
  username: string;
  nameTag: THREE.Sprite;
  head: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  materials: THREE.Material[];
  updateAnimation: (time: number, animState?: boolean | string) => void;
  phoneMesh?: THREE.Mesh;
  // Sub-articular limb nodes for high-fidelity kinematics
  leftForearm?: THREE.Group;
  rightForearm?: THREE.Group;
  leftLowerLeg?: THREE.Group;
  rightLowerLeg?: THREE.Group;
}

const agbadaBibTextureCache = new Map<string, THREE.CanvasTexture>();
const asoOkeTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Procedural authentic Aso-Oke woven textile texture.
 * Generates rich vertical woven stripes with micro-cloth thread weave.
 */
function getOrCreateAsoOkeTexture(baseHex: number, stripeHex: number): THREE.Texture {
  const cacheKey = `asooke_${baseHex}_${stripeHex}`;
  if (asoOkeTextureCache.has(cacheKey)) return asoOkeTextureCache.get(cacheKey)!;
  if (typeof document === 'undefined') return new THREE.Texture();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseColor = `#${(baseHex & 0xffffff).toString(16).padStart(6, '0')}`;
  const stripeColor = `#${(stripeHex & 0xffffff).toString(16).padStart(6, '0')}`;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Vertical Aso-Oke woven stripes
  const stripeWidths = [20, 10, 36, 14, 28, 8];
  let curX = 0;
  let idx = 0;
  while (curX < 512) {
    const w = stripeWidths[idx % stripeWidths.length];
    if (idx % 2 === 1) {
      ctx.fillStyle = stripeColor;
      ctx.fillRect(curX, 0, w, 512);
    } else if (idx % 4 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.40)'; // Crisp white accent stripe
      ctx.fillRect(curX, 0, Math.max(3, w * 0.35), 512);
    }
    curX += w + 6;
    idx++;
  }

  // Fine horizontal weft thread texture for authentic textile weave
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < 512; y += 3) {
    ctx.fillRect(0, y, 512, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  asoOkeTextureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Procedural authentic Nigerian Agbada chest embroidery plaque (Meander / Labyrinth Fretwork).
 * Directly matches the premium cultural reference in Reference 2.
 */
function getOrCreateAgbadaBibTexture(colorHex: number): THREE.Texture {
  const cacheKey = `agbada_bib_${colorHex}`;
  if (agbadaBibTextureCache.has(cacheKey)) return agbadaBibTextureCache.get(cacheKey)!;
  if (typeof document === 'undefined') return new THREE.Texture();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Crisp white/cream silk background fabric (Reference 2)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-weave fabric grain
  ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
  for (let x = 0; x < 512; x += 4) {
    ctx.fillRect(x, 0, 2, 512);
  }

  const threadColor = `#${(colorHex & 0xffffff).toString(16).padStart(6, '0')}`;

  // Outer embroidered border in dark silk thread + gold metallic trim
  ctx.strokeStyle = threadColor;
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.strokeRect(36, 26, 440, 460);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 8;
  ctx.strokeRect(58, 48, 396, 416);

  // African Geometric Meander / Labyrinth Fretwork (Reference 2)
  ctx.strokeStyle = threadColor;
  ctx.lineWidth = 14;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  // Upper labyrinth quadrant
  ctx.beginPath();
  // Left key
  ctx.moveTo(110, 110);
  ctx.lineTo(220, 110);
  ctx.lineTo(220, 220);
  ctx.lineTo(150, 220);
  ctx.lineTo(150, 160);
  ctx.lineTo(185, 160);
  // Right key (mirrored)
  ctx.moveTo(402, 110);
  ctx.lineTo(292, 110);
  ctx.lineTo(292, 220);
  ctx.lineTo(362, 220);
  ctx.lineTo(362, 160);
  ctx.lineTo(327, 160);
  ctx.stroke();

  // Center gold emblem divider
  ctx.fillStyle = '#facc15';
  ctx.fillRect(240, 90, 32, 140);

  // Lower labyrinth quadrant (mirrored)
  ctx.strokeStyle = threadColor;
  ctx.beginPath();
  ctx.moveTo(110, 402);
  ctx.lineTo(220, 402);
  ctx.lineTo(220, 292);
  ctx.lineTo(150, 292);
  ctx.lineTo(150, 352);
  ctx.lineTo(185, 352);

  ctx.moveTo(402, 402);
  ctx.lineTo(292, 402);
  ctx.lineTo(292, 292);
  ctx.lineTo(362, 292);
  ctx.lineTo(362, 352);
  ctx.lineTo(327, 352);
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.fillRect(240, 282, 32, 140);

  // Center medallion diamond
  ctx.fillStyle = threadColor;
  ctx.beginPath();
  ctx.moveTo(256, 230);
  ctx.lineTo(286, 256);
  ctx.lineTo(256, 282);
  ctx.lineTo(226, 256);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  agbadaBibTextureCache.set(cacheKey, texture);
  return texture;
}



/**
 * HumanMeshBuilder
 * Constructs realistic, stylized anatomical human figures for NigeriaLife.
 * Features 8-head proportions, distinct masculine/feminine silhouettes,
 * sculpted facial features (eyes, eyelids, eyebrows, nose with nostrils, lips, ears),
 * articulated limbs with elbows and knees, hands with distinct palms, thumbs, and 4 fingers,
 * realistic footwear with soles, and authentic Nigerian cultural attire.
 */
export class HumanMeshBuilder {
  public static createHuman(config: HumanConfig): HumanRig {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];

    const isFemale = config.gender === 'female';
    const skinHex = config.skinTone || (isFemale ? '#5c3722' : '#4a2c1d');
    
    // PBR Skin material with subtle specular & warm melanin undertones
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinHex),
      roughness: 0.62,
      metalness: 0.04,
    });
    materials.push(skinMat);

    const isDoctor = config.outfit === 'doctor_coat';
    const outfitColor = isDoctor
      ? 0x0891b2 // Professional Hospital Teal Medical Scrubs
      : (config.outfitColor ?? (isFemale ? 0x2563eb : 0xf97316));
    const secondaryColor = config.secondaryColor ?? (isFemale ? 0x1e3a8a : 0x059669);

    const clothingMat = new THREE.MeshStandardMaterial({
      color: outfitColor,
      roughness: 0.65,
      metalness: 0.05,
    });
    materials.push(clothingMat);

    const secondaryClothingMat = new THREE.MeshStandardMaterial({
      color: secondaryColor,
      roughness: 0.65,
      metalness: 0.05,
    });
    materials.push(secondaryClothingMat);

    const trousersMat = new THREE.MeshStandardMaterial({
      color: isDoctor ? 0x0e7490 : (config.trousersColor ?? (isFemale ? 0x1e293b : 0xea580c)),
      roughness: 0.72,
    });
    materials.push(trousersMat);

    // Shoe leather / rubber sole material
    const defaultShoeColor = (isFemale && config.outfit === 'blue_dress') ? 0xdc2626 : 0x18181b;
    const shoeMat = new THREE.MeshStandardMaterial({
      color: config.shoeColor ?? defaultShoeColor,
      roughness: config.shoeStyle === 'loafers' || config.shoeStyle === 'oxfords' ? 0.25 : 0.45,
      metalness: config.shoeStyle === 'loafers' ? 0.25 : 0.1,
    });
    materials.push(shoeMat);

    const defaultSoleColor = config.shoeStyle === 'sneakers' ? 0xf8fafc : 0x09090b;
    const soleMat = new THREE.MeshStandardMaterial({
      color: defaultSoleColor,
      roughness: 0.85,
    });
    materials.push(soleMat);

    // Facial feature shared materials
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.25 }); // African warm amber-brown iris
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 });
    const browMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const lipMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinHex).multiplyScalar(0.72).add(new THREE.Color(0x2d0d0d)),
      roughness: 0.45,
    });
    materials.push(eyeWhiteMat, irisMat, pupilMat, browMat, lipMat);

    // Subtle soft ambient ground contact shadow
    const shadowGeo = new THREE.CircleGeometry(0.55, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
    });
    materials.push(shadowMat);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    group.add(shadowMesh);

    // Neck dimensions
    const neckRadius = isFemale ? 0.065 : 0.082;

    // =========================================================================
    // 1. TORSO (ANATOMICAL SHAPING: MASCULINE VS FEMININE)
    // =========================================================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = isFemale ? 1.05 : 1.1;
    group.add(torsoGroup);

    if (isFemale) {
      // FEMININE ANATOMY: Tapered ribcage, bust contour, nipped waist, flared hips
      // A. Upper Chest
      const chestGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.32, 16);
      chestGeo.scale(1.18, 1, 0.86);
      const chestMesh = new THREE.Mesh(chestGeo, clothingMat);
      chestMesh.position.set(0, 0.18, 0);
      chestMesh.castShadow = true;
      torsoGroup.add(chestMesh);

      // Anatomical bust curves
      const bustGeo = new THREE.SphereGeometry(0.095, 12, 10);
      const leftBust = new THREE.Mesh(bustGeo, clothingMat);
      leftBust.position.set(-0.088, 0.165, 0.115);
      leftBust.scale.set(1.05, 0.95, 1.15);
      torsoGroup.add(leftBust);

      const rightBust = new THREE.Mesh(bustGeo, clothingMat);
      rightBust.position.set(0.088, 0.165, 0.115);
      rightBust.scale.set(1.05, 0.95, 1.15);
      torsoGroup.add(rightBust);

      // B. Slender Nipped Waist
      const waistGeo = new THREE.CylinderGeometry(0.138, 0.168, 0.22, 16);
      waistGeo.scale(1.1, 1, 0.82);
      const waistMesh = new THREE.Mesh(waistGeo, clothingMat);
      waistMesh.position.set(0, -0.075, 0);
      torsoGroup.add(waistMesh);

      // C. Curvaceous Pelvis & Hips
      const hipsGeo = new THREE.CylinderGeometry(0.168, 0.22, 0.24, 16);
      hipsGeo.scale(1.24, 1, 0.88);
      const hipsMesh = new THREE.Mesh(hipsGeo, config.outfit === 'blue_dress' ? clothingMat : trousersMat);
      hipsMesh.position.set(0, -0.27, 0);
      torsoGroup.add(hipsMesh);

      // D. Flared Skirt Hem for dresses
      if (config.outfit === 'blue_dress' || !config.outfit) {
        const dressSkirtGeo = new THREE.ConeGeometry(0.33, 0.44, 20, 1, true);
        const dressSkirt = new THREE.Mesh(dressSkirtGeo, clothingMat);
        dressSkirt.position.set(0, -0.42, 0);
        torsoGroup.add(dressSkirt);
      }
    } else {
      // MASCULINE ANATOMY: Broad deltoid shoulders, athletic V-taper chest, straight waist
      // A. Broad Pectoral Chest
      const chestGeo = new THREE.CylinderGeometry(0.24, 0.20, 0.36, 16);
      chestGeo.scale(1.22, 1, 0.78);
      const chestMesh = new THREE.Mesh(chestGeo, clothingMat);
      chestMesh.position.set(0, 0.18, 0);
      chestMesh.castShadow = true;
      torsoGroup.add(chestMesh);

      // Anatomical sculpted pectorals (smooth curves, no flat boxes)
      const pecMat = new THREE.MeshStandardMaterial({
        color: outfitColor,
        roughness: 0.62,
      });
      materials.push(pecMat);
      for (const px of [-0.09, 0.09]) {
        const pec = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), pecMat);
        pec.scale.set(1.2, 0.85, 0.65);
        pec.position.set(px, 0.20, 0.09);
        torsoGroup.add(pec);
      }

      // B. Athletic Waist & Abdomen
      const waistGeo = new THREE.CylinderGeometry(0.19, 0.21, 0.26, 16);
      waistGeo.scale(1.14, 1, 0.8);
      const waistMesh = new THREE.Mesh(waistGeo, clothingMat);
      waistMesh.position.set(0, -0.11, 0);
      torsoGroup.add(waistMesh);

      // C. Pelvis & Belt Line
      const hipsGeo = new THREE.CylinderGeometry(0.21, 0.22, 0.20, 16);
      hipsGeo.scale(1.14, 1, 0.82);
      const hipsMesh = new THREE.Mesh(hipsGeo, trousersMat);
      hipsMesh.position.set(0, -0.32, 0);
      torsoGroup.add(hipsMesh);

      // Belt with buckle
      const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
      );
      belt.scale.set(1.15, 1, 0.84);
      belt.position.set(0, -0.23, 0);
      torsoGroup.add(belt);

      const buckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 })
      );
      buckle.position.set(0, -0.23, 0.18);
      torsoGroup.add(buckle);

      // D. High-Visibility Safety Vest for Engineers
      if (config.outfit === 'engineer_vest') {
        const vestMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });
        materials.push(vestMat);
        const stripeMat = new THREE.MeshStandardMaterial({
          color: 0xecfccb,
          emissive: 0xecfccb,
          emissiveIntensity: 0.4,
          roughness: 0.2,
        });
        materials.push(stripeMat);

        // Torso vest panels
        const vestPanelL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.03), vestMat);
        vestPanelL.position.set(-0.12, 0.16, 0.11);
        torsoGroup.add(vestPanelL);

        const vestPanelR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.03), vestMat);
        vestPanelR.position.set(0.12, 0.16, 0.11);
        torsoGroup.add(vestPanelR);

        // Reflective silver/lime horizontal stripes
        const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.23), stripeMat);
        stripe1.position.set(0, 0.24, 0);
        torsoGroup.add(stripe1);

        const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.23), stripeMat);
        stripe2.position.set(0, 0.06, 0);
        torsoGroup.add(stripe2);

        // Vertical reflective shoulder suspenders
        for (const sx of [-0.14, 0.14]) {
          const susp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.40, 0.24), stripeMat);
          susp.position.set(sx, 0.16, 0);
          torsoGroup.add(susp);
        }
      }
    }

    // =========================================================================
    // OCCUPATION & CULTURAL ATTIRE OVERLAYS
    // =========================================================================
    if (config.outfit === 'agbada') {
      // Grand flowing Nigerian Agbada outer robe with authentic Aso-Oke woven textile & geometric fretwork embroidery
      const agbadaBaseColor = config.outfitColor ?? 0x047857;
      const asoOkeTex = getOrCreateAsoOkeTexture(agbadaBaseColor, 0x1e3a8a);
      const agbadaMat = new THREE.MeshStandardMaterial({
        color: agbadaBaseColor,
        map: asoOkeTex,
        roughness: 0.65,
        metalness: 0.04,
      });
      materials.push(agbadaMat);

      // High-collared white inner tunic collar visible at neck base (Reference 2)
      const innerCollarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
      materials.push(innerCollarMat);
      const innerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.098, 0.09, 18), innerCollarMat);
      innerCollar.position.set(0, 0.32, 0);
      torsoGroup.add(innerCollar);

      // Main flowing robe mantle
      const robeGeo = new THREE.CylinderGeometry(0.35, 0.44, 0.88, 18);
      robeGeo.scale(1.22, 1, 0.68);
      const robe = new THREE.Mesh(robeGeo, agbadaMat);
      robe.position.set(0, -0.06, 0);
      robe.castShadow = true;
      torsoGroup.add(robe);

      // Draped Agbada Shoulder Wings extending wide across both shoulders
      for (const sx of [-0.36, 0.36]) {
        const wingGeo = new THREE.CylinderGeometry(0.14, 0.22, 0.56, 14);
        wingGeo.scale(1.35, 1, 0.72);
        const wing = new THREE.Mesh(wingGeo, agbadaMat);
        wing.rotation.z = sx > 0 ? -0.38 : 0.38;
        wing.position.set(sx, 0.16, 0);
        torsoGroup.add(wing);
      }

      // Authentic Geometric Meander / Labyrinth Fretwork Embroidery Bib Plaque (Reference 2)
      // Positioned firmly on the outer front surface of the robe (z = 0.260)
      const bibTex = getOrCreateAgbadaBibTexture(agbadaBaseColor);
      const bibMat = new THREE.MeshStandardMaterial({
        map: bibTex,
        roughness: 0.45,
        metalness: 0.10,
      });
      materials.push(bibMat);

      const bibGeo = new THREE.BoxGeometry(0.25, 0.35, 0.02);
      const bib = new THREE.Mesh(bibGeo, bibMat);
      bib.position.set(0, 0.12, 0.260);
      torsoGroup.add(bib);

      // 3D Raised gold embroidered border frame around the bib
      const frameMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.80, roughness: 0.22 });
      materials.push(frameMat);
      const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.02, 0.025), frameMat);
      frameTop.position.set(0, 0.30, 0.268);
      torsoGroup.add(frameTop);
      const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.02, 0.025), frameMat);
      frameBottom.position.set(0, -0.06, 0.268);
      torsoGroup.add(frameBottom);
      for (const fx of [-0.135, 0.135]) {
        const frameSide = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.025), frameMat);
        frameSide.position.set(fx, 0.12, 0.268);
        torsoGroup.add(frameSide);
      }
    } else if (config.outfit === 'senator') {
      // Modern Lagos Senator Tunic: tailored standing mandarin collar, gold bar pin, and welt pocket
      const senatorMat = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.58 });
      materials.push(senatorMat);
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
      materials.push(goldTrimMat);

      // Standing mandarin collar
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.102, 0.065, 16), senatorMat);
      collar.position.set(0, 0.34, 0.01);
      torsoGroup.add(collar);

      // Gold collar bar pin bridging the throat
      const collarPin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8), goldTrimMat);
      collarPin.rotation.z = Math.PI / 2;
      collarPin.position.set(0, 0.34, 0.112);
      torsoGroup.add(collarPin);

      // Left breast pocket with gold pocket square
      const pocketFlap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.028, 0.02), senatorMat);
      pocketFlap.position.set(-0.12, 0.22, 0.12);
      torsoGroup.add(pocketFlap);
      const square = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.015), goldTrimMat);
      square.position.set(-0.12, 0.235, 0.122);
      torsoGroup.add(square);

      // Vertical center button placket
      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.44, 0.015), senatorMat);
      placket.position.set(0, 0.10, 0.12);
      torsoGroup.add(placket);
      for (let b = 0; b < 4; b++) {
        const button = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 8), goldTrimMat);
        button.rotation.x = Math.PI / 2;
        button.position.set(0, 0.24 - b * 0.08, 0.128);
        torsoGroup.add(button);
      }
    } else if (config.outfit === 'traffic_warden') {
      // Official Lagos State LASTMA Traffic Warden Uniform
      // High-visibility yellow shirt with dark epaulets, chest pockets & black tie
      const epauletMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
      materials.push(epauletMat);
      for (const sx of [-0.22, 0.22]) {
        const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.16), epauletMat);
        epaulet.position.set(sx, 0.34, 0);
        torsoGroup.add(epaulet);
      }

      // Two chest pockets with flaps
      for (const px of [-0.11, 0.11]) {
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.015), clothingMat);
        pocket.position.set(px, 0.20, 0.13);
        torsoGroup.add(pocket);
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.025, 0.02), epauletMat);
        flap.position.set(px, 0.245, 0.135);
        torsoGroup.add(flap);
      }

      // Black tie
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.02), epauletMat);
      tie.position.set(0, 0.16, 0.135);
    } else if (config.outfit === 'doctor_coat') {
      // Clinical Tailored Lab Coat
      const coatMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
      materials.push(coatMat);

      // Open lab coat mantle wrapping the torso
      const coatMantle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.22, 0.44, 16, 1, true, Math.PI * 0.18, Math.PI * 1.64),
        coatMat
      );
      coatMantle.scale.set(1.24, 1, 0.82);
      coatMantle.position.set(0, 0.16, 0);
      torsoGroup.add(coatMantle);

      // Folded open lapel collars
      for (const lx of [-0.13, 0.13]) {
        const lapel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.36, 8), coatMat);
        lapel.scale.set(1.4, 1, 0.4);
        lapel.rotation.z = lx > 0 ? -0.15 : 0.15;
        lapel.position.set(lx, 0.18, 0.135);
        torsoGroup.add(lapel);
      }

      // Coat tails flowing down to upper thighs
      const coatTails = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.28, 0.45, 16, 1, true, Math.PI * 0.15, Math.PI * 1.7),
        coatMat
      );
      coatTails.scale.set(1.22, 1, 0.86);
      coatTails.position.set(0, -0.32, 0);
      torsoGroup.add(coatTails);

      // Chest pocket with pen clip
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.01), coatMat);
      pocket.position.set(-0.14, 0.20, 0.138);
      torsoGroup.add(pocket);
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 })
      );
      pen.position.set(-0.13, 0.22, 0.145);
      torsoGroup.add(pen);
    } else if (config.outfit === 'pilot_uniform') {
      // Captain Pilot Blazer with 4 Gold Epaulet Bars & Wing Insignia
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 });
      materials.push(goldMat);
      for (const sx of [-0.22, 0.22]) {
        for (let s = 0; s < 4; s++) {
          const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.014, 0.16), goldMat);
          epaulet.position.set(sx, 0.34 + s * 0.02, 0);
          torsoGroup.add(epaulet);
        }
      }
      const wings = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.02), goldMat);
      wings.position.set(-0.14, 0.23, 0.13);
      torsoGroup.add(wings);
    } else {
      // Folded ribbed collar ring encircling base of neck for all shirts/tees
      const collarRing = new THREE.Mesh(
        new THREE.TorusGeometry(neckRadius * 1.25, 0.022, 8, 16),
        clothingMat
      );
      collarRing.rotation.x = Math.PI / 2;
      collarRing.position.set(0, 0.34, 0.01);
      torsoGroup.add(collarRing);
    }

    // Optional Stethoscope
    if (config.hasStethoscope || config.outfit === 'doctor_coat') {
      const stethMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      materials.push(stethMat);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 16), stethMat);
      loop.rotation.x = Math.PI / 3;
      loop.position.set(0, 0.34, 0.07);
      torsoGroup.add(loop);

      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.015, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 })
      );
      bell.rotation.x = Math.PI / 2;
      bell.position.set(0, 0.15, 0.14);
      torsoGroup.add(bell);
    }

    // Optional Necktie
    if (config.hasTie || config.outfit === 'pilot_uniform' || config.outfit === 'lecturer_suit') {
      const tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.32, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x09090b })
      );
      tie.position.set(0, 0.15, 0.13);
      torsoGroup.add(tie);
    }

    // Optional Bags & Backpacks
    if (config.hasBackpack || config.outfit === 'student_casual' || config.bagStyle === 'backpack') {
      const packColor = config.bagColor ?? 0x1d4ed8;
      const packMat = new THREE.MeshStandardMaterial({ color: packColor, roughness: 0.6 });
      materials.push(packMat);
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), packMat);
      backpack.position.set(0, 0.08, -0.20);
      torsoGroup.add(backpack);
    } else if (config.bagStyle === 'crossbody') {
      const bagColor = config.bagColor ?? 0x1c1917;
      const bagMat = new THREE.MeshStandardMaterial({ color: bagColor, roughness: 0.4 });
      materials.push(bagMat);
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.08), bagMat);
      pouch.position.set(-0.22, -0.15, 0.08);
      torsoGroup.add(pouch);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 0.015), bagMat);
      strap.rotation.z = 0.55;
      strap.position.set(0, 0.06, 0.16);
      torsoGroup.add(strap);
    } else if (config.bagStyle === 'briefcase') {
      const caseColor = config.bagColor ?? 0x451a03;
      const caseMat = new THREE.MeshStandardMaterial({ color: caseColor, roughness: 0.35, metalness: 0.1 });
      materials.push(caseMat);
      const briefcase = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.30, 0.40), caseMat);
      briefcase.position.set(0.32, -0.25, 0.02);
      torsoGroup.add(briefcase);
    } else if (config.bagStyle === 'clutch') {
      const clutchColor = config.bagColor ?? 0xd97706;
      const clutchMat = new THREE.MeshStandardMaterial({ color: clutchColor, roughness: 0.25, metalness: 0.3 });
      materials.push(clutchMat);
      const clutch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.24), clutchMat);
      clutch.position.set(-0.24, -0.16, 0.06);
      torsoGroup.add(clutch);
    }

    // =========================================================================
    // 2. NECK & HEAD (ANATOMICAL SHAPING WITH SCULPTED FACIAL FEATURES)
    // =========================================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, isFemale ? 1.58 : 1.66, 0);
    group.add(headGroup);

    // Anatomical Neck
    const neckGeo = new THREE.CylinderGeometry(neckRadius * 0.94, neckRadius * 1.08, 0.16, 14);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, -0.11, 0);
    headGroup.add(neckMesh);

    // Sculpted Cranium & Facial Structure (Natural proportions matching Reference 2)
    const headWidth = isFemale ? 0.17 : 0.19;
    const headHeight = isFemale ? 0.23 : 0.25;
    const headDepth = isFemale ? 0.19 : 0.21;

    // Sculpted organic head mesh with natural human jaw taper, chin curvature, and smooth normals
    const craniumGeo = new THREE.SphereGeometry(headWidth, 24, 20);
    craniumGeo.scale(1, headHeight / headWidth, headDepth / headWidth);

    const cPos = craniumGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      let x = cPos.getX(i);
      let y = cPos.getY(i);
      let z = cPos.getZ(i);

      // Jawline & Chin taper: below mid-face (y < 0), taper smoothly down toward chin
      if (y < 0) {
        const t = Math.min(1, Math.abs(y) / (headHeight * 0.75));
        // Taper cheeks/jaw inward in X
        x *= (1.0 - t * 0.32);
        // Taper back of jaw inward in Z, but maintain subtle forward chin curve
        if (z < 0) {
          z *= (1.0 - t * 0.25);
        } else {
          z += Math.max(0, 1.0 - Math.abs(x) / (headWidth * 0.6)) * (t * 0.022);
        }
      }

      // Forehead & Temples subtle narrowing
      if (y > 0 && Math.abs(x) > headWidth * 0.7 && z < headDepth * 0.3) {
        x *= 0.94;
      }

      cPos.setXYZ(i, x, y, z);
    }
    craniumGeo.computeVertexNormals();

    const craniumMesh = new THREE.Mesh(craniumGeo, skinMat);
    craniumMesh.castShadow = true;
    headGroup.add(craniumMesh);

    // --- PHYSICAL 3D SCULPTED FACIAL ANATOMY (Matching Reference 2) ---
    // Precise surface coordinates guarantee eyes, nose, lips and tribal marks are 100% visible and unoccluded.

    if (config.lod === 'street') {
      // Streamlined Street Face: Clean, recognizable stylized features with minimal draw calls
      // 1. Almond Eyes (White Sclera + Amber/Dark Pupil)
      for (const ex of [-0.055, 0.055]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), eyeWhiteMat);
        eye.scale.set(1.2, 0.8, 0.5);
        eye.position.set(ex, 0.012, 0.206);
        headGroup.add(eye);

        const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 8), irisMat);
        pupil.rotation.x = Math.PI / 2;
        pupil.position.set(ex, 0.012, 0.216);
        headGroup.add(pupil);
      }

      // 2. Eyebrows
      for (const bx of [-0.058, 0.058]) {
        const isLeft = bx < 0;
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.014, 0.01), browMat);
        brow.rotation.z = isLeft ? -0.16 : 0.16;
        brow.position.set(bx, 0.050, 0.208);
        headGroup.add(brow);
      }

      // 3. Sculpted African Nasal Architecture (Unified bridge & apex)
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.065, 8), skinMat);
      nose.position.set(0, -0.010, 0.224);
      headGroup.add(nose);

      // 4. Lips (Unified contoured feature)
      const lips = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), lipMat);
      lips.scale.set(1.6, 0.65, 0.8);
      lips.position.set(0, -0.068, 0.208);
      headGroup.add(lips);

      // 5. Ears
      for (const ex of [-headWidth * 0.98, headWidth * 0.98]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), skinMat);
        ear.scale.set(0.35, 1.1, 0.7);
        ear.position.set(ex, 0.005, -0.015);
        headGroup.add(ear);
      }

      if (!isFemale) {
        const goatee = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), browMat);
        goatee.scale.set(1.1, 0.6, 0.8);
        goatee.position.set(0, -0.105, 0.178);
        headGroup.add(goatee);
      }
    } else {
      // 1. Almond 3D Eyes (White Sclera, Warm African Amber Iris, Pupil & Corneal Catchlight Sparkle)
      const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      materials.push(catchlightMat);

      for (const ex of [-0.055, 0.055]) {
        // Sclera (White Eye Capsule)
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 12), eyeWhiteMat);
        sclera.scale.set(1.22, 0.85, 0.88);
        sclera.position.set(ex, 0.012, 0.204);
        headGroup.add(sclera);

        // Iris (Warm African Amber)
        const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.004, 16), irisMat);
        iris.rotation.x = Math.PI / 2;
        iris.position.set(ex, 0.012, 0.219);
        headGroup.add(iris);

        // Pupil (Deep Black Center)
        const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.005, 12), pupilMat);
        pupil.rotation.x = Math.PI / 2;
        pupil.position.set(ex, 0.012, 0.221);
        headGroup.add(pupil);

        // Lifelike Corneal Catchlight (Pixar/Disney specular sparkle matching Reference 2)
        const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 6), catchlightMat);
        catchlight.position.set(ex + 0.0045, 0.016, 0.224);
        headGroup.add(catchlight);

        // Upper Eyelid Fold
        const upperLid = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.054, 8), skinMat);
        upperLid.rotation.z = Math.PI / 2;
        upperLid.position.set(ex, 0.024, 0.218);
        headGroup.add(upperLid);

        // Lower Eyelid
        const lowerLid = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.048, 8), skinMat);
        lowerLid.rotation.z = Math.PI / 2;
        lowerLid.position.set(ex, -0.004, 0.216);
        headGroup.add(lowerLid);
      }

      // 2. Arched Eyebrows (Reference 2)
      for (const bx of [-0.058, 0.058]) {
        const isLeft = bx < 0;
        const brow = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.006, 0.075, 8),
          browMat
        );
        brow.rotation.z = isLeft ? -Math.PI / 2 - 0.16 : Math.PI / 2 + 0.16;
        brow.rotation.y = isLeft ? 0.20 : -0.20;
        brow.position.set(bx, 0.050, 0.208);
        headGroup.add(brow);
      }

      // 3. African Nasal Architecture (Defined Bridge, Rounded Apex & Nostril Wings)
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.019, 0.052, 8), skinMat);
      bridge.position.set(0, 0.006, 0.214);
      headGroup.add(bridge);

      const apex = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), skinMat);
      apex.scale.set(1.22, 0.92, 1.15);
      apex.position.set(0, -0.024, 0.236);
      headGroup.add(apex);

      for (const nx of [-0.023, 0.023]) {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), skinMat);
        nostril.scale.set(0.95, 0.82, 1.15);
        nostril.position.set(nx, -0.028, 0.220);
        headGroup.add(nostril);
      }

      // 4. Contoured Cupid's Bow Lips (Reference 2)
      for (const lx of [-0.015, 0.015]) {
        const peak = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), lipMat);
        peak.scale.set(1.2, 0.70, 1.05);
        peak.position.set(lx, -0.058, 0.209);
        headGroup.add(peak);
      }
      const upperBar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.060, 8), lipMat);
      upperBar.rotation.z = Math.PI / 2;
      upperBar.position.set(0, -0.060, 0.207);
      headGroup.add(upperBar);

      const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), lipMat);
      lowerLip.scale.set(1.42, 0.68, 1.0);
      lowerLip.position.set(0, -0.078, 0.208);
      headGroup.add(lowerLip);

      // 5. Authentic Yoruba Tribal Cheek Marks (3 Delicate Horizontal Pélé Marks - Reference 2)
      const tribalMarkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      materials.push(tribalMarkMat);
      for (const side of [-1, 1]) {
        for (let m = 0; m < 3; m++) {
          const markY = -0.010 - m * 0.011;
          const mark = new THREE.Mesh(
            new THREE.CylinderGeometry(0.002, 0.002, 0.044, 6),
            tribalMarkMat
          );
          mark.rotation.z = side * -0.22; // Gentle upward cheek curve toward ear
          mark.rotation.y = side * 0.35;
          mark.position.set(side * 0.082, markY, 0.202);
          headGroup.add(mark);
        }
      }

      // 6. Male Facial Grooming (Sculpted Mustache & Chin Goatee matching Reference 2)
      if (!isFemale) {
        const stache = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.068, 8), browMat);
        stache.rotation.z = Math.PI / 2;
        stache.position.set(0, -0.050, 0.212);
        headGroup.add(stache);

        const goatee = new THREE.Mesh(new THREE.SphereGeometry(0.020, 10, 8), browMat);
        goatee.scale.set(1.15, 0.75, 0.85);
        goatee.position.set(0, -0.110, 0.178);
        headGroup.add(goatee);
      }

      // 7. Anatomical Ears
      const earHeight = 0.005;
      for (const ex of [-headWidth * 0.98, headWidth * 0.98]) {
        const earGroup = new THREE.Group();
        earGroup.position.set(ex, earHeight, -0.015);
        earGroup.rotation.y = ex > 0 ? -0.20 : 0.20; // 12 deg natural backward angle

        const earHelix = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 12, Math.PI * 1.4), skinMat);
        earHelix.rotation.z = ex > 0 ? 0.35 : -0.35;
        earGroup.add(earHelix);

        const earConcha = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), skinMat);
        earConcha.scale.set(0.35, 1.1, 0.8);
        earGroup.add(earConcha);

        headGroup.add(earGroup);
      }
    }

    // 8. Optional Accessories (Designer Sunglasses & Cuban Gold Chain)
    if (config.hasShades) {
      const shadesGlassMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.1,
        metalness: 0.9,
      });
      const shadesFrameMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.85,
        roughness: 0.25,
      });
      materials.push(shadesGlassMat, shadesFrameMat);

      for (const sx of [-0.055, 0.055]) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.026, 0.008), shadesGlassMat);
        lens.position.set(sx, 0.012, 0.224);
        headGroup.add(lens);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.030, 0.006), shadesFrameMat);
        frame.position.set(sx, 0.012, 0.222);
        headGroup.add(frame);
      }

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.006), shadesFrameMat);
      bridge.position.set(0, 0.014, 0.226);
      headGroup.add(bridge);

      for (const tx of [-0.082, 0.082]) {
        const temple = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.16), shadesFrameMat);
        temple.position.set(tx, 0.014, 0.14);
        headGroup.add(temple);
      }
    }

    if (config.hasGoldChain) {
      const chainMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.85,
        roughness: 0.2,
      });
      materials.push(chainMat);

      const chainMesh = new THREE.Mesh(new THREE.TorusGeometry(neckRadius * 1.18, 0.010, 8, 22), chainMat);
      chainMesh.rotation.x = Math.PI / 2 + 0.18;
      chainMesh.position.set(0, -0.11, 0.025);
      headGroup.add(chainMesh);

      const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 14), chainMat);
      medallion.rotation.x = Math.PI / 2;
      medallion.position.set(0, -0.15, 0.065);
      headGroup.add(medallion);
    }

    if (config.hasCoralBeads) {
      const coralMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48, // Authentic rich crimson coral
        roughness: 0.32,
        metalness: 0.08,
      });
      materials.push(coralMat);
      const coralStrand = new THREE.Mesh(new THREE.TorusGeometry(neckRadius * 1.25, 0.015, 8, 24), coralMat);
      coralStrand.rotation.x = Math.PI / 2 + 0.16;
      coralStrand.position.set(0, -0.10, 0.03);
      headGroup.add(coralStrand);
    }

    // =========================================================================
    // 3. HAIRSTYLES & CULTURAL HEADWEAR
    // =========================================================================
    const hairColor = config.hairColor || '#171717';
    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hairColor),
      roughness: 0.88,
    });
    materials.push(hairMat);

    if (isFemale) {
      const femaleStyle = config.hairstyle || (config.outfit === 'blue_dress' ? 'bob_wig' : 'braids');

      if (femaleStyle === 'bob_wig' || femaleStyle === 'short_crop') {
        // Sleek feminine bob / shoulder-length wig
        const wigGeo = new THREE.SphereGeometry(headWidth * 1.06, 16, 14);
        wigGeo.scale(1.05, 1.25, 1.15);
        const wigMesh = new THREE.Mesh(wigGeo, hairMat);
        wigMesh.position.set(0, 0.04, -0.02);
        headGroup.add(wigMesh);

        for (const sx of [-headWidth * 1.02, headWidth * 1.02]) {
          const sideLock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 8), hairMat);
          sideLock.position.set(sx, -0.12, 0.02);
          headGroup.add(sideLock);
        }
      } else if (femaleStyle === 'gele') {
        // Grand Nigerian Gele (Autogele / Aso-Oke pleated head-tie)
        const geleColor = config.secondaryColor ?? (config.hairColor ? new THREE.Color(config.hairColor).getHex() : (config.outfitColor ?? 0xd97706));
        const geleTex = getOrCreateAsoOkeTexture(geleColor, 0xfacc15);
        const geleMat = new THREE.MeshStandardMaterial({
          color: geleColor,
          map: geleTex,
          roughness: 0.65,
        });
        materials.push(geleMat);

        const turban = new THREE.Mesh(new THREE.TorusGeometry(headWidth * 1.12, 0.07, 10, 20), geleMat);
        turban.rotation.x = Math.PI / 2 + 0.15;
        turban.position.set(0, 0.08, 0);
        headGroup.add(turban);

        for (let p = 0; p < 3; p++) {
          const pleat = new THREE.Mesh(
            new THREE.CylinderGeometry(headWidth * (1.2 + p * 0.15), headWidth * (1.1 + p * 0.12), 0.08, 20, 1, false, 0, Math.PI),
            geleMat
          );
          pleat.rotation.x = Math.PI / 2 + 0.25 + p * 0.12;
          pleat.position.set(0, 0.10 + p * 0.04, -0.02);
          headGroup.add(pleat);
        }
      } else {
        // Braids / Cornrows
        const crown = new THREE.Mesh(new THREE.SphereGeometry(headWidth * 1.04, 16, 12), hairMat);
        crown.scale.set(1.02, 1.02, 1.06);
        crown.position.set(0, 0.03, -0.01);
        headGroup.add(crown);

        // Flowing micro-braid plaits hanging over shoulders
        for (const sx of [-headWidth * 0.94, headWidth * 0.94]) {
          for (let b = 0; b < 3; b++) {
            const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.38, 6), hairMat);
            braid.position.set(sx + (b - 1) * 0.025, -0.14, 0.02 + b * 0.03);
            braid.rotation.z = sx > 0 ? 0.08 : -0.08;
            headGroup.add(braid);
          }
        }
      }
    } else {
      const maleStyle = config.hairstyle || 'short_crop';

      if (maleStyle === 'afro') {
        // Volumetric Textured Afro Crown
        const afroGeo = new THREE.SphereGeometry(headWidth * 1.22, 18, 14);
        afroGeo.scale(1.08, 1.12, 1.10);
        const afroMesh = new THREE.Mesh(afroGeo, hairMat);
        afroMesh.position.set(0, 0.09, -0.02);
        headGroup.add(afroMesh);
      } else if (maleStyle === 'fila' || config.outfit === 'agbada') {
        // Traditional Embroidered Yoruba Fila Gobi Cap with Authentic Folded Lateral Wing (Reference 2)
        const filaColor = config.hairColor
          ? new THREE.Color(config.hairColor).getHex()
          : (config.outfit === 'agbada' ? outfitColor : (config.outfitColor ?? 0x047857));
        const filaTex = getOrCreateAsoOkeTexture(filaColor, 0x1e3a8a);
        const filaMat = new THREE.MeshStandardMaterial({
          color: filaColor,
          map: filaTex,
          roughness: 0.65,
        });
        materials.push(filaMat);
        const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 });
        materials.push(goldTrimMat);

        // Cylindrical crown base wrapping cranium
        const filaBase = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.04, headWidth * 1.02, 0.14, 18), filaMat);
        filaBase.position.set(0, 0.15, -0.01);
        headGroup.add(filaBase);

        // Embroidered gold trim band around base (positioned at y = 0.085, safely above eyebrows)
        const filaBand = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.05, headWidth * 1.05, 0.024, 18), goldTrimMat);
        filaBand.position.set(0, 0.085, -0.01);
        headGroup.add(filaBand);

        // Folded lateral top crest draping gracefully to the right (Fila Gobi style)
        const crestGeo = new THREE.CylinderGeometry(headWidth * 0.95, headWidth * 0.40, 0.20, 16);
        crestGeo.scale(1.2, 0.85, 0.7);
        const filaCrest = new THREE.Mesh(crestGeo, filaMat);
        filaCrest.rotation.z = -0.52; // Authentic fold over to the right ear
        filaCrest.rotation.x = 0.12;
        filaCrest.position.set(0.07, 0.23, 0.02);
        headGroup.add(filaCrest);

        // Folded tip accent
        const tipGeo = new THREE.SphereGeometry(headWidth * 0.28, 10, 8);
        tipGeo.scale(1.3, 0.6, 0.8);
        const filaTip = new THREE.Mesh(tipGeo, filaMat);
        filaTip.position.set(0.16, 0.18, 0.03);
        headGroup.add(filaTip);
      } else if (maleStyle === 'police_cap' || config.outfit === 'traffic_warden') {
        // Official LASTMA Traffic Warden / Police Authority Peaked Cap
        const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });
        materials.push(capMat);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.15, headWidth * 1.02, 0.13, 18), capMat);
        crown.position.set(0, 0.16, 0.01);
        headGroup.add(crown);

        const goldBand = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.06, headWidth * 1.06, 0.022, 18), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 }));
        goldBand.position.set(0, 0.095, 0.01);
        headGroup.add(goldBand);

        // Visor angled downward over the eyes
        const visor = new THREE.Mesh(
          new THREE.CylinderGeometry(headWidth * 1.15, headWidth * 1.15, 0.018, 18, 1, false, -Math.PI * 0.32, Math.PI * 0.64),
          new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.15, metalness: 0.2 })
        );
        visor.position.set(0, 0.092, 0.09);
        visor.rotation.x = 0.28; // Angled down naturally
        headGroup.add(visor);

        const badge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.015), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 }));
        badge.position.set(0, 0.17, headDepth * 0.92);
        headGroup.add(badge);
      } else {
        // Natural African Fade / Buzz Cut (Reference 1)
        // A. Upper Cranial Hair Cap (calibrated to frame forehead naturally without dipping over eyebrows)
        const fadeCapGeo = new THREE.SphereGeometry(headWidth * 1.015, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
        fadeCapGeo.scale(1, headHeight / headWidth, headDepth / headWidth);
        const fadeCap = new THREE.Mesh(fadeCapGeo, hairMat);
        fadeCap.position.set(0, 0.005, -0.015);
        headGroup.add(fadeCap);

        // A2. Occipital & Back-of-Head Tapered Fade (precisely covers back skull down to nape)
        const backFadeGeo = new THREE.SphereGeometry(headWidth * 1.012, 18, 12, Math.PI * 0.5, Math.PI, Math.PI * 0.35, Math.PI * 0.32);
        backFadeGeo.scale(1, headHeight / headWidth, headDepth / headWidth);
        const backFade = new THREE.Mesh(backFadeGeo, hairMat);
        backFade.position.set(0, 0, -0.01);
        headGroup.add(backFade);

        // B. Crisp Forward African Hairline (frames forehead at natural human height)
        const hairlineBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, headWidth * 0.78, 10),
          hairMat
        );
        hairlineBar.rotation.z = Math.PI / 2;
        hairlineBar.position.set(0, 0.082, 0.188);
        headGroup.add(hairlineBar);

        // C. Temple Sideburn Points descending sleekly to ear tragus
        for (const sx of [-headWidth * 0.94, headWidth * 0.94]) {
          const sideburn = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, 0.045, 0.020),
            hairMat
          );
          sideburn.position.set(sx, 0.020, 0.01);
          headGroup.add(sideburn);
        }
      }
    }

    // Street Vendor Tray balanced on head
    if (config.hasTray) {
      const basinMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
      materials.push(basinMat);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.16, 16), basinMat);
      basin.position.set(0, headHeight + 0.14, 0);
      headGroup.add(basin);
    }

    // =========================================================================
    // 4. ARMS & HANDS (ARTICULATED JOINTS & 5-FINGER SCULPTED HANDS)
    // =========================================================================
    const armRadius = isFemale ? 0.052 : 0.068;
    const upperArmLength = isFemale ? 0.28 : 0.32;
    const forearmLength = isFemale ? 0.26 : 0.30;
    const shoulderX = isFemale ? 0.24 : 0.32;
    const coatSleeveMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
    const armMatToUse = (isFemale && config.outfit === 'blue_dress') 
      ? skinMat 
      : (config.outfit === 'doctor_coat' ? coatSleeveMat : clothingMat);

    // Helper: builds an articulated 5-finger sculpted hand (Anatomical palm, thenar pad, and naturally curled fingers)
    const buildSculptedHand = (isLeft: boolean): THREE.Group => {
      const handGroup = new THREE.Group();
      
      // 1. Tapered Palm with anatomical wrist-to-knuckle flare
      const palmGeo = new THREE.CylinderGeometry(0.036, 0.028, 0.075, 12);
      palmGeo.scale(1.05, 1, 0.45);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.position.set(0, -0.040, 0);
      handGroup.add(palm);

      // 2. Thenar Muscle Pad (fleshy ball at base of thumb)
      const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), skinMat);
      thenar.scale.set(1.3, 1.4, 0.95);
      const thumbDir = isLeft ? 1 : -1;
      thenar.position.set(thumbDir * 0.022, -0.030, 0.010);
      handGroup.add(thenar);

      // 3. Knuckle Ridge Arch
      const knuckleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.068, 8), skinMat);
      knuckleBar.rotation.z = Math.PI / 2;
      knuckleBar.position.set(0, -0.070, 0.004);
      handGroup.add(knuckleBar);

      if (config.lod === 'street') {
        // Optimized street hand: contoured palm, thumb, and sculpted curled fingers block
        const thumbGroup = new THREE.Group();
        thumbGroup.position.set(thumbDir * 0.028, -0.028, 0.008);
        thumbGroup.rotation.z = thumbDir * -0.65;
        thumbGroup.rotation.x = 0.35;
        const thumbMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.010, 0.038, 6), skinMat);
        thumbMesh.position.set(0, -0.019, 0);
        thumbGroup.add(thumbMesh);
        handGroup.add(thumbGroup);

        const fingersGeo = new THREE.BoxGeometry(0.062, 0.044, 0.022);
        const fingersMesh = new THREE.Mesh(fingersGeo, skinMat);
        fingersMesh.position.set(0, -0.090, 0.006);
        fingersMesh.rotation.x = 0.22;
        handGroup.add(fingersMesh);
        return handGroup;
      }

      // 4. Articulated Opposable Thumb (Metacarpal + Distal Phalanx angled forward)
      const thumbGroup = new THREE.Group();
      thumbGroup.position.set(thumbDir * 0.030, -0.028, 0.008);
      thumbGroup.rotation.z = thumbDir * -0.65;
      thumbGroup.rotation.x = 0.35; // Natural forward angle

      const thumbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.028, 6), skinMat);
      thumbBase.position.set(0, -0.014, 0);
      thumbGroup.add(thumbBase);

      const thumbDistal = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.024, 6), skinMat);
      thumbDistal.position.set(0, -0.034, 0.003);
      thumbDistal.rotation.x = 0.20; // Subtle tip bend
      thumbGroup.add(thumbDistal);

      const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), skinMat);
      thumbTip.position.set(0, -0.046, 0.006);
      thumbGroup.add(thumbTip);

      // Thumbnail plate on dorsal side
      const thumbNail = new THREE.Mesh(
        new THREE.BoxGeometry(0.007, 0.014, 0.002),
        new THREE.MeshStandardMaterial({ color: 0xf1dfd0, roughness: 0.3, metalness: 0.1 })
      );
      thumbNail.position.set(0, -0.038, -0.007);
      thumbGroup.add(thumbNail);

      handGroup.add(thumbGroup);

      // 5. 4 Anatomical Curled Fingers with 3-Segment Phalanges (Index, Middle, Ring, Pinky)
      const fingerWidths = [0.0095, 0.010, 0.0095, 0.008];
      const fingerLengths = [0.048, 0.054, 0.050, 0.040];
      const fingerOffsets = [-0.025, -0.008, 0.008, 0.024];
      const fingerSplays = [
        thumbDir * -0.05,
        thumbDir * -0.01,
        thumbDir * 0.02,
        thumbDir * 0.06,
      ];

      for (let f = 0; f < 4; f++) {
        const fingerGroup = new THREE.Group();
        fingerGroup.position.set(fingerOffsets[f], -0.075, 0);
        fingerGroup.rotation.x = 0.18; // Base resting flexion
        fingerGroup.rotation.z = fingerSplays[f];

        // MCP Joint (Base Knuckle)
        const mcpKnuckle = new THREE.Mesh(new THREE.SphereGeometry(fingerWidths[f] * 0.95, 6, 6), skinMat);
        mcpKnuckle.position.set(0, 0, 0.002);
        fingerGroup.add(mcpKnuckle);

        // 1. Proximal Phalanx (40% of finger length)
        const proxLen = fingerLengths[f] * 0.40;
        const prox = new THREE.Mesh(
          new THREE.CylinderGeometry(fingerWidths[f] * 0.90, fingerWidths[f], proxLen, 6),
          skinMat
        );
        prox.position.set(0, -proxLen / 2, 0);
        fingerGroup.add(prox);

        // PIP Joint (Middle Knuckle)
        const pipGroup = new THREE.Group();
        pipGroup.position.set(0, -proxLen, 0);
        pipGroup.rotation.x = 0.20; // First joint curl
        const pipKnuckle = new THREE.Mesh(new THREE.SphereGeometry(fingerWidths[f] * 0.88, 6, 6), skinMat);
        pipKnuckle.position.set(0, 0, 0.002);
        pipGroup.add(pipKnuckle);

        // 2. Intermediate Phalanx (32% of finger length)
        const midLen = fingerLengths[f] * 0.32;
        const mid = new THREE.Mesh(
          new THREE.CylinderGeometry(fingerWidths[f] * 0.80, fingerWidths[f] * 0.90, midLen, 6),
          skinMat
        );
        mid.position.set(0, -midLen / 2, 0);
        pipGroup.add(mid);

        // DIP Joint (Distal Knuckle)
        const dipGroup = new THREE.Group();
        dipGroup.position.set(0, -midLen, 0);
        dipGroup.rotation.x = 0.22; // Tip joint curl
        const dipKnuckle = new THREE.Mesh(new THREE.SphereGeometry(fingerWidths[f] * 0.78, 6, 6), skinMat);
        dipKnuckle.position.set(0, 0, 0.001);
        dipGroup.add(dipKnuckle);

        // 3. Distal Phalanx (28% of finger length) with fingertip pad
        const distLen = fingerLengths[f] * 0.28;
        const dist = new THREE.Mesh(
          new THREE.CylinderGeometry(fingerWidths[f] * 0.65, fingerWidths[f] * 0.80, distLen, 6),
          skinMat
        );
        dist.position.set(0, -distLen / 2, 0);
        dipGroup.add(dist);

        // Fingertip Flesh Pad
        const tip = new THREE.Mesh(new THREE.SphereGeometry(fingerWidths[f] * 0.68, 6, 6), skinMat);
        tip.position.set(0, -distLen, 0.001);
        dipGroup.add(tip);

        // Fingernail Plate on dorsal side
        const nail = new THREE.Mesh(
          new THREE.BoxGeometry(fingerWidths[f] * 0.75, distLen * 0.65, 0.002),
          new THREE.MeshStandardMaterial({ color: 0xf1dfd0, roughness: 0.3, metalness: 0.1 })
        );
        nail.position.set(0, -distLen * 0.5, -fingerWidths[f] * 0.62);
        dipGroup.add(nail);

        pipGroup.add(dipGroup);
        fingerGroup.add(pipGroup);
        handGroup.add(fingerGroup);
      }

      return handGroup;
    };

    // A. Left Arm Hierarchy (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-shoulderX, isFemale ? 1.30 : 1.38, 0);
    group.add(leftArmGroup);

    // Shoulder Deltoid cap
    const deltoidL = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.15, 10, 8), armMatToUse);
    leftArmGroup.add(deltoidL);

    // Left Upper Arm
    const leftUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(armRadius, armRadius * 0.9, upperArmLength, 10),
      armMatToUse
    );
    leftUpperArm.position.set(0, -upperArmLength / 2, 0);
    const sleeveCuffL = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 1.04, armRadius * 1.04, 0.032, 12), armMatToUse);
    sleeveCuffL.position.set(0, -upperArmLength / 2 + 0.016, 0);
    leftUpperArm.add(sleeveCuffL);
    leftArmGroup.add(leftUpperArm);

    // Left Forearm Group (pivots at elbow)
    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.set(0, -upperArmLength, 0);
    leftArmGroup.add(leftForearmGroup);

    // Left Elbow Joint sphere
    const leftElbow = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.88, 8, 8), skinMat);
    leftForearmGroup.add(leftElbow);

    // Left Forearm shaft
    const leftForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(armRadius * 0.88, armRadius * 0.72, forearmLength, 10),
      skinMat
    );
    leftForearm.position.set(0, -forearmLength / 2, 0);
    leftForearmGroup.add(leftForearm);

    // Left Hand (with 5 fingers)
    const leftHand = buildSculptedHand(true);
    leftHand.position.set(0, -forearmLength, 0);
    leftForearmGroup.add(leftHand);

    // B. Right Arm Hierarchy
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(shoulderX, isFemale ? 1.30 : 1.38, 0);
    group.add(rightArmGroup);

    const deltoidR = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.15, 10, 8), armMatToUse);
    rightArmGroup.add(deltoidR);

    const rightUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(armRadius, armRadius * 0.9, upperArmLength, 10),
      armMatToUse
    );
    rightUpperArm.position.set(0, -upperArmLength / 2, 0);
    const sleeveCuffR = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 1.04, armRadius * 1.04, 0.032, 12), armMatToUse);
    sleeveCuffR.position.set(0, -upperArmLength / 2 + 0.016, 0);
    rightUpperArm.add(sleeveCuffR);
    rightArmGroup.add(rightUpperArm);

    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.set(0, -upperArmLength, 0);
    rightArmGroup.add(rightForearmGroup);

    const rightElbow = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.88, 8, 8), skinMat);
    rightForearmGroup.add(rightElbow);

    const rightForearm = new THREE.Mesh(
      new THREE.CylinderGeometry(armRadius * 0.88, armRadius * 0.72, forearmLength, 10),
      skinMat
    );
    rightForearm.position.set(0, -forearmLength / 2, 0);
    rightForearmGroup.add(rightForearm);

    const rightHand = buildSculptedHand(false);
    rightHand.position.set(0, -forearmLength, 0);
    rightForearmGroup.add(rightHand);

    // Smartphone model attached to right palm
    const phoneGeo = new THREE.BoxGeometry(0.075, 0.14, 0.016);
    const phoneMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.2 });
    materials.push(phoneMat);
    const phoneMesh = new THREE.Mesh(phoneGeo, phoneMat);
    phoneMesh.position.set(0, -forearmLength - 0.04, 0.04);
    phoneMesh.visible = false;
    rightForearmGroup.add(phoneMesh);

    // =========================================================================
    // 5. LEGS & FOOTWEAR (ARTICULATED KNEES & REAL SHOE GEOMETRY)
    // =========================================================================
    const legRadius = isFemale ? 0.072 : 0.092;
    const hipHeight = isFemale ? 0.74 : 0.78;
    const thighLength = isFemale ? 0.38 : 0.40;
    const shinLength = isFemale ? 0.36 : 0.38;
    const legSpacing = isFemale ? 0.13 : 0.16;
    const legMatToUse = (isFemale && config.outfit === 'blue_dress') ? skinMat : trousersMat;

    // Helper: builds a detailed shoe with rubber sole, toe box, and heel
    const buildDetailedShoe = (isFemaleHeel: boolean): THREE.Group => {
      const shoeGroup = new THREE.Group();
      const isHeel = isFemaleHeel || config.shoeStyle === 'heels';
      const footLength = isHeel ? 0.19 : 0.25;
      const footWidth = isHeel ? 0.075 : 0.095;

      // Sole slab
      const sole = new THREE.Mesh(new THREE.BoxGeometry(footWidth, 0.03, footLength), soleMat);
      sole.position.set(0, 0.015, 0.04);
      shoeGroup.add(sole);

      // Main Shoe Upper
      const upper = new THREE.Mesh(new THREE.BoxGeometry(footWidth * 0.95, 0.07, footLength * 0.88), shoeMat);
      upper.position.set(0, 0.06, 0.03);
      shoeGroup.add(upper);

      // Curved Toe Box
      const toe = new THREE.Mesh(new THREE.SphereGeometry(footWidth * 0.46, 8, 8), shoeMat);
      toe.scale.set(1, 0.65, 1.3);
      toe.position.set(0, 0.045, footLength * 0.42);
      shoeGroup.add(toe);

      // Loafers metal horsebit bar
      if (config.shoeStyle === 'loafers') {
        const bitMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(footWidth * 0.55, 0.012, 0.018), bitMat);
        buckle.position.set(0, 0.096, 0.02);
        shoeGroup.add(buckle);
      }

      // Chelsea / Work Boots high ankle cuff
      if (config.shoeStyle === 'boots') {
        const bootCollar = new THREE.Mesh(new THREE.CylinderGeometry(footWidth * 0.48, footWidth * 0.50, 0.08, 12), shoeMat);
        bootCollar.position.set(0, 0.10, -0.01);
        shoeGroup.add(bootCollar);
      }

      // Elevated Heel / Stiletto for women's dress
      if (isHeel) {
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.06, 6), shoeMat);
        heel.position.set(0, 0.03, -0.04);
        shoeGroup.add(heel);
      }

      return shoeGroup;
    };

    // A. Left Leg Hierarchy (Hip -> Thigh -> Knee -> Shin/Calf -> Foot)
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-legSpacing, hipHeight, 0);
    group.add(leftLegGroup);

    // Left Thigh
    const leftThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 0.88, thighLength, 12),
      legMatToUse
    );
    leftThigh.position.set(0, -thighLength / 2, 0);
    leftLegGroup.add(leftThigh);

    // Left Lower Leg Group (pivots at knee)
    const leftLowerLegGroup = new THREE.Group();
    leftLowerLegGroup.position.set(0, -thighLength, 0);
    leftLegGroup.add(leftLowerLegGroup);

    // Left Knee Joint
    const leftKnee = new THREE.Mesh(new THREE.SphereGeometry(legRadius * 0.86, 8, 8), legMatToUse);
    leftLowerLegGroup.add(leftKnee);

    // Left Shin & Calf
    const leftShin = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius * 0.86, legRadius * 0.70, shinLength, 12),
      legMatToUse
    );
    leftShin.position.set(0, -shinLength / 2, 0);
    if (!(isFemale && config.outfit === 'blue_dress')) {
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(legRadius * 0.74, legRadius * 0.74, 0.035, 12), legMatToUse);
      cuff.position.set(0, -shinLength / 2 + 0.018, 0);
      leftShin.add(cuff);
    }
    leftLowerLegGroup.add(leftShin);

    // Left Shoe
    const leftShoe = buildDetailedShoe(isFemale && config.outfit === 'blue_dress');
    leftShoe.position.set(0, -shinLength, 0);
    leftLowerLegGroup.add(leftShoe);

    // B. Right Leg Hierarchy
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(legSpacing, hipHeight, 0);
    group.add(rightLegGroup);

    const rightThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 0.88, thighLength, 12),
      legMatToUse
    );
    rightThigh.position.set(0, -thighLength / 2, 0);
    rightLegGroup.add(rightThigh);

    const rightLowerLegGroup = new THREE.Group();
    rightLowerLegGroup.position.set(0, -thighLength, 0);
    rightLegGroup.add(rightLowerLegGroup);

    const rightKnee = new THREE.Mesh(new THREE.SphereGeometry(legRadius * 0.86, 8, 8), legMatToUse);
    rightLowerLegGroup.add(rightKnee);

    const rightShin = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius * 0.86, legRadius * 0.70, shinLength, 12),
      legMatToUse
    );
    rightShin.position.set(0, -shinLength / 2, 0);
    if (!(isFemale && config.outfit === 'blue_dress')) {
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(legRadius * 0.74, legRadius * 0.74, 0.035, 12), legMatToUse);
      cuff.position.set(0, -shinLength / 2 + 0.018, 0);
      rightShin.add(cuff);
    }
    rightLowerLegGroup.add(rightShin);

    const rightShoe = buildDetailedShoe(isFemale && config.outfit === 'blue_dress');
    rightShoe.position.set(0, -shinLength, 0);
    rightLowerLegGroup.add(rightShoe);

    // =========================================================================
    // 6. FLOATING SOCIAL USERNAME TAG
    // =========================================================================
    const nameTag = HumanMeshBuilder.createUsernameTag(config.username);
    nameTag.position.set(0, isFemale ? 2.05 : 2.18, 0);
    group.add(nameTag);

    // =========================================================================
    // 7. KINEMATIC ANIMATION ENGINE
    // Supports double-joint articulation (knees bend, elbows flex naturally)
    // =========================================================================
    const defaultY = isFemale ? 1.05 : 1.1;
    const updateAnimation = (time: number, animState?: boolean | string) => {
      const isWalking = animState === true || animState === 'walk';
      const isRunning = animState === 'run';
      const isDancing = animState === 'dance';
      const isTalking = animState === 'talk';
      const isCalling = animState === 'phone_call' || animState === 'call';

      if (phoneMesh) {
        phoneMesh.visible = isCalling;
      }

      if (isRunning) {
        // High-energy sprint with articulated knee and elbow pumping
        const stride = Math.sin(time * 14);
        leftLegGroup.rotation.x = stride * 0.95;
        rightLegGroup.rotation.x = -stride * 0.95;
        
        // Dynamic knee flexion on backswing
        leftLowerLegGroup.rotation.x = Math.max(0, -stride * 1.1);
        rightLowerLegGroup.rotation.x = Math.max(0, stride * 1.1);

        leftArmGroup.rotation.x = -stride * 0.85;
        rightArmGroup.rotation.x = stride * 0.85;
        leftArmGroup.rotation.z = -0.25;
        rightArmGroup.rotation.z = 0.25;

        // Elbow flexion (arms pumped at ~70°)
        leftForearmGroup.rotation.x = -0.9 + Math.sin(time * 14) * 0.25;
        rightForearmGroup.rotation.x = -0.9 - Math.sin(time * 14) * 0.25;

        torsoGroup.position.y = defaultY + Math.abs(Math.sin(time * 28)) * 0.08;
        torsoGroup.rotation.x = 0.14; // Forward running lean
        torsoGroup.rotation.z = Math.sin(time * 14) * 0.04;
        headGroup.rotation.set(-0.06, 0, 0);
      } else if (isWalking) {
        // Natural pedestrian stride with double-joint flexion
        const stride = Math.sin(time * 8);
        leftLegGroup.rotation.x = stride * 0.58;
        rightLegGroup.rotation.x = -stride * 0.58;

        // Knee bends backward during leg recovery swing
        leftLowerLegGroup.rotation.x = Math.max(0, -stride * 0.75);
        rightLowerLegGroup.rotation.x = Math.max(0, stride * 0.75);

        // Arm swing counterbalances leg movement
        leftArmGroup.rotation.x = -stride * 0.48;
        rightArmGroup.rotation.x = stride * 0.48;
        leftArmGroup.rotation.z = 0;
        rightArmGroup.rotation.z = 0;

        // Natural elbow flexion during forward arm stroke
        leftForearmGroup.rotation.x = -0.28 + Math.max(0, -stride * 0.35);
        rightForearmGroup.rotation.x = -0.28 + Math.max(0, stride * 0.35);

        torsoGroup.position.y = defaultY + Math.abs(Math.sin(time * 16)) * 0.038;
        torsoGroup.rotation.x = 0;
        torsoGroup.rotation.z = Math.sin(time * 8) * 0.025; // Subtle pelvic tilt
        headGroup.rotation.set(0, 0, 0);
      } else if (isDancing) {
        // Authentic Afrobeats groove: hip sway, knee bounce, shoulder roll
        const beat = time * 8;
        const bounce = Math.abs(Math.sin(beat)) * 0.08;
        torsoGroup.position.y = defaultY - bounce;
        torsoGroup.rotation.z = Math.sin(beat * 0.5) * 0.15; // Hip sway
        torsoGroup.rotation.y = Math.cos(beat * 0.5) * 0.12;
        torsoGroup.rotation.x = 0.04;

        leftArmGroup.rotation.x = -0.8 + Math.sin(beat) * 0.35;
        rightArmGroup.rotation.x = -0.8 + Math.cos(beat) * 0.35;
        leftArmGroup.rotation.z = -0.35 + Math.sin(beat * 0.5) * 0.22;
        rightArmGroup.rotation.z = 0.35 - Math.cos(beat * 0.5) * 0.22;

        leftForearmGroup.rotation.x = -0.75 + Math.sin(beat) * 0.3;
        rightForearmGroup.rotation.x = -0.75 + Math.cos(beat) * 0.3;

        headGroup.rotation.y = Math.sin(beat * 0.5) * 0.16;
        headGroup.rotation.x = Math.sin(beat) * 0.08;

        leftLegGroup.rotation.x = Math.sin(beat * 0.5) * 0.2;
        rightLegGroup.rotation.x = -Math.sin(beat * 0.5) * 0.2;
        leftLowerLegGroup.rotation.x = bounce * 3.5;
        rightLowerLegGroup.rotation.x = bounce * 3.5;
      } else if (isCalling) {
        // Articulated elbow brings the phone cleanly to right ear
        torsoGroup.position.y = defaultY + Math.sin(time * 2) * 0.012;
        torsoGroup.rotation.set(0, 0, 0);
        
        rightArmGroup.rotation.set(-0.85, 0.25, 0.45);
        rightForearmGroup.rotation.set(-1.45, 0, 0); // Forearm flexes 85° to ear
        leftArmGroup.rotation.set(Math.sin(time * 2) * 0.04, 0, 0);
        leftForearmGroup.rotation.set(-0.15, 0, 0);

        headGroup.rotation.set(Math.sin(time * 2.5) * 0.05, 0, -0.10);
        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
        leftLowerLegGroup.rotation.x = 0;
        rightLowerLegGroup.rotation.x = 0;
      } else if (isTalking) {
        // Conversational wrist & elbow gestures
        const gesture = Math.sin(time * 4);
        torsoGroup.position.y = defaultY + Math.sin(time * 2) * 0.015;
        torsoGroup.rotation.set(0, 0, 0);

        leftArmGroup.rotation.set(-0.35 + gesture * 0.15, 0, -0.15);
        leftForearmGroup.rotation.set(-0.55 + gesture * 0.2, 0, 0);
        rightArmGroup.rotation.set(-0.55 + Math.cos(time * 3) * 0.2, 0, 0.20);
        rightForearmGroup.rotation.set(-0.75 + Math.cos(time * 3) * 0.25, 0, 0);

        headGroup.rotation.set(Math.sin(time * 3) * 0.08, Math.sin(time * 1.5) * 0.12, 0);
        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
        leftLowerLegGroup.rotation.x = 0;
        rightLowerLegGroup.rotation.x = 0;
      } else {
        // Natural breathing / idle state
        const breath = Math.sin(time * 2) * 0.012;
        torsoGroup.position.y = defaultY + breath;
        torsoGroup.rotation.set(0, 0, 0);
        headGroup.rotation.set(0, 0, 0);

        leftArmGroup.rotation.set(Math.sin(time * 2) * 0.025, 0, 0);
        rightArmGroup.rotation.set(-Math.sin(time * 2) * 0.025, 0, 0);
        leftForearmGroup.rotation.set(-0.12, 0, 0);
        rightForearmGroup.rotation.set(-0.12, 0, 0);

        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
        leftLowerLegGroup.rotation.x = 0;
        rightLowerLegGroup.rotation.x = 0;
      }
    };

    if (config.heightScale) {
      group.scale.set(config.heightScale, config.heightScale, config.heightScale);
    }

    return {
      group,
      gender: config.gender,
      username: config.username,
      nameTag,
      head: headGroup,
      torso: torsoGroup,
      leftArm: leftArmGroup,
      rightArm: rightArmGroup,
      leftLeg: leftLegGroup,
      rightLeg: rightLegGroup,
      materials,
      updateAnimation,
      phoneMesh,
      leftForearm: leftForearmGroup,
      rightForearm: rightForearmGroup,
      leftLowerLeg: leftLowerLegGroup,
      rightLowerLeg: rightLowerLegGroup,
    };
  }

  /**
   * Generates a sleek rounded pill username tag sprite matching Image 3.
   * e.g. @GpOfGoodLife, @ka_y_la, @VICTOR0326
   */
  public static createUsernameTag(username: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Clean rounded pill background
    const bg = '#2563eb';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(16, 12, 224, 40, 20);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(16, 12, 224, 40, 20);
    ctx.stroke();

    // Username text
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.startsWith('@') ? username : `@${username}`, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.4, 0.35, 1);
    return sprite;
  }
}
