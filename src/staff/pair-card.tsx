import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { pairingLink } from '@/lib/pairing';

import { clock, pairingCode } from './data';
import { staffColors, staffFont } from './theme';

/**
 * "Code for her phone", on New person and on Person while her phone isn't paired. The code lives 15 minutes,
 * so it is only made at the visit, when someone taps the button (the same code and QR as the family app's).
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
      <Text style={styles.h2}>Code for her phone</Text>
      {code ? (
        <>
          <View style={styles.row}>
            <View style={styles.qr} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <QRCode value={pairingLink(code.value)} size={148} color={staffColors.ink} backgroundColor="#fff" />
            </View>
            <View style={styles.steps}>
              <Text style={styles.code} accessibilityLabel={`Code ${code.value.split('').join(' ')}`}>
                {`${code.value.slice(0, 3)} ${code.value.slice(3)}`}
              </Text>
              <Text style={styles.step}>1 · Install Hilo on her phone</Text>
              <Text style={styles.step}>{`2 · Tap "I have a code" ("Tengo un código") and scan it`}</Text>
              <Text style={styles.step}>{`3 · ${name} says yes to the consent, then the first talk, together`}</Text>
            </View>
          </View>
          <View style={styles.foot}>
            <Text style={styles.note}>{`Works once, until ${clock(code.until)}.`}</Text>
            <Pressable onPress={make} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>{busy ? 'Making a new code…' : 'New code'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.note}>
            Make it at the visit, with her phone in your hand: the code works for 15 minutes.
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
  card: { backgroundColor: staffColors.block, borderRadius: 28, paddingVertical: 24, paddingHorizontal: 28, gap: 16 },
  h2: { fontFamily: staffFont, fontSize: 16, fontWeight: '500', color: staffColors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'center' },
  qr: { padding: 12, borderRadius: 16, backgroundColor: '#fff' },
  steps: { flex: 1, minWidth: 220, gap: 8 },
  code: {
    fontFamily: staffFont,
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: 2,
    color: staffColors.ink,
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  step: { fontFamily: staffFont, fontSize: 15, lineHeight: 22, color: staffColors.soft },
  foot: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  note: { fontFamily: staffFont, fontSize: 14, lineHeight: 20, color: staffColors.muted },
  link: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink, textDecorationLine: 'underline' },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: staffColors.ink,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  buttonText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
  error: { fontFamily: staffFont, fontSize: 14, color: staffColors.error },
});
