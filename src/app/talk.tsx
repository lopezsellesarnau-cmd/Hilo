import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot, type BotMood } from '@/components/bot';
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

        <View style={styles.stage}>
          <Bot size={botSize} mood={mood} look="left" />
        </View>

        <View style={styles.talk} accessibilityLiveRegion="polite">
          <Text style={styles.label}>{labels[mood]}</Text>
          <Text style={styles.say}>
            {step === 2 ? prefix : ''}
            {current.say}
          </Text>
          {reply ? <Text style={styles.reply}>Tú: «{reply}»</Text> : null}
        </View>

        <View style={styles.controls}>
          {current.input === 'hold' && yourTurn ? (
            <Pressable
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
              <Text style={[styles.holdText, mood === 'listening' && styles.holdTextOn]}>
                {mood === 'listening' ? 'Suelta cuando acabes' : 'Mantén pulsado para hablar'}
              </Text>
            </Pressable>
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
        </View>
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
    minHeight: 150,
    gap: 14,
    marginBottom: 24,
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
    minHeight: size.buttonHeight,
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
  yesno: {
    flexDirection: 'row',
    gap: 14,
  },
  half: {
    flex: 1,
  },
});
