import * as THREE from 'three';
import { Player } from '../player/Player';
import { RemotePlayer } from './RemotePlayer';
import type { NetPacket, PlayerNetState, ChatMessage } from './types';
import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';
import type { EmoteType } from '../player/CharacterCustomization';
import { InteriorManager } from '../interiors/InteriorManager';
import { ServerLink } from '../realestate/ServerLink';

/** How games reach each other: a channel between tabs of one browser, or the world server between devices. */
interface Wire {
  postMessage(packet: NetPacket): void;
  onmessage: ((event: { data: NetPacket }) => void) | null;
}

function openWire(link: ServerLink | null): Wire {
  if (!link) return new BroadcastChannel('nigeria_life_broad_st_v1') as unknown as Wire;
  const wire: Wire = { postMessage: (packet) => link.relay(packet), onmessage: null };
  link.on('net', (packet) => wire.onmessage?.({ data: packet as NetPacket }));
  return wire;
}

export class NetworkManager {
  private static instance: NetworkManager | null = null;
  public localId: string;
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  private scene: THREE.Scene;
  private localPlayer: Player;
  private channel: Wire;
  private lastBroadcast: number = 0;
  private broadcastInterval: number = 50; // ~20 Hz
  private onChatMessageCallback?: (msg: ChatMessage) => void;
  private onPlayerCountCallback?: (count: number) => void;
  private onDirectMessageCallback?: (fromId: string, fromName: string, text: string) => void;
  private onVehicleCallback?: (playerId: string, vehicle: { id: string; x: number; z: number; yaw: number }) => void;
  private onPlayerLeftCallback?: (playerId: string) => void;
  /** Transfers already paid in, so the same one arriving twice is only counted once */
  private receivedTransfers = new Set<string>();

  constructor(scene: THREE.Scene, localPlayer: Player) {
    NetworkManager.instance = this;
    this.scene = scene;
    this.localPlayer = localPlayer;
    const link = ServerLink.get();
    // On a server, a game's id is the one the server knows it by, so the server can say when it has gone
    this.localId = link ? `net_${link.clientId.slice(0, 8)}` : `naija_${Math.random().toString(36).substring(2, 8)}`;

    // Between tabs of this browser, or through the world server to other devices
    this.channel = openWire(link);
    this.channel.onmessage = (event) => this.handleMessage(event as MessageEvent);
    if (link) {
      // A game that closed without saying goodbye
      link.on('gone', (data) => this.handleMessage({ data: { type: 'leave', id: `net_${String((data as { client?: string }).client ?? '').slice(0, 8)}` } } as MessageEvent));
      // Joined, or back in touch: say who is here
      link.on('link', (connected) => {
        if (connected) this.broadcastJoin();
      });
    }

    // Announce presence
    this.broadcastJoin();

    // Clean up on tab close
    window.addEventListener('beforeunload', () => {
      this.broadcastLeave();
    });
  }

  public static getInstance(): NetworkManager | null {
    return NetworkManager.instance;
  }

  public setOnChatMessage(cb: (msg: ChatMessage) => void): void {
    this.onChatMessageCallback = cb;
  }

  public setOnDirectMessage(cb: (fromId: string, fromName: string, text: string) => void): void {
    this.onDirectMessageCallback = cb;
  }

  /** Told where a vehicle is each time the player driving it says so. */
  public setOnVehicle(cb: (playerId: string, vehicle: { id: string; x: number; z: number; yaw: number }) => void): void {
    this.onVehicleCallback = cb;
  }

  public setOnPlayerLeft(cb: (playerId: string) => void): void {
    this.onPlayerLeftCallback = cb;
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
      const driving = state.driving;
      if (driving && typeof driving.id === 'string' && Number.isFinite(driving.x) && Number.isFinite(driving.z) && Number.isFinite(driving.yaw)) {
        this.onVehicleCallback?.(state.id, driving);
      }
    } else if (packet.type === 'leave') {
      if (this.remotePlayers.has(packet.id)) {
        const remote = this.remotePlayers.get(packet.id)!;
        this.scene.remove(remote.mesh);
        this.remotePlayers.delete(packet.id);
        this.onPlayerLeftCallback?.(packet.id);

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
    } else if (packet.type === 'dm') {
      // A private message is for one player: everyone else ignores it
      if (packet.toId === this.localId) {
        this.onDirectMessageCallback?.(packet.fromId, packet.fromName, String(packet.text).slice(0, 240));
        showGameToast(`💬 @${packet.fromName}: ${String(packet.text).slice(0, 60)}`, 'info', 3600);
      }
    } else if (packet.type === 'p2p_transfer') {
      if (packet.transfer.recipientId === this.localId && !this.receivedTransfers.has(packet.transfer.id)) {
        this.receivedTransfers.add(packet.transfer.id);
        const received = BackendService.getInstance().processTransaction({
          type: 'TRANSFER_IN',
          amount: packet.transfer.amount,
          description: `Transfer from @${packet.transfer.senderName}`,
          source: packet.transfer.into === 'bank' ? 'bank' : 'wallet',
        }).success;
        if (received) {
          showGameToast(
            `+₦${packet.transfer.amount.toLocaleString()} from @${packet.transfer.senderName} (${packet.transfer.memo || 'Direct Transfer'})`,
            'success'
          );
        }
      }
    } else if (packet.type === 'social') {
      if (packet.toId === this.localId) {
        const text = packet.kind === 'wave' ? '👋 How far!' : '🙏 Good day!';
        this.remotePlayers.get(packet.fromId)?.showSpeechBubble(text);
        showGameToast(`@${packet.fromName} ${packet.kind === 'wave' ? 'waved at you' : 'greeted you'}.`, 'info', 3200);
      }
    } else if (packet.type === 'emote_sync') {
      if (this.remotePlayers.has(packet.playerId)) {
        const remote = this.remotePlayers.get(packet.playerId)!;
        remote.currentEmote = packet.emote;
      }
    }
  }

  public getLocalNetState(): PlayerNetState {
    const data = BackendService.getInstance().getData();
    const actor = this.localPlayer.actor;
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
      place: InteriorManager.getInstance().currentInterior?.id,
      driving: this.localPlayer.isDriving && this.localPlayer.currentVehicle
        ? {
            id: this.localPlayer.currentVehicle.id,
            x: Number(this.localPlayer.currentVehicle.mesh.position.x.toFixed(2)),
            z: Number(this.localPlayer.currentVehicle.mesh.position.z.toFixed(2)),
            yaw: Number(this.localPlayer.currentVehicle.mesh.rotation.y.toFixed(3)),
          }
        : undefined,
      // While a scripted action runs, others see the same pose
      pose: actor.scripted ? { legs: actor.pose.legs, arms: actor.pose.arms, height: actor.pose.height } : undefined,
      streetCred: data.stats.streetCred,
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

  public sendDirectMessage(toId: string, text: string): void {
    const packet: NetPacket = { type: 'dm', fromId: this.localId, fromName: this.localPlayer.config.name, toId, text: text.slice(0, 240) };
    this.channel.postMessage(packet);
  }

  /**
   * Sends money to another player who is online. The money leaves the sender's bank account
   * or their cash, whichever they chose, and arrives in the matching pocket on the other side.
   * Each transfer carries its own id, so it can only ever be paid in once.
   */
  public sendTransfer(recipientId: string, amount: number, memo: string, from: 'bank' | 'wallet'): { success: boolean; message: string } {
    const recipient = this.remotePlayers.get(recipientId);
    if (!recipient) return { success: false, message: 'That player is not online, so no money was sent.' };
    if (recipientId === this.localId) return { success: false, message: 'You cannot send money to yourself.' };
    if (!Number.isInteger(amount) || amount <= 0) return { success: false, message: 'Enter a whole amount to send.' };

    const backend = BackendService.getInstance();
    const paid = backend.processTransaction({
      type: 'TRANSFER_OUT',
      amount,
      description: `Transfer to @${recipient.name}`,
      source: from,
      funding: 'strict',
    });
    if (!paid.success) {
      const data = backend.getData();
      const have = from === 'bank' ? data.bank.balance : data.walletCash;
      return { success: false, message: `You have ₦${have.toLocaleString()} ${from === 'bank' ? 'in the bank' : 'in cash'}, which is not enough to send ₦${amount.toLocaleString()}.` };
    }

    const packet: NetPacket = {
      type: 'p2p_transfer',
      transfer: {
        id: `wire_${this.localId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        senderId: this.localId,
        senderName: this.localPlayer.config.name,
        recipientId,
        amount,
        memo,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        into: from,
      },
    };
    this.channel.postMessage(packet);
    return { success: true, message: `Sent ₦${amount.toLocaleString()} to @${recipient.name}.` };
  }

  public sendP2PTransfer(recipientId: string, amount: number, memo: string = 'EkoPay Instant Wire'): { success: boolean; message: string } {
    // Nobody is listening for a player who is not here, so the money would simply vanish
    if (!this.remotePlayers.has(recipientId)) {
      return { success: false, message: `@${recipientId} is not online. No money was sent.` };
    }

    const backend = BackendService.getInstance();
    const success = backend.spendCash(amount, `P2P Transfer to @${recipientId}`, 'TRANSFER_OUT');
    if (!success) {
      return { success: false, message: 'Insufficient cash in your wallet!' };
    }

    const packet: NetPacket = {
      type: 'p2p_transfer',
      transfer: {
        id: `wire_${this.localId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        senderId: this.localId,
        senderName: this.localPlayer.config.name,
        recipientId,
        amount,
        memo,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };

    this.channel.postMessage(packet);
    showGameToast(`₦${amount.toLocaleString()} transferred to @${recipientId}.`, 'success');
    return { success: true, message: `Transferred ₦${amount.toLocaleString()} successfully!` };
  }

  /** Tells another player that this one waved at or greeted them. Everyone nearby sees the gesture itself. */
  public sendSocial(toId: string, kind: 'wave' | 'greet'): void {
    const packet: NetPacket = {
      type: 'social',
      fromId: this.localId,
      fromName: this.localPlayer.config.name,
      toId,
      kind,
    };
    this.channel.postMessage(packet);
  }

  public syncEmote(emote: EmoteType): void {
    const packet: NetPacket = {
      type: 'emote_sync',
      playerId: this.localId,
      emote,
    };
    this.channel.postMessage(packet);
  }

  public getOnlinePlayersList(): Array<{
    id: string;
    name: string;
    avatar: string;
    streetCred: number;
    isLocal: boolean;
    pingMs: number;
    currentEmote: string;
  }> {
    const data = BackendService.getInstance().getData();
    const list = [
      {
        id: this.localId,
        name: `${this.localPlayer.config.name} (You)`,
        avatar: '🇳🇬',
        streetCred: data.stats.streetCred,
        isLocal: true,
        pingMs: 12,
        currentEmote: this.localPlayer.currentEmote,
      },
    ];

    this.remotePlayers.forEach((rp, id) => {
      list.push({
        id,
        name: rp.name || `@${id.substring(0, 8)}`,
        avatar: '👤',
        streetCred: 35,
        isLocal: false,
        pingMs: Math.floor(15 + Math.random() * 15),
        currentEmote: rp.currentEmote,
      });
    });

    return list;
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
