import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/**
 * The senior's phone: sign in anonymously and claim the family's code.
 * That links this phone to the senior row the family created.
 */
async function pair(code: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // A family account on this phone (or on the simulator while testing) is signed out first
  if (session && !session.user.is_anonymous) await supabase.auth.signOut();
  if (!session || !session.user.is_anonymous) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error('offline');
  }
  const { data, error } = await supabase.rpc('claim_pairing_code', { pairing_code: code });
  if (error) throw new Error(error.message.includes('Already paired') ? 'paired' : 'code');
  return data as string;
}

const MESSAGES: Record<string, string> = {
  code: 'Ese código no sirve. Pide a tu familia uno nuevo.',
  paired: 'Este móvil ya está conectado.',
  offline: 'No hay conexión. Prueba otra vez en un momento.',
};

export default function PairCodeScreen() {
  const [code, setCode] = useState('');
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
      setError(MESSAGES[(e as Error).message] ?? MESSAGES.offline);
      return;
    }
    setChecking(false);
    router.replace({ pathname: '/consent', params: { personId } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <View style={styles.bot}>
            <Bot size={110} mood={checking ? 'thinking' : 'idle'} />
          </View>
          <ScreenHeader title="Escribe el código" subtitle="Te lo da tu familia. Son 6 números." backLabel="Atrás" />

          <View style={styles.body}>
            <TextField
              label="Código"
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
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <View style={styles.footer}>
            <BigButton
              label={checking ? 'Conectando…' : 'Conectar'}
              onPress={code.length === 6 && !checking ? () => submit(code) : undefined}
            />
          </View>
        </ScrollView>
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
  },
});
