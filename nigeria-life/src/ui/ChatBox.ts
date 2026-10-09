import { NetworkManager } from '../multiplayer/NetworkManager';
import type { ChatMessage } from '../multiplayer/types';

export class ChatBox {
  private container: HTMLDivElement;
  private network: NetworkManager;
  private messageListEl: HTMLDivElement;
  private inputEl: HTMLInputElement;

  constructor(network: NetworkManager) {
    this.network = network;

    this.container = document.createElement('div');
    this.container.id = 'street-chat-box';
    // Starts closed so it does not cover the game; a new message lights the dot
    this.container.className = 'minimized';
    this.container.innerHTML = `
      <div class="chat-header" id="chat-header">
        <div class="chat-title">
          <span class="chat-dot"></span>
          <span>Street Chat</span>
        </div>
        <button class="chat-minimize-btn" id="chat-toggle-btn" aria-label="Open or close chat">+</button>
      </div>
      <div class="chat-messages" id="chat-messages-list">
        <div class="chat-msg system-msg">
          <span class="msg-text">🇳🇬 Welcome to Broad Street! Press [Enter] to chat with nearby players.</span>
        </div>
      </div>
      <form class="chat-form" id="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="Say something (Press Enter)..." maxlength="80" autocomplete="off" />
        <button type="submit" class="chat-send-btn">Send</button>
      </form>
    `;

    document.body.appendChild(this.container);

    this.messageListEl = document.getElementById('chat-messages-list') as HTMLDivElement;
    this.inputEl = document.getElementById('chat-input') as HTMLInputElement;

    this.setupEvents();

    // Listen to network chat messages
    this.network.setOnChatMessage((msg) => this.addMessage(msg));
  }

  private setupEvents(): void {
    const form = document.getElementById('chat-form') as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.inputEl.value.trim();
      if (!text) return;

      this.network.sendChatMessage(text);
      this.inputEl.value = '';
      this.inputEl.blur();
    });

    // The whole header opens and closes the chat
    document.getElementById('chat-header')!.addEventListener('click', () => {
      this.setOpen(this.container.classList.contains('minimized'));
    });

    // Global 'Enter' key focuses chat input
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const isFocused = document.activeElement === this.inputEl;
        if (!isFocused && (document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault();
          this.setOpen(true);
          this.inputEl.focus();
        }
      }
    });
  }

  private setOpen(open: boolean): void {
    this.container.classList.toggle('minimized', !open);
    if (open) this.container.classList.remove('has-unread');
    const toggleBtn = document.getElementById('chat-toggle-btn');
    if (toggleBtn) toggleBtn.textContent = open ? '−' : '+';
  }

  public addMessage(msg: ChatMessage): void {
    const isSelf = msg.senderId === this.network.localId;
    if (!isSelf && this.container.classList.contains('minimized')) {
      this.container.classList.add('has-unread');
    }
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${isSelf ? 'msg-self' : 'msg-remote'}`;
    msgEl.innerHTML = `
      <span class="msg-sender">${msg.senderName}:</span>
      <span class="msg-text">${this.escapeHtml(msg.text)}</span>
      <span class="msg-time">${msg.timestamp}</span>
    `;

    this.messageListEl.appendChild(msgEl);
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
