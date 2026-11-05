/**
 * The way into Nigeria Life online: create an account (a username others will know you by, a
 * password, man or woman) or sign in to one you have, on any phone. A guest who registers keeps
 * everything they have. "Later" plays on as a guest, and the screen asks again next time.
 */

export interface SignInHooks {
  register(username: string, password: string): Promise<{ ok: boolean; reason?: string }>;
  login(username: string, password: string): Promise<{ ok: boolean; reason?: string }>;
  /** Signed in or registered: the player's name, and (registering) who they chose to be */
  done(name: string, gender: 'male' | 'female' | null, isNew: boolean): void;
}

export class SignInScreen {
  private el: HTMLDivElement | null = null;
  private mode: 'register' | 'login' = 'register';
  private gender: 'male' | 'female' = 'male';
  private readonly hooks: SignInHooks;

  constructor(hooks: SignInHooks) {
    this.hooks = hooks;
  }

  public open(): void {
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'nl-signin';
    el.className = 'nl-signin';
    document.body.appendChild(el);
    this.el = el;
    this.render();
  }

  public close(): void {
    this.el?.remove();
    this.el = null;
  }

  private render(): void {
    const el = this.el;
    if (!el) return;
    // What was typed stays typed when the form is drawn again (a tab, man or woman)
    const typedUser = (el.querySelector('#nl-signin-user') as HTMLInputElement | null)?.value ?? '';
    const typedPass = (el.querySelector('#nl-signin-pass') as HTMLInputElement | null)?.value ?? '';
    const reg = this.mode === 'register';
    el.innerHTML = `
      <div class="nl-signin-card" role="dialog" aria-label="${reg ? 'Create your account' : 'Sign in'}">
        <img class="nl-signin-mark" src="${import.meta.env.BASE_URL}icon-192.png" alt="" />
        <h1>${reg ? 'Your life in Lagos starts here' : 'Welcome back'}</h1>
        <p>${reg ? 'Choose the name everyone in the city will know you by. Your money, homes and cars stay yours on any phone.' : 'Sign in with your username and password to carry on where you left off.'}</p>
        <div class="nl-signin-tabs" role="tablist">
          <button type="button" data-mode="register" class="${reg ? 'is-on' : ''}">Create account</button>
          <button type="button" data-mode="login" class="${reg ? '' : 'is-on'}">Sign in</button>
        </div>
        <label>Username<input id="nl-signin-user" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="16" placeholder="e.g. Ada_Lagos" /></label>
        <label>Password<input id="nl-signin-pass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="At least 6 characters" /></label>
        ${reg ? `<div class="nl-signin-who"><span>I am</span>
          <button type="button" data-gender="male" class="${this.gender === 'male' ? 'is-on' : ''}">👨🏾 A man</button>
          <button type="button" data-gender="female" class="${this.gender === 'female' ? 'is-on' : ''}">👩🏾 A woman</button></div>` : ''}
        <div class="nl-signin-error" id="nl-signin-error" role="alert"></div>
        <button type="button" class="nl-signin-go" id="nl-signin-go">${reg ? 'Create my account' : 'Sign in'}</button>
        <button type="button" class="nl-signin-later" id="nl-signin-later">Play as a guest for now</button>
      </div>`;
    el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      this.mode = b.dataset.mode as 'register' | 'login';
      this.render();
    }));
    el.querySelectorAll<HTMLButtonElement>('[data-gender]').forEach((b) => b.addEventListener('click', () => {
      this.gender = b.dataset.gender as 'male' | 'female';
      this.render();
    }));
    el.querySelector('#nl-signin-later')!.addEventListener('click', () => this.close());
    const go = el.querySelector('#nl-signin-go') as HTMLButtonElement;
    const user = el.querySelector('#nl-signin-user') as HTMLInputElement;
    const pass = el.querySelector('#nl-signin-pass') as HTMLInputElement;
    const error = el.querySelector('#nl-signin-error') as HTMLDivElement;
    user.value = typedUser;
    pass.value = typedPass;
    // Typing here is typing, not walking or opening the map
    for (const input of [user, pass]) {
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') go.click();
      });
      input.addEventListener('keyup', (e) => e.stopPropagation());
    }
    go.addEventListener('click', async () => {
      const username = user.value.trim().replace(/^@/, '');
      const password = pass.value;
      if (!/^[A-Za-z0-9_.]{3,16}$/.test(username)) {
        error.textContent = 'A username is 3 to 16 letters or numbers (_ and . allowed, no spaces).';
        return;
      }
      if (password.length < 6) {
        error.textContent = 'The password needs at least 6 characters.';
        return;
      }
      go.disabled = true;
      go.textContent = reg ? 'Creating…' : 'Signing in…';
      error.textContent = '';
      const result = reg ? await this.hooks.register(username, password) : await this.hooks.login(username, password);
      if (!result.ok) {
        error.textContent = result.reason ?? 'Something went wrong. Try again.';
        go.disabled = false;
        go.textContent = reg ? 'Create my account' : 'Sign in';
        return;
      }
      this.close();
      this.hooks.done(username, reg ? this.gender : null, reg);
    });
    if (!typedUser) setTimeout(() => user.focus(), 50);
  }
}
