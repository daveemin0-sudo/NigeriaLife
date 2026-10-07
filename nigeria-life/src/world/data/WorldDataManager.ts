import * as THREE from 'three';
import { LAGOS_MAP_DATA } from './LagosMapData';
import type { CityMapData, DistrictData, MapLandmark, MapProperty, MapBusiness } from './WorldDataTypes';

export class WorldDataManager {
  private static instance: WorldDataManager;
  private currentCity: CityMapData = LAGOS_MAP_DATA;
  private playerMapPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  private constructor() {}

  public static getInstance(): WorldDataManager {
    if (!WorldDataManager.instance) {
      WorldDataManager.instance = new WorldDataManager();
    }
    return WorldDataManager.instance;
  }

  public getCurrentCity(): CityMapData {
    return this.currentCity;
  }

  public getDistricts(): DistrictData[] {
    return this.currentCity.districts;
  }

  public getDistrictById(id: string): DistrictData | undefined {
    return this.currentCity.districts.find((d) => d.id === id);
  }

  public getDistrictAt(pos: THREE.Vector3): DistrictData | undefined {
    for (const district of this.currentCity.districts) {
      const b = district.bounds;
      if (pos.x >= b.minX && pos.x <= b.maxX && pos.z >= b.minZ && pos.z <= b.maxZ) {
        return district;
      }
    }
    // Default fallback to closest district center
    let closest: DistrictData | undefined = undefined;
    let minDist = Infinity;
    for (const district of this.currentCity.districts) {
      const d = district.center.distanceTo(pos);
      if (d < minDist) {
        minDist = d;
        closest = district;
      }
    }
    return closest;
  }

  public getLandmarks(): MapLandmark[] {
    return this.currentCity.landmarks;
  }

  public getLandmarkById(id: string): MapLandmark | undefined {
    return this.currentCity.landmarks.find((l) => l.id === id);
  }

  public getProperties(): MapProperty[] {
    return this.currentCity.properties;
  }

  public getPropertyById(id: string): MapProperty | undefined {
    return this.currentCity.properties.find((p) => p.id === id);
  }

  public getBusinesses(): MapBusiness[] {
    return this.currentCity.businesses;
  }

  public getBusinessById(id: string): MapBusiness | undefined {
    return this.currentCity.businesses.find((b) => b.id === id);
  }

  public updatePropertyStatus(propId: string, status: MapProperty['status'], ownerId: string): void {
    const prop = this.currentCity.properties.find((p) => p.id === propId);
    if (prop) {
      prop.status = status;
      prop.ownerId = ownerId;
    }
  }

  public updatePlayerPosition(pos: THREE.Vector3): void {
    this.playerMapPosition.copy(pos);
  }

  public getPlayerPosition(): THREE.Vector3 {
    return this.playerMapPosition;
  }
}
