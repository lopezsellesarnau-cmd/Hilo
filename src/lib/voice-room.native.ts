import { AudioSession, registerGlobals } from '@livekit/react-native';
import { RTCAudioSession } from '@livekit/react-native-webrtc';
import { Room, RoomEvent, type RemoteParticipant } from 'livekit-client';

import { supabase } from '@/lib/supabase';

/**
 * The voice call between a family member and her (plan: vault Senior-App/12-llamadas-plan, piece 1).
 * LiveKit carries the audio (EU, nothing recorded); the voice-call Edge Function gives the tokens.
 * This file is the phone's side; voice-room.ts is the web's (no calls there).
 */

let globals = false;
/** WebRTC for LiveKit, once, before the first room */
export function prepareVoice() {
  if (globals) return;
  registerGlobals();
  globals = true;
}

export const voiceSupported = true;

type Joined = { url: string; token: string };
const call = async <T>(body: object): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('voice-call', { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status ?? 0;
    throw Object.assign(new Error('voice-call'), { status });
  }
  return data as T;
};

/** A family member calls her: her phone rings; the caller gets the room */
export const startCall = () => call<Joined & { call_id: string }>({ action: 'start' });
/** She answered: her token for the same room */
export const joinCall = (callId: string) => call<Joined>({ action: 'join', call_id: callId });
/** Declined, not answered or hung up (quiet if it fails: the server ends stale calls by their status) */
export const endCall = (callId: string) => call<{ status: string }>({ action: 'end', call_id: callId }).catch(() => null);

/**
 * Into the room with the microphone on. `onOther` hears the other person arrive and leave.
 * `callKit` (her phone): CallKit turns the audio on itself. Starting it here too fails while the phone is
 * locked (an app in the background can't take the audio), and the call ended at once.
 */
export async function connectRoom(joined: Joined, onOther: (here: boolean) => void, callKit = false) {
  prepareVoice();
  await AudioSession.configureAudio({ ios: { defaultOutput: 'earpiece' } });
  if (!callKit) await AudioSession.startAudioSession();
  const room = new Room({ adaptiveStream: false, dynacast: false });
  room.on(RoomEvent.ParticipantConnected, () => onOther(true));
  room.on(RoomEvent.ParticipantDisconnected, () => onOther(room.remoteParticipants.size > 0));
  await room.connect(joined.url, joined.token);
  // Locked, the microphone may only open once CallKit's audio is on: then call.ts tries again
  await room.localParticipant.setMicrophoneEnabled(true).catch((e) => {
    if (!callKit) throw e;
    console.warn('voice: microphone later', e);
  });
  if (room.remoteParticipants.size) onOther(true);
  return room;
}

/** Out of the room and the audio session */
export async function leaveRoom(room: Room | null) {
  await room?.disconnect().catch(() => {});
  await AudioSession.stopAudioSession().catch(() => {});
}

/** How loud the other person is right now (0–1), for the Bot's mouth */
export const otherLevel = (room: Room | null) => {
  let level = 0;
  room?.remoteParticipants.forEach((p: RemoteParticipant) => (level = Math.max(level, p.audioLevel)));
  return level;
};

/** Her or your microphone off and on */
export const setMuted = (room: Room | null, muted: boolean) => room?.localParticipant.setMicrophoneEnabled(!muted).catch(() => {});

/** Earpiece or loudspeaker (iOS: 'default' is the earpiece for a call) */
export const setSpeaker = (on: boolean) => AudioSession.selectAudioOutput(on ? 'force_speaker' : 'default').catch(() => {});

/** CallKit turned the call's audio on or off (her phone): WebRTC has to be told, or there is no sound */
export const callKitAudio = (active: boolean) => (active ? RTCAudioSession.audioSessionDidActivate() : RTCAudioSession.audioSessionDidDeactivate());

export type { Room };
