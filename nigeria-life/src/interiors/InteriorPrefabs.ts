import * as THREE from 'three';
import { HingedDoor } from '../interactions/Door';
import { InteractionDirector } from '../interactions/InteractionDirector';

export class InteriorPrefabs {
  // Shared materials for efficient draw calls
  private static matTileWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  private static matWoodDesk = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  private static matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  private static matChrome = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
  private static matBlueFabric = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });
  private static matRedFabric = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
  private static matGlass = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45, roughness: 0.1 });

  private static tileImage: HTMLCanvasElement | null = null;

  /** Floor tiles with grout lines, tinted by the floor's own colour. One tile is 1.5 m square. */
  private static tileTexture(width: number, length: number): THREE.CanvasTexture {
    if (!this.tileImage) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      // A faint sheen across each tile, and the grout between them
      const sheen = ctx.createLinearGradient(0, 0, 128, 128);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sheen.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = 'rgba(40, 40, 50, 0.2)';
      ctx.fillRect(0, 0, 128, 3);
      ctx.fillRect(0, 0, 3, 128);
      this.tileImage = canvas;
    }
    const texture = new THREE.CanvasTexture(this.tileImage);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / 1.5, length / 1.5);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  /**
   * Build a modular room with floor, cutaway low front walls (for isometric camera clarity),
   * and high back/side walls.
   */
  public static createRoom(
    width: number,
    length: number,
    height: number = 4.2,
    floorColor: number = 0xf1f5f9,
    wallColor: number = 0x334155
  ): THREE.Group {
    const room = new THREE.Group();
    room.name = 'interior_room_shell';
    room.userData.size = { width, length, height };

    // Floor
    const floorGeo = new THREE.BoxGeometry(width, 0.4, length);
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.3, map: this.tileTexture(width, length) });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.name = 'interior_floor_mesh';
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    room.add(floor);

    // Wall Material
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.7 });
    const wallThick = 0.4;

    // Back wall (Z = -length / 2)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), wallMat);
    backWall.name = 'shell_wall_back';
    backWall.position.set(0, height / 2, -length / 2);
    backWall.receiveShadow = true;
    room.add(backWall);

    // Left wall (X = -width / 2)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, length), wallMat);
    leftWall.name = 'shell_wall_left';
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.receiveShadow = true;
    room.add(leftWall);

    // Right wall (X = width / 2)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, length), wallMat);
    rightWall.name = 'shell_wall_right';
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.receiveShadow = true;
    room.add(rightWall);

    // A painted lower band with a rail above it runs round the three tall walls. Each piece is
    // part of its wall, so it comes down with the wall when the camera looks over it.
    const bandColor = new THREE.Color(wallColor).multiplyScalar(0.7);
    const bandMat = new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.75 });
    const railMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallColor).lerp(new THREE.Color(0xffffff), 0.55), roughness: 0.6 });
    const bandH = 1.1;
    const inner = wallThick / 2 + 0.015;
    const dress = (wall: THREE.Mesh, span: number, alongX: boolean, inward: number) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(alongX ? span : 0.03, bandH, alongX ? 0.03 : span), bandMat);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? span : 0.06, 0.08, alongX ? 0.06 : span), railMat);
      band.position.y = -height / 2 + bandH / 2;
      rail.position.y = -height / 2 + bandH + 0.04;
      if (alongX) {
        band.position.z = inward * inner;
        rail.position.z = inward * (inner + 0.015);
      } else {
        band.position.x = inward * inner;
        rail.position.x = inward * (inner + 0.015);
      }
      wall.add(band, rail);
    };
    dress(backWall, width - wallThick, true, 1);
    dress(leftWall, length - wallThick, false, 1);
    dress(rightWall, length - wallThick, false, -1);

    // Front Low Cutaway Wall (Z = length / 2, height = 1.0) with door opening
    const halfFrontW = (width - 3.2) / 2;
    const frontWallL = new THREE.Mesh(new THREE.BoxGeometry(halfFrontW, 1.2, wallThick), wallMat);
    frontWallL.position.set(-width / 2 + halfFrontW / 2, 0.6, length / 2);
    room.add(frontWallL);

    const frontWallR = new THREE.Mesh(new THREE.BoxGeometry(halfFrontW, 1.2, wallThick), wallMat);
    frontWallR.position.set(width / 2 - halfFrontW / 2, 0.6, length / 2);
    room.add(frontWallR);

    // Skirting baseboard along back wall
    const skirting = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.2, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    skirting.position.set(0, 0.1, -length / 2 + wallThick / 2 + 0.03);
    room.add(skirting);

    return room;
  }

  /**
   * Exit door glowing portal with clear green emergency exit signage.
   */
  public static createExitDoor(pos: THREE.Vector3, rotY: number = Math.PI): THREE.Group {
    const doorGroup = new THREE.Group();
    doorGroup.position.copy(pos);
    doorGroup.rotation.y = rotY;

    doorGroup.name = 'interior_exit_door';

    // Door frame: two posts and a lintel around an opening the player can walk through
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, 0.2), frameMat);
      post.position.set(side * 0.975, 1.6, 0);
      doorGroup.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.2), frameMat);
    lintel.position.y = 3.05;
    doorGroup.add(lintel);

    // Glass door on a hinge; it swings outward, away from the room
    const door = new HingedDoor({ width: 1.5, height: 2.9, material: this.matGlass, swing: 1.75, thickness: 0.05 });
    doorGroup.add(door.group);
    doorGroup.userData.door = InteractionDirector.get().addDoor(door);

    // Glowing Green "EXIT TO STREET" Sign
    const signGeo = new THREE.BoxGeometry(1.6, 0.5, 0.15);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x15803d, emissiveIntensity: 0.6 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.2, 0.1);
    doorGroup.add(sign);

    // Floor welcome mat
    const matGeo = new THREE.BoxGeometry(2.2, 0.05, 1.4);
    const matMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    const mat = new THREE.Mesh(matGeo, matMat);
    mat.position.set(0, 0.025, 0.8);
    doorGroup.add(mat);

    return doorGroup;
  }

  // =========================================================================
  // HOSPITAL PREFABS
  // =========================================================================
  public static createHospitalBed(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const bedGroup = new THREE.Group();
    bedGroup.position.copy(pos);
    bedGroup.rotation.y = rotY;

    // Steel frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 4.2), this.matChrome);
    frame.position.y = 0.5;
    frame.castShadow = true;
    bedGroup.add(frame);

    // White medical mattress
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.35, 4.0),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    mattress.position.set(0, 0.9, 0);
    bedGroup.add(mattress);

    // Blue Hospital Sheet / Pillow
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.8), this.matBlueFabric);
    pillow.position.set(0, 1.15, -1.4);
    bedGroup.add(pillow);

    // IV Drip Stand beside bed
    const dripGroup = this.createIVDripStand(new THREE.Vector3(1.6, 0, -1.0));
    bedGroup.add(dripGroup);

    // Heart rate monitor on rolling cart
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), this.matChrome);
    cart.position.set(-1.6, 0.6, -1.0);
    bedGroup.add(cart);

    const monitorScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.45, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x059669 }) // Green vital pulse line
    );
    monitorScreen.position.set(-1.6, 1.4, -0.95);
    bedGroup.add(monitorScreen);

    return bedGroup;
  }

  public static createIVDripStand(pos: THREE.Vector3): THREE.Group {
    const drip = new THREE.Group();
    drip.position.copy(pos);

    // Stand base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 8), this.matDarkMetal);
    drip.add(base);

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), this.matChrome);
    pole.position.y = 1.2;
    drip.add(pole);

    // Hanging Saline bag
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.1), this.matGlass);
    bag.position.set(0.12, 2.2, 0);
    drip.add(bag);

    return drip;
  }

  public static createDoctorDesk(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const deskGroup = new THREE.Group();
    deskGroup.position.copy(pos);
    deskGroup.rotation.y = rotY;

    // Executive wooden consultation desk
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.8), this.matWoodDesk);
    top.position.y = 1.1;
    deskGroup.add(top);

    // Desk pedestal drawers
    for (let x of [-1.5, 1.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.05, 1.6), this.matWoodDesk);
      leg.position.set(x, 0.53, 0);
      deskGroup.add(leg);
    }

    // Doctor's laptop
    const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.45), this.matChrome);
    laptop.position.set(0, 1.18, 0.1);
    deskGroup.add(laptop);

    // Doctor ergonomic chair
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), this.matDarkMetal);
    chair.position.set(0, 0.8, -1.2);
    deskGroup.add(chair);

    // Patient chair opposite desk
    const patientChair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), this.matBlueFabric);
    patientChair.position.set(0, 0.6, 1.4);
    deskGroup.add(patientChair);

    return deskGroup;
  }

  public static createWaitingChairs(pos: THREE.Vector3, count: number = 4, spacing: number = 0.9): THREE.Group {
    const chairsGroup = new THREE.Group();
    chairsGroup.position.copy(pos);

    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * spacing;
      // Steel bench connector
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.65), this.matBlueFabric);
      seat.position.set(x, 0.5, 0);
      chairsGroup.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.1), this.matBlueFabric);
      back.position.set(x, 0.85, -0.3);
      chairsGroup.add(back);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), this.matChrome);
      leg.position.set(x, 0.25, 0);
      chairsGroup.add(leg);
    }

    return chairsGroup;
  }

  public static createPharmacyShelf(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const shelfGroup = new THREE.Group();
    shelfGroup.position.copy(pos);
    shelfGroup.rotation.y = rotY;

    // Shelving unit frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 0.8), this.matDarkMetal);
    frame.position.y = 1.6;
    shelfGroup.add(frame);

    // Shelves with colorful pill boxes and bottles
    const colors = [0xef4444, 0x10b981, 0x3b82f6, 0xf59e0b];
    for (let r = 0; r < 4; r++) {
      const y = 0.7 + r * 0.7;
      for (let c = 0; c < 6; c++) {
        const x = -1.8 + c * 0.7;
        const boxMat = new THREE.MeshStandardMaterial({ color: colors[(r + c) % colors.length] });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), boxMat);
        box.position.set(x, y, 0.15);
        shelfGroup.add(box);
      }
    }

    return shelfGroup;
  }

  // =========================================================================
  // BANK PREFABS
  // =========================================================================
  public static createBankTellerCounter(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const counterGroup = new THREE.Group();
    counterGroup.position.copy(pos);
    counterGroup.rotation.y = rotY;

    // Marble counter top
    const counter = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.2, 1.4), this.matDarkMetal);
    counter.position.y = 0.6;
    counterGroup.add(counter);

    // Bulletproof security glass divider
    const glass = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.8, 0.08), this.matGlass);
    glass.position.set(0, 2.1, 0);
    counterGroup.add(glass);

    // Cash transaction pass-through slots
    for (let tx of [-2.0, 0, 2.0]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), this.matChrome);
      tray.position.set(tx, 1.22, 0);
      counterGroup.add(tray);

      // Computer monitor behind counter
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.1), this.matDarkMetal);
      monitor.position.set(tx, 1.5, -0.4);
      counterGroup.add(monitor);
    }

    return counterGroup;
  }

  public static createATMKiosk(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const atmGroup = new THREE.Group();
    atmGroup.position.copy(pos);
    atmGroup.rotation.y = rotY;

    // Body housing
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 }); // Diamond blue banking finish
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.0), bodyMat);
    body.position.y = 1.2;
    atmGroup.add(body);

    // Glowing screen
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    screen.position.set(0, 1.5, 0.51);
    atmGroup.add(screen);

    // Keypad and card slot
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), this.matChrome);
    slot.position.set(0, 1.15, 0.51);
    atmGroup.add(slot);

    // Cash dispenser
    const dispenser = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.06), this.matDarkMetal);
    dispenser.position.set(0, 0.9, 0.51);
    atmGroup.add(dispenser);

    return atmGroup;
  }

  public static createSecurityBarrier(pos: THREE.Vector3): THREE.Group {
    const barrier = new THREE.Group();
    barrier.position.copy(pos);

    // Walk-through metal detector frame
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.8), this.matDarkMetal);
    leftPillar.position.set(-0.8, 1.3, 0);
    barrier.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.8), this.matDarkMetal);
    rightPillar.position.set(0.8, 1.3, 0);
    barrier.add(rightPillar);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.8), this.matDarkMetal);
    topBeam.position.set(0, 2.5, 0);
    barrier.add(topBeam);

    // Indicator light
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    light.position.set(0, 2.5, 0.42);
    barrier.add(light);

    return barrier;
  }

  // =========================================================================
  // RESTAURANT / BUKA PREFABS
  // =========================================================================
  public static createDiningTable(pos: THREE.Vector3): THREE.Group {
    const tableGroup = new THREE.Group();
    tableGroup.position.copy(pos);

    // Table top
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.1, 16), this.matWoodDesk);
    table.position.y = 0.95;
    tableGroup.add(table);

    // Central table leg & base
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.9, 8), this.matDarkMetal);
    leg.position.y = 0.45;
    tableGroup.add(leg);

    // 4 Wooden Chairs around table
    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), this.matRedFabric);
      chair.position.set(Math.cos(angle) * 1.5, 0.3, Math.sin(angle) * 1.5);
      tableGroup.add(chair);
    }

    // Plate with Jollof Rice in center
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.05, 12), this.matTileWhite);
    plate.position.set(0, 1.02, 0);
    tableGroup.add(plate);

    // Rice mound
    const rice = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xea580c }) // Rich reddish-orange Jollof
    );
    rice.position.set(0, 1.05, 0);
    tableGroup.add(rice);

    return tableGroup;
  }

  public static createFoodWarmer(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const warmerGroup = new THREE.Group();
    warmerGroup.position.copy(pos);
    warmerGroup.rotation.y = rotY;

    // Stainless steel food serving buffet counter
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.1, 1.4), this.matChrome);
    base.position.y = 0.55;
    warmerGroup.add(base);

    // Food trays: Jollof, Fried Rice, Asun, Egusi
    const trayColors = [0xea580c, 0xfacc15, 0x7c2d12, 0x15803d];
    for (let t = 0; t < 4; t++) {
      const tx = -1.6 + t * 1.05;
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.15, 0.8),
        new THREE.MeshStandardMaterial({ color: trayColors[t], roughness: 0.8 })
      );
      tray.position.set(tx, 1.15, 0);
      warmerGroup.add(tray);
    }

    // Sneeze guard glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.8, 0.05), this.matGlass);
    glass.position.set(0, 1.6, 0.6);
    glass.rotation.x = 0.2;
    warmerGroup.add(glass);

    return warmerGroup;
  }

  public static createKitchenStove(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const stoveGroup = new THREE.Group();
    stoveGroup.position.copy(pos);
    stoveGroup.rotation.y = rotY;

    // Commercial industrial burner table
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 1.4), this.matDarkMetal);
    table.position.y = 0.5;
    stoveGroup.add(table);

    // 2 Giant Cooking pots (Cauldrons)
    for (let px of [-0.9, 0.9]) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.45, 0.8, 16),
        new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8 })
      );
      pot.position.set(px, 1.4, 0);
      stoveGroup.add(pot);
    }

    return stoveGroup;
  }

  // =========================================================================
  // POLICE STATION PREFABS
  // =========================================================================
  public static createPoliceFrontDesk(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const deskGroup = new THREE.Group();
    deskGroup.position.copy(pos);
    deskGroup.rotation.y = rotY;

    // Solid concrete and wood desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.2, 1.6), this.matWoodDesk);
    desk.position.y = 0.6;
    deskGroup.add(desk);

    // Lagos State Police Crest emblem board on front
    const crestMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a }); // Police Blue
    const crest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), crestMat);
    crest.position.set(0, 0.6, 0.85);
    deskGroup.add(crest);

    // Case incident logbook
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.45), this.matDarkMetal);
    book.position.set(0, 1.24, 0);
    deskGroup.add(book);

    // Telephone handset
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.25), this.matDarkMetal);
    phone.position.set(1.4, 1.25, 0);
    deskGroup.add(phone);

    return deskGroup;
  }

  public static createHoldingCell(pos: THREE.Vector3, width: number = 5.0, length: number = 4.0): THREE.Group {
    const cellGroup = new THREE.Group();
    cellGroup.position.copy(pos);

    // Heavy iron vertical bars
    const barMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.9, roughness: 0.2 });
    const barCount = Math.floor(width / 0.35);

    for (let b = 0; b <= barCount; b++) {
      const bx = -width / 2 + b * (width / barCount);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 8), barMat);
      bar.position.set(bx, 1.8, length / 2);
      cellGroup.add(bar);
    }

    // Top and bottom horizontal cross-rails
    for (let ry of [0.4, 1.8, 3.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.08), barMat);
      rail.position.set(0, ry, length / 2);
      cellGroup.add(rail);
    }

    // Concrete prison bench inside cell
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(width - 1.0, 0.5, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 })
    );
    bench.position.set(0, 0.25, -length / 2 + 0.6);
    cellGroup.add(bench);

    return cellGroup;
  }

  public static createWantedBoard(pos: THREE.Vector3, rotY: number = 0): THREE.Group {
    const boardGroup = new THREE.Group();
    boardGroup.position.copy(pos);
    boardGroup.rotation.y = rotY;

    // Cork bulletin board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.8, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 })
    );
    board.position.y = 1.8;
    boardGroup.add(board);

    // Paper notices pinned on board
    for (let p = 0; p < 5; p++) {
      const px = -1.1 + (p % 3) * 0.9;
      const py = 1.5 + Math.floor(p / 3) * 0.6;
      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xfef08a })
      );
      paper.position.set(px, py, 0.05);
      boardGroup.add(paper);
    }

    return boardGroup;
  }

  // =========================================================================
  // LIGHTING PREFAB
  // =========================================================================
  public static createCeilingLight(pos: THREE.Vector3, color: number = 0xf8fafc): THREE.Group {
    const lightGroup = new THREE.Group();
    lightGroup.position.copy(pos);

    // Fluorescent fixture box
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.1, 0.6),
      new THREE.MeshBasicMaterial({ color: color })
    );
    lightGroup.add(fixture);

    // PointLight source
    const light = new THREE.PointLight(color, 1.5, 12, 1.2);
    light.position.y = -0.3;
    lightGroup.add(light);

    return lightGroup;
  }
}
