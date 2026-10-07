export type HeadwearType = 'fila_cream' | 'igbo_red_cap' | 'afro_hair' | 'none';
export type AttireStyle = 'agbada_green' | 'senator_navy' | 'super_eagles' | 'white_gold' | 'ankara_gold';
export type EmoteType = 'idle' | 'walk' | 'zanku' | 'groove' | 'salute';

export interface CharacterConfig {
  name: string;
  skinTone: string;       // Hex color string (e.g. '#4a2e1d')
  attire: AttireStyle;
  headwear: HeadwearType;
  hasShades: boolean;
  hasGoldChain: boolean;
  trousersColor: string;
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  name: 'Bayo',
  skinTone: '#4a2e1d',
  attire: 'agbada_green',
  headwear: 'fila_cream',
  hasShades: true,
  hasGoldChain: true,
  trousersColor: '#f8fafc',
};

export const ATTIRE_PRESETS: Record<AttireStyle, { name: string; color: number; label: string; trousers: string }> = {
  agbada_green: {
    name: 'Emerald Agbada',
    color: 0x008751, // Nigerian national green
    label: 'Traditional Yoruba Emerald Agbada with embroidery',
    trousers: '#ffffff',
  },
  senator_navy: {
    name: 'Navy Senator Suit',
    color: 0x1e3a8a, // Deep royal navy
    label: 'Modern Lagos VIP Senator Suit with gold collar pin',
    trousers: '#1e3a8a',
  },
  super_eagles: {
    name: 'Super Eagles Retro 1994',
    color: 0x10b981, // Vibrant chevron jersey green
    label: 'Iconic Super Eagles National Team Jersey',
    trousers: '#111827',
  },
  white_gold: {
    name: 'Pure White & Gold Kaftan',
    color: 0xffffff,
    label: 'Pristine Sunday Best / Owambe White Kaftan',
    trousers: '#ffffff',
  },
  ankara_gold: {
    name: 'Ankara Wax Pattern',
    color: 0xd97706, // Amber gold print
    label: 'African Ankara fabric with rich gold and bronze accents',
    trousers: '#18181b',
  },
};

export const SKIN_TONES = [
  { name: 'Rich Melanin', hex: '#311d11' },
  { name: 'Warm Mahogany', hex: '#4a2e1d' },
  { name: 'Deep Bronze', hex: '#633d26' },
  { name: 'Golden Honey', hex: '#7c4d30' },
];

export const HEADWEAR_OPTIONS: { id: HeadwearType; name: string }[] = [
  { id: 'fila_cream', name: 'Cream Fila (Yoruba Cap)' },
  { id: 'igbo_red_cap', name: 'Igbo Red Chief Cap' },
  { id: 'afro_hair', name: 'Clean Fade / Afro' },
  { id: 'none', name: 'No Headwear' },
];

export class CharacterStorage {
  private static STORAGE_KEY = 'nigeria_life_character_v1';

  public static load(): CharacterConfig {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CHARACTER_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to default
    }
    return { ...DEFAULT_CHARACTER_CONFIG };
  }

  public static save(config: CharacterConfig): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage errors
    }
  }
}
