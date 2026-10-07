import * as THREE from 'three';
import type { InteractiveObject } from './World';
import { SignageLibrary } from '../materials/SignageLibrary';

export class NPCs {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];

  // Street Hawker (moves back and forth along the sidewalk)
  private hawker: THREE.Group;
  private hawkerDir: number = 1;
  private hawkerSpeed: number = 2.2;
  private hawkerWalkTime: number = 0;
  private hawkerLegL!: THREE.Mesh;
  private hawkerLegR!: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    this.hawker = this.createHawker();
    this.createDanfoConductor();
    this.createBetCustomer();
    this.createAuntyAnkara();
    this.createCorporateBanker();
  }

  // 1. Street Hawker with Plantain Chips / Bottled Water tray on head
  private createHawker(): THREE.Group {
    const hawkerGroup = new THREE.Group();
    hawkerGroup.position.set(-8.5, 0, -20);

    // Shadow
    const shadowGeo = new THREE.CircleGeometry(0.45, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    hawkerGroup.add(shadow);

    // Torso (Yellow t-shirt)
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    hawkerGroup.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.5;
    hawkerGroup.add(head);

    // Tray on head with bottled drinks & snacks
    const trayGeo = new THREE.CylinderGeometry(0.55, 0.45, 0.15, 16);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.y = 1.82;
    hawkerGroup.add(tray);

    // Snack bottles/packs inside tray
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const bottleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8);
      const bottleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const bottle = new THREE.Mesh(bottleGeo, bottleMat);
      bottle.position.set(Math.cos(angle) * 0.25, 2.0, Math.sin(angle) * 0.25);
      hawkerGroup.add(bottle);
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    this.hawkerLegL = new THREE.Mesh(legGeo, legMat);
    this.hawkerLegL.position.set(-0.16, 0.35, 0);
    hawkerGroup.add(this.hawkerLegL);

    this.hawkerLegR = new THREE.Mesh(legGeo, legMat);
    this.hawkerLegR.position.set(0.16, 0.35, 0);
    hawkerGroup.add(this.hawkerLegR);

    this.group.add(hawkerGroup);

    this.interactiveList.push({
      mesh: hawkerGroup,
      id: 'npc-hawker',
      name: 'Chidi - Street Drinks Hawker',
      category: 'Street Vendor',
      description: '"Cold pure water, chilled Coke, Gala, and fresh plantain chips! Only ₦200!"',
      interactionPoint: new THREE.Vector3(-7.5, 0, -20),
    });

    return hawkerGroup;
  }

  // 2. Danfo Conductor at Bus Stop
  private createDanfoConductor(): void {
    const conductor = new THREE.Group();
    conductor.position.set(-7.5, 0, 8.5);

    // Torso (Sleeveless singlet / jersey)
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    conductor.add(body);

    // Head with baseball cap
    const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1d, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.55;
    conductor.add(head);

    const capGeo = new THREE.BoxGeometry(0.42, 0.15, 0.5);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 1.75, 0.05);
    conductor.add(cap);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.16, 0.35, 0);
    conductor.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.16, 0.35, 0);
    conductor.add(legR);

    this.group.add(conductor);

    this.interactiveList.push({
      mesh: conductor,
      id: 'npc-conductor',
      name: 'Agbero / Danfo Conductor',
      category: 'Transport NPC',
      description: '"Oshodi straight! Enter with your ₦300 exact change, no ₦1,000 note!"',
      interactionPoint: new THREE.Vector3(-6.2, 0, 8.5),
    });
  }

  // 3. Citizen outside Bet9ja (Wearing green Ankara Dashiki)
  private createBetCustomer(): void {
    const signLib = SignageLibrary.getInstance();
    const guy = new THREE.Group();
    guy.position.set(8.5, 0, 10.5);

    const bodyGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: signLib.ankaraFabrics[2]?.map ?? null,
      color: 0xffffff,
      roughness: 0.65,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    guy.add(body);

    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    head.castShadow = true;
    guy.add(head);

    // Jeans
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.35, 0);
    guy.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15, 0.35, 0);
    guy.add(legR);

    // Holding smartphone checking scores
    const phoneGeo = new THREE.BoxGeometry(0.12, 0.22, 0.04);
    const phoneMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const phone = new THREE.Mesh(phoneGeo, phoneMat);
    phone.position.set(-0.35, 1.1, 0.25);
    guy.add(phone);

    this.group.add(guy);

    this.interactiveList.push({
      mesh: guy,
      id: 'npc-punter',
      name: 'Segun - Street Punter',
      category: 'Citizen NPC',
      description: '"Bro, Chelsea cut my ₦500,000 ticket in 93rd minute yesterday! Pain!"',
      interactionPoint: new THREE.Vector3(7.2, 0, 10.5),
    });
  }

  // 4. Elegant Market Trader Aunty outside Sabo Textiles (Ankara Wrapper & Gele Head-tie)
  private createAuntyAnkara(): void {
    const signLib = SignageLibrary.getInstance();
    const aunty = new THREE.Group();
    aunty.position.set(10.5, 0, 24);

    // Shadow
    const shadowGeo = new THREE.CircleGeometry(0.45, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    aunty.add(shadow);

    // Ankara Buba blouse & Iro wrapper skirt
    const ankaraMat = new THREE.MeshStandardMaterial({
      map: signLib.ankaraFabrics[1]?.map ?? null,
      color: 0xffffff,
      roughness: 0.7,
    });

    const blouse = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.36), ankaraMat);
    blouse.position.y = 1.0;
    blouse.castShadow = true;
    aunty.add(blouse);

    // Wrapper skirt (flared cylinder)
    const skirtGeo = new THREE.CylinderGeometry(0.32, 0.42, 0.7, 16);
    const skirt = new THREE.Mesh(skirtGeo, ankaraMat);
    skirt.position.y = 0.45;
    skirt.castShadow = true;
    aunty.add(skirt);

    // Head
    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1d, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.55;
    head.castShadow = true;
    aunty.add(head);

    // Magnificent Gele (Yoruba pleated formal head-tie)
    const geleMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.5,
      metalness: 0.15,
    });
    const geleGeo = new THREE.BoxGeometry(0.72, 0.32, 0.55);
    const gele = new THREE.Mesh(geleGeo, geleMat);
    gele.position.set(0, 1.82, 0);
    gele.rotation.z = -0.08;
    gele.castShadow = true;
    aunty.add(gele);

    // Gold hoop earrings
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.95, roughness: 0.2 });
    for (const ex of [-0.21, 0.21]) {
      const earring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), ringMat);
      earring.position.set(ex, 1.52, 0);
      aunty.add(earring);
    }

    // Leather handbag in hand
    const bagGeo = new THREE.BoxGeometry(0.28, 0.26, 0.14);
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });
    const bag = new THREE.Mesh(bagGeo, bagMat);
    bag.position.set(0.42, 0.75, 0.1);
    aunty.add(bag);

    this.group.add(aunty);

    this.interactiveList.push({
      mesh: aunty,
      id: 'npc-aunty',
      name: 'Mama Nkechi - Fabric Merchant',
      category: 'Citizen NPC',
      description: '"Ah-ah! My fine customer! Enter Sabo Textiles and touch our new Hollandais arrival!"',
      interactionPoint: new THREE.Vector3(9.2, 0, 24),
    });
  }

  // 5. Corporate Banker outside Eko Commercial Bank (Crisp shirt, tie, and briefcase)
  private createCorporateBanker(): void {
    const banker = new THREE.Group();
    banker.position.set(10.5, 0, -18);

    // Shadow
    const shadowGeo = new THREE.CircleGeometry(0.45, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    banker.add(shadow);

    // Formal light blue corporate dress shirt
    const shirtGeo = new THREE.BoxGeometry(0.55, 0.78, 0.34);
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.6 });
    const shirt = new THREE.Mesh(shirtGeo, shirtMat);
    shirt.position.y = 0.98;
    shirt.castShadow = true;
    banker.add(shirt);

    // Silk dark navy corporate necktie
    const tieGeo = new THREE.BoxGeometry(0.08, 0.52, 0.04);
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 });
    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.position.set(0, 1.05, 0.18);
    banker.add(tie);

    // Head
    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x311d11, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.55;
    head.castShadow = true;
    banker.add(head);

    // Charcoal corporate trousers & polished oxford shoes
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const legGeo = new THREE.BoxGeometry(0.19, 0.62, 0.19);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.15, 0.35, 0);
    banker.add(legL);
    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.15, 0.35, 0);
    banker.add(legR);

    // Leather business briefcase
    const caseGeo = new THREE.BoxGeometry(0.12, 0.32, 0.42);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x271911, roughness: 0.3, metalness: 0.1 });
    const briefcase = new THREE.Mesh(caseGeo, caseMat);
    briefcase.position.set(-0.38, 0.68, 0);
    briefcase.castShadow = true;
    banker.add(briefcase);

    this.group.add(banker);

    this.interactiveList.push({
      mesh: banker,
      id: 'npc-banker',
      name: 'Tunde - Investment Banker',
      category: 'Citizen NPC',
      description: '"Central Bank MPC rate decision was announced today. Need to review the treasury bond yield curves."',
      interactionPoint: new THREE.Vector3(9.2, 0, -18),
    });
  }

  public update(delta: number): void {
    // Animate Hawker pacing up and down sidewalk
    this.hawker.position.z += this.hawkerDir * this.hawkerSpeed * delta;
    this.hawkerWalkTime += delta * 7;

    this.hawkerLegL.rotation.x = Math.sin(this.hawkerWalkTime) * 0.45;
    this.hawkerLegR.rotation.x = -Math.sin(this.hawkerWalkTime) * 0.45;

    if (this.hawker.position.z > 25) {
      this.hawkerDir = -1;
      this.hawker.rotation.y = Math.PI;
    } else if (this.hawker.position.z < -35) {
      this.hawkerDir = 1;
      this.hawker.rotation.y = 0;
    }
  }
}
