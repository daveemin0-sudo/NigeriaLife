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
}

/**
 * HumanMeshBuilder
 * Constructs realistic, stylized anatomical human figures for NigeriaLife.
 * Distinct female vs male silhouettes (waist, hips, bust, shoulders, hairstyles, and clothing).
 */
export class HumanMeshBuilder {
  public static createHuman(config: HumanConfig): HumanRig {
    const group = new THREE.Group();
    const materials: THREE.Material[] = [];

    const isFemale = config.gender === 'female';
    const skinHex = config.skinTone || (isFemale ? '#5c3722' : '#4a2c1d');
    const skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinHex),
      roughness: 0.65,
      metalness: 0.05,
    });
    materials.push(skinMat);

    const outfitColor = config.outfitColor ?? (isFemale ? 0x2563eb : 0xf97316);
    const secondaryColor = config.secondaryColor ?? (isFemale ? 0x1e3a8a : 0x059669);

    const clothingMat = new THREE.MeshStandardMaterial({
      color: outfitColor,
      roughness: 0.6,
    });
    materials.push(clothingMat);

    const secondaryClothingMat = new THREE.MeshStandardMaterial({
      color: secondaryColor,
      roughness: 0.6,
    });
    materials.push(secondaryClothingMat);

    const trousersMat = new THREE.MeshStandardMaterial({
      color: isFemale ? 0x1e293b : 0xea580c,
      roughness: 0.7,
    });
    materials.push(trousersMat);

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
    });
    materials.push(shoeMat);

    // Subtle ambient shadow puddle beneath feet
    const shadowGeo = new THREE.CircleGeometry(0.55, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
    });
    materials.push(shadowMat);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    group.add(shadowMesh);

    // =========================================================================
    // 1. TORSO (MASCULINE VS FEMININE ANATOMY)
    // =========================================================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = isFemale ? 1.05 : 1.1;
    group.add(torsoGroup);

    if (isFemale) {
      // FEMALE ANATOMY: Tapered ribcage, bust contour, nipped-in waist, feminine hips
      // A. Upper Chest & Bust
      const chestGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.35, 12);
      chestGeo.scale(1.2, 1, 0.85);
      const chestMesh = new THREE.Mesh(chestGeo, clothingMat);
      chestMesh.position.set(0, 0.18, 0);
      chestMesh.castShadow = true;
      torsoGroup.add(chestMesh);

      // Subtle anatomical bust curves
      const bustGeo = new THREE.SphereGeometry(0.1, 10, 8);
      const leftBust = new THREE.Mesh(bustGeo, clothingMat);
      leftBust.position.set(-0.09, 0.17, 0.12);
      leftBust.scale.set(1.1, 1, 1.2);
      torsoGroup.add(leftBust);

      const rightBust = new THREE.Mesh(bustGeo, clothingMat);
      rightBust.position.set(0.09, 0.17, 0.12);
      rightBust.scale.set(1.1, 1, 1.2);
      torsoGroup.add(rightBust);

      // B. Slender Waist
      const waistGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.22, 12);
      waistGeo.scale(1.1, 1, 0.8);
      const waistMesh = new THREE.Mesh(waistGeo, clothingMat);
      waistMesh.position.set(0, -0.08, 0);
      torsoGroup.add(waistMesh);

      // C. Curvaceous Hips & Pelvis
      const hipsGeo = new THREE.CylinderGeometry(0.17, 0.22, 0.24, 12);
      hipsGeo.scale(1.25, 1, 0.88);
      const hipsMesh = new THREE.Mesh(hipsGeo, config.outfit === 'blue_dress' ? clothingMat : trousersMat);
      hipsMesh.position.set(0, -0.28, 0);
      torsoGroup.add(hipsMesh);

      // D. Flared Dress Hem (if dress outfit, like Image 3 blue dress lady!)
      if (config.outfit === 'blue_dress' || !config.outfit) {
        const dressSkirtGeo = new THREE.ConeGeometry(0.32, 0.42, 16, 1, true);
        const dressSkirt = new THREE.Mesh(dressSkirtGeo, clothingMat);
        dressSkirt.position.set(0, -0.42, 0);
        torsoGroup.add(dressSkirt);
      }
    } else {
      // MASCULINE ANATOMY: Broad shoulders, athletic chest, straight waist to hips
      // A. Broad Shoulders & Chest
      const chestGeo = new THREE.BoxGeometry(0.56, 0.42, 0.28);
      const chestMesh = new THREE.Mesh(chestGeo, clothingMat);
      chestMesh.position.set(0, 0.18, 0);
      chestMesh.castShadow = true;
      torsoGroup.add(chestMesh);

      // B. Waist & Abdomen
      const waistGeo = new THREE.BoxGeometry(0.44, 0.34, 0.25);
      const waistMesh = new THREE.Mesh(waistGeo, clothingMat);
      waistMesh.position.set(0, -0.16, 0);
      torsoGroup.add(waistMesh);

      // C. Hips & Belt
      const hipsGeo = new THREE.BoxGeometry(0.46, 0.18, 0.26);
      const hipsMesh = new THREE.Mesh(hipsGeo, trousersMat);
      hipsMesh.position.set(0, -0.36, 0);
      torsoGroup.add(hipsMesh);

      // D. High-Visibility Safety Vest
      if (config.outfit === 'engineer_vest') {
        const vestMat = new THREE.MeshStandardMaterial({
          color: 0xf97316, // Bright High-Vis Safety Orange
          roughness: 0.5,
        });
        materials.push(vestMat);

        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xecfccb });
        materials.push(stripeMat);

        // Reflective Silver / Lime Stripes across chest and waist
        const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.29), stripeMat);
        stripe1.position.set(0, 0.26, 0);
        torsoGroup.add(stripe1);

        const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.29), stripeMat);
        stripe2.position.set(0, 0.08, 0);
        torsoGroup.add(stripe2);

        // Vertical shoulder harness stripes
        const susp1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.3), stripeMat);
        susp1.position.set(-0.16, 0.18, 0);
        torsoGroup.add(susp1);

        const susp2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.3), stripeMat);
        susp2.position.set(0.16, 0.18, 0);
        torsoGroup.add(susp2);
      }
    }

    // =========================================================================
    // OCCUPATION-SPECIFIC ATTIRE OVERLAYS (UNISEX / ADAPTABLE)
    // =========================================================================
    if (config.outfit === 'doctor_coat') {
      // Doctor's Long Clinical Lab Coat (Pure White)
      const coatMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      materials.push(coatMat);
      const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.04), coatMat);
      lapelL.position.set(-0.16, 0.16, 0.15);
      torsoGroup.add(lapelL);
      const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.04), coatMat);
      lapelR.position.set(0.16, 0.16, 0.15);
      torsoGroup.add(lapelR);

      // Pocket with clinical pens
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), coatMat);
      pocket.position.set(-0.15, 0.22, 0.17);
      torsoGroup.add(pocket);
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), new THREE.MeshBasicMaterial({ color: 0x2563eb }));
      pen.position.set(-0.14, 0.27, 0.18);
      torsoGroup.add(pen);

      // Coat tails hanging past hips
      const coatTails = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.28), coatMat);
      coatTails.position.set(0, -0.42, -0.02);
      torsoGroup.add(coatTails);
    } else if (config.outfit === 'nurse_scrubs') {
      // Cyan/Teal V-neck Medical Scrubs
      const scrubMat = new THREE.MeshStandardMaterial({ color: config.outfitColor ?? 0x0284c7, roughness: 0.6 });
      materials.push(scrubMat);
      const idBadge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.02), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      idBadge.position.set(-0.14, 0.22, 0.16);
      torsoGroup.add(idBadge);
    } else if (config.outfit === 'pilot_uniform') {
      // Captain Pilot Blazer with 4 Gold Epaulet Stripes & Gold Pilot Wings
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.3 });
      materials.push(goldMat);
      for (const sx of [-0.22, 0.22]) {
        for (let stripe = 0; stripe < 4; stripe++) {
          const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.18), goldMat);
          epaulet.position.set(sx, 0.36 + stripe * 0.022, 0);
          torsoGroup.add(epaulet);
        }
      }
      // Gold pilot wings on left breast
      const wings = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.02), goldMat);
      wings.position.set(-0.15, 0.24, 0.16);
      torsoGroup.add(wings);
    } else if (config.outfit === 'security_uniform') {
      // Tactical Security Shirt with Shield Crest
      const badgeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
      materials.push(badgeMat);
      const shield = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 5), badgeMat);
      shield.rotation.x = Math.PI;
      shield.position.set(-0.15, 0.24, 0.16);
      torsoGroup.add(shield);
    } else if (config.outfit === 'traffic_warden') {
      // LASTMA / Police High-Vis Yellow-Lime Harness
      const limeMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.4 });
      materials.push(limeMat);
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.31), limeMat);
      strapL.rotation.z = -0.25;
      strapL.position.set(-0.06, 0.16, 0);
      torsoGroup.add(strapL);
      const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.31), limeMat);
      strapR.rotation.z = 0.25;
      strapR.position.set(0.06, 0.16, 0);
      torsoGroup.add(strapR);
    } else if (config.outfit === 'chef_attire') {
      // Double-breasted Chef Jacket with Red Scarf
      const redScarf = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
      redScarf.rotation.x = Math.PI / 2;
      redScarf.position.set(0, 0.36, 0.04);
      torsoGroup.add(redScarf);
    } else if (config.outfit === 'agbada') {
      // Grand flowing Nigerian Agbada outer robe
      const agbadaMat = new THREE.MeshStandardMaterial({ color: config.outfitColor ?? 0x047857, roughness: 0.7 });
      materials.push(agbadaMat);
      const robeGeo = new THREE.BoxGeometry(0.82, 0.85, 0.38);
      const robe = new THREE.Mesh(robeGeo, agbadaMat);
      robe.position.set(0, -0.06, 0);
      torsoGroup.add(robe);

      // Gold chest embroidery medallion
      const embMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      materials.push(embMat);
      const emb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), embMat);
      emb.rotation.x = Math.PI / 2;
      emb.position.set(0, 0.18, 0.2);
      torsoGroup.add(emb);
    }

    // Optional Stethoscope around neck
    if (config.hasStethoscope) {
      const stethMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
      materials.push(stethMat);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 16), stethMat);
      loop.rotation.x = Math.PI / 3;
      loop.position.set(0, 0.34, 0.08);
      torsoGroup.add(loop);

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, 0.14, 0.16);
      torsoGroup.add(disc);
    }

    // Optional Necktie
    if (config.hasTie || config.outfit === 'pilot_uniform' || config.outfit === 'lecturer_suit') {
      const tieMat = new THREE.MeshStandardMaterial({ color: 0x09090b });
      materials.push(tieMat);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.03), tieMat);
      tie.position.set(0, 0.15, 0.16);
      torsoGroup.add(tie);
    }

    // Optional 3D Backpack (Students)
    if (config.hasBackpack || config.outfit === 'student_casual') {
      const packMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 });
      materials.push(packMat);
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.2), packMat);
      backpack.position.set(0, 0.08, -0.22);
      torsoGroup.add(backpack);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x172554 }));
      pocket.position.set(0, -0.04, -0.32);
      torsoGroup.add(pocket);
    }

    // =========================================================================
    // 2. NECK & HEAD (ANATOMICAL SHAPING)
    // =========================================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, isFemale ? 1.58 : 1.66, 0);
    group.add(headGroup);

    // Neck
    const neckRadius = isFemale ? 0.065 : 0.085;
    const neckGeo = new THREE.CylinderGeometry(neckRadius, neckRadius * 1.1, 0.16, 12);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, -0.12, 0);
    headGroup.add(neckMesh);

    // Head Cranium & Face
    const headWidth = isFemale ? 0.22 : 0.26;
    const headHeight = isFemale ? 0.27 : 0.3;
    const headDepth = isFemale ? 0.24 : 0.28;

    const headGeo = new THREE.SphereGeometry(headWidth, 14, 12);
    headGeo.scale(1, headHeight / headWidth, headDepth / headWidth);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Subtle sculpted nose
    const noseGeo = new THREE.ConeGeometry(0.035, 0.08, 8);
    const noseMesh = new THREE.Mesh(noseGeo, skinMat);
    noseMesh.rotation.x = Math.PI / 2;
    noseMesh.position.set(0, -0.01, headDepth * 0.95);
    headGroup.add(noseMesh);

    // =========================================================================
    // 3. HAIRSTYLES & HEADWEAR (DISTINCT FEMALE VS MALE)
    // =========================================================================
    const hairColor = config.hairColor || '#171717';
    const hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hairColor),
      roughness: 0.85,
    });
    materials.push(hairMat);

    if (isFemale) {
      const femaleStyle = config.hairstyle || (config.outfit === 'blue_dress' ? 'bob_wig' : 'braids');

      if (femaleStyle === 'bob_wig' || femaleStyle === 'short_crop') {
        // Sleek feminine bob / shoulder-length wig
        const wigGeo = new THREE.SphereGeometry(headWidth * 1.08, 12, 10);
        wigGeo.scale(1.05, 1.25, 1.15);
        const wigMesh = new THREE.Mesh(wigGeo, hairMat);
        wigMesh.position.set(0, 0.04, -0.02);
        headGroup.add(wigMesh);

        // Hanging hair sides
        const hairSideGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8);
        const leftSide = new THREE.Mesh(hairSideGeo, hairMat);
        leftSide.position.set(-headWidth * 1.05, -0.12, 0.02);
        headGroup.add(leftSide);

        const rightSide = new THREE.Mesh(hairSideGeo, hairMat);
        rightSide.position.set(headWidth * 1.05, -0.12, 0.02);
        headGroup.add(rightSide);
      } else if (femaleStyle === 'braids' || femaleStyle === 'ponytail') {
        // Long box braids hanging down past shoulders
        const capGeo = new THREE.SphereGeometry(headWidth * 1.04, 12, 10);
        const capMesh = new THREE.Mesh(capGeo, hairMat);
        capMesh.position.set(0, 0.06, -0.02);
        headGroup.add(capMesh);

        // Multiple individual braids hanging
        for (let i = -3; i <= 3; i++) {
          const braidGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.52, 6);
          const braid = new THREE.Mesh(braidGeo, hairMat);
          braid.position.set(i * 0.06, -0.22, -0.16);
          braid.rotation.x = 0.15;
          headGroup.add(braid);
        }
      } else if (femaleStyle === 'gele') {
        // Grand Nigerian Gele (headwrap)
        const geleMat = new THREE.MeshStandardMaterial({ color: secondaryColor, roughness: 0.5 });
        materials.push(geleMat);
        const geleBase = new THREE.CylinderGeometry(headWidth * 1.25, headWidth * 1.1, 0.18, 16);
        const geleMesh = new THREE.Mesh(geleBase, geleMat);
        geleMesh.position.set(0, 0.16, 0);
        headGroup.add(geleMesh);

        const fanGeo = new THREE.TorusGeometry(headWidth * 1.2, 0.08, 6, 16, Math.PI);
        const fanMesh = new THREE.Mesh(fanGeo, geleMat);
        fanMesh.rotation.x = Math.PI / 2;
        fanMesh.position.set(0, 0.24, 0);
        headGroup.add(fanMesh);
      }
    } else {
      // MALE HEADWEAR: Construction Hardhat (Image 3!), Fila, or Short Fade
      const maleStyle = config.hairstyle || (config.outfit === 'engineer_vest' ? 'hardhat' : 'fade');

      if (maleStyle === 'hardhat') {
        // Construction Safety Helmet (Electric Blue, like Image 3!)
        const helmetMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7, // Vibrant Blue Hardhat
          roughness: 0.3,
          metalness: 0.1,
        });
        materials.push(helmetMat);

        const domeGeo = new THREE.SphereGeometry(headWidth * 1.12, 14, 10);
        const domeMesh = new THREE.Mesh(domeGeo, helmetMat);
        domeMesh.position.set(0, 0.06, 0);
        headGroup.add(domeMesh);

        // Helmet brim
        const brimGeo = new THREE.CylinderGeometry(headWidth * 1.35, headWidth * 1.35, 0.03, 16);
        const brimMesh = new THREE.Mesh(brimGeo, helmetMat);
        brimMesh.position.set(0, 0.01, 0.04);
        headGroup.add(brimMesh);

        // Hardhat center ridge
        const ridgeGeo = new THREE.BoxGeometry(0.04, 0.08, headDepth * 1.8);
        const ridgeMesh = new THREE.Mesh(ridgeGeo, helmetMat);
        ridgeMesh.position.set(0, 0.16, 0);
        headGroup.add(ridgeMesh);
      } else if (maleStyle === 'fila') {
        // Yoruba / Senator Fila Cap
        const filaMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
        materials.push(filaMat);
        const filaGeo = new THREE.CylinderGeometry(headWidth * 1.05, headWidth * 1.02, 0.18, 14);
        const filaMesh = new THREE.Mesh(filaGeo, filaMat);
        filaMesh.rotation.z = -0.15;
        filaMesh.position.set(0.04, 0.14, 0);
        headGroup.add(filaMesh);
      } else if (maleStyle === 'pilot_cap' || config.hairstyle === 'pilot_cap') {
        // Commercial Airline Pilot Peaked Cap with Gold Laurel Visor
        const pilotCapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
        materials.push(pilotCapMat);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.15, headWidth * 1.05, 0.14, 16), pilotCapMat);
        crown.position.set(0, 0.12, 0);
        headGroup.add(crown);

        const goldVisorMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 });
        materials.push(goldVisorMat);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(headWidth * 1.25, 0.03, 0.16), new THREE.MeshStandardMaterial({ color: 0x020617 }));
        visor.position.set(0, 0.06, headDepth * 0.95);
        headGroup.add(visor);

        const crest = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 5), goldVisorMat);
        crest.rotation.x = Math.PI;
        crest.position.set(0, 0.16, headDepth * 0.9);
        headGroup.add(crest);
      } else if (maleStyle === 'police_cap' || config.hairstyle === 'police_cap') {
        // Nigeria Police Service Peaked Cap
        const policeCapMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        materials.push(policeCapMat);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.12, headWidth * 1.04, 0.14, 16), policeCapMat);
        crown.position.set(0, 0.12, 0);
        headGroup.add(crown);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(headWidth * 1.2, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: 0x09090b }));
        visor.position.set(0, 0.06, headDepth * 0.92);
        headGroup.add(visor);

        const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
        badge.position.set(0, 0.15, headDepth * 0.9);
        headGroup.add(badge);
      } else if (maleStyle === 'chef_toque' || config.hairstyle === 'chef_toque') {
        // White Chef Pleated Toque
        const toqueMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
        materials.push(toqueMat);
        const toque = new THREE.Mesh(new THREE.CylinderGeometry(headWidth * 1.18, headWidth * 1.05, 0.36, 16), toqueMat);
        toque.position.set(0, 0.24, 0);
        headGroup.add(toque);
      } else {
        // Clean male fade / buzzcut
        const hairGeo = new THREE.SphereGeometry(headWidth * 1.02, 12, 8);
        const hairMesh = new THREE.Mesh(hairGeo, hairMat);
        hairMesh.position.set(0, 0.04, -0.02);
        headGroup.add(hairMesh);
      }
    }

    // Street Drinks & Snacks Hawker Tray balanced on head
    if (config.hasTray) {
      const basinMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }); // Red plastic basin
      materials.push(basinMat);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.16, 16), basinMat);
      basin.position.set(0, headHeight + 0.14, 0);
      headGroup.add(basin);

      // Sachet pure water bags & Gala sausage rolls in tray
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
      materials.push(waterMat);
      for (let w = -2; w <= 2; w++) {
        const sachet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), waterMat);
        sachet.position.set(w * 0.12, headHeight + 0.22, (w % 2) * 0.1);
        headGroup.add(sachet);
      }

      const galaMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
      materials.push(galaMat);
      for (let g = -1; g <= 1; g++) {
        const gala = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), galaMat);
        gala.rotation.x = Math.PI / 2;
        gala.position.set(g * 0.16, headHeight + 0.25, -0.1);
        headGroup.add(gala);
      }
    }

    // =========================================================================
    // 4. ARMS & HANDS
    // =========================================================================
    const armRadius = isFemale ? 0.055 : 0.08;
    const armLength = isFemale ? 0.58 : 0.65;

    // Left Arm
    const leftArmGroup = new THREE.Group();
    const shoulderX = isFemale ? 0.24 : 0.34;
    leftArmGroup.position.set(-shoulderX, isFemale ? 1.32 : 1.4, 0);
    group.add(leftArmGroup);

    const leftArmGeo = new THREE.CylinderGeometry(armRadius, armRadius * 0.85, armLength, 10);
    // Arms sleeveless for dresses or t-shirts, otherwise clothed
    const armMatToUse = (isFemale && config.outfit === 'blue_dress') ? skinMat : clothingMat;
    const leftArmMesh = new THREE.Mesh(leftArmGeo, armMatToUse);
    leftArmMesh.position.set(0, -armLength / 2, 0);
    leftArmGroup.add(leftArmMesh);

    // Left Hand
    const handGeo = new THREE.SphereGeometry(armRadius * 0.9, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(0, -armLength, 0);
    leftArmGroup.add(leftHand);

    // Right Arm
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(shoulderX, isFemale ? 1.32 : 1.4, 0);
    group.add(rightArmGroup);

    const rightArmMesh = new THREE.Mesh(leftArmGeo, armMatToUse);
    rightArmMesh.position.set(0, -armLength / 2, 0);
    rightArmGroup.add(rightArmMesh);

    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.set(0, -armLength, 0);
    rightArmGroup.add(rightHand);

    // Smartphone model attached to right hand (hidden until phone_call)
    const phoneGeo = new THREE.BoxGeometry(0.08, 0.14, 0.02);
    const phoneMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 });
    materials.push(phoneMat);
    const phoneMesh = new THREE.Mesh(phoneGeo, phoneMat);
    phoneMesh.position.set(0.02, -armLength, 0.03);
    phoneMesh.visible = false;
    rightArmGroup.add(phoneMesh);

    // =========================================================================
    // 5. LEGS & FEET / SHOES
    // =========================================================================
    const legRadius = isFemale ? 0.075 : 0.1;
    const legLength = isFemale ? 0.72 : 0.76;
    const legSpacing = isFemale ? 0.13 : 0.16;

    // Left Leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-legSpacing, 0.76, 0);
    group.add(leftLegGroup);

    const legMatToUse = (isFemale && config.outfit === 'blue_dress') ? skinMat : trousersMat;
    const leftLegMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 0.85, legLength, 10),
      legMatToUse
    );
    leftLegMesh.position.set(0, -legLength / 2, 0);
    leftLegGroup.add(leftLegMesh);

    // Left Shoe / Heel / Work Boot
    const footLength = isFemale ? 0.18 : 0.24;
    const shoeGeo = new THREE.BoxGeometry(armRadius * 1.4, 0.08, footLength);
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(0, -legLength, 0.04);
    leftLegGroup.add(leftShoe);

    // Right Leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(legSpacing, 0.76, 0);
    group.add(rightLegGroup);

    const rightLegMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 0.85, legLength, 10),
      legMatToUse
    );
    rightLegMesh.position.set(0, -legLength / 2, 0);
    rightLegGroup.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0, -legLength, 0.04);
    rightLegGroup.add(rightShoe);

    // =========================================================================
    // 6. FLOATING SOCIAL USERNAME TAG (MATCHING IMAGE 3)
    // =========================================================================
    const nameTag = HumanMeshBuilder.createUsernameTag(config.username);
    nameTag.position.set(0, isFemale ? 2.05 : 2.15, 0);
    group.add(nameTag);

    // =========================================================================
    // 7. ANIMATION TICK FUNCTION
    // Supports: walk, run, dance (Afrobeats), talk, phone_call, idle
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
        // High-energy sprint
        const stride = Math.sin(time * 14);
        leftLegGroup.rotation.x = stride * 0.95;
        rightLegGroup.rotation.x = -stride * 0.95;
        leftArmGroup.rotation.x = -stride * 0.85;
        rightArmGroup.rotation.x = stride * 0.85;
        leftArmGroup.rotation.z = -0.25;
        rightArmGroup.rotation.z = 0.25;
        torsoGroup.position.y = defaultY + Math.abs(Math.sin(time * 28)) * 0.08;
        torsoGroup.rotation.x = 0.12;
        torsoGroup.rotation.z = 0;
        headGroup.rotation.set(0, 0, 0);
      } else if (isWalking) {
        // Stylized natural walk
        const stride = Math.sin(time * 8);
        leftLegGroup.rotation.x = stride * 0.6;
        rightLegGroup.rotation.x = -stride * 0.6;
        leftArmGroup.rotation.x = -stride * 0.5;
        rightArmGroup.rotation.x = stride * 0.5;
        leftArmGroup.rotation.z = 0;
        rightArmGroup.rotation.z = 0;
        torsoGroup.position.y = defaultY + Math.abs(Math.sin(time * 16)) * 0.04;
        torsoGroup.rotation.x = 0;
        torsoGroup.rotation.z = Math.sin(time * 8) * 0.03;
        headGroup.rotation.set(0, 0, 0);
      } else if (isDancing) {
        // Authentic Afrobeats shoulder roll, hip sway & bounce
        const beat = time * 8;
        const bounce = Math.abs(Math.sin(beat)) * 0.08;
        torsoGroup.position.y = defaultY - bounce;
        torsoGroup.rotation.z = Math.sin(beat * 0.5) * 0.14; // Hip sway
        torsoGroup.rotation.y = Math.cos(beat * 0.5) * 0.12;
        torsoGroup.rotation.x = 0;

        leftArmGroup.rotation.x = -1.1 + Math.sin(beat) * 0.35;
        rightArmGroup.rotation.x = -1.1 + Math.cos(beat) * 0.35;
        leftArmGroup.rotation.z = -0.4 + Math.sin(beat * 0.5) * 0.25;
        rightArmGroup.rotation.z = 0.4 - Math.cos(beat * 0.5) * 0.25;

        headGroup.rotation.y = Math.sin(beat * 0.5) * 0.18;
        headGroup.rotation.x = Math.sin(beat) * 0.1;

        leftLegGroup.rotation.x = Math.sin(beat * 0.5) * 0.2;
        rightLegGroup.rotation.x = -Math.sin(beat * 0.5) * 0.2;
      } else if (isCalling) {
        // Holding phone to right ear with subtle conversational nod
        torsoGroup.position.y = defaultY + Math.sin(time * 2) * 0.012;
        torsoGroup.rotation.set(0, 0, 0);
        rightArmGroup.rotation.set(-2.2, 0.35, 0.55);
        leftArmGroup.rotation.set(Math.sin(time * 2) * 0.04, 0, 0);
        headGroup.rotation.set(Math.sin(time * 2.5) * 0.05, 0, -0.12);
        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
      } else if (isTalking) {
        // Conversational gesturing
        const gesture = Math.sin(time * 4);
        torsoGroup.position.y = defaultY + Math.sin(time * 2) * 0.015;
        torsoGroup.rotation.set(0, 0, 0);
        leftArmGroup.rotation.set(-0.4 + gesture * 0.2, 0, -0.2);
        rightArmGroup.rotation.set(-0.75 + Math.cos(time * 3) * 0.25, 0, 0.25);
        headGroup.rotation.set(Math.sin(time * 3) * 0.08, Math.sin(time * 1.5) * 0.12, 0);
        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
      } else {
        // Subtle natural breathing / idle posture
        const breath = Math.sin(time * 2) * 0.015;
        torsoGroup.position.y = defaultY + breath;
        torsoGroup.rotation.set(0, 0, 0);
        headGroup.rotation.set(0, 0, 0);
        leftArmGroup.rotation.set(Math.sin(time * 2) * 0.03, 0, 0);
        rightArmGroup.rotation.set(-Math.sin(time * 2) * 0.03, 0, 0);
        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
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
    const bg = '#2563eb'; // Sleek Social Blue (like Image 3)
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
