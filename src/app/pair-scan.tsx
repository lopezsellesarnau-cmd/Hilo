import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ScreenHeader } from '@/components/screen-header';
import { Bot } from '@/components/bot';
import { t } from '@/i18n';
import { codeFromInviteQr, JOIN_MESSAGES, joinFamily } from '@/lib/invite';
import { codeFromQr, pair, PAIR_MESSAGES } from '@/lib/pairing';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/**
 * The senior's phone reads the QR on the family's screen, then pairs like a typed code.
 * With mode=join, a new family member reads another member's invite QR instead and joins that family.
 */
export default function PairScanScreen() {
  const { mode, memberName = '' } = useLocalSearchParams<{ mode?: 'join'; memberName?: string }>();
  const joining = mode === 'join';
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same QR many times per second: only the first one counts
  const busy = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanned = async (data: string) => {
    const code = joining ? codeFromInviteQr(data) : codeFromQr(data);
    if (!code || busy.current) return;
    busy.current = true;
    setConnecting(true);
    setError(null);
    try {
      if (joining) {
        await joinFamily(code, memberName);
        router.dismissAll();
        router.replace('/family/today');
      } else {
        const personId = await pair(code);
        router.replace({ pathname: '/consent', params: { personId } });
      }
    } catch (e) {
      setConnecting(false);
      const messages = joining ? JOIN_MESSAGES : PAIR_MESSAGES;
      setError(messages[(e as Error).message] ?? messages.offline);
      // Let them try again after reading the message
      setTimeout(() => (busy.current = false), 2500);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScreenHeader
          title={t.pairScan.title}
          subtitle={joining ? t.join.scanSubtitle : t.pairScan.subtitle}
          backLabel={t.common.back}
        />

        <View style={styles.body}>
          {connecting ? (
            <View style={styles.ask}>
              <View style={styles.bot}>
                <Bot size={140} mood="thinking" />
              </View>
              <Text style={styles.text}>{t.pairCode.connecting}</Text>
            </View>
          ) : !permission ? null : permission.granted ? (
            <View style={styles.frame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => scanned(data)}
              />
            </View>
          ) : (
            <View style={styles.ask}>
              <Text style={styles.text}>{t.pairScan.needCamera}</Text>
              {permission.canAskAgain ? (
                <BigButton label={t.pairScan.useCamera} onPress={requestPermission} />
              ) : (
                <Text style={styles.text}>{t.pairScan.denied}</Text>
              )}
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
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
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  ask: {
    gap: 20,
  },
  bot: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  error: {
    marginTop: 20,
    fontSize: fontSize.label,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
    textAlign: 'center',
  },
  text: {
    fontSize: fontSize.status,
    lineHeight: 28,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
});
