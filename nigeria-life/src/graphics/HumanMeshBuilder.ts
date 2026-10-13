import * as THREE from 'three';

export type Gender = 'male' | 'female';

export interface HumanConfig {
  gender: Gender;
  username: string;
  skinTone?: string;
  hairColor?: string;
  hairstyle?: 
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
  outfit?: 
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
  outfitColor?: number;
  secondaryColor?: number;
  trousersColor?: number;
  heightScale?: number;
  hasStethoscope?: boolean;
  hasTie?: boolean;
  hasBackpack?: boolean;
  hasTray?: boolean;
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

    const outfitColor = config.outfitColor ?? (isFemale ? 0x2563eb : 0xf97316);
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
      color: config.trousersColor ?? (isFemale ? 0x1e293b : 0xea580c),
      roughness: 0.72,
    });
    materials.push(trousersMat);

    // Shoe leather / rubber sole material
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.45,
      metalness: 0.1,
    });
    materials.push(shoeMat);

    const soleMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.85,
    });
    materials.push(soleMat);

    // Facial feature shared materials
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
    const browMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 });
    const lipMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinHex).multiplyScalar(0.78),
      roughness: 0.5,
    });
    materials.push(eyeWhiteMat, pupilMat, browMat, lipMat);

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

      // Pectoral definition plates
      const pecMat = new THREE.MeshStandardMaterial({
        color: outfitColor,
        roughness: 0.62,
      });
      materials.push(pecMat);
      for (const px of [-0.09, 0.09]) {
        const pec = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.04), pecMat);
        pec.position.set(px, 0.20, 0.10);
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
      // Grand flowing Nigerian Agbada outer robe with tailored brocade folds
      const agbadaMat = new THREE.MeshStandardMaterial({
        color: config.outfitColor ?? 0x047857,
        roughness: 0.72,
      });
      materials.push(agbadaMat);

      // Main robe mantle
      const robeGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.88, 16);
      robeGeo.scale(1.28, 1, 0.72);
      const robe = new THREE.Mesh(robeGeo, agbadaMat);
      robe.position.set(0, -0.06, 0);
      robe.castShadow = true;
      torsoGroup.add(robe);

      // Gold royal embroidery medallion
      const goldEmbMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.6,
        roughness: 0.35,
      });
      materials.push(goldEmbMat);
      const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 20), goldEmbMat);
      medallion.rotation.x = Math.PI / 2;
      medallion.position.set(0, 0.18, 0.17);
      torsoGroup.add(medallion);

      // Intricate concentric embroidery ring
      const embRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 16), goldEmbMat);
      embRing.position.set(0, 0.18, 0.178);
      torsoGroup.add(embRing);
    } else if (config.outfit === 'senator') {
      // Traditional Senator Tunic: mandarin collar and chest pocket flap
      const senatorMat = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.6 });
      materials.push(senatorMat);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.025, 8, 16), senatorMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.35, 0.01);
      torsoGroup.add(collar);

      // Breast pocket flap
      const pocketFlap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.02), senatorMat);
      pocketFlap.position.set(-0.12, 0.22, 0.12);
      torsoGroup.add(pocketFlap);
    } else if (config.outfit === 'doctor_coat') {
      // Clinical Lab Coat
      const coatMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
      materials.push(coatMat);
      for (const lx of [-0.15, 0.15]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.40, 0.03), coatMat);
        lapel.position.set(lx, 0.16, 0.12);
        torsoGroup.add(lapel);
      }
      const coatTails = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.36, 0.26), coatMat);
      coatTails.position.set(0, -0.40, -0.01);
      torsoGroup.add(coatTails);
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

    // Optional Backpack
    if (config.hasBackpack || config.outfit === 'student_casual') {
      const packMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 });
      materials.push(packMat);
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), packMat);
      backpack.position.set(0, 0.08, -0.20);
      torsoGroup.add(backpack);
    }

    // =========================================================================
    // 2. NECK & HEAD (ANATOMICAL SHAPING WITH SCULPTED FACIAL FEATURES)
    // =========================================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, isFemale ? 1.58 : 1.66, 0);
    group.add(headGroup);

    // Anatomical Neck
    const neckRadius = isFemale ? 0.065 : 0.082;
    const neckGeo = new THREE.CylinderGeometry(neckRadius * 0.94, neckRadius * 1.08, 0.16, 14);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, -0.11, 0);
    headGroup.add(neckMesh);

    // Sculpted Cranium & Facial Structure
    const headWidth = isFemale ? 0.20 : 0.23;
    const headHeight = isFemale ? 0.26 : 0.29;
    const headDepth = isFemale ? 0.22 : 0.25;

    const craniumGeo = new THREE.SphereGeometry(headWidth, 16, 14);
    craniumGeo.scale(1, headHeight / headWidth, headDepth / headWidth);
    const craniumMesh = new THREE.Mesh(craniumGeo, skinMat);
    craniumMesh.castShadow = true;
    headGroup.add(craniumMesh);

    // Jawline & Chin Definition
    const chinGeo = new THREE.SphereGeometry(headWidth * 0.52, 10, 8);
    chinGeo.scale(1.1, 0.9, 1.2);
    const chinMesh = new THREE.Mesh(chinGeo, skinMat);
    chinMesh.position.set(0, -headHeight * 0.55, headDepth * 0.38);
    headGroup.add(chinMesh);

    // --- SCULPTED FACIAL FEATURES ---
    // A. Eyes with Sclera & Pupils
    const eyeSpacing = isFemale ? 0.068 : 0.078;
    const eyeHeight = 0.02;
    const eyeForward = headDepth * 0.92;

    for (const ex of [-eyeSpacing, eyeSpacing]) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(ex, eyeHeight, eyeForward);

      // Sclera (Eye white)
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), eyeWhiteMat);
      sclera.scale.set(1.4, 0.8, 0.6);
      eyeGroup.add(sclera);

      // Pupil / Iris
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), pupilMat);
      pupil.position.set(0, 0, 0.015);
      eyeGroup.add(pupil);

      // Upper Eyelid fold
      const eyelid = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 8, Math.PI), skinMat);
      eyelid.position.set(0, 0.008, 0.01);
      eyeGroup.add(eyelid);

      headGroup.add(eyeGroup);
    }

    // B. Eyebrows
    const browHeight = eyeHeight + 0.042;
    for (const bx of [-eyeSpacing, eyeSpacing]) {
      const eyebrow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.02), browMat);
      eyebrow.rotation.z = (bx > 0 ? -0.15 : 0.15);
      eyebrow.position.set(bx, browHeight, eyeForward + 0.015);
      headGroup.add(eyebrow);
    }

    // C. Sculpted African Nose (Bridge + Nostril Flange)
    const noseGroup = new THREE.Group();
    noseGroup.position.set(0, -0.04, eyeForward + 0.015);

    // Nose Bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.065, 0.035), skinMat);
    bridge.position.set(0, 0.025, 0);
    noseGroup.add(bridge);

    // Nose Tip (Apex)
    const apex = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMat);
    apex.scale.set(1.15, 0.9, 1.2);
    apex.position.set(0, -0.015, 0.025);
    noseGroup.add(apex);

    // Left and Right Nostrils
    for (const nx of [-0.025, 0.025]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), skinMat);
      nostril.position.set(nx, -0.02, 0.015);
      noseGroup.add(nostril);
    }
    headGroup.add(noseGroup);

    // D. Lips (Defined Upper and Lower Lip)
    const lipsGroup = new THREE.Group();
    lipsGroup.position.set(0, -0.115, eyeForward * 0.94);

    const upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.016, 0.025), lipMat);
    upperLip.position.set(0, 0.01, 0.01);
    lipsGroup.add(upperLip);

    const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.020, 0.028), lipMat);
    lowerLip.position.set(0, -0.01, 0.012);
    lipsGroup.add(lowerLip);

    headGroup.add(lipsGroup);

    // E. Ears
    const earHeight = 0.01;
    for (const ex of [-headWidth * 1.02, headWidth * 1.02]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), skinMat);
      ear.scale.set(0.4, 1.2, 0.8);
      ear.position.set(ex, earHeight, -0.02);
      headGroup.add(ear);
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
        const wigGeo = new THREE.SphereGeometry(headWidth * 1.06, 14, 12);
        wigGeo.scale(1.05, 1.25, 1.15);
        const wigMesh = new THREE.Mesh(wigGeo, hairMat);
        wigMesh.position.set(0, 0.04, -0.02);
        headGroup.add(wigMesh);

        for (const sx of [-headWidth * 1.02, headWidth * 1.02]) {
          const sideLock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 8), hairMat);
          sideLock.position.set(sx, -0.12, 0.02);
          headGroup.add(sideLock);
        }
      } else if (femaleStyle === 'braids' || femaleStyle === 'ponytail') {
        // Box Braids hanging gracefully over shoulders
        const cap = new THREE.Mesh(new THREE.SphereGeometry(headWidth * 1.04, 14, 12), hairMat);
        cap.position.set(0, 0.06, -0.02);
        headGroup.add(cap);

        for (let i = -3; i <= 3; i++) {
          const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.54, 6), hairMat);
          braid.position.set(i * 0.055, -0.22, -0.14);
          braid.rotation.x = 0.12;
          headGroup.add(braid);
        }
      } else if (femaleStyle === 'gele') {
        // Grand Nigerian Gele (layered fan headwrap with folds)
        const geleMat = new THREE.MeshStandardMaterial({
          color: secondaryColor,
          roughness: 0.52,
          metalness: 0.15,
        });
        materials.push(geleMat);

        const geleCrown = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.22, headWidth * 1.08, 0.18, 18), geleMat);
        geleCrown.position.set(0, 0.16, 0);
        headGroup.add(geleCrown);

        const fanGeo = new THREE.TorusGeometry(headWidth * 1.25, 0.08, 8, 20, Math.PI);
        const fanMesh = new THREE.Mesh(fanGeo, geleMat);
        fanMesh.rotation.x = Math.PI / 2;
        fanMesh.position.set(0, 0.25, 0);
        headGroup.add(fanMesh);
      }
    } else {
      const maleStyle = config.hairstyle || (config.outfit === 'engineer_vest' ? 'hardhat' : 'fade');

      if (maleStyle === 'hardhat' || config.outfit === 'engineer_vest') {
        // Construction Safety Hardhat
        const helmetMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          roughness: 0.35,
          metalness: 0.1,
        });
        materials.push(helmetMat);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(headWidth * 1.15, 16, 12), helmetMat);
        dome.position.set(0, 0.08, 0);
        headGroup.add(dome);

        const brim = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.35, headWidth * 1.35, 0.025, 18), helmetMat);
        brim.position.set(0, 0.03, 0.04);
        headGroup.add(brim);

        // Top reinforcement crest ridge
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, headDepth * 1.6), helmetMat);
        ridge.position.set(0, 0.20, 0);
        headGroup.add(ridge);
      } else if (maleStyle === 'fila' || config.outfit === 'agbada') {
        // Traditional Embroidered Yoruba Fila Cap
        const filaMat = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.7 });
        materials.push(filaMat);
        const filaBase = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.12, headWidth * 1.04, 0.16, 16), filaMat);
        filaBase.position.set(0, 0.12, 0);
        headGroup.add(filaBase);

        const filaCrest = new THREE.Mesh(new THREE.ConeGeometry(headWidth * 1.05, 0.18, 16), filaMat);
        filaCrest.rotation.z = 0.35; // Characteristic tilt to one side
        filaCrest.position.set(0.06, 0.24, 0);
        headGroup.add(filaCrest);
      } else if (maleStyle === 'pilot_cap') {
        // Captain Peaked Cap
        const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
        materials.push(capMat);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.18, headWidth * 1.06, 0.14, 16), capMat);
        crown.position.set(0, 0.12, 0);
        headGroup.add(crown);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(headWidth * 1.2, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 }));
        visor.position.set(0, 0.05, headDepth * 0.95);
        headGroup.add(visor);

        const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 }));
        badge.position.set(0, 0.16, headDepth * 0.9);
        headGroup.add(badge);
      } else {
        // Crisp Fade / Buzzcut with clean hairline
        const fadeCap = new THREE.Mesh(new THREE.SphereGeometry(headWidth * 1.03, 14, 10), hairMat);
        fadeCap.position.set(0, 0.04, -0.015);
        headGroup.add(fadeCap);
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
    const armMatToUse = (isFemale && config.outfit === 'blue_dress') ? skinMat : clothingMat;

    // Helper: builds an articulated 5-finger sculpted hand (Banishing the sphere!)
    const buildSculptedHand = (isLeft: boolean): THREE.Group => {
      const handGroup = new THREE.Group();
      
      // Palm block with anatomical arch
      const palmGeo = new THREE.BoxGeometry(0.075, 0.085, 0.035);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.position.set(0, -0.045, 0);
      handGroup.add(palm);

      // Angled Opposable Thumb
      const thumbX = isLeft ? 0.042 : -0.042;
      const thumbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.038, 6), skinMat);
      thumbBase.rotation.z = isLeft ? -0.55 : 0.55;
      thumbBase.position.set(thumbX, -0.03, 0.015);
      handGroup.add(thumbBase);

      const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), skinMat);
      thumbTip.position.set(thumbX * 1.35, -0.048, 0.022);
      handGroup.add(thumbTip);

      // 4 Individually Modeled Fingers (Index, Middle, Ring, Pinky)
      const fingerWidths = [0.012, 0.013, 0.012, 0.010];
      const fingerLengths = [0.048, 0.054, 0.049, 0.040];
      const fingerOffsets = [-0.027, -0.009, 0.009, 0.027];

      for (let f = 0; f < 4; f++) {
        const fingerGroup = new THREE.Group();
        fingerGroup.position.set(fingerOffsets[f], -0.085, 0);

        // Finger Phalanx
        const phalanx = new THREE.Mesh(
          new THREE.CylinderGeometry(fingerWidths[f] * 0.85, fingerWidths[f], fingerLengths[f], 6),
          skinMat
        );
        phalanx.position.set(0, -fingerLengths[f] / 2, 0);
        fingerGroup.add(phalanx);

        // Finger Tip
        const tip = new THREE.Mesh(new THREE.SphereGeometry(fingerWidths[f] * 0.85, 6, 6), skinMat);
        tip.position.set(0, -fingerLengths[f], 0);
        fingerGroup.add(tip);

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
    const thighLength = isFemale ? 0.38 : 0.42;
    const shinLength = isFemale ? 0.36 : 0.40;
    const legSpacing = isFemale ? 0.13 : 0.16;
    const legMatToUse = (isFemale && config.outfit === 'blue_dress') ? skinMat : trousersMat;

    // Helper: builds a detailed shoe with rubber sole, toe box, and heel
    const buildDetailedShoe = (isFemaleHeel: boolean): THREE.Group => {
      const shoeGroup = new THREE.Group();

      const footLength = isFemaleHeel ? 0.19 : 0.25;
      const footWidth = isFemaleHeel ? 0.075 : 0.095;

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

      // Elevated Heel / Stiletto for women's dress
      if (isFemaleHeel) {
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.06, 6), shoeMat);
        heel.position.set(0, 0.03, -0.04);
        shoeGroup.add(heel);
      }

      return shoeGroup;
    };

    // A. Left Leg Hierarchy (Hip -> Thigh -> Knee -> Shin/Calf -> Foot)
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-legSpacing, 0.78, 0);
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
    leftLowerLegGroup.add(leftShin);

    // Left Shoe
    const leftShoe = buildDetailedShoe(isFemale && config.outfit === 'blue_dress');
    leftShoe.position.set(0, -shinLength, 0);
    leftLowerLegGroup.add(leftShoe);

    // B. Right Leg Hierarchy
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(legSpacing, 0.78, 0);
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
