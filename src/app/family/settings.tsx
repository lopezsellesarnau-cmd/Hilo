import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { WideFrame } from '@/components/wide-split';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '@/lib/legal';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight, spacing } from '@/theme';

const SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const LANGUAGE_NAMES: Record<string, string> = { es: 'Español', en: 'English', nl: 'Nederlands' };

// Texts of the section about the senior, together for the translation later
const text = {
  talk: 'La charla',
  talkValue: (time: string | null, locale: string) =>
    `${time ? time.slice(0, 5).replace(/^0/, '') : 'Sin hora'} · ${LANGUAGE_NAMES[locale] ?? locale}`,
  pills: 'Sus pastillas',
  pillsValue: (n: number) => (n ? String(n) : 'Ninguna'),
  phone: 'Su móvil',
  phoneValue: (connected: boolean) => (connected ? 'Conectado' : 'Sin conectar'),
  relinkTitle: '¿Conectar otro móvil?',
  relinkText: (name: string) =>
    `El móvil que tiene ahora ${name} dejará de funcionar con Hilo. Luego escaneas el código nuevo con el otro móvil.`,
  relinkYes: 'Sí, conectar otro',
  cancel: 'Cancelar',
  relinkError: 'No hemos podido desconectarlo. Comprueba tu conexión y vuelve a probar.',
};

type Senior = {
  id: string;
  display_name: string;
  talk_time: string | null;
  locale: string;
  user_id: string | null;
  medications: { count: number }[];
};

function Row({
  label,
  value,
  onPress,
  danger = false,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={[styles.rowText, danger && styles.danger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

/** Family settings: the senior's talk, pills and phone, then account, subscription and legal. */
export default function SettingsScreen() {
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
  }, []);

  const [senior, setSenior] = useState<Senior | null>(null);
  const [relinking, setRelinking] = useState(false);
  const [relinkError, setRelinkError] = useState<string | null>(null);

  // Again when coming back from editing the talk, the pills or the phone
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('people')
        .select('id, display_name, talk_time, locale, user_id, medications(count)')
        .eq('role', 'senior')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setSenior(data as Senior | null));
    }, []),
  );

  const edit = (pathname: '/onboarding/talk' | '/onboarding/pills') =>
    senior && router.push({ pathname, params: { seniorId: senior.id, seniorName: senior.display_name, from: 'settings' } });

  const pair = () =>
    senior && router.push({ pathname: '/onboarding/pair', params: { seniorId: senior.id, seniorName: senior.display_name } });

  // A phone is connected: unlink it first, so a new code can be made for the other phone
  const relink = async () => {
    if (!senior) return;
    setRelinkError(null);
    const { error: e } = await supabase.rpc('unlink_senior_phone', { senior_id: senior.id });
    if (e) {
      setRelinkError(text.relinkError);
      return;
    }
    setRelinking(false);
    pair();
  };

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
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <Text style={styles.title} accessibilityRole="header">
            Ajustes
          </Text>

          {senior ? (
            <>
              <Text style={styles.section}>{senior.display_name.toUpperCase()}</Text>
              <View style={styles.group}>
                <Row label={text.talk} value={text.talkValue(senior.talk_time, senior.locale)} onPress={() => edit('/onboarding/talk')} />
                <Row
                  label={text.pills}
                  value={text.pillsValue(senior.medications[0]?.count ?? 0)}
                  onPress={() => edit('/onboarding/pills')}
                />
                <Row
                  label={text.phone}
                  value={text.phoneValue(Boolean(senior.user_id))}
                  onPress={() => (senior.user_id ? setRelinking(true) : pair())}
                />
              </View>

              {relinking ? (
                <View style={styles.confirm}>
                  <Text style={styles.confirmTitle}>{text.relinkTitle}</Text>
                  <Text style={styles.confirmText}>{text.relinkText(senior.display_name)}</Text>
                  <BigButton scale="family" label={text.relinkYes} onPress={relink} />
                  <BigButton scale="family" variant="outline" label={text.cancel} onPress={() => setRelinking(false)} />
                  {relinkError ? <Text style={styles.error}>{relinkError}</Text> : null}
                </View>
              ) : null}
            </>
          ) : null}

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

          <Text style={styles.section}>AYUDA Y LEGAL</Text>
          <View style={styles.group}>
            <Row label="Ayuda" onPress={() => WebBrowser.openBrowserAsync(SUPPORT_URL)} />
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
      </WideFrame>
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
  rowRight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
