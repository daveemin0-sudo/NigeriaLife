import type { CharacterConfig, EmoteType } from '../player/CharacterCustomization';

export interface PlayerNetState {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  isMoving: boolean;
  currentEmote: EmoteType;
  config: CharacterConfig;
  streetCred?: number;
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

export interface P2PTransferMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  amount: number;
  memo: string;
  timestamp: string;
}

export type NetPacket =
  | { type: 'join'; player: PlayerNetState }
  | { type: 'state'; player: PlayerNetState }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'p2p_transfer'; transfer: P2PTransferMessage }
  | { type: 'emote_sync'; playerId: string; emote: EmoteType }
  | { type: 'leave'; id: string };
