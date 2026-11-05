/** Small helpers for screens that are written as HTML strings. */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Makes any text safe to put inside HTML, including text typed by another player. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`;
}

/** "1 item", "3 items" */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** A row in a list: an icon, a title with a line under it, and something on the right. */
export function row(options: {
  icon: string;
  title: string;
  sub?: string;
  trailing?: string;
  attrs?: string;
  tone?: 'default' | 'good' | 'bad' | 'muted';
  tag?: 'button' | 'div';
}): string {
  const tag = options.tag ?? (options.attrs ? 'button' : 'div');
  return `
    <${tag} class="nl-row${options.tone && options.tone !== 'default' ? ` nl-row--${options.tone}` : ''}" ${options.attrs ?? ''}>
      <span class="nl-row-icon">${options.icon}</span>
      <span class="nl-row-text">
        <span class="nl-row-title">${options.title}</span>
        ${options.sub ? `<span class="nl-row-sub">${options.sub}</span>` : ''}
      </span>
      ${options.trailing ? `<span class="nl-row-trail">${options.trailing}</span>` : ''}
    </${tag}>`;
}

/** What a screen shows when there is nothing to list, with what to do about it. */
export function empty(icon: string, title: string, text: string, action?: string): string {
  return `
    <div class="nl-empty">
      <span class="nl-empty-icon">${icon}</span>
      <strong class="nl-empty-title">${title}</strong>
      <span class="nl-empty-text">${text}</span>
      ${action ?? ''}
    </div>`;
}

/** A row of choices where one is on: tabs, filters. */
export function chips(name: string, current: string, options: Array<[value: string, label: string]>): string {
  return `
    <div class="nl-chips" role="tablist">
      ${options.map(([value, label]) => `
        <button class="nl-chip${value === current ? ' is-on' : ''}" role="tab" aria-selected="${value === current}" data-set="${name}" data-value="${esc(value)}">${label}</button>
      `).join('')}
    </div>`;
}

/** A bar that fills from 0 to 100. */
export function meter(percent: number, tone: 'good' | 'warn' | 'bad' | 'plain' = 'plain'): string {
  const value = Math.max(0, Math.min(100, percent));
  return `<span class="nl-meter nl-meter--${tone}" role="progressbar" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value.toFixed(1)}%"></span></span>`;
}
