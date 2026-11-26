import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import HiloVoip from '../../modules/hilo-voip';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Hilo rings like a phone call (CallKit): the family presses "Llamar ahora" and her phone rings, even locked.
 * The ring arrives as a VoIP push (modules/hilo-voip); when she answers, the talk opens. iPhone only for now.
 *
 * Answering on a locked phone leaves Hilo behind the lock screen. So the call stays "connected" in iOS's call screen
 * (with its Hilo button) until Hilo comes to the front: only then the call screen goes and the talk opens.
 * An answer older than RECENT_MS opens nothing: opening Hilo by hand later lands on Home, not on an old talk.
 */
const RECENT_MS = 2 * 60 * 1000;
let pending: { uuid: string; at: number } | null = null;

// Hilo is in front: end the call screen and open the talk, if she answered just now
const openTalk = () => {
  if (!pending) return;
  const { uuid, at } = pending;
  pending = null;
  RNCallKeep.endCall(uuid);
  if (Date.now() - at < RECENT_MS) router.push('/talk');
};

// She answered: the family sees it; the talk opens now if Hilo is in front, or when she unlocks and opens it
const answer = (callUUID: string) => {
  supabase.rpc('answer_ring', { ring_id: callUUID });
  pending = { uuid: callUUID, at: Date.now() };
  if (AppState.currentState === 'active') return openTalk();
  // Never opened: after a while the call screen goes by itself
  setTimeout(() => {
    if (pending?.uuid !== callUUID) return;
    pending = null;
    RNCallKeep.endCall(callUUID);
  }, RECENT_MS);
};

let ready: Promise<void> | null = null;

const setup = () =>
  (ready ??= RNCallKeep.setup({
    ios: { appName: 'Hilo', imageName: 'CallIcon', supportsVideo: false, includesCallsInRecents: false },
    android: { alertTitle: '', alertDescription: '', cancelButton: '', okButton: '', additionalPermissions: [] },
  }).then(async () => {
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => answer(callUUID));
    // She opened Hilo (the Hilo button on the call screen, or the icon after unlocking)
    AppState.addEventListener('change', (state) => state === 'active' && openTalk());
    // She hung up on the call screen before opening Hilo: nothing to open
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      if (pending?.uuid === callUUID) pending = null;
    });
    RNCallKeep.addEventListener('didDisplayIncomingCall', ({ error, errorCode }) => {
      if (error) console.warn('call not shown', errorCode, error);
    });
    // Answered while Hilo was closed: the answer came before this code was running
    for (const event of await RNCallKeep.getInitialEvents()) {
      if (event.name === 'RNCallKeepPerformAnswerCallAction') answer(event.data.callUUID);
    }
    RNCallKeep.clearInitialEvents();
  }));

const saveToken = (token: string) => supabase.rpc('save_voip_token', { device_token: token });

/** On her Home: ready to answer, and the server knows where to ring. Quiet if it can't: the app works without it */
export async function registerSeniorCalls() {
  if (Platform.OS !== 'ios' || !HiloVoip) return;
  await setup();
  const token = HiloVoip.getToken();
  if (token) return saveToken(token);
  // The first time, iOS gives the token a moment later
  const sub = HiloVoip.addListener('onToken', ({ token }) => {
    sub.remove();
    saveToken(token);
  });
}

// Test only: the real call id comes from the server
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

/** Test only (on the iPhone: the simulator ends CallKit calls at once): rings in 5 s, as if the family had pressed "Llamar ahora" */
export async function ringForTest() {
  if (Platform.OS !== 'ios') return;
  await setup();
  setTimeout(() => RNCallKeep.displayIncomingCall(uuid(), 'Hilo', t.talk.caller, 'generic', false), 5000);
}
