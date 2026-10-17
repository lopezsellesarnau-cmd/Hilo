import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot, type BotMood } from '@/components/bot';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { WideSplit } from '@/components/wide-split';
import { t } from '@/i18n';
import { useWide, wideBotSize } from '@/lib/layout';
import { loadSeniorDay } from '@/lib/senior-day';
import { leaveTalk, sendTurn } from '@/lib/talk';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const labels: Record<BotMood, string> = t.talk.moods;

// She taps once to talk. Her turn ends after a pause, when she taps "He terminado", or at the limit
const PAUSE_MS = 3500;
/** If she hasn't said anything yet, wait longer before giving up */
const FIRST_WORDS_MS = 8000;
const MAX_TURN_MS = 2 * 60 * 1000;

// Spanish, live text while she speaks (the talk is Spanish only for now, whatever the phone's language)
const startRecognition = () =>
  ExpoSpeechRecognitionModule.start({
    lang: 'es-ES',
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    // Voice is health-adjacent personal data: keep it on the phone when the phone can do it
    requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    iosTaskHint: 'dictation',
  });

export default function TalkScreen() {
  const { width, height } = useWindowDimensions();
  // iPad on its side: bot on the left, the talk on the right (Figma IPAD MINI / DUO 1)
  const wide = useWide();
  // Smaller than on Home: this screen has more text (prototype overlap bug)
  const botSize = wide ? wideBotSize(width, height) : Math.min(size.bot, width * 0.7, height * 0.25);

  const [mood, setMood] = useState<BotMood>('thinking');
  // What Hilo says now (from Claude, through the talk Edge Function)
  const [say, setSay] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // Hilo just asked about her pills: she answers with Sí / No, not by voice, so it's recorded right
  const [askPills, setAskPills] = useState(false);
  // What she is saying right now, live while she talks
  const [heard, setHeard] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const heardRef = useRef('');
  // iOS can end recognition by itself on a short pause; while her turn is still open we start it again and keep what she said
  const listening = useRef(false);
  const earlier = useRef('');
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef<string | null>(null);
  // The server already closed this talk (goodbye or turn limit)
  const closed = useRef(false);
  // False once she leaves the screen: a reply that arrives later is ignored (its audio player is gone)
  const alive = useRef(true);
  // Long stories don't push everything off screen: the text gets about a fifth of it and scrolls, newest at the bottom
  const textBox = useRef<ScrollView>(null);
  // Older lines fade out at the top instead of being cut by a hard line
  const [scrolled, setScrolled] = useState(false);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hilo's last sentence as audio, so "Repetir" plays it again without asking Claude
  const player = useAudioPlayer();
  const [lastAudio, setLastAudio] = useState<string | null>(null);

  // When the voice ends, it's her turn
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        if (speakTimer.current) clearTimeout(speakTimer.current);
        setMood('idle');
      }
    });
    return () => sub.remove();
  }, [player]);

  // Hilo says the sentence out loud; without audio, "speaking" lasts about as long as reading it
  const speak = async (text: string, audio: string | null) => {
    setMood('speaking');
    if (speakTimer.current) clearTimeout(speakTimer.current);
    // Also a safety net if the audio never reports that it ended
    speakTimer.current = setTimeout(() => setMood('idle'), Math.max(2400, text.length * (audio ? 120 : 55)));
    if (!audio) return;
    // Loudspeaker, even with the iPhone on silent: many seniors never turn the ringer back on
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' });
    if (!alive.current) return;
    player.replace({ uri: `data:audio/mpeg;base64,${audio}` });
    player.play();
  };

  const show = (text: string, audio: string | null) => {
    setSay(text);
    setReply(null);
    setHeard('');
    setLastAudio(audio);
    speak(text, audio);
  };

  const handle = (result: Awaited<ReturnType<typeof sendTurn>>) => {
    if (!alive.current) return;
    if ('error' in result) {
      if (result.error === 'too_long') {
        closed.current = true;
        setEnded(true);
        show(t.talk.tooLong, null);
        return;
      }
      setMood('idle');
      setHint(
        result.error === 'offline'
          ? t.common.offline
          : t.talk.failed,
      );
      return;
    }
    session.current = result.sessionId;
    setAskPills(result.askPills);
    if (result.ended) {
      closed.current = true;
      setEnded(true);
    }
    show(result.reply, result.audio);
  };

  const turn = (text: string) => {
    setMood('thinking');
    setHint(null);
    sendTurn(session.current, text).then(handle);
  };

  const answerPills = (answer: 'yes' | 'no') => {
    setAskPills(false);
    setReply(answer === 'yes' ? t.talk.pillsYesReply : t.talk.pillsNoReply);
    setMood('thinking');
    setHint(null);
    sendTurn(session.current, undefined, answer).then(handle);
  };

  // Hilo starts the talk when the screen opens
  const started = useRef(false);
  const [name, setName] = useState<string | null>(null);
  // Leaving the screen: stop everything, and close the talk if Hilo didn't say goodbye
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (speakTimer.current) clearTimeout(speakTimer.current);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      if (maxTimer.current) clearTimeout(maxTimer.current);
      if (listening.current) ExpoSpeechRecognitionModule.abort();
      // What she told still goes to her book
      if (session.current && !closed.current) leaveTalk(session.current);
    };
  }, []);

  useEffect(() => {
    // Once per screen, even if React runs effects twice in development: each start is a new talk
    if (started.current) return;
    started.current = true;
    sendTurn(null).then(handle);
    loadSeniorDay().then((day) => day.me && setName(day.me.display_name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask for the microphone and speech recognition when the talk opens, not in the middle of the first press
  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync();
  }, []);

  const stopTimers = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
  };

  // Her turn is over: recognition stops and 'end' sends what she said
  const finish = () => {
    if (!listening.current) return;
    listening.current = false;
    stopTimers();
    ExpoSpeechRecognitionModule.stop();
  };

  const waitForPause = (ms: number) => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(finish, ms);
  };

  useSpeechRecognitionEvent('result', (e) => {
    const part = e.results[0]?.transcript ?? '';
    // The iPad can send one last empty result when recognition stops: it must not wipe what she said
    if (!part && heardRef.current) return;
    const text = [earlier.current, part].filter(Boolean).join(' ');
    heardRef.current = text;
    setHeard(text);
    // She is still talking: the pause starts counting again
    waitForPause(text ? PAUSE_MS : FIRST_WORDS_MS);
  });
  // Recognition is done (her turn is over): her words are the reply, and the talk goes on
  useSpeechRecognitionEvent('end', () => {
    if (mood !== 'listening') return;
    if (listening.current) {
      earlier.current = heardRef.current;
      startRecognition();
      return;
    }
    const text = heardRef.current.trim();
    if (!text) {
      setMood('idle');
      setHint(t.talk.notHeard);
      return;
    }
    setReply(text);
    turn(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return; // 'end' comes next and handles it
    stopTimers();
    listening.current = false;
    setMood('idle');
    setHint(
      e.error === 'not-allowed'
        ? t.talk.noMic
        : t.talk.notHeard,
    );
  });

  const listen = () => {
    if (mood !== 'idle') return;
    listening.current = true;
    earlier.current = '';
    heardRef.current = '';
    setHeard('');
    setHint(null);
    setMood('listening');
    startRecognition();
    waitForPause(FIRST_WORDS_MS);
    maxTimer.current = setTimeout(finish, MAX_TURN_MS);
  };

  const yourTurn = !ended && !askPills && (mood === 'idle' || mood === 'listening');

  const header = <ScreenHeader backLabel={t.home.title} title={t.home.hello(name)} subtitle={t.home.howAreYou} />;

  // On a wide screen the bot is on the left of the text, so it looks right, towards it
  const stage = (
    <Animated.View layout={LinearTransition.duration(250)} style={styles.stage}>
      <Bot size={botSize} mood={mood} look={wide ? 'right' : 'left'} />
    </Animated.View>
  );

  const talk = (
    <>
      <Animated.View layout={LinearTransition.duration(250)} style={styles.talk} accessibilityLiveRegion="polite">
        <Text style={styles.label}>{labels[mood]}</Text>
        <View>
          <ScrollView
            ref={textBox}
            style={{ maxHeight: height * (wide ? 0.35 : 0.2) }}
            contentContainerStyle={styles.text}
            onContentSizeChange={() => textBox.current?.scrollToEnd({ animated: true })}
            onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 2)}
            scrollEventThrottle={32}
            showsVerticalScrollIndicator
            nestedScrollEnabled>
            <Text style={styles.say}>{say}</Text>
            {reply || heard ? <Text style={styles.reply}>{t.talk.you(reply ?? heard ?? '')}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.background, `${colors.background}00`]}
            style={[styles.fade, { opacity: scrolled ? 1 : 0 }]}
          />
        </View>
      </Animated.View>

      <Animated.View layout={LinearTransition.duration(250)} style={styles.controls}>
        {yourTurn ? (
          <PressScale
            animateColor
            onPress={mood === 'listening' ? finish : listen}
            accessibilityRole="button"
            accessibilityLabel={mood === 'listening' ? t.talk.done : t.talk.tap}
            accessibilityHint={
              mood === 'listening' ? t.talk.doneHint : t.talk.tapHint
            }
            style={[styles.hold, mood === 'listening' && styles.holdOn]}>
            <Animated.Text style={[styles.holdText, mood === 'listening' && styles.holdTextOn, styles.smoothText]}>
              {mood === 'listening' ? t.talk.done : t.talk.tap}
            </Animated.Text>
          </PressScale>
        ) : null}

        {askPills && mood === 'idle' ? (
          <View style={styles.yesno}>
            <View style={styles.half}>
              <BigButton label={t.common.yes} onPress={() => answerPills('yes')} accessibilityHint={t.talk.pillsYesHint} />
            </View>
            <View style={styles.half}>
              <BigButton variant="outline" label={t.common.no} onPress={() => answerPills('no')} accessibilityHint={t.talk.pillsNoHint} />
            </View>
          </View>
        ) : null}

        {mood === 'idle' && lastAudio ? (
          <BigButton
            label={t.talk.repeat}
            variant="outline"
            onPress={() => speak(say, lastAudio)}
            accessibilityHint={t.talk.repeatHint}
          />
        ) : null}

        {ended && mood === 'idle' ? <BigButton label={t.talk.backHome} onPress={() => router.back()} /> : null}
      </Animated.View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.screen, wide && styles.screenWide]} bounces={false}>
        {wide ? (
          <WideSplit side={stage}>
            <View style={styles.side}>
              {header}
              <View style={styles.sideTalk}>{talk}</View>
            </View>
          </WideSplit>
        ) : (
          <>
            {header}
            {stage}
            {talk}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  screenWide: {
    maxWidth: spacing.wideMax,
  },
  // Right column on a wide screen: greeting at the top, the talk and its buttons at the bottom
  side: {
    flex: 1,
  },
  sideTalk: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  talk: {
    gap: 14,
  },
  text: {
    gap: 14,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0.4,
    color: colors.ink,
  },
  say: {
    fontSize: fontSize.talk,
    lineHeight: 27,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  reply: {
    fontSize: fontSize.talk,
    lineHeight: 27,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  hint: {
    fontSize: fontSize.label,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
  },
  controls: {
    marginTop: 24,
    gap: 12,
  },
  yesno: {
    flexDirection: 'row',
    gap: 14,
  },
  half: {
    flex: 1,
  },
  hold: {
    minHeight: size.buttonHeight,
    borderRadius: size.buttonRadius,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  holdOn: {
    backgroundColor: colors.ink,
  },
  holdText: {
    fontSize: fontSize.holdButton,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  holdTextOn: {
    color: colors.background,
  },
  smoothText: {
    transitionProperty: 'color',
    transitionDuration: '300ms',
    transitionTimingFunction: 'ease-out',
  },
});
