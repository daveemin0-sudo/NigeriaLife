import type { CharacterConfig, EmoteType } from '../player/CharacterCustomization';

export interface PlayerNetState {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  isMoving: boolean;
  currentEmote: EmoteType;
  config: CharacterConfig;
  chatBubble?: {
    text: string;
    timestamp: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export type NetPacket =
  | { type: 'join'; player: PlayerNetState }
  | { type: 'state'; player: PlayerNetState }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'leave'; id: string };
