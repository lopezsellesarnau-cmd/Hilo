import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight, spacing } from '@/theme';

const SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function Row({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={[styles.rowText, danger && styles.danger]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/** Family settings. For now: account, subscription and legal. Later also talk time, pills and pairing. */
export default function SettingsScreen() {
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    const { error: e } = await supabase.rpc('delete_my_account');
    if (e) {
      setDeleting(false);
      setError('No hemos podido borrar la cuenta. Comprueba tu conexión y vuelve a probar.');
      return;
    }
    // The user no longer exists; this only clears the session stored on the phone
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          Ajustes
        </Text>

        <Text style={styles.section}>TU CUENTA</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowText}>Email</Text>
            <Text style={styles.value} numberOfLines={1}>
              {email}
            </Text>
          </View>
          <Row label="Gestionar suscripción" onPress={() => Linking.openURL(SUBSCRIPTIONS_URL)} />
          <Row label="Cerrar sesión" onPress={signOut} />
        </View>

        <Text style={styles.section}>LEGAL</Text>
        <View style={styles.group}>
          <Row label="Términos" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
          <Row label="Política de privacidad" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
        </View>

        <View style={styles.group}>
          <Row label="Borrar mi cuenta" danger onPress={() => setConfirming(true)} />
        </View>

        {confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmTitle}>¿Borrar tu cuenta?</Text>
            <Text style={styles.confirmText}>
              Si eres el único familiar en Hilo, también se borra todo lo de tu familia: sus pastillas, sus charlas y su
              libro. No se puede deshacer.
            </Text>
            <BigButton scale="family" label={deleting ? 'Borrando…' : 'Sí, borrar todo'} onPress={deleteAccount} />
            <BigButton scale="family" variant="outline" label="Cancelar" onPress={() => setConfirming(false)} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}
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
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 48,
  },
  title: {
    fontSize: family.fontSize.title,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  section: {
    marginTop: 26,
    marginBottom: 8,
    fontSize: family.fontSize.note,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  group: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d9dbd6',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d9dbd6',
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  value: {
    flexShrink: 1,
    fontSize: family.fontSize.body,
    color: colors.muted,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
  },
  danger: {
    color: '#b3261e',
  },
  confirm: {
    marginTop: 18,
    padding: 18,
    gap: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e6e8e4',
  },
  confirmTitle: {
    fontSize: family.fontSize.subtitle,
    fontWeight: '700',
    color: colors.ink,
  },
  confirmText: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.muted,
    marginBottom: 6,
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
