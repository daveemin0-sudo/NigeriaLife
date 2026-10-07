import * as THREE from 'three';
import type { InteractiveObject } from './World';

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

  // 3. Citizen outside Bet9ja
  private createBetCustomer(): void {
    const guy = new THREE.Group();
    guy.position.set(8.5, 0, 10.5);

    const bodyGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    guy.add(body);

    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    guy.add(head);

    // Holding paper bet slip / smartphone
    const phoneGeo = new THREE.BoxGeometry(0.12, 0.22, 0.04);
    const phoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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
