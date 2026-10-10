import type { CharacterConfig, EmoteType } from '../player/CharacterCustomization';
import type { ArmPose, LegPose } from '../interactions/Poses';

export interface PlayerNetState {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  isMoving: boolean;
  currentEmote: EmoteType;
  config: CharacterConfig;
  /** The building they are inside, if any. Their position is then a place in that room, not on the street. */
  place?: string;
  /** The vehicle they are at the wheel of, and where it is. They are inside it, so their own body is not shown. */
  driving?: { id: string; x: number; z: number; yaw: number };
  /** What the body is doing in a scripted action (waving, shaking hands, sitting); absent when walking about freely */
  pose?: { legs: LegPose; arms: ArmPose; height?: number };
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
  /** Which of the receiver's pockets it lands in: a bank transfer goes to their bank account */
  into?: 'wallet' | 'bank';
}

export type NetPacket =
  | { type: 'join'; player: PlayerNetState }
  | { type: 'state'; player: PlayerNetState }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'p2p_transfer'; transfer: P2PTransferMessage }
  | { type: 'emote_sync'; playerId: string; emote: EmoteType }
  | { type: 'social'; fromId: string; fromName: string; toId: string; kind: 'wave' | 'greet' }
  | { type: 'dm'; fromId: string; fromName: string; toId: string; text: string }
  | { type: 'leave'; id: string };
