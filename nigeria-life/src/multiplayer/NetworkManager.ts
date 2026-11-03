import * as THREE from 'three';
import { Player } from '../player/Player';
import { RemotePlayer } from './RemotePlayer';
import type { NetPacket, PlayerNetState, ChatMessage } from './types';
import type { CharacterConfig, EmoteType } from '../player/CharacterCustomization';
import type { ClientMessage, NearbyWire, ServerMessage, WireCharacter } from './serverProtocol';
import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';
import { ServerQueueScreen } from '../ui/ServerQueueScreen';

const LOCAL_CHANNEL = 'nigeria_life_broad_st_v1';

function gameServerUrl(): string | null {
  const configured = (import.meta.env as { VITE_GAME_SERVER_URL?: string }).VITE_GAME_SERVER_URL;
  if (configured === 'off') return null;
  if (configured && configured.length > 0) return configured;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'ws://127.0.0.1:8787';
  return null;
}

export class NetworkManager {
  private static instance: NetworkManager | null = null;
  public localId: string;
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  private scene: THREE.Scene;
  private localPlayer: Player;
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private transport: 'pending' | 'server' | 'local' = 'pending';
  private admitted = false;
  private serverPopulation = 1;
  private queueScreen = new ServerQueueScreen();
  private seenRemoteAt: Map<string, number> = new Map();
  private lastBroadcast: number = 0;
  private broadcastInterval: number = 50; // ~20 Hz
  private onChatMessageCallback?: (msg: ChatMessage) => void;
  private onPlayerCountCallback?: (count: number) => void;

  constructor(scene: THREE.Scene, localPlayer: Player) {
    NetworkManager.instance = this;
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.localId = `naija_${Math.random().toString(36).substring(2, 8)}`;
    // Always open the local channel so same-machine cash wires still land,
    // including while this tab is attached to the game server.
    this.channel = new BroadcastChannel(LOCAL_CHANNEL);
    this.channel.onmessage = this.handleMessage.bind(this);
    window.addEventListener('beforeunload', this.onPageLeave);
    // Connect on the next turn so the city constructor cannot eat the join timeout.
    window.setTimeout(() => this.connectToGameServer(), 0);
  }

  public static getInstance(): NetworkManager | null {
    return NetworkManager.instance;
  }

  public setOnChatMessage(cb: (msg: ChatMessage) => void): void {
    this.onChatMessageCallback = cb;
  }

  public setOnPlayerCount(cb: (count: number) => void): void {
    this.onPlayerCountCallback = cb;
    cb(this.playerCount());
  }

  private playerCount(): number {
    if (this.transport === 'server') return this.serverPopulation;
    return this.remotePlayers.size + 1;
  }

  private publishPlayerCount(): void {
    this.onPlayerCountCallback?.(this.playerCount());
  }

  /** Street play across browser tabs, used when no game server is reachable. */
  private startLocal(): void {
    if (this.transport === 'local') return;
    this.transport = 'local';
    this.admitted = true;
    this.queueScreen.hide();
    document.body.dataset.gameServer = 'local';
    this.broadcastJoin();
    this.publishPlayerCount();
  }

  private onPageLeave = (): void => {
    if (this.transport === 'local') this.broadcastLeave();
    this.socket?.close();
  };

  private finishJoin(socket: WebSocket): void {
    if (this.transport === 'local') {
      socket.close();
      return;
    }
    if (this.socket === socket) return;
    this.transport = 'server';
    this.socket = socket;
    document.body.dataset.gameServer = 'connecting';
    this.sendServer({
      type: 'hello',
      name: this.localPlayer.config.name,
      config: this.wireConfig(),
    });
  }

  private connectToGameServer(): void {
    const url = gameServerUrl();
    if (!url) {
      this.startLocal();
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.startLocal();
      return;
    }

    const giveUp = window.setTimeout(() => {
      if (this.transport !== 'pending') return;
      // The first frames of the city can stall the main thread long enough
      // that this timer is due before the open event runs. The socket is
      // already open in that case, so join instead of dropping to local play.
      if (socket.readyState === WebSocket.OPEN) {
        this.finishJoin(socket);
        return;
      }
      socket.close();
      this.startLocal();
    }, 4000);

    socket.addEventListener('open', () => {
      window.clearTimeout(giveUp);
      this.finishJoin(socket);
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      this.onServerMessage(message);
    });

    socket.addEventListener('error', () => {
      if (this.transport !== 'pending') return;
      if (socket.readyState === WebSocket.OPEN) return;
      window.clearTimeout(giveUp);
      this.startLocal();
    });

    socket.addEventListener('close', () => {
      if (this.transport === 'pending') {
        window.clearTimeout(giveUp);
        this.startLocal();
        return;
      }
      if (this.transport === 'server' && !this.admitted) {
        this.socket = null;
        this.startLocal();
      }
    });
  }

  private wireConfig(): WireCharacter {
    const config = this.localPlayer.config;
    return {
      name: config.name,
      gender: config.gender,
      skinTone: config.skinTone,
      attire: config.attire,
      headwear: config.headwear,
      hasShades: config.hasShades,
      hasGoldChain: config.hasGoldChain,
      trousersColor: config.trousersColor,
    };
  }

  private sendServer(message: ClientMessage): void {
    if (this.transport !== 'server' || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (message.type !== 'hello' && !this.admitted) return;
    this.socket.send(JSON.stringify(message));
  }

  private onServerMessage(message: ServerMessage): void {
    if (message.type === 'queued' || message.type === 'queue_update') {
      this.queueScreen.show(message.position);
      return;
    }
    if (message.type === 'welcome') {
      this.admitted = true;
      this.localId = message.id;
      this.serverPopulation = message.population;
      this.queueScreen.hide();
      document.body.dataset.gameServer = 'in';
      this.broadcastState();
      this.publishPlayerCount();
      return;
    }
    if (message.type === 'world') {
      this.serverPopulation = message.population;
      const now = performance.now();
      for (const nearby of message.nearby) this.upsertRemote(nearby, now);
      for (const chat of message.chats) this.showRemoteChat(chat.senderId, chat);
      this.reapRemotes(now);
      this.publishPlayerCount();
      return;
    }
    if (message.type === 'rejected') {
      showGameToast(message.reason, 'warning');
    }
  }

  private upsertRemote(nearby: NearbyWire, now: number): void {
    this.seenRemoteAt.set(nearby.id, now);
    const existing = this.remotePlayers.get(nearby.id);
    if (!existing) {
      if (!nearby.config || !nearby.name) return;
      const remote = new RemotePlayer({
        id: nearby.id,
        name: nearby.name,
        position: { x: nearby.x, y: nearby.y, z: nearby.z },
        rotationY: nearby.ry,
        isMoving: nearby.mv,
        currentEmote: nearby.em as EmoteType,
        config: nearby.config as CharacterConfig,
      });
      this.remotePlayers.set(nearby.id, remote);
      this.scene.add(remote.mesh);
      return;
    }
    existing.targetPosition.set(nearby.x, nearby.y, nearby.z);
    existing.targetRotationY = nearby.ry;
    existing.isMoving = nearby.mv;
    existing.currentEmote = nearby.em as EmoteType;
  }

  private showRemoteChat(senderId: string, chat: { text: string; senderName: string; senderId: string; id: string; timestamp: string }): void {
    const remote = this.remotePlayers.get(senderId);
    if (remote) remote.showSpeechBubble(chat.text);
    this.onChatMessageCallback?.({
      id: chat.id,
      senderId: chat.senderId,
      senderName: chat.senderName,
      text: chat.text,
      timestamp: chat.timestamp,
    });
  }

  private reapRemotes(now: number): void {
    for (const [id, remote] of this.remotePlayers) {
      const seen = this.seenRemoteAt.get(id) ?? 0;
      if (now - seen < 2500) continue;
      this.scene.remove(remote.mesh);
      this.remotePlayers.delete(id);
      this.seenRemoteAt.delete(id);
    }
  }

  private handleMessage(event: MessageEvent<NetPacket>): void {
    const packet = event.data;
    if (!packet || typeof packet !== 'object') return;
    if (this.transport !== 'local' && packet.type !== 'p2p_transfer') return;

    if (packet.type === 'join' || packet.type === 'state') {
      const state = packet.player;
      if (state.id === this.localId) return;

      if (!this.remotePlayers.has(state.id)) {
        const newRemote = new RemotePlayer(state);
        this.remotePlayers.set(state.id, newRemote);
        this.scene.add(newRemote.mesh);
        this.publishPlayerCount();

        if (packet.type === 'join') this.broadcastState();
      } else {
        const remote = this.remotePlayers.get(state.id)!;
        remote.applyState(state);
      }
    } else if (packet.type === 'leave') {
      if (this.remotePlayers.has(packet.id)) {
        const remote = this.remotePlayers.get(packet.id)!;
        this.scene.remove(remote.mesh);
        this.remotePlayers.delete(packet.id);
        this.publishPlayerCount();
      }
    } else if (packet.type === 'chat') {
      if (this.remotePlayers.has(packet.message.senderId)) {
        const remote = this.remotePlayers.get(packet.message.senderId)!;
        remote.showSpeechBubble(packet.message.text);
      }
      this.onChatMessageCallback?.(packet.message);
    } else if (packet.type === 'p2p_transfer') {
      if (packet.transfer.recipientId === this.localId) {
        const received = BackendService.getInstance().addCash(
          packet.transfer.amount,
          `Transfer from @${packet.transfer.senderName}`,
          'TRANSFER_IN'
        );
        if (received) {
          showGameToast(
            `+₦${packet.transfer.amount.toLocaleString()} from @${packet.transfer.senderName} (${packet.transfer.memo || 'Direct Transfer'})`,
            'success'
          );
        }
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
      streetCred: data.stats.streetCred,
    };
  }

  public broadcastJoin(): void {
    if (this.transport !== 'local' || !this.channel) return;
    const packet: NetPacket = { type: 'join', player: this.getLocalNetState() };
    this.channel.postMessage(packet);
  }

  public broadcastState(): void {
    if (this.transport === 'server') {
      const state = this.getLocalNetState();
      this.sendServer({
        type: 'state',
        x: state.position.x,
        y: state.position.y,
        z: state.position.z,
        ry: state.rotationY,
        mv: state.isMoving,
        em: state.currentEmote,
      });
      return;
    }
    if (this.transport !== 'local' || !this.channel) return;
    const packet: NetPacket = { type: 'state', player: this.getLocalNetState() };
    this.channel.postMessage(packet);
  }

  public broadcastLeave(): void {
    if (this.transport !== 'local' || !this.channel) return;
    const packet: NetPacket = { type: 'leave', id: this.localId };
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

    if (this.transport === 'server') {
      this.sendServer({ type: 'chat', text });
    } else if (this.channel) {
      const packet: NetPacket = { type: 'chat', message: msg };
      this.channel.postMessage(packet);
    }
    this.onChatMessageCallback?.(msg);
  }

  /** Tell the game server this player started or finished a job shift. */
  public reportShift(action: 'start' | 'complete', jobId: string): void {
    this.sendServer({ type: 'shift', action, jobId });
  }

  public sendP2PTransfer(recipientId: string, amount: number, memo: string = 'EkoPay Instant Wire'): { success: boolean; message: string } {
    if (!this.remotePlayers.has(recipientId)) {
      return { success: false, message: `@${recipientId} is not online. No money was sent.` };
    }
    if (!this.channel) {
      return { success: false, message: 'Direct wires are only available on the local street channel.' };
    }

    const backend = BackendService.getInstance();
    const success = backend.spendCash(amount, `P2P Transfer to @${recipientId}`, 'TRANSFER_OUT');
    if (!success) {
      return { success: false, message: 'Insufficient cash in your wallet!' };
    }

    const packet: NetPacket = {
      type: 'p2p_transfer',
      transfer: {
        id: `wire_${Date.now()}`,
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

  public syncEmote(emote: EmoteType): void {
    if (this.transport === 'server') {
      this.broadcastState();
      return;
    }
    if (this.transport !== 'local' || !this.channel) return;
    const packet: NetPacket = { type: 'emote_sync', playerId: this.localId, emote };
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
        name: (rp as unknown as { name?: string }).name || `@${id.substring(0, 8)}`,
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
    const now = performance.now();
    if (this.admitted && now - this.lastBroadcast > this.broadcastInterval) {
      this.broadcastState();
      this.lastBroadcast = now;
    }

    this.remotePlayers.forEach((player) => {
      player.update(delta);
    });
  }
}
