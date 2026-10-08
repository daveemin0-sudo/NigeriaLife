import * as THREE from 'three';

export type Gender = 'male' | 'female';

export interface HumanConfig {
  gender: Gender;
  username: string;
  skinTone?: string;
  hairColor?: string;
  hairstyle?: 'short_crop' | 'fade' | 'afro' | 'braids' | 'bob_wig' | 'ponytail' | 'hardhat' | 'fila' | 'gele';
  outfit?: 'engineer_vest' | 'senator' | 'blue_dress' | 'peplum_skirt' | 'casual_tee' | 'casual_blouse';
  outfitColor?: number;
  secondaryColor?: number;
  heightScale?: number;
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
  updateAnimation: (time: number, isWalking: boolean) => void;
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

      // D. High-Visibility Safety Vest (Like foreground worker in Image 3!)
      if (config.outfit === 'engineer_vest' || config.outfit === undefined) {
        const vestMat = new THREE.MeshStandardMaterial({
          color: 0xf97316, // Bright High-Vis Safety Orange
          roughness: 0.5,
        });
        materials.push(vestMat);

        const stripeMat = new THREE.MeshBasicMaterial({
          color: 0xecfccb, // Reflective Lime Yellow Striping
        });
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
      } else {
        // Clean male fade / buzzcut
        const hairGeo = new THREE.SphereGeometry(headWidth * 1.02, 12, 8);
        const hairMesh = new THREE.Mesh(hairGeo, hairMat);
        hairMesh.position.set(0, 0.04, -0.02);
        headGroup.add(hairMesh);
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
    // =========================================================================
    const updateAnimation = (time: number, isWalking: boolean) => {
      if (isWalking) {
        const stride = Math.sin(time * 8);
        leftLegGroup.rotation.x = stride * 0.6;
        rightLegGroup.rotation.x = -stride * 0.6;
        leftArmGroup.rotation.x = -stride * 0.5;
        rightArmGroup.rotation.x = stride * 0.5;
        torsoGroup.position.y = (isFemale ? 1.05 : 1.1) + Math.abs(Math.sin(time * 16)) * 0.04;
      } else {
        // Subtle natural breathing / idle sway
        const breath = Math.sin(time * 2) * 0.015;
        torsoGroup.position.y = (isFemale ? 1.05 : 1.1) + breath;
        leftArmGroup.rotation.x = Math.sin(time * 2) * 0.03;
        rightArmGroup.rotation.x = -Math.sin(time * 2) * 0.03;
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
