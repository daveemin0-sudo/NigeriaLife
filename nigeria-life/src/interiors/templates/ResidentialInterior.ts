import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import { HouseDecorationSystem } from '../../housing/HouseDecorationSystem';

export class ResidentialInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  // Animated elements
  private fanBlades: THREE.Mesh[] = [];
  private fanHeads: THREE.Group[] = [];
  private tvScreen: THREE.Mesh | null = null;
  private animTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for residential interior
    const origin = new THREE.Vector3(260, 0, 440);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_residence',
      name: 'Victoria Luxury Apartment & Residence',
      type: 'residence',
      tier: 'tier3_simulated',
      districtName: 'Victoria Island Residential Compound',
      streetBuildingId: 'villa-compound',
      streetEntrance: new THREE.Vector3(-14, 0, -45),
      streetExitRotation: Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 8),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 16, 20),
      ambientLightColor: 0xffedd5,
      ambientLightIntensity: 1.3,
      rooms: [
        {
          id: 'residence_main',
          name: 'Executive Duplex Apartment',
          size: { width: 30, length: 24, height: 4.2 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xf8fafc,
          wallColor: 0xd97706, // Warm Ochre / Mustard Yellow (Screenshot 5)
        },
      ],
      stations: [
        {
          id: 'flat-tv',
          name: '75-Inch Smart TV & Soundbar',
          category: 'Home Entertainment',
          description: 'Live Super Eagles vs Rivals match streaming in 4K. Tap to cheer & dance!',
          relativePosition: new THREE.Vector3(-10, 0, 3),
          actions: [
            {
              id: 'watch_super_eagles',
              label: '📺 Watch Super Eagles AFCON Match (Cheer & Dance)',
              description: 'Watch live football broadcast with stadium roar.',
              rewardEnergy: 30,
              rewardCred: 5,
              dialogueResponse: '⚽ GOOOAAAL! Super Eagles score a screamer! You dance with joy! Energy boosted +30%!',
            },
          ],
        },
        {
          id: 'flat-bed',
          name: 'King-Size Royal Master Bed',
          category: 'Rest & Recovery',
          description: 'Memory foam mattress with air conditioning blowing. Restores 100% full energy!',
          relativePosition: new THREE.Vector3(7.5, 0, -5.5),
          actions: [
            {
              id: 'sleep_luxury_bed',
              label: '🛏️ Sleep on Luxury Bed (100% Full Energy Recharge)',
              description: 'Fall into deep restorative sleep under luxury duvet.',
              rewardEnergy: 100,
              rewardHealth: 100,
              dialogueResponse: '💤 You rest peacefully with the AC blowing. 100% Full Energy and Health restored!',
            },
          ],
        },
        {
          id: 'flat-drum',
          name: 'Nigerian Blue Plastic Water Drum & Red Bucket',
          category: 'Home Essentials',
          description: 'The undefeated symbol of Nigerian domestic resilience! Filled with chilled borehole water.',
          relativePosition: new THREE.Vector3(8.5, 0, 5.5),
          actions: [
            {
              id: 'fetch_water_bath',
              label: '🪣 Fetch Chilled Water & Bath with Red Bowl (Hygiene +100%)',
              description: 'Fetch chilled water with the red plastic bucket and take a refreshing bath.',
              rewardEnergy: 40,
              rewardHealth: 40,
              dialogueResponse: '💧 Refreshing bath taken with the red bowl! Cool chilled borehole water clears your head. Energy +40%!',
            },
          ],
        },
        {
          id: 'flat-workstation',
          name: 'Remote Tech Workstation',
          category: 'Remote Work',
          description: 'Ergonomic dual-monitor setup with high-speed fiber internet for remote freelancing gigs.',
          relativePosition: new THREE.Vector3(-6.5, 0, -5.5),
          actions: [
            {
              id: 'work_remote_sprint',
              label: '💻 Complete Remote Tech Engineering Sprint (+₦12,000 Cash)',
              description: 'Ship code review and backend API endpoint for international client.',
              rewardCash: 12000,
              rewardCred: 20,
              dialogueResponse: '💻 Pull request approved and merged into production! ₦12,000 remote salary credited to your wallet! Street Cred +20!',
            },
          ],
        },
      ],
      npcs: [],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Ceramic Tiled Floor with Grid Grout Lines
    const floorGeo = new THREE.BoxGeometry(32, 0.4, 26);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Warm Ochre / Mustard Yellow Walls (Screenshot 5)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Authentic Nigerian ochre wall paint
      roughness: 0.7,
    });
    const wallH = 4.2;
    const wallT = 0.4;

    // Outer boundary walls (cutaway height so camera sees inside clearly)
    // Back Wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(32, wallH, wallT), wallMat);
    backWall.position.set(0, wallH / 2, -13);
    this.group.add(backWall);

    // Windows with Burglar-Proof Metal Bars along back wall (Screenshot 5)
    for (const wx of [-10, 0, 10]) {
      this.createBurglarProofWindow(wx, 2.4, -12.8);
    }

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 26), wallMat);
    leftWall.position.set(-16, wallH / 2, 0);
    this.group.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 26), wallMat);
    rightWall.position.set(16, wallH / 2, 0);
    this.group.add(rightWall);

    // Dividing Walls between Rooms (Living, Bedrooms, Bathroom)
    // Horizontal divider separating Bedrooms from Living Room
    const divH = new THREE.Mesh(new THREE.BoxGeometry(22, wallH, wallT), wallMat);
    divH.position.set(-5, wallH / 2, -1);
    this.group.add(divH);

    // Vertical divider separating Master Bedroom from Center Bedroom
    const divV1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 12), wallMat);
    divV1.position.set(2, wallH / 2, -7);
    this.group.add(divV1);

    // Vertical divider separating Bathroom
    const divV2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 13), wallMat);
    divV2.position.set(6, wallH / 2, 5.5);
    this.group.add(divV2);

    // 2. Ceiling & Ambient Lights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.0, 4), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(8, 4.0, -6), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-5, 4.0, -6), 0xffedd5));

    // 3. Exit Door
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 12), Math.PI);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Apartment Front Door',
      category: 'Exit to Street',
      description: 'Step outside through the compound gate back to the street.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10),
    });

    // 4. Living Room:
    // A. Circular Orange & Gold Heritage Rug (Screenshot 5)
    const rugOuter = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.7, 32),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9, side: THREE.DoubleSide })
    );
    rugOuter.rotation.x = -Math.PI / 2;
    rugOuter.position.set(-6, 0.02, 5);
    this.group.add(rugOuter);

    const rugInner = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 })
    );
    rugInner.rotation.x = -Math.PI / 2;
    rugInner.position.set(-6, 0.022, 5);
    this.group.add(rugInner);

    // B. Emerald Green 3-Seater Sofa
    const sofa = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.2, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.7 })
    );
    sofa.position.set(-2, 0.6, 6);
    this.group.add(sofa);

    // C. Black Leather 2-Seater Sofa (Screenshot 5)
    const sofaBlack = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.2, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 })
    );
    sofaBlack.position.set(-7.5, 0.6, 2.5);
    this.group.add(sofaBlack);

    // D. Wooden Coffee Table in Living Room
    const coffeeTable = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 })
    );
    coffeeTable.position.set(-6, 0.3, 5);
    this.group.add(coffeeTable);

    // E. 75-inch Flat Screen TV & Entertainment Wall Console
    const tvUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.2, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
    );
    tvUnit.position.set(-15.8, 2.4, 4);
    this.group.add(tvUnit);

    const screenGeo = new THREE.PlaneGeometry(6.2, 2.8);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    this.tvScreen = new THREE.Mesh(screenGeo, screenMat);
    this.tvScreen.rotation.y = Math.PI / 2;
    this.tvScreen.position.set(-15.65, 2.4, 4);
    this.group.add(this.tvScreen);

    // F. Round Wooden Dining Table with 4 Chairs (Screenshot 5)
    const diningTable = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
    );
    diningTable.position.set(-8, 1.1, 10);
    this.group.add(diningTable);

    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    tableLeg.position.set(-8, 0.55, 10);
    this.group.add(tableLeg);

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9a3412 })
      );
      chair.position.set(-8 + Math.cos(a) * 1.8, 0.35, 10 + Math.sin(a) * 1.8);
      this.group.add(chair);
    }

    // G. Potted Indoor Majesty Palm Plant (Screenshot 5)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.25, 0.7, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef08a })
    );
    pot.position.set(-0.5, 0.35, 0.5);
    this.group.add(pot);

    // 5. Bedrooms:
    // A. Master Bedroom (Right) - Purple Duvet King Bed (Screenshot 5)
    const masterBed = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.8, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    masterBed.position.set(10.5, 0.4, -6.5);
    this.group.add(masterBed);

    const masterMattress = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.5, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 }) // Royal Purple
    );
    masterMattress.position.set(10.5, 0.9, -6.5);
    this.group.add(masterMattress);

    // B. Center Bedroom - Purple Bed (Screenshot 5)
    const centerBed = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.8, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    centerBed.position.set(-3, 0.4, -7);
    this.group.add(centerBed);

    const centerMattress = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.5, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 })
    );
    centerMattress.position.set(-3, 0.9, -7);
    this.group.add(centerMattress);

    // C. Guest Bedroom (Left) - Blue Bed (Screenshot 5)
    const guestBed = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.8, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    guestBed.position.set(-12, 0.4, -7);
    this.group.add(guestBed);

    const guestMattress = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.5, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }) // Vibrant Blue
    );
    guestMattress.position.set(-12, 0.9, -7);
    this.group.add(guestMattress);

    // 6. Bathroom (Tiled with Bathtub, Glass Shower, WC, Blue Drum & Red Bucket!):
    // White Ceramic Bathtub
    const tub = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    tub.position.set(9.5, 0.4, 3);
    this.group.add(tub);

    // Glass Shower Booth
    const showerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.4, roughness: 0.1 })
    );
    showerGlass.position.set(13.5, 1.6, 4.5);
    this.group.add(showerGlass);

    // Toilet WC
    const wc = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    wc.position.set(14, 0.45, 1.5);
    this.group.add(wc);

    // Iconic Nigerian Blue Water Storage Drum & Red Fetch Bucket (Screenshot 5)
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
    );
    drum.position.set(8.5, 0.9, 0.5);
    this.group.add(drum);

    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    bucket.position.set(9.8, 0.4, 0.6);
    this.group.add(bucket);

    // 7. Outdoor Covered Carport with Wooden Pergola & Parked Cars (Screenshot 5):
    this.createOutdoorCarport(17.5, 0, 7.5);

    // 8. Attach House Decoration System Placed Items Group
    const decorationSystem = HouseDecorationSystem.getInstance();
    this.group.add(decorationSystem.placedItemsGroup);

    // Register stations into interactive list
    this.interactiveList.push({
      mesh: tvUnit,
      id: 'flat-tv',
      name: '75-Inch Smart TV & Soundbar',
      category: 'Home Entertainment',
      description: 'Live Super Eagles AFCON stream in 4K with pulsating soundbar.',
      interactionPoint: new THREE.Vector3(this.group.position.x - 14, 0, this.group.position.z + 4),
    });

    this.interactiveList.push({
      mesh: masterBed,
      id: 'flat-bed',
      name: 'King-Size Royal Master Bed',
      category: 'Rest & Recovery',
      description: 'Recharge 100% full energy under cool AC breeze.',
      interactionPoint: new THREE.Vector3(this.group.position.x + 9, 0, this.group.position.z - 6),
    });

    this.interactiveList.push({
      mesh: drum,
      id: 'flat-drum',
      name: 'Nigerian Blue Plastic Water Drum & Red Bucket',
      category: 'Home Essentials',
      description: 'Borehole chilled water ready with the red bucket.',
      interactionPoint: new THREE.Vector3(this.group.position.x + 8.5, 0, this.group.position.z + 1.5),
    });
  }

  /**
   * Builds burglar-proof metal window grills (Screenshot 5)
   */
  private createBurglarProofWindow(x: number, y: number, z: number): void {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, y, z);

    // White Window Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    winGroup.add(frame);

    // Vertical Iron Burglar Proof Security Bars
    for (let bx = -1.1; bx <= 1.1; bx += 0.32) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 2.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 })
      );
      bar.position.set(bx, 0, 0.12);
      winGroup.add(bar);
    }

    this.group.add(winGroup);
  }

  /**
   * Outdoor Carport with wooden pergola beams and parked cars (Screenshot 5)
   */
  private createOutdoorCarport(x: number, y: number, z: number): void {
    const carportGroup = new THREE.Group();
    carportGroup.position.set(x, y, z);

    // Concrete driveway slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.2, 8.5),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 })
    );
    slab.position.y = -0.1;
    carportGroup.add(slab);

    // Wooden Pergola Frame (Yellow/Ochre timber posts)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });

    // 4 Corner Posts
    for (const px of [-3.0, 3.0]) {
      for (const pz of [-4.0, 4.0]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), woodMat);
        post.position.set(px, 1.8, pz);
        carportGroup.add(post);
      }
    }

    // Top horizontal crossbeams
    for (let rz = -3.8; rz <= 3.8; rz += 1.8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 0.25), woodMat);
      beam.position.set(0, 3.6, rz);
      carportGroup.add(beam);
    }

    // Parked Cars under carport
    // Car 1: Silver Sedan
    const car1 = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.6 })
    );
    car1.position.set(-1.4, 0.55, 0);
    carportGroup.add(car1);

    // Car 2: Black Mercedes G-Wagon SUV (Screenshot 5)
    const car2 = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.5, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4, metalness: 0.4 })
    );
    car2.position.set(1.4, 0.75, 0);
    carportGroup.add(car2);

    this.group.add(carportGroup);
  }

  public update(delta: number, _time: number): void {
    this.animTime += delta;

    for (const blade of this.fanBlades) {
      blade.rotation.z += delta * 24;
    }

    for (const head of this.fanHeads) {
      head.rotation.y = Math.sin(this.animTime * 1.5) * 0.7;
    }

    if (this.tvScreen) {
      const g = 0.5 + Math.sin(this.animTime * 6) * 0.15;
      (this.tvScreen.material as THREE.MeshBasicMaterial).color.setRGB(0.1, g, 0.2);
    }
  }
}
