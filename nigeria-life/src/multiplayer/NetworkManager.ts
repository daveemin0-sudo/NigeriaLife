import * as THREE from 'three';
import { Player } from '../player/Player';
import { RemotePlayer } from './RemotePlayer';
import type { NetPacket, PlayerNetState, ChatMessage } from './types';

export class NetworkManager {
  public localId: string;
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  private scene: THREE.Scene;
  private localPlayer: Player;
  private channel: BroadcastChannel;
  private lastBroadcast: number = 0;
  private broadcastInterval: number = 50; // ~20 Hz
  private onChatMessageCallback?: (msg: ChatMessage) => void;
  private onPlayerCountCallback?: (count: number) => void;

  constructor(scene: THREE.Scene, localPlayer: Player) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.localId = `naija_${Math.random().toString(36).substring(2, 8)}`;

    // Cross-tab real-time communication channel
    this.channel = new BroadcastChannel('nigeria_life_broad_st_v1');
    this.channel.onmessage = this.handleMessage.bind(this);

    // Announce presence
    this.broadcastJoin();

    // Clean up on tab close
    window.addEventListener('beforeunload', () => {
      this.broadcastLeave();
    });
  }

  public setOnChatMessage(cb: (msg: ChatMessage) => void): void {
    this.onChatMessageCallback = cb;
  }

  public setOnPlayerCount(cb: (count: number) => void): void {
    this.onPlayerCountCallback = cb;
    cb(this.remotePlayers.size + 1);
  }

  private handleMessage(event: MessageEvent<NetPacket>): void {
    const packet = event.data;
    if (!packet || typeof packet !== 'object') return;

    if (packet.type === 'join' || packet.type === 'state') {
      const state = packet.player;
      if (state.id === this.localId) return;

      if (!this.remotePlayers.has(state.id)) {
        // Spawn new player in Lagos world
        const newRemote = new RemotePlayer(state);
        this.remotePlayers.set(state.id, newRemote);
        this.scene.add(newRemote.mesh);

        if (this.onPlayerCountCallback) {
          this.onPlayerCountCallback(this.remotePlayers.size + 1);
        }

        // If it was a join announcement, reply with our state immediately so they see us too
        if (packet.type === 'join') {
          this.broadcastState();
        }
      } else {
        const remote = this.remotePlayers.get(state.id)!;
        remote.applyState(state);
      }
    } else if (packet.type === 'leave') {
      if (this.remotePlayers.has(packet.id)) {
        const remote = this.remotePlayers.get(packet.id)!;
        this.scene.remove(remote.mesh);
        this.remotePlayers.delete(packet.id);

        if (this.onPlayerCountCallback) {
          this.onPlayerCountCallback(this.remotePlayers.size + 1);
        }
      }
    } else if (packet.type === 'chat') {
      if (this.remotePlayers.has(packet.message.senderId)) {
        const remote = this.remotePlayers.get(packet.message.senderId)!;
        remote.showSpeechBubble(packet.message.text);
      }
      if (this.onChatMessageCallback) {
        this.onChatMessageCallback(packet.message);
      }
    }
  }

  public getLocalNetState(): PlayerNetState {
    return {
      id: this.localId,
      name: this.localPlayer.config.name,
      position: {
        x: Number(this.localPlayer.position.x.toFixed(2)),
        y: Number(this.localPlayer.position.y.toFixed(2)),
        z: Number(this.localPlayer.position.z.toFixed(2)),
      },
      rotationY: Number(this.localPlayer.mesh.rotation.y.toFixed(2)),
      isMoving: this.localPlayer.isMoving,
      currentEmote: this.localPlayer.currentEmote,
      config: this.localPlayer.config,
    };
  }

  public broadcastJoin(): void {
    const packet: NetPacket = {
      type: 'join',
      player: this.getLocalNetState(),
    };
    this.channel.postMessage(packet);
  }

  public broadcastState(): void {
    const packet: NetPacket = {
      type: 'state',
      player: this.getLocalNetState(),
    };
    this.channel.postMessage(packet);
  }

  public broadcastLeave(): void {
    const packet: NetPacket = {
      type: 'leave',
      id: this.localId,
    };
    this.channel.postMessage(packet);
  }

  public sendChatMessage(text: string): void {
    const msg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: this.localId,
      senderName: this.localPlayer.config.name,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const packet: NetPacket = {
      type: 'chat',
      message: msg,
    };

    this.channel.postMessage(packet);
    if (this.onChatMessageCallback) {
      this.onChatMessageCallback(msg);
    }
  }

  public update(delta: number): void {
    // 1. Periodically broadcast own state
    const now = performance.now();
    if (now - this.lastBroadcast > this.broadcastInterval) {
      this.broadcastState();
      this.lastBroadcast = now;
    }

    // 2. Update remote players interpolation and walk cycles
    this.remotePlayers.forEach((player) => {
      player.update(delta);
    });
  }
}
