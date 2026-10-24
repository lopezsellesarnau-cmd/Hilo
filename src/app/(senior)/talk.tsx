import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot, type BotMood } from '@/components/bot';
import { RepeatIcon } from '@/components/icons';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { WideSplit } from '@/components/wide-split';
import { t } from '@/i18n';
import { useWide, wideBotSize } from '@/lib/layout';
import { loadSeniorDay, type SeniorMe } from '@/lib/senior-day';
import { supabase } from '@/lib/supabase';
import { leaveTalk, sendTurn } from '@/lib/talk';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const labels: Record<BotMood, string> = t.talk.moods;

// She taps once to talk. Her turn ends after a pause, when she taps "He terminado", or at the limit
const PAUSE_MS = 3500;
/** If she hasn't said anything yet, wait longer before giving up */
const FIRST_WORDS_MS = 8000;
const MAX_TURN_MS = 2 * 60 * 1000;

/** people.locale → what iOS listens for */
const LISTEN: Record<SeniorMe['locale'], string> = { es: 'es-ES', en: 'en-GB', nl: 'nl-NL' };

// Live text while she speaks, in the language of her talk
const startRecognition = (locale: SeniorMe['locale']) =>
  ExpoSpeechRecognitionModule.start({
    lang: LISTEN[locale] ?? 'es-ES',
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
  const botSize = wide ? wideBotSize(width, height) : Math.min(size.bot, width * 0.66, height * 0.28);

  const [mood, setMood] = useState<BotMood>('thinking');
  // What Hilo says now (from Claude, through the talk Edge Function)
  const [say, setSay] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // The family connected another phone: this one can only pair again
  const [unpaired, setUnpaired] = useState(false);
  // Hilo just asked about her pills: she answers with Sí / No, not by voice, so it's recorded right
  const [askPills, setAskPills] = useState(false);
  // What she is saying right now, live while she talks
  const [heard, setHeard] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const heardRef = useRef('');
  const locale = useRef<SeniorMe['locale']>('es');
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
      if (result.error === 'unpaired') {
        closed.current = true;
        setUnpaired(true);
        setEnded(true);
        show(t.talk.unpaired, null);
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

  // Forget this phone's old account and start from Welcome, where she scans the family's new code
  const pairAgain = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/');
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
    loadSeniorDay().then((day) => {
      if (day.me) locale.current = day.me.locale;
    });
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
      startRecognition(locale.current);
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
    startRecognition(locale.current);
    waitForPause(FIRST_WORDS_MS);
    maxTimer.current = setTimeout(finish, MAX_TURN_MS);
  };

  const yourTurn = !ended && !askPills && (mood === 'idle' || mood === 'listening');

  // Only the way back: the bot and what Hilo says are the screen
  const header = <ScreenHeader backLabel={t.home.title} />;

  // On a wide screen the bot is on the left of the text, so it looks right, towards it
  const stage = (
    <Animated.View layout={LinearTransition.duration(250)} style={styles.stage}>
      <Bot size={botSize} mood={mood} look={wide ? 'right' : 'left'} />
    </Animated.View>
  );

  const talk = (
    <>
      {/* The bot's pose says the state; the label stays for VoiceOver */}
      <Animated.View
        layout={LinearTransition.duration(250)}
        style={styles.talk}
        accessible
        accessibilityLabel={`${labels[mood]} ${say}`}
        accessibilityLiveRegion="polite">
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
            <Animated.Text key={say} entering={FadeIn.duration(350)} style={styles.say}>
              {say}
            </Animated.Text>
            {reply || heard ? <Text style={styles.reply}>{t.talk.you(reply ?? heard ?? '')}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.surface, `${colors.surface}00`]}
            style={[styles.fade, { opacity: scrolled ? 1 : 0 }]}
          />
        </View>
      </Animated.View>

      <Animated.View layout={LinearTransition.duration(250)} style={styles.controls}>
        {yourTurn ? (
          <View style={styles.turnRow}>
            <PressScale
              animateColor
              onPress={mood === 'listening' ? finish : listen}
              accessibilityRole="button"
              accessibilityLabel={mood === 'listening' ? t.talk.done : t.talk.tap}
              accessibilityHint={mood === 'listening' ? t.talk.doneHint : t.talk.tapHint}
              containerStyle={styles.holdSlot}
              style={[styles.hold, mood === 'listening' && styles.holdOn]}>
              <Animated.Text style={[styles.holdText, mood === 'listening' && styles.holdTextOn, styles.smoothText]}>
                {mood === 'listening' ? t.talk.done : t.talk.tap}
              </Animated.Text>
            </PressScale>
            {mood === 'idle' && lastAudio ? (
              <PressScale
                onPress={() => speak(say, lastAudio)}
                accessibilityRole="button"
                accessibilityLabel={t.talk.repeat}
                accessibilityHint={t.talk.repeatHint}
                style={styles.repeat}>
                <RepeatIcon />
                <Text style={styles.repeatText}>{t.talk.repeat}</Text>
              </PressScale>
            ) : null}
          </View>
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

        {mood === 'idle' && lastAudio && !yourTurn ? (
          <BigButton
            label={t.talk.repeat}
            variant="outline"
            onPress={() => speak(say, lastAudio)}
            accessibilityHint={t.talk.repeatHint}
          />
        ) : null}

        {ended && mood === 'idle' ? (
          unpaired ? (
            <BigButton label={t.talk.pairAgain} onPress={pairAgain} />
          ) : (
            <BigButton label={t.talk.backHome} onPress={() => router.back()} />
          )
        ) : null}
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
  // Hilo's sentence in a grey card, like the prototype
  talk: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
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
  say: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  reply: {
    fontSize: fontSize.talk,
    lineHeight: 27,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  turnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  holdSlot: {
    flex: 1,
  },
  repeat: {
    width: 104,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.background,
  },
  repeatText: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.ink,
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
    minHeight: 88,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  // While she talks the button turns white: easy to see that Hilo is listening
  holdOn: {
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  holdText: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.onAccent,
    textAlign: 'center',
  },
  holdTextOn: {
    color: colors.ink,
  },
  smoothText: {
    transitionProperty: 'color',
    transitionDuration: '300ms',
    transitionTimingFunction: 'ease-out',
  },
});
