import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot, type BotMood } from '@/components/bot';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { sampleTalk } from '@/data/sample';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const labels: Record<BotMood, string> = {
  speaking: 'HABLANDO…',
  idle: 'TU TURNO:',
  listening: 'TE ESCUCHO…',
  thinking: 'UN MOMENTO…',
};

export default function TalkScreen() {
  const { width, height } = useWindowDimensions();
  // Smaller than on Home: this screen has more text (prototype overlap bug)
  const botSize = Math.min(size.bot, width * 0.7, height * 0.25);

  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<BotMood>('speaking');
  const [prefix, setPrefix] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Long stories don't push everything off screen: the text gets about a fifth of it and scrolls, newest at the bottom
  const textBox = useRef<ScrollView>(null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // Each new step: the bot speaks, then it's her turn
  useEffect(() => {
    const text = sampleTalk[step].say;
    const id = setTimeout(() => setMood('idle'), Math.max(2400, text.length * 55));
    return () => clearTimeout(id);
  }, [step]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const next = () => {
    setMood('thinking');
    later(() => {
      setReply(null);
      setStep((s) => s + 1);
      setMood('speaking');
    }, 1300);
  };

  const current = sampleTalk[step];
  const yourTurn = mood === 'idle' || mood === 'listening';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen} bounces={false}>
        <ScreenHeader backLabel="Inicio" title="¡Hola, Carmen!" subtitle="¿Cómo estás?" />

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
            <Text style={styles.say}>
              {step === 2 ? prefix : ''}
              {current.say}
            </Text>
            {reply ? <Text style={styles.reply}>Tú: «{reply}»</Text> : null}
          </ScrollView>
        </Animated.View>

        <Animated.View layout={LinearTransition.duration(250)} style={styles.controls}>
          {current.input === 'hold' && yourTurn ? (
            <PressScale
              animateColor
              onPressIn={() => mood === 'idle' && setMood('listening')}
              onPressOut={() => {
                if (mood !== 'listening') return;
                setReply(current.reply ?? null);
                next();
              }}
              accessibilityRole="button"
              accessibilityLabel="Mantén pulsado para hablar"
              accessibilityHint="Mantén el botón pulsado mientras hablas y suéltalo al terminar"
              style={[styles.hold, mood === 'listening' && styles.holdOn]}>
              <Animated.Text style={[styles.holdText, mood === 'listening' && styles.holdTextOn, styles.smoothText]}>
                {mood === 'listening' ? 'Suelta cuando acabes' : 'Mantén pulsado para hablar'}
              </Animated.Text>
            </PressScale>
          ) : null}

          {current.input === 'yesno' && mood === 'idle' ? (
            <View style={styles.yesno}>
              <View style={styles.half}>
                <BigButton label="Sí" onPress={next} />
              </View>
              <View style={styles.half}>
                <BigButton
                  variant="outline"
                  label="No"
                  onPress={() => {
                    setPrefix('Vale, te lo recuerdo en media hora. ');
                    next();
                  }}
                />
              </View>
            </View>
          ) : null}

          {current.input === 'end' && mood === 'idle' ? (
            <BigButton label="Volver al inicio" onPress={() => router.back()} />
          ) : null}
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
  yesno: {
    flexDirection: 'row',
    gap: 14,
  },
  half: {
    flex: 1,
  },
});
