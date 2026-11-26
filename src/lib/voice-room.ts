/**
 * The web has no calls (no CallKit, no WebRTC setup here): the same functions, doing nothing.
 * The phone's side is voice-room.native.ts.
 */
type Joined = { url: string; token: string };
export type Room = { disconnect: () => Promise<void> };

export const voiceSupported = false;
export const prepareVoice = () => {};
const unsupported = () => Promise.reject(Object.assign(new Error('voice-call'), { status: 501 }));
export const startCall = (): Promise<Joined & { call_id: string }> => unsupported();
export const joinCall = (_callId: string): Promise<Joined> => unsupported();
export const endCall = async (_callId: string) => null;
export const connectRoom = (_joined: Joined, _onOther: (here: boolean) => void): Promise<Room> => unsupported();
export const leaveRoom = async (_room: Room | null) => {};
export const otherLevel = (_room: Room | null) => 0;
export const setMuted = async (_room: Room | null, _muted: boolean) => {};
export const setSpeaker = async (_on: boolean) => {};
export const callKitAudio = (_active: boolean) => {};
