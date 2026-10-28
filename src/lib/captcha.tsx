import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Cloudflare Turnstile before each sign-in, so nobody can script hundreds of accounts (e.g. to guess pairing codes).
 * Invisible: she never sees a puzzle. On the phone it runs in a hidden web view mounted once by <CaptchaHost />.
 * No site key (or no token in time) → no token: Supabase only asks for one once CAPTCHA is on in Attack Protection.
 */
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
// Turnstile only answers on the widget's hostnames: the hidden page acts as if it were on the web app
const BASE_URL = 'https://hilo-app-beta.vercel.app';
const TIMEOUT_MS = 15000;

let pending: Promise<string | undefined> | null = null;
let deliver: ((token: string | undefined) => void) | null = null;
let setOpen: ((open: boolean) => void) | null = null;

/** A one-use token (valid 5 minutes), or undefined if Turnstile couldn't give one */
export function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY || !setOpen) return Promise.resolve(undefined);
  // Two taps at once share the same token request
  if (!pending) {
    pending = new Promise((resolve) => {
      const timer = setTimeout(() => deliver?.(undefined), TIMEOUT_MS);
      deliver = (token) => {
        clearTimeout(timer);
        pending = null;
        deliver = null;
        setOpen?.(false);
        if (__DEV__) console.log('captcha', token ? 'token ok' : 'no token');
        resolve(token);
      };
      setOpen?.(true);
    });
  }
  return pending;
}

const page = (siteKey: string) => `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width">
<script>
  function send(t) { window.ReactNativeWebView.postMessage(t || ''); }
  function go() {
    turnstile.render('#box', { sitekey: '${siteKey}', callback: send, 'error-callback': function () { send(''); } });
  }
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=go&render=explicit" async></script>
</head><body><div id="box"></div></body></html>`;

/** Mounted once in the root layout; the web view only exists while a token is being asked for */
export function CaptchaHost() {
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    setOpen = setOpenState;
    return () => {
      setOpen = null;
    };
  }, []);
  if (!open || !SITE_KEY) return null;
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{ html: page(SITE_KEY), baseUrl: BASE_URL }}
        originWhitelist={['*']}
        onMessage={(e) => deliver?.(e.nativeEvent.data || undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Not size 0: a web view without size may not run its scripts
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
