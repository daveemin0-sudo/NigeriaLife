/** Messages between the browser (or a load-test bot) and one game-server process. */

export interface WireCharacter {
  name: string;
  gender: string;
  skinTone: string;
  attire: string;
  headwear: string;
  hasShades: boolean;
  hasGoldChain: boolean;
  trousersColor: string;
}

export interface NearbyWire {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  mv: boolean;
  em: string;
  /** Present the first time this player is introduced to the receiver. */
  name?: string;
  config?: WireCharacter;
}

export interface ChatWire {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface ShiftWire {
  playerId: string;
  name: string;
  jobId: string;
  action: 'start' | 'complete';
}

export type ClientMessage =
  | { type: 'hello'; name: string; config?: Partial<WireCharacter> }
  | { type: 'state'; x: number; y: number; z: number; ry: number; mv: boolean; em: string }
  | { type: 'chat'; text: string }
  | { type: 'shift'; action: 'start' | 'complete'; jobId: string };

export type ServerMessage =
  | { type: 'queued'; position: number; limit: number }
  | { type: 'queue_update'; position: number; limit: number }
  | { type: 'welcome'; id: string; limit: number; population: number }
  | {
      type: 'world';
      tick: number;
      population: number;
      nearby: NearbyWire[];
      chats: ChatWire[];
      shifts: ShiftWire[];
    }
  | { type: 'shift_result'; ok: boolean; action: 'start' | 'complete'; jobId: string; message: string }
  | { type: 'rejected'; reason: string };

export interface ServerMetrics {
  players: number;
  queued: number;
  safeLimit: number;
  tick: { avgMs: number; p95Ms: number; maxMs: number; samples: number };
  droppedMessages: number;
  droppedInbound: number;
  droppedOutbound: number;
  messagesIn: number;
  messagesOut: number;
  chats: number;
  shiftsStarted: number;
  shiftsCompleted: number;
  cpuPercentOneCore: number;
  rssMb: number;
  heapUsedMb: number;
  uptimeSec: number;
  config: {
    tickMs: number;
    broadcastHz: number;
    interestRadius: number;
    maxNearby: number;
  };
}
