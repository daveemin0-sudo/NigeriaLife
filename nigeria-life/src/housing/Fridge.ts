// What is in the fridge at home: food the player has stocked it with (from their bag, or what
// was delivered), kept apart from the bag, one fridge to each home, to take out and eat.

import type { Item } from '../backend/types';
import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';

export class Fridge {
  private static instance: Fridge | null = null;
  public static get(): Fridge {
    return (Fridge.instance ??= new Fridge());
  }

  private homeId = 'main';
  private food: Item[] = [];
  private readonly backend = BackendService.getInstance();

  private constructor() {
    this.load();
  }

  private key(): string {
    return profileKey(`nl_fridge_v1${this.homeId === 'main' ? '' : `:${this.homeId}`}`);
  }

  private load(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key()) || '[]');
      this.food = Array.isArray(saved) ? saved.filter((i) => i && typeof i.id === 'string' && i.quantity > 0) : [];
    } catch {
      this.food = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.food));
    } catch {
      // Kept until the page is closed
    }
  }

  /** The fridge of the home being lived in */
  public setHome(id: string): void {
    if (id === this.homeId) return;
    this.homeId = id;
    this.load();
  }

  /** What is in it, each kind once with how many */
  public contents(): Item[] {
    return this.food.map((i) => ({ ...i }));
  }

  public count(): number {
    return this.food.reduce((n, i) => n + i.quantity, 0);
  }

  /** Food in the bag that could go in */
  public inBag(): Item[] {
    return this.backend.getData().inventory.filter((i) => i.category === 'food' && i.usable && i.quantity > 0);
  }

  /** Everything to eat in the bag goes into the fridge. How many pieces went in. */
  public stockFromBag(): number {
    let moved = 0;
    for (const item of this.inBag()) {
      const here = this.food.find((f) => f.id === item.id);
      if (here) here.quantity += item.quantity;
      else this.food.push({ ...item });
      moved += item.quantity;
      this.backend.removeItem(item.id);
    }
    if (moved) this.save();
    return moved;
  }

  /** Puts something straight in (a delivery brought home) */
  public put(item: Omit<Item, 'quantity'>, quantity = 1): void {
    const here = this.food.find((f) => f.id === item.id);
    if (here) here.quantity += quantity;
    else this.food.push({ ...item, quantity });
    this.save();
  }

  /** Takes one out, to be eaten: it is back in the player's hand (their bag) until it is */
  public takeOut(id: string): Item | null {
    const here = this.food.find((f) => f.id === id);
    if (!here) return null;
    here.quantity -= 1;
    if (here.quantity <= 0) this.food = this.food.filter((f) => f !== here);
    this.save();
    const { quantity: _q, ...rest } = here;
    this.backend.addItem(rest, 1);
    return { ...here, quantity: 1 };
  }
}
