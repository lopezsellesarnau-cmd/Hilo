import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { useWide } from '@/lib/layout';
import { pair, PAIR_MESSAGES } from '@/lib/pairing';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export default function PairCodeScreen() {
  // iPad on its side: the bot on the left, the code on the right
  const wide = useWide();
  // Filled in when the QR was scanned with the Camera (see pair.tsx)
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => (params.code ?? '').replace(/\D/g, '').slice(0, 6));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    if (checking) return;
    setChecking(true);
    setError(null);
    let personId: string;
    try {
      personId = await pair(value);
    } catch (e) {
      setChecking(false);
      setError(PAIR_MESSAGES[(e as Error).message] ?? PAIR_MESSAGES.offline);
      return;
    }
    setChecking(false);
    router.replace({ pathname: '/consent', params: { personId } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WideFrame mood={checking ? 'thinking' : 'idle'}>
          <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
            {wide ? null : (
              <View style={styles.bot}>
                <Bot size={110} mood={checking ? 'thinking' : 'idle'} />
              </View>
            )}
            <ScreenHeader
              title={t.code.question}
              subtitle={t.pairCode.subtitle}
              backLabel={t.common.back}
            />

            <View style={styles.body}>
              <TextField
                label={t.code.label}
                code
                value={code}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  setError(null);
                  if (digits.length === 6) submit(digits);
                }}
                placeholder="······"
                keyboardType="number-pad"
                maxLength={6}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>

            <View style={styles.footer}>
              <BigButton variant="outline" label={t.pairCode.scan} onPress={() => router.push('/pair-scan')} />
              <BigButton
                label={checking ? t.pairCode.connecting : t.pairCode.connect}
                onPress={code.length === 6 && !checking ? () => submit(code) : undefined}
              />
            </View>
          </ScrollView>
        </WideFrame>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
  bot: {
    flexShrink: 0,
    alignSelf: 'center',
    marginBottom: 20,
  },
  body: {
    marginTop: 28,
    gap: 12,
  },
  error: {
    fontSize: fontSize.label,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    gap: 14,
  },
});
