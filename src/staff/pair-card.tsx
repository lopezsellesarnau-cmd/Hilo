import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { pairingLink } from '@/lib/pairing';

import { clock, pairingCode } from './data';
import { staffColors, staffFont, staffText } from './theme';

/**
 * "Code for her phone", as in the New person frame. On New person and on Person while her phone isn't paired.
 * The code lives 15 minutes, so it is only made at the visit, when someone taps the button (the same code and
 * QR as the family app's).
 */
export function PairCard({ personId, name }: { personId: string; name: string }) {
  const [code, setCode] = useState<{ value: string; until: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const make = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const value = await pairingCode(personId);
    setBusy(false);
    if (!value) return setError(true);
    setCode({ value, until: new Date(Date.now() + 15 * 60_000).toISOString() });
  };

  return (
    <View style={styles.card}>
      <Text style={[staffText.label, styles.label]}>Code for her phone</Text>
      {code ? (
        <>
          <View style={styles.qr} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <QRCode value={pairingLink(code.value)} size={156} color={staffColors.ink} backgroundColor="#fff" />
          </View>
          <Text style={styles.code} accessibilityLabel={`Code ${code.value.split('').join(' ')}`}>
            {`${code.value.slice(0, 3)} ${code.value.slice(3)}`}
          </Text>
          <View style={styles.steps}>
            <Text style={styles.step}>1. Install Hilo on her phone</Text>
            <Text style={styles.step}>2. Scan the code with the Camera</Text>
            <Text style={styles.step}>{`3. ${name} says yes, then the first talk, together`}</Text>
          </View>
          <Text style={styles.note}>{`Works once, until ${clock(code.until)}.`}</Text>
          <Pressable onPress={make} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{busy ? 'Making a new code…' : 'New code'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.step, styles.left]}>
            Make it at the visit, with her phone in your hand: it works for 15 minutes.
          </Text>
          <Pressable onPress={make} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>{busy ? 'Making the code…' : 'Get a code for her phone'}</Text>
          </Pressable>
        </>
      )}
      {error ? <Text style={styles.error}>{"The code wasn't made. Try again."}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: staffColors.block,
    borderRadius: 28,
    padding: 28,
    gap: 14,
    alignItems: 'center',
    maxWidth: 380,
  },
  label: { alignSelf: 'flex-start' },
  qr: { padding: 12, borderRadius: 12, backgroundColor: '#fff' },
  code: {
    fontFamily: staffFont,
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: 2.4,
    color: staffColors.ink,
    fontVariant: ['tabular-nums'],
  },
  steps: { alignSelf: 'stretch', gap: 2 },
  step: { fontFamily: staffFont, fontSize: 15, lineHeight: 25, color: staffColors.ink },
  left: { alignSelf: 'stretch' },
  note: { fontFamily: staffFont, fontSize: 13, color: staffColors.muted },
  link: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink, textDecorationLine: 'underline' },
  button: {
    alignSelf: 'stretch',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: staffColors.ink,
    borderRadius: 999,
    paddingHorizontal: 22,
  },
  buttonText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
  error: { fontFamily: staffFont, fontSize: 14, color: staffColors.error },
});
