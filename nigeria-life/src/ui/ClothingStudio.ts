import { WARDROBE_CATALOGUE, type CharacterConfig } from '../player/CharacterCustomization';
import {
  CONDITION_LABELS, FABRIC_LABELS, GRAPHICS, LOGO_SHAPES, MAX_OUTFITS, PALETTES, PATTERN_LABELS, STITCH_COLOURS,
  cleanLogoText, deleteOutfit, equipOutfit, fabricChoices, patternChoices, renameOutfit, saveOutfit, updateOutfit,
  type Condition, type GarmentSlot, type GarmentStyle, type PatternKind,
} from '../player/ClothingStyle';
import { playerGarments } from '../graphics/people/SkinnedCharacter';
import type { Player } from '../player/Player';
import { LookPreview } from './LookPreview';
import { showGameToast } from './GameToast';

/**
 * The clothing studio: the player makes each garment they wear their own (its colours, its cloth, a pattern
 * or print, the thread, its condition), sees it on their real model turned any way, and keeps whole looks as
 * saved outfits to put on again. Every change is worn at once and saved with the character.
 */
type Region = 'main' | 'colour2' | 'colour3' | 'stitch';
type Focus = 'full' | GarmentSlot;

const SLOT_LABEL: Record<GarmentSlot, string> = { top: 'Top', bottom: 'Trousers', shoes: 'Shoes', hat: 'Hat' };
const SLOT_ITEM: Record<GarmentSlot, keyof CharacterConfig> = { top: 'topId', bottom: 'bottomId', shoes: 'shoesId', hat: 'headwearId' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const hexOf = (n: number | undefined) => '#' + (n ?? 0).toString(16).padStart(6, '0');

export class ClothingStudio {
  private slot: GarmentSlot = 'top';
  private region: Region = 'main';
  private palette = PALETTES[0].id;
  private yaw = -0.35;
  private focus: Focus = 'full';
  private renaming: string | null = null;
  private confirmDelete: string | null = null;
  private shotTimer = 0;
  private shotGen = 0;
  private host: HTMLElement | null = null;

  private player: Player;
  constructor(player: Player) {
    this.player = player;
  }

  /** Draws the studio into `host` (again after any change of what is shown) */
  mount(host: HTMLElement): void {
    this.host = host;
    this.draw();
  }

  private get cfg(): CharacterConfig {
    return this.player.config;
  }

  /** The slots that can be styled now: what is worn (a one-piece has no separate trousers; a hat only if worn) */
  private slots(): GarmentSlot[] {
    const worn = playerGarments(this.cfg);
    const out: GarmentSlot[] = ['top'];
    if (!worn.onePiece) out.push('bottom');
    out.push('shoes');
    if (worn.hat) out.push('hat');
    return out;
  }

  private variant(slot: GarmentSlot): string {
    return playerGarments(this.cfg)[slot];
  }

  private itemColour(slot: GarmentSlot): string {
    const id = this.cfg[SLOT_ITEM[slot]] as string | undefined;
    return hexOf(WARDROBE_CATALOGUE.find((i) => i.id === id)?.color ?? (slot === 'bottom' ? 0x1e293b : 0x111827));
  }

  private style(slot = this.slot): GarmentStyle {
    return this.cfg.clothingStyles?.[slot] ?? {};
  }

  /** Changes this slot's style, wears it and saves it */
  private setStyle(change: (s: GarmentStyle) => GarmentStyle, redraw = false): void {
    const styles = { ...(this.cfg.clothingStyles ?? {}) };
    const next = change({ ...this.style(), pattern: this.style().pattern ? { ...this.style().pattern! } : undefined });
    if (next.pattern?.kind === 'plain') delete next.pattern;
    styles[this.slot] = next;
    this.player.restyle({ ...this.cfg, clothingStyles: styles });
    if (redraw) this.draw();
    else this.refreshSwatches();
    this.queueShot();
  }

  // ----------------------------------------------------------------------------------- Drawing
  private draw(): void {
    const host = this.host;
    if (!host) return;
    const slots = this.slots();
    if (!slots.includes(this.slot)) this.slot = 'top';
    const s = this.style();
    const variant = this.variant(this.slot);
    const fabrics = fabricChoices(this.slot, variant);
    const fabric = s.fabric && fabrics.includes(s.fabric) ? s.fabric : fabrics[0];
    const patterns = patternChoices(this.slot, fabric);
    const pk: PatternKind = s.pattern && patterns.includes(s.pattern.kind) ? s.pattern.kind : 'plain';
    const regions: [Region, string][] = [['main', 'Main colour']];
    if (pk !== 'plain') regions.push(['colour2', pk === 'graphic' || pk === 'logo' ? 'Ink' : 'Pattern colour']);
    if (['stripes', 'check', 'camo', 'ankara', 'graphic', 'logo'].includes(pk)) regions.push(['colour3', pk === 'logo' ? 'Badge colour' : pk === 'graphic' ? 'Second ink' : 'Accent colour']);
    if (fabric !== 'rubber') regions.push(['stitch', 'Stitching']);
    if (!regions.some(([r]) => r === this.region)) this.region = 'main';
    const chip = (cls: string, data: string, label: string, on: boolean, extra = '') => `<button type="button" class="cs-chip ${cls}${on ? ' is-on' : ''}" ${data}>${extra}${label}</button>`;
    const outfits = this.cfg.outfits ?? [];
    const pal = PALETTES.find((p) => p.id === this.palette) ?? PALETTES[0];
    const p = s.pattern ?? { kind: 'plain' as PatternKind };
    host.innerHTML = `
      <div class="cs-studio">
        <div class="cs-stage">
          <img class="cs-shot" id="cs-shot" alt="Your clothes on you" />
          <div class="cs-turn">
            <button type="button" class="cs-icon" id="cs-left" aria-label="Turn left">⟲</button>
            ${(['full', ...slots] as Focus[]).map((f) => chip('cs-focus', `data-focus="${f}"`, f === 'full' ? 'Whole look' : SLOT_LABEL[f as GarmentSlot], this.focus === f)).join('')}
            <button type="button" class="cs-icon" id="cs-right" aria-label="Turn right">⟳</button>
          </div>
        </div>
        <div class="cs-panel">
          <div class="cs-row cs-slots">${slots.map((sl) => chip('cs-slot', `data-slot="${sl}"`, SLOT_LABEL[sl], this.slot === sl)).join('')}</div>

          <div class="cs-section">
            <div class="cs-title">Colour</div>
            <div class="cs-row">${regions.map(([r, l]) => chip('cs-region', `data-region="${r}"`, l, this.region === r)).join('')}</div>
            <div class="cs-row cs-palettes">${PALETTES.map((x) => chip('cs-pal', `data-pal="${x.id}"`, x.label, x.id === pal.id)).join('')}</div>
            <div class="cs-swatches" id="cs-swatches">${this.swatches(pal.colours)}</div>
          </div>

          <div class="cs-section">
            <div class="cs-title">Cloth</div>
            <div class="cs-row">${fabrics.map((f) => chip('cs-fabric', `data-fabric="${f}"`, FABRIC_LABELS[f], f === fabric)).join('')}</div>
          </div>

          <div class="cs-section">
            <div class="cs-title">Pattern</div>
            <div class="cs-row">${patterns.map((k) => chip('cs-pattern', `data-pattern="${k}"`, PATTERN_LABELS[k], k === pk)).join('')}</div>
            ${pk === 'graphic' ? `<div class="cs-row">${GRAPHICS.map((g) => chip('cs-design', `data-design="${g.id}"`, g.label, (p.design ?? 'eko_sun') === g.id)).join('')}</div>` : ''}
            ${pk === 'logo' ? `
              <label class="cs-field">Your letters <input type="text" id="cs-logo" maxlength="12" value="${esc(p.text ?? '')}" placeholder="Up to 12 letters" autocomplete="off" /></label>
              <div class="cs-row">${LOGO_SHAPES.map((x) => chip('cs-shape', `data-shape="${x.id}"`, x.label, (p.shape ?? 'circle') === x.id)).join('')}</div>` : ''}
            ${pk !== 'plain' ? `<label class="cs-field">Size <input type="range" id="cs-scale" min="50" max="200" step="5" value="${Math.round((p.scale ?? 1) * 100)}" /></label>` : ''}
            ${['stripes', 'pinstripe', 'check'].includes(pk) ? `<div class="cs-row">${[0, 45, 90].map((a) => chip('cs-angle', `data-angle="${a}"`, a === 0 ? 'Across' : a === 45 ? 'Diagonal' : 'Up and down', (p.angle ?? 0) === a)).join('')}</div>` : ''}
            ${pk === 'graphic' || pk === 'logo' ? `
              <label class="cs-field">Across <input type="range" id="cs-x" min="-100" max="100" step="5" value="${Math.round((p.x ?? 0) * 100)}" /></label>
              <label class="cs-field">Up <input type="range" id="cs-y" min="-100" max="100" step="5" value="${Math.round((p.y ?? 0) * 100)}" /></label>` : ''}
          </div>

          <div class="cs-section">
            <div class="cs-title">Condition</div>
            <div class="cs-row">${(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => chip('cs-cond', `data-cond="${c}"`, CONDITION_LABELS[c], (s.condition ?? 'clean') === c)).join('')}</div>
          </div>
          <button type="button" class="cs-reset" id="cs-reset">Back to the shop look</button>

          <div class="cs-section cs-outfits">
            <div class="cs-title">Saved outfits <span class="cs-count">${outfits.length} of ${MAX_OUTFITS}</span></div>
            <div class="cs-save">
              <input type="text" id="cs-outfit-name" maxlength="24" placeholder="Name this look" autocomplete="off" />
              <button type="button" class="cs-primary" id="cs-outfit-save" ${outfits.length >= MAX_OUTFITS ? 'disabled' : ''}>Save outfit</button>
            </div>
            ${outfits.length ? '' : '<div class="cs-hint">Save what you are wearing now, colours and all, and put it back on in one tap.</div>'}
            <div class="cs-list">
              ${outfits.map((o) => `
                <div class="cs-outfit" data-id="${o.id}">
                  ${this.renaming === o.id
                    ? `<input type="text" class="cs-rename" data-id="${o.id}" maxlength="24" value="${esc(o.name)}" />`
                    : `<span class="cs-outfit-name">${esc(o.name)}</span>`}
                  <span class="cs-outfit-acts">
                    <button type="button" class="cs-mini cs-primary" data-act="wear" data-id="${o.id}">Wear</button>
                    <button type="button" class="cs-mini" data-act="update" data-id="${o.id}" title="Save what you wear now into this outfit">Update</button>
                    <button type="button" class="cs-mini" data-act="rename" data-id="${o.id}">${this.renaming === o.id ? 'Done' : 'Rename'}</button>
                    <button type="button" class="cs-mini cs-danger" data-act="delete" data-id="${o.id}">${this.confirmDelete === o.id ? 'Sure?' : 'Delete'}</button>
                  </span>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
    this.bind();
    this.queueShot(0);
  }

  /** The swatches for the chosen region (the current colour marked), with a picker for any colour */
  private swatches(colours: string[]): string {
    const now = this.regionColour();
    const list = this.region === 'stitch' ? STITCH_COLOURS : colours;
    return list.map((c) => `<button type="button" class="cs-swatch${c === now ? ' is-on' : ''}" data-colour="${c}" style="background:${c || 'conic-gradient(#d4d4d4 0 25%, #fff 0 50%, #d4d4d4 0 75%, #fff 0)'}" title="${c || 'The cloth’s own thread'}" aria-label="${c || 'Own thread'}"></button>`).join('')
      + `<label class="cs-swatch cs-any" title="Any colour"><input type="color" id="cs-any" value="${now || '#888888'}" />+</label>`;
  }

  private regionColour(): string {
    const s = this.style();
    if (this.region === 'main') return (s.colour ?? this.itemColour(this.slot)).toLowerCase();
    if (this.region === 'stitch') return s.stitch ?? '';
    if (this.region === 'colour2') return s.pattern?.colour2 ?? '#111827';
    return s.pattern?.colour3 ?? '#facc15';
  }

  private refreshSwatches(): void {
    const el = this.host?.querySelector('#cs-swatches');
    const pal = PALETTES.find((p) => p.id === this.palette) ?? PALETTES[0];
    if (el) {
      el.innerHTML = this.swatches(pal.colours);
      this.bindSwatches();
    }
  }

  private setColour(c: string): void {
    const region = this.region;
    this.setStyle((s) => {
      if (region === 'main') s.colour = c;
      else if (region === 'stitch') s.stitch = c;
      else if (s.pattern) s.pattern[region] = c;
      return s;
    });
  }

  // ----------------------------------------------------------------------------------- Events
  private bindSwatches(): void {
    const host = this.host!;
    host.querySelectorAll<HTMLElement>('.cs-swatch[data-colour]').forEach((b) => { b.onclick = () => this.setColour(b.dataset.colour!); });
    const any = host.querySelector<HTMLInputElement>('#cs-any');
    if (any) any.oninput = () => this.setColour(any.value.toLowerCase());
  }

  private bind(): void {
    const host = this.host!;
    const on = (sel: string, fn: (el: HTMLElement) => void) => host.querySelectorAll<HTMLElement>(sel).forEach((el) => { el.onclick = () => fn(el); });
    on('.cs-slot', (el) => { this.slot = el.dataset.slot as GarmentSlot; this.region = 'main'; if (this.focus !== 'full') this.focus = this.slot; this.draw(); });
    on('.cs-focus', (el) => { this.focus = el.dataset.focus as Focus; this.draw(); });
    on('.cs-region', (el) => { this.region = el.dataset.region as Region; this.draw(); });
    on('.cs-pal', (el) => { this.palette = el.dataset.pal!; this.draw(); });
    on('.cs-fabric', (el) => this.setStyle((s) => ({ ...s, fabric: el.dataset.fabric as GarmentStyle['fabric'] }), true));
    on('.cs-pattern', (el) => this.setStyle((s) => {
      const kind = el.dataset.pattern as PatternKind;
      const keep = s.pattern ?? { kind };
      return { ...s, pattern: { ...keep, kind, colour2: keep.colour2 ?? (kind === 'camo' ? '#4d5b3a' : '#111827'), colour3: keep.colour3 ?? (kind === 'camo' ? '#2f3424' : '#facc15'), text: kind === 'logo' ? keep.text ?? (this.cfg.name || 'NL').slice(0, 12) : keep.text } };
    }, true));
    on('.cs-design', (el) => this.setStyle((s) => ({ ...s, pattern: { ...s.pattern!, design: el.dataset.design } }), true));
    on('.cs-shape', (el) => this.setStyle((s) => ({ ...s, pattern: { ...s.pattern!, shape: el.dataset.shape as never } }), true));
    on('.cs-angle', (el) => this.setStyle((s) => ({ ...s, pattern: { ...s.pattern!, angle: Number(el.dataset.angle) } }), true));
    on('.cs-cond', (el) => this.setStyle((s) => ({ ...s, condition: el.dataset.cond as Condition }), true));
    on('#cs-reset', () => this.setStyle(() => ({}), true));
    on('#cs-left', () => { this.yaw -= Math.PI / 4; this.queueShot(0); });
    on('#cs-right', () => { this.yaw += Math.PI / 4; this.queueShot(0); });
    this.bindSwatches();
    const slider = (id: string, set: (s: GarmentStyle, v: number) => void) => {
      const el = host.querySelector<HTMLInputElement>(id);
      if (el) el.oninput = () => this.setStyle((s) => { set(s, Number(el.value) / 100); return s; });
    };
    slider('#cs-scale', (s, v) => { if (s.pattern) s.pattern.scale = v; });
    slider('#cs-x', (s, v) => { if (s.pattern) s.pattern.x = v; });
    slider('#cs-y', (s, v) => { if (s.pattern) s.pattern.y = v; });
    // The logo is printed when typing pauses (not a new print for every letter)
    const logo = host.querySelector<HTMLInputElement>('#cs-logo');
    if (logo) {
      let t = 0;
      logo.oninput = () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => this.setStyle((s) => ({ ...s, pattern: { ...s.pattern!, text: cleanLogoText(logo.value) } })), 450);
      };
    }

    // Outfits
    const nameEl = host.querySelector<HTMLInputElement>('#cs-outfit-name');
    on('#cs-outfit-save', () => {
      const name = nameEl?.value.trim() || `Outfit ${(this.cfg.outfits?.length ?? 0) + 1}`;
      const saved = saveOutfit(this.cfg, name);
      if (!saved) { showGameToast(`You can keep ${MAX_OUTFITS} outfits. Delete one to save another.`, 'info', 3000); return; }
      this.player.restyle(saved.cfg);
      showGameToast(`Saved “${saved.outfit.name}”`, 'success', 2200);
      this.draw();
    });
    host.querySelectorAll<HTMLElement>('.cs-outfit [data-act]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.id!;
        const act = b.dataset.act;
        if (act !== 'delete') this.confirmDelete = null;
        if (act === 'wear') {
          const { cfg, missing } = equipOutfit(this.cfg, id);
          this.player.restyle(cfg);
          const name = cfg.outfits?.find((o) => o.id === id)?.name ?? 'Outfit';
          showGameToast(missing.length ? `Wearing “${name}” (${missing.length} item${missing.length > 1 ? 's' : ''} no longer yours)` : `Wearing “${name}”`, missing.length ? 'info' : 'success', 2400);
        } else if (act === 'update') {
          this.player.restyle(updateOutfit(this.cfg, id));
          showGameToast('Outfit updated with what you are wearing', 'success', 2200);
        } else if (act === 'rename') {
          if (this.renaming === id) {
            const input = host.querySelector<HTMLInputElement>(`.cs-rename[data-id="${id}"]`);
            if (input) this.player.restyle(renameOutfit(this.cfg, id, input.value));
            this.renaming = null;
          } else this.renaming = id;
        } else if (act === 'delete') {
          if (this.confirmDelete === id) {
            this.player.restyle(deleteOutfit(this.cfg, id));
            this.confirmDelete = null;
          } else this.confirmDelete = id;
        }
        this.draw();
      };
    });
    host.querySelectorAll<HTMLInputElement>('.cs-rename').forEach((input) => {
      input.focus();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { this.player.restyle(renameOutfit(this.cfg, input.dataset.id!, input.value)); this.renaming = null; this.draw(); }
        if (e.key === 'Escape') { this.renaming = null; this.draw(); }
        e.stopPropagation();
      };
    });
    // Typing here is not walking about
    host.querySelectorAll<HTMLInputElement>('input[type="text"]').forEach((i) => { i.addEventListener('keydown', (e) => e.stopPropagation()); });
  }

  // ----------------------------------------------------------------------------------- The picture
  private queueShot(delay = 90): void {
    window.clearTimeout(this.shotTimer);
    this.shotTimer = window.setTimeout(() => void this.shoot(), delay);
  }

  private async shoot(): Promise<void> {
    const gen = ++this.shotGen;
    const url = await LookPreview.shootClothes(this.cfg, this.yaw, this.focus);
    if (gen !== this.shotGen || !url) return;
    const img = this.host?.querySelector<HTMLImageElement>('#cs-shot');
    if (img) img.src = url;
  }
}
