import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import type { NavGrid } from '../../interactions/NavGrid';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { ShopService, SHOP } from '../shop/ShopService';
import { SHOP_SECTIONS } from '../shop/ShopCatalog';

/** Everyday Supermarket: shelves to take things from, a basket, and a till where they are paid for. */
export class ShopInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  /** Baskets, shelves and the till */
  public service: ShopService;
  private shopper: InteriorNPCMesh | null = null;
  private shopperTimer = 4;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for the shop interior
    const origin = new THREE.Vector3(260, 0, 540);
    this.group.position.copy(origin);
    this.service = new ShopService(this.group, origin);

    this.def = {
      id: 'interior_shop',
      name: 'Everyday Supermarket',
      type: 'shop',
      tier: 'tier3_simulated',
      districtName: 'Broad Street, Lagos Island',
      streetBuildingId: 'supermarket',
      streetEntrance: new THREE.Vector3(11, 0, -45), // Replaced by the street door's position when it registers
      streetExitRotation: -Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, SHOP.room.length / 2 - 2.4),
      exitDoorOffset: new THREE.Vector3(0, 0, SHOP.room.length / 2),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xf8fafc,
      ambientLightIntensity: 1.3,
      rooms: [
        {
          id: 'shop_floor',
          name: 'Shop floor',
          size: SHOP.room,
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xf1f5f9,
          wallColor: 0xfde68a,
        },
      ],
      // What is sold and what it costs lives in shop/ShopCatalog.ts
      stations: [],
      npcs: [
        {
          id: 'npc_shop_cashier',
          name: 'Bolanle',
          role: 'Teller',
          title: 'Cashier',
          relativePosition: SHOP.till.cashier.clone(),
          rotationY: 0,
          outfitColor: 0x2563eb,
          dialogueGreeting: 'Welcome to Everyday! Take a basket, pick what you want and bring it to me.',
          actions: [],
        },
        {
          id: 'npc_shop_customer',
          name: 'Mrs. Adeyemi',
          role: 'Customer',
          title: 'Shopper',
          relativePosition: new THREE.Vector3(-6.2, 0, -6.1),
          rotationY: Math.PI,
          gender: 'female',
          outfitColor: 0x9d174d,
          dialogueGreeting: 'The malt is cold today. Take two before it finishes.',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  /** Floor map used to walk characters around the shelves and the till. */
  public get nav(): NavGrid {
    return this.service.nav;
  }

  public onPlayerEntered(): void {
    this.service.playerEntered();
  }

  public onPlayerLeft(): void {
    this.service.playerLeft();
  }

  private build3DInterior(): void {
    const origin = this.group.position;
    const worldPoint = (x: number, z: number) => new THREE.Vector3(origin.x + x, 0, origin.z + z);
    const { width, length, height } = SHOP.room;

    this.group.add(InteriorPrefabs.createRoom(width, length, height, 0xf1f5f9, 0xfde68a));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-4, 4.2, -4), 0xf8fafc));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(4, 4.2, -4), 0xf8fafc));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(0, 4.2, 3), 0xf8fafc));
    this.addDecor();

    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, length / 2), Math.PI);
    this.group.add(exitDoor);
    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Door to Broad Street',
      category: 'Exit to Street',
      description: 'Step back out onto Broad Street.',
      interactionPoint: worldPoint(0, length / 2 - 1.3),
    });

    // Shelves: one clickable spot per section
    for (const section of SHOP_SECTIONS) {
      this.interactiveList.push({
        mesh: this.service.shelfMesh(section.id),
        id: `shop_shelf_${section.id}`,
        name: section.name,
        category: 'Shelf',
        description: `${section.blurb} ${section.products.map((entry) => entry.name).join(', ')}.`,
        interactionPoint: this.service.shelfStand(section.id),
      });
    }

    // The till
    this.interactiveList.push({
      mesh: this.service.counterMesh,
      id: 'shop_checkout',
      name: 'Till',
      category: 'Pay here',
      description: 'Bring your basket here. Bolanle rings everything up, and you pay as she hands you the bag.',
      interactionPoint: worldPoint(SHOP.till.customer.x, SHOP.till.customer.z),
    });

    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);
      const isCashier = npcDef.id === 'npc_shop_cashier';
      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: isCashier ? 'Shop staff' : 'Customer',
        description: npcDef.dialogueGreeting,
        // The cashier is spoken to across the counter
        interactionPoint: isCashier
          ? worldPoint(SHOP.till.customer.x + 0.9, SHOP.till.customer.z)
          : worldPoint(npcDef.relativePosition.x + 1.3, npcDef.relativePosition.z + 0.6),
      });
      if (isCashier) {
        this.service.setStaff(npcMesh.actor);
      } else {
        this.shopper = npcMesh;
        // She is standing in the aisle: walk around her
        this.service.nav.blockDisc(npcDef.relativePosition.x, npcDef.relativePosition.z, 0.25);
      }
    }
  }

  /** Things that make it a shop and not a room with shelves: a tiled aisle, a mat, offers on the wall. */
  private addDecor(): void {
    const { width, length } = SHOP.room;

    // Checked floor tiles down the middle aisle
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, length - 2.2),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.35 })
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(0, 0.012, -0.4);
    this.group.add(tile);

    // Offers painted along the back wall, above the shelves
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 1024, 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 50px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EVERYDAY LOW PRICES  ·  FRESH BREAD DAILY  ·  COLD DRINKS', 512, 50, 1000);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(width - 3, 0.7), new THREE.MeshBasicMaterial({ map: texture }));
    banner.position.set(0, 3.2, -length / 2 + 0.22);
    this.group.add(banner);

    // Crates of fruit by the door, on the side away from the till
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
    const fruit = [0xf97316, 0xfacc15, 0x16a34a];
    fruit.forEach((color, index) => {
      const x = -7.6;
      const z = 1.2 + index * 1.15;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.9), crateMat);
      crate.position.set(x, 0.25, z);
      this.group.add(crate);
      const pile = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
      );
      pile.scale.set(1, 0.55, 0.9);
      pile.position.set(x, 0.5, z);
      this.group.add(pile);
    });
    this.service.nav.blockRect(-7.6, 2.35, 0.5, 1.75);
  }

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) npc.update(delta, time);
    this.service.update(delta);

    // The other customer looks along the fridge and reaches for something now and then
    this.shopperTimer -= delta;
    if (this.shopper && this.shopperTimer <= 0 && !this.shopper.actor.busy) {
      this.shopperTimer = 5 + Math.random() * 5;
      InteractionDirector.get().perform({
        id: 'shopper browses',
        actor: this.shopper.actor,
        target: this.shopper.actor.homeYaw,
        animation: { arms: 'reach' },
        seconds: 1.3,
      }, { casual: true });
    }
  }
}
