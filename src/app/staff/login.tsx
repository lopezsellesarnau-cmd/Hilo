import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Bot } from '@/components/bot';
import { supabase } from '@/lib/supabase';
import { staffColors, staffFont, staffText } from '@/staff/theme';

const looksLikeEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

/**
 * Staff sign-in with a 6-digit code by email, like the family app. Accounts are never created here
 * (shouldCreateUser: false): Hilo adds the staff of each organisation.
 */
export default function StaffLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async () => {
    if (!looksLikeEmail(email)) return setMessage('Type your work email.');
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error?.status === 429) return setMessage('Too many tries. Wait a minute and try again.');
    // Unknown emails get the same answer, so the page doesn't tell who works where
    setStep('code');
  };

  const verify = async (token: string) => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    setBusy(false);
    // On success the layout sees the new session and opens /staff
    if (error) setMessage("That code didn't work. Check it, or ask for a new one.");
  };

  return (
    <View style={styles.page}>
      <View style={styles.box}>
        <Bot size={56} />
        <Text style={[staffText.label, styles.kicker]}>Hilo for organisations</Text>
        <Text style={staffText.title}>{step === 'email' ? 'Sign in' : 'Check your email'}</Text>
        <Text style={[staffText.body, styles.hint]}>
          {step === 'email'
            ? "We'll send a 6-digit code to your work email."
            : `If ${email.trim().toLowerCase()} is a staff account, a 6-digit code is on its way.`}
        </Text>

        {step === 'email' ? (
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setMessage(null);
            }}
            onSubmitEditing={send}
            placeholder="name@organisation.org"
            placeholderTextColor={staffColors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
            style={styles.input}
          />
        ) : (
          <TextInput
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              setMessage(null);
              if (digits.length === 6) verify(digits);
            }}
            placeholder="······"
            placeholderTextColor={staffColors.muted}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            style={[styles.input, styles.code]}
          />
        )}

        {message ? <Text style={styles.error}>{message}</Text> : null}

        <Pressable
          onPress={busy ? undefined : step === 'email' ? send : () => code.length === 6 && verify(code)}
          style={[styles.button, busy && styles.busy]}
          accessibilityRole="button">
          <Text style={styles.buttonText}>
            {busy ? 'One moment…' : step === 'email' ? 'Send code' : 'Sign in'}
          </Text>
        </Pressable>

        {step === 'code' ? (
          <Pressable
            onPress={() => {
              setStep('email');
              setCode('');
              setMessage(null);
            }}
            accessibilityRole="button">
            <Text style={styles.link}>Use another email</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page, alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 400 },
  kicker: { marginTop: 28, marginBottom: 10 },
  hint: { marginTop: 12, color: staffColors.soft },
  input: {
    marginTop: 28,
    backgroundColor: staffColors.block,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: staffFont,
    fontSize: 16,
    color: staffColors.ink,
  },
  code: { fontSize: 24, letterSpacing: 8 },
  error: { marginTop: 12, fontFamily: staffFont, fontSize: 14, color: staffColors.error },
  button: {
    marginTop: 20,
    backgroundColor: staffColors.ink,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  busy: { opacity: 0.6 },
  buttonText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
  link: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: staffFont,
    fontSize: 14,
    color: staffColors.muted,
    textDecorationLine: 'underline',
  },
});
