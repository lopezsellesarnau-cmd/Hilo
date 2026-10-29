import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Bot } from '@/components/bot';
import { supabase } from '@/lib/supabase';
import { staffColors, staffFont, staffText } from '@/staff/theme';

type Setup = { factorId: string; qr: string; secret: string };

/**
 * The second step of the staff sign-in, after the email code: a 6-digit code from an authenticator app
 * (Passwords on iPhone and Mac, Google Authenticator, Microsoft Authenticator…). Required for every staff
 * member; the database refuses staff data without it (the staff_two_factor migration).
 * "enroll": the first time, scan the QR and type a code to confirm. "verify": every sign-in after that.
 */
export function TwoFactor({ mode, email }: { mode: 'enroll' | 'verify'; email: string }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error) return live && setMessage("We couldn't load this. Reload the page.");
      if (mode === 'verify') {
        if (live) setFactorId(factors.totp[0]?.id ?? null);
        return;
      }
      // A setup left halfway leaves an unverified factor behind: start again from a clean one
      await Promise.all(
        factors.all.filter((f) => f.status === 'unverified').map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
      );
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Hilo' });
      if (!live) return;
      if (e) return setMessage("We couldn't start the setup. Reload the page.");
      const qr = data.totp.qr_code;
      setSetup({
        factorId: data.id,
        qr: qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`,
        secret: data.totp.secret,
      });
      setFactorId(data.id);
    })();
    return () => {
      live = false;
    };
  }, [mode]);

  const verify = async (token: string) => {
    if (!factorId || busy) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: token });
    setBusy(false);
    // On success the session becomes aal2 and the layout opens /staff
    if (error) {
      setCode('');
      setMessage("That code didn't work. Codes change every 30 seconds: type the one on screen now.");
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.box}>
        <Bot size={56} />
        <Text style={[staffText.label, styles.kicker]}>Hilo for organisations</Text>
        <Text style={staffText.title}>{mode === 'enroll' ? 'Set up a second step' : 'One more step'}</Text>
        <Text style={[staffText.body, styles.hint]}>
          {mode === 'enroll'
            ? `Staff see health information, so signing in takes your email code and a code from an authenticator app. Scan this with the app (Passwords on iPhone or Mac, Google Authenticator, Microsoft Authenticator), then type the 6-digit code it shows.`
            : `Type the 6-digit code for Hilo from your authenticator app (${email}).`}
        </Text>

        {setup ? (
          <View style={styles.qrBlock}>
            <Image source={{ uri: setup.qr }} style={styles.qr} accessibilityLabel="QR code for your authenticator app" />
            <Text style={styles.small}>{"Can't scan it? Type this key in the app instead:"}</Text>
            <Text selectable style={styles.secret}>
              {setup.secret}
            </Text>
          </View>
        ) : null}

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
          editable={!!factorId}
          style={[styles.input, styles.code]}
        />

        {message ? <Text style={styles.error}>{message}</Text> : null}

        <Pressable
          onPress={busy ? undefined : () => code.length === 6 && verify(code)}
          style={[styles.button, (busy || !factorId) && styles.busy]}
          accessibilityRole="button">
          <Text style={styles.buttonText}>{busy ? 'One moment…' : mode === 'enroll' ? 'Turn on' : 'Continue'}</Text>
        </Pressable>

        {mode === 'verify' ? (
          <Text style={styles.small}>{"Lost your phone? Write to Hilo (lopezsellesarnau@gmail.com) to reset your second step."}</Text>
        ) : null}

        <Pressable onPress={() => supabase.auth.signOut()} accessibilityRole="button">
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page, alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 400 },
  kicker: { marginTop: 28, marginBottom: 10 },
  hint: { marginTop: 12, color: staffColors.soft },
  qrBlock: { marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: staffColors.block, alignItems: 'center' },
  qr: { width: 180, height: 180, backgroundColor: '#fff' },
  small: { marginTop: 12, fontFamily: staffFont, fontSize: 13, color: staffColors.muted, textAlign: 'center' },
  secret: { marginTop: 6, fontFamily: staffFont, fontSize: 14, letterSpacing: 1, color: staffColors.ink },
  input: {
    marginTop: 24,
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
