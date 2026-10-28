/**
 * Cloudflare Turnstile on the web (family and staff): Cloudflare's script renders an invisible widget off screen.
 * Same contract as captcha.tsx: a one-use token, or undefined if there is no site key or no answer in time.
 */
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TIMEOUT_MS = 15000;

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;

const load = () => {
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Offline: try again on the next sign-in
        loading = null;
        reject(new Error('turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
};

export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  try {
    await load();
  } catch {
    return undefined;
  }
  const turnstile = window.turnstile;
  if (!turnstile) return undefined;
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(box);
    let id = '';
    let done = false;
    const finish = (token: string | undefined) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (id) turnstile.remove(id);
      box.remove();
      if (__DEV__) console.log('captcha', token ? 'token ok' : 'no token');
      resolve(token);
    };
    const timer = setTimeout(() => finish(undefined), TIMEOUT_MS);
    id = turnstile.render(box, {
      sitekey: SITE_KEY,
      callback: (token: string) => finish(token),
      'error-callback': () => finish(undefined),
    });
  });
}

/** Nothing to mount on the web */
export function CaptchaHost() {
  return null;
}
