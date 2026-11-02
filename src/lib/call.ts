import { router } from 'expo-router';
import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import { t } from '@/i18n';

/**
 * Hilo rings like a phone call (CallKit): the family presses "Talk now" and her phone rings, even locked.
 * When she answers, the talk opens. iPhone only for now.
 */

let ready: Promise<void> | null = null;

const setup = () =>
  (ready ??= RNCallKeep.setup({
    ios: { appName: 'Hilo', imageName: 'CallIcon', supportsVideo: false, includesCallsInRecents: false },
    android: { alertTitle: '', alertDescription: '', cancelButton: '', okButton: '', additionalPermissions: [] },
  }).then(() => {
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      RNCallKeep.endCall(callUUID);
      router.push('/talk');
    });
    RNCallKeep.addEventListener('didDisplayIncomingCall', ({ error, errorCode }) => {
      if (error) console.warn('call not shown', errorCode, error);
    });
  }));

// Test only: the real call id will come from the server
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

/** Test only (on the iPhone: the simulator ends CallKit calls at once): rings in 5 s, time to lock the screen, as if the family had pressed "Talk now" */
export async function ringForTest() {
  if (Platform.OS !== 'ios') return;
  await setup();
  setTimeout(() => RNCallKeep.displayIncomingCall(uuid(), 'Hilo', t.talk.caller, 'generic', false), 5000);
}
