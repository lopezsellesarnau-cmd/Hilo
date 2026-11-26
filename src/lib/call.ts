import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

import HiloVoip from '../../modules/hilo-voip';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { callKitAudio, connectRoom, endCall as endVoiceCall, joinCall, leaveRoom, prepareVoice, setMuted, type Room } from '@/lib/voice-room';

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

/**
 * A family member calling her (voice_calls), not Hilo: answering joins the call right there, on the call screen,
 * even locked; Hilo doesn't open. CallKit owns the audio, so WebRTC is told when iOS turns it on and off.
 */
let voice: { uuid: string; room: Room | null } | null = null;
let callAudio = false; // CallKit's audio is on (it can come before the room is ready)
let toldWebRTC = false;

const isVoice = async (uuid: string) => {
  const { data } = await supabase.from('voice_calls').select('id').eq('id', uuid).maybeSingle();
  return Boolean(data);
};

const audioOn = () => {
  if (!voice || toldWebRTC || !callAudio) return;
  callKitAudio(true);
  toldWebRTC = true;
};

// The call ends: she hung up (CallKit), or the family member left the room (then the call screen goes too)
const hangUpVoice = async (uuid: string, otherLeft = false) => {
  if (voice?.uuid !== uuid) return;
  const room = voice.room;
  voice = null;
  await leaveRoom(room);
  endVoiceCall(uuid);
  if (otherLeft) RNCallKeep.endCall(uuid);
};

const answerVoice = async (uuid: string) => {
  voice = { uuid, room: null };
  try {
    const room = await connectRoom(await joinCall(uuid), (here) => {
      if (!here) hangUpVoice(uuid, true);
    });
    // She hung up while it was connecting
    if (voice?.uuid !== uuid) return leaveRoom(room);
    voice.room = room;
    audioOn();
  } catch {
    // Too late (the family gave up) or no network: the call screen goes
    voice = null;
    RNCallKeep.endCall(uuid);
  }
};

// She answered: a family member's call joins at once; Hilo's call opens the talk (now, or when she opens Hilo)
const answer = async (callUUID: string) => {
  if (await isVoice(callUUID)) return answerVoice(callUUID);
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

const setup = () => {
  // WebRTC for the family's calls, before any room
  prepareVoice();
  return (ready ??= RNCallKeep.setup({
    ios: { appName: 'Hilo', imageName: 'CallIcon', supportsVideo: false, includesCallsInRecents: false },
    android: { alertTitle: '', alertDescription: '', cancelButton: '', okButton: '', additionalPermissions: [] },
  }).then(async () => {
    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => answer(callUUID));
    // She opened Hilo (the Hilo button on the call screen, or the icon after unlocking)
    AppState.addEventListener('change', (state) => state === 'active' && openTalk());
    // She hung up on the call screen: nothing to open, or the family's call ends (or she declined it)
    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      if (pending?.uuid === callUUID) pending = null;
      if (voice?.uuid === callUUID) return void hangUpVoice(callUUID);
      isVoice(callUUID).then((v) => v && endVoiceCall(callUUID));
    });
    // The mute button on iOS's call screen
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ muted, callUUID }) => {
      if (voice?.uuid === callUUID) setMuted(voice.room, muted);
    });
    // CallKit turns the call's audio on and off: WebRTC has to follow
    RNCallKeep.addEventListener('didActivateAudioSession', () => {
      callAudio = true;
      audioOn();
    });
    RNCallKeep.addEventListener('didDeactivateAudioSession', () => {
      callAudio = false;
      if (toldWebRTC) callKitAudio(false);
      toldWebRTC = false;
    });
    RNCallKeep.addEventListener('didDisplayIncomingCall', ({ error, errorCode }) => {
      if (error) console.warn('call not shown', errorCode, error);
    });
    // Answered while Hilo was closed: the answer came before this code was running
    for (const event of await RNCallKeep.getInitialEvents()) {
      if (event.name === 'RNCallKeepDidActivateAudioSession') callAudio = true;
      if (event.name === 'RNCallKeepPerformAnswerCallAction') answer(event.data.callUUID);
      if (event.name === 'RNCallKeepPerformEndCallAction') isVoice(event.data.callUUID).then((v) => v && endVoiceCall(event.data.callUUID));
    }
    RNCallKeep.clearInitialEvents();
  }));
};

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
