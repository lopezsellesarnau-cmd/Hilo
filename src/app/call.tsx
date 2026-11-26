import { setStatusBarStyle } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HangUpIcon, MicIcon, MicOffIcon, SpeakerIcon } from '@/components/icons';
import { LiveBot } from '@/components/live-bot';
import { PressScale } from '@/components/press-scale';
import { TRAY } from '@/components/record-flow';
import { t } from '@/i18n';
import { iCalled } from '@/lib/calls';
import { goBack } from '@/lib/nav';
import { supabase } from '@/lib/supabase';
import { connectRoom, endCall, leaveRoom, otherLevel, setMuted, setSpeaker, startCall, type Room } from '@/lib/voice-room';
import { colors, fontWeight } from '@/theme';

const text = t.voiceCall;
/** Ringing this long without an answer: "No answer" */
const RING_MS = 40 * 1000;

type State = 'starting' | 'calling' | 'active' | 'noAnswer' | 'declined' | 'ended' | 'busy' | 'noPhone' | 'notReady' | 'failed';
const OVER: State[] = ['noAnswer', 'declined', 'ended', 'busy', 'noPhone', 'notReady', 'failed'];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Llamar (plan: vault Senior-App/12-llamadas-plan, piece 1): a family member calls her, voice to voice, inside Hilo.
 * Her iPhone rings like any call (CallKit, with this person's name); when she answers they talk here, through LiveKit
 * (EU, nothing recorded). Black like a call: her Bot (its mouth moves when she speaks), her name, the time,
 * and Mute, Speaker and End.
 */
export default function CallScreen() {
  const reduce = useReducedMotion();
  const [name, setName] = useState('');
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [state, setState] = useState<State>('starting');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [speaker, setSpeakerState] = useState(false);
  const room = useRef<Room | null>(null);
  const callId = useRef<string | null>(null);
  const mouth = useSharedValue(0);

  // The state, also for the timers and the cleanup (they run outside render)
  const now = useRef<State>('starting');
  const go = (s: State) => {
    if (OVER.includes(now.current)) return; // a call that's over stays over
    now.current = s;
    setState(s);
  };

  // Over: out of the room, tell the server, and back after a moment
  const finish = (s: State) => {
    if (OVER.includes(now.current)) return;
    go(s);
    const id = callId.current;
    if (id) endCall(id);
    leaveRoom(room.current);
    room.current = null;
    setTimeout(() => goBack('/family/today'), 1600);
  };

  useEffect(() => {
    setStatusBarStyle('light');
    let alive = true;
    const channel = { current: null as ReturnType<typeof supabase.channel> | null };

    (async () => {
      const { data: s } = await supabase.from('people').select('id, display_name').eq('role', 'senior').limit(1).maybeSingle();
      if (s) {
        setName(s.display_name);
        setSeniorId(s.id);
      }
      try {
        const started = await startCall();
        if (!alive) return void endCall(started.call_id);
        callId.current = started.call_id;
        go('calling');
        // She answers, declines or hangs up: the row tells this phone at once
        channel.current = supabase
          .channel(`voice-call-${started.call_id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'voice_calls', filter: `id=eq.${started.call_id}` }, ({ new: row }) => {
            const status = (row as { status: string }).status;
            if (status === 'active') go('active');
            if (status === 'declined') finish('declined');
            if (status === 'missed') finish('noAnswer');
            if (status === 'ended') finish('ended');
          })
          .subscribe();
        room.current = await connectRoom(started, (here) => {
          if (here) go('active');
          else if (now.current === 'active') finish('ended'); // she hung up
        });
        if (!alive) leaveRoom(room.current);
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        finish(status === 409 ? 'noPhone' : status === 429 ? 'busy' : status === 503 || status === 501 ? 'notReady' : 'failed');
      }
    })();

    // Nobody answered
    const ring = setTimeout(() => now.current === 'calling' && finish('noAnswer'), RING_MS);

    return () => {
      alive = false;
      clearTimeout(ring);
      if (channel.current) supabase.removeChannel(channel.current);
      // Leaving the screen ends the call
      if (!OVER.includes(now.current) && callId.current) endCall(callId.current);
      leaveRoom(room.current);
      setStatusBarStyle('dark');
    };
    // once, on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Talking: the time, and it counts as a call from this family member (for "Call Grandma")
  useEffect(() => {
    if (state !== 'active') return;
    if (seniorId) iCalled(seniorId).catch(() => {});
    const id = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [state, seniorId]);

  // Her Bot's mouth moves with her voice
  useEffect(() => {
    if (state !== 'active' || reduce) return;
    const id = setInterval(() => mouth.set(withTiming(Math.min(1, otherLevel(room.current) * 3), { duration: 90 })), 100);
    return () => {
      clearInterval(id);
      mouth.set(withTiming(0, { duration: 150 }));
    };
  }, [state, reduce, mouth]);

  const status =
    state === 'active'
      ? clock(seconds)
      : state === 'starting' || state === 'calling'
        ? text.calling
        : text[state];

  const over = OVER.includes(state);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Animated.View entering={reduce ? undefined : FadeIn.duration(300)}>
          <LiveBot size={180} voice={mouth} color={colors.onAccent} eyeColor={TRAY} />
        </Animated.View>
        <Animated.Text entering={reduce ? undefined : FadeInDown.delay(80).springify().damping(16)} style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
          {name}
        </Animated.Text>
        <Text style={[styles.status, over && styles.statusOver]} accessibilityLiveRegion="polite">
          {status}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Round
          label={muted ? text.unmute : text.mute}
          on={muted}
          disabled={over}
          onPress={() => {
            setMuted(room.current, !muted);
            setMutedState(!muted);
          }}>
          {muted ? <MicOffIcon color={colors.ink} /> : <MicIcon size={26} />}
        </Round>
        <Round
          label={text.speaker}
          on={speaker}
          disabled={over}
          onPress={() => {
            setSpeaker(!speaker);
            setSpeakerState(!speaker);
          }}>
          <SpeakerIcon color={speaker ? colors.ink : colors.onAccent} />
        </Round>
        <Round label={text.end} danger disabled={over} onPress={() => finish(state === 'active' ? 'ended' : 'noAnswer')}>
          <HangUpIcon />
        </Round>
      </View>
    </SafeAreaView>
  );
}

function Round({ label, on, danger, disabled, onPress, children }: { label: string; on?: boolean; danger?: boolean; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.roundWrap}>
      <PressScale
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: on, disabled }}
        style={[styles.round, on && styles.roundOn, danger && styles.roundDanger, disabled && styles.roundOff]}>
        {children}
      </PressScale>
      <Text style={styles.roundLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TRAY, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24 },
  name: { marginTop: 32, fontSize: 52, lineHeight: 56, fontWeight: fontWeight.bold, letterSpacing: -2.4, color: colors.onAccent },
  status: { marginTop: 10, fontSize: 20, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)', fontVariant: ['tabular-nums'], textAlign: 'center' },
  statusOver: { color: colors.onAccent },
  buttons: { flexDirection: 'row', justifyContent: 'space-evenly', paddingBottom: 40 },
  roundWrap: { alignItems: 'center', gap: 10 },
  round: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  roundOn: { backgroundColor: colors.onAccent },
  roundDanger: { backgroundColor: colors.error },
  roundOff: { opacity: 0.4 },
  roundLabel: { fontSize: 14, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.7)' },
});
