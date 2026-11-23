import { MOST_AMOUNT, amountInWords, parseAmount } from '../life/Amounts';
import { UIStateManager } from './UIStateManager';

export interface AmountQuestion {
  who: string;
  role?: string;
  text: string;
  /** The word on the button: Withdraw, Buy, Give */
  action: string;
  /** ₦ unless it is dollars or pounds */
  symbol?: string;
  /** The most they can do now (their balance, what they can afford) */
  most?: number;
  /** The smallest that makes sense here */
  least?: number;
  /** What this amount comes to, shown as they type: "Costs ₦160,000" */
  worth?: (amount: number) => string;
  pick: (amount: number) => void;
}

const MULTIPLY: Array<[string, number]> = [['Thousand', 1e3], ['Million', 1e6], ['Billion', 1e9], ['Trillion', 1e12]];

/** Asks for any amount of money, up to trillions. Typed on a keyboard or a phone, with shortcuts for the big numbers. */
export function askAmount(q: AmountQuestion): void {
  document.getElementById('amount-sheet')?.remove();
  const symbol = q.symbol ?? '₦';
  const most = Math.min(q.most ?? MOST_AMOUNT, MOST_AMOUNT);
  const least = q.least ?? 1;
  const money = (n: number) => `${symbol}${n.toLocaleString('en-NG')}`;

  const overlay = document.createElement('div');
  overlay.id = 'amount-sheet';
  overlay.className = 'game-dialogue-overlay amount-sheet';
  overlay.innerHTML = `
    <form class="game-dialogue-card amount-card" novalidate>
      <div class="dialogue-speaker-meta">
        <span class="dialogue-speaker-name"></span>
        <span class="dialogue-speaker-role"></span>
      </div>
      <label class="amount-question" for="amount-input"></label>
      <div class="amount-field">
        <span aria-hidden="true">${symbol}</span>
        <input id="amount-input" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="0" aria-describedby="amount-readout">
      </div>
      <div class="amount-shortcuts">
        ${MULTIPLY.map(([label, by]) => `<button type="button" data-by="${by}">${label}</button>`).join('')}
        ${q.most !== undefined && most > 0 ? '<button type="button" data-all="1">All</button>' : ''}
      </div>
      <div class="amount-readout" id="amount-readout" role="status"></div>
      <div class="amount-actions">
        <button type="button" class="amount-cancel">Cancel</button>
        <button type="submit" class="amount-go" disabled></button>
      </div>
    </form>`;
  overlay.querySelector('.dialogue-speaker-name')!.textContent = q.who;
  overlay.querySelector('.dialogue-speaker-role')!.textContent = q.role ?? '';
  overlay.querySelector('.amount-question')!.textContent = q.text;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('#amount-input')!;
  const readout = overlay.querySelector<HTMLElement>('#amount-readout')!;
  const go = overlay.querySelector<HTMLButtonElement>('.amount-go')!;
  let amount = NaN;

  const refresh = () => {
    const text = input.value.trim();
    amount = parseAmount(text);
    let line = '';
    let bad = false;
    if (!text) line = q.most !== undefined ? `You can go up to ${money(most)}.` : 'Type any amount.';
    else if (!Number.isFinite(amount)) { line = 'Type a whole amount, like 5000, 2.5m or 3 billion.'; bad = true; }
    else if (amount < least) { line = `The least here is ${money(least)}.`; bad = true; }
    else if (amount > most) { line = `That is more than you have. You can go up to ${money(most)}.`; bad = true; }
    else {
      const words = amountInWords(amount);
      line = `${money(amount)}${words ? ` (${words})` : ''}${q.worth ? ` · ${q.worth(amount)}` : ''}`;
    }
    readout.textContent = line;
    readout.classList.toggle('is-bad', bad);
    const ready = Boolean(text) && !bad;
    go.disabled = !ready;
    go.textContent = ready ? `${q.action} ${money(amount)}` : q.action;
  };

  const close = () => {
    if (!overlay.isConnected) return;
    overlay.remove();
    UIStateManager.getInstance().popModal('amount');
  };
  UIStateManager.getInstance().registerModal('amount', { id: 'amount', close, isOpen: () => overlay.isConnected });
  UIStateManager.getInstance().pushModal('amount');

  input.addEventListener('input', refresh);
  overlay.querySelectorAll<HTMLButtonElement>('[data-by]').forEach((button) => {
    button.onclick = () => {
      const now = parseAmount(input.value);
      const by = Number(button.dataset.by);
      const next = Number.isFinite(now) ? now * by : by;
      input.value = String(Math.min(next, MOST_AMOUNT));
      refresh();
      input.focus();
    };
  });
  const all = overlay.querySelector<HTMLButtonElement>('[data-all]');
  if (all) all.onclick = () => { input.value = String(most); refresh(); input.focus(); };
  overlay.querySelector<HTMLButtonElement>('.amount-cancel')!.onclick = close;
  overlay.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    if (go.disabled) return;
    const chosen = amount;
    close();
    q.pick(chosen);
  });
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  // Typing here is not walking, or picking a numbered reply
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    overlay.addEventListener(type, (e) => {
      e.stopPropagation();
      if (type === 'keydown' && (e as KeyboardEvent).key === 'Escape') { e.preventDefault(); close(); }
    });
  }
  refresh();
  input.focus();
}
