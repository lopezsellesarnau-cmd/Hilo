import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot, type BotMood } from '@/components/bot';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { loadSeniorDay } from '@/lib/senior-day';
import { sendTurn } from '@/lib/talk';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const labels: Record<BotMood, string> = {
  speaking: 'HABLANDO…',
  idle: 'TU TURNO:',
  listening: 'TE ESCUCHO…',
  thinking: 'UN MOMENTO…',
};

// She taps once to talk. Her turn ends after a pause, when she taps "He terminado", or at the limit
const PAUSE_MS = 3500;
/** If she hasn't said anything yet, wait longer before giving up */
const FIRST_WORDS_MS = 8000;
const MAX_TURN_MS = 2 * 60 * 1000;

// Spanish, live text while she speaks
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
  // Smaller than on Home: this screen has more text (prototype overlap bug)
  const botSize = Math.min(size.bot, width * 0.7, height * 0.25);

  const [mood, setMood] = useState<BotMood>('thinking');
  // What Hilo says now (from Claude, through the talk Edge Function)
  const [say, setSay] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
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
  // Long stories don't push everything off screen: the text gets about a fifth of it and scrolls, newest at the bottom
  const textBox = useRef<ScrollView>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Until Hilo has a voice: "speaking" for about as long as reading the sentence takes, then it's her turn
  const show = (text: string) => {
    setSay(text);
    setReply(null);
    setHeard('');
    setMood('speaking');
    if (speakTimer.current) clearTimeout(speakTimer.current);
    speakTimer.current = setTimeout(() => setMood('idle'), Math.max(2400, text.length * 55));
  };

  const handle = (result: Awaited<ReturnType<typeof sendTurn>>) => {
    if ('error' in result) {
      if (result.error === 'too_long') {
        setEnded(true);
        show('Hoy ya hemos charlado mucho. Lo guardo en tu libro. ¡Hasta mañana!');
        return;
      }
      setMood('idle');
      setHint(
        result.error === 'offline'
          ? 'No hay conexión. Prueba otra vez en un momento.'
          : 'Algo ha fallado. Toca el botón y prueba otra vez.',
      );
      return;
    }
    session.current = result.sessionId;
    show(result.reply);
  };

  const turn = (text: string) => {
    setMood('thinking');
    setHint(null);
    sendTurn(session.current, text).then(handle);
  };

  // Hilo starts the talk when the screen opens
  const started = useRef(false);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    // Once per screen, even if React runs effects twice in development: each start is a new talk
    if (started.current) return;
    started.current = true;
    sendTurn(null).then(handle);
    loadSeniorDay().then((day) => day.me && setName(day.me.display_name));
    return () => {
      if (speakTimer.current) clearTimeout(speakTimer.current);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      if (maxTimer.current) clearTimeout(maxTimer.current);
      if (listening.current) ExpoSpeechRecognitionModule.abort();
    };
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
    const text = [earlier.current, e.results[0]?.transcript ?? ''].filter(Boolean).join(' ');
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
      setHint('No te he oído bien. Toca el botón y habla otra vez.');
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
        ? 'Hilo no puede usar el micrófono. Actívalo en Ajustes > Hilo.'
        : 'No te he oído bien. Toca el botón y habla otra vez.',
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

  const yourTurn = !ended && (mood === 'idle' || mood === 'listening');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen} bounces={false}>
        <ScreenHeader backLabel="Inicio" title={name ? `¡Hola, ${name}!` : '¡Hola!'} subtitle="¿Cómo estás?" />

        <Animated.View layout={LinearTransition.duration(250)} style={styles.stage}>
          <Bot size={botSize} mood={mood} look="left" />
        </Animated.View>

        {/* Sits right above the buttons; while the bot speaks there are none, so it moves down to use the space */}
        <Animated.View layout={LinearTransition.duration(250)} style={styles.talk} accessibilityLiveRegion="polite">
          <Text style={styles.label}>{labels[mood]}</Text>
          <ScrollView
            ref={textBox}
            style={{ maxHeight: height * 0.2 }}
            contentContainerStyle={styles.text}
            onContentSizeChange={() => textBox.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator
            nestedScrollEnabled>
            <Text style={styles.say}>{say}</Text>
            {reply || heard ? <Text style={styles.reply}>Tú: «{reply ?? heard}»</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </ScrollView>
        </Animated.View>

        <Animated.View layout={LinearTransition.duration(250)} style={styles.controls}>
          {yourTurn ? (
            <PressScale
              animateColor
              onPress={mood === 'listening' ? finish : listen}
              accessibilityRole="button"
              accessibilityLabel={mood === 'listening' ? 'He terminado' : 'Toca para hablar'}
              accessibilityHint={
                mood === 'listening' ? 'Toca cuando acabes de hablar' : 'Toca y habla. Cuando te calles un momento, Hilo te contesta'
              }
              style={[styles.hold, mood === 'listening' && styles.holdOn]}>
              <Animated.Text style={[styles.holdText, mood === 'listening' && styles.holdTextOn, styles.smoothText]}>
                {mood === 'listening' ? 'He terminado' : 'Toca para hablar'}
              </Animated.Text>
            </PressScale>
          ) : null}

          {ended && mood === 'idle' ? <BigButton label="Volver al inicio" onPress={() => router.back()} /> : null}
        </Animated.View>
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
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
