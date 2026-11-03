import { router } from 'expo-router';
import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import HiloVoip from '../../modules/hilo-voip';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Hilo rings like a phone call (CallKit): the family presses "Llamar ahora" and her phone rings, even locked.
 * The ring arrives as a VoIP push (modules/hilo-voip); when she answers, the talk opens. iPhone only for now.
 */

// She answered: the family sees it, and the talk opens
const answer = (callUUID: string) => {
  supabase.rpc('answer_ring', { ring_id: callUUID });
  RNCallKeep.endCall(callUUID);
  router.push('/talk');
};

let ready: Promise<void> | null = null;

const setup = () =>
  (ready ??= RNCallKeep.setup({
    ios: { appName: 'Hilo', imageName: 'CallIcon', supportsVideo: false, includesCallsInRecents: false },
    android: { alertTitle: '', alertDescription: '', cancelButton: '', okButton: '', additionalPermissions: [] },
  }).then(async () => {
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => answer(callUUID));
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
