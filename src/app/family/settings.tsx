import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ListRow } from '@/components/list-row';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from '@/lib/legal';
import { forgetFamilyPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight, spacing } from '@/theme';

const SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const LANGUAGE_NAMES: Record<string, string> = { es: 'Español', en: 'English', nl: 'Nederlands' };

const text = {
  ...t.settings,
  talkValue: (time: string | null, locale: string, city: string | null) =>
    [time ? time.slice(0, 5).replace(/^0/, '') : t.settings.noTime, LANGUAGE_NAMES[locale] ?? locale, city]
      .filter(Boolean)
      .join(' · '),
};

type Senior = {
  id: string;
  display_name: string;
  talk_time: string | null;
  locale: string;
  city: string | null;
  memory: string | null;
  user_id: string | null;
  medications: { count: number }[];
};

/** A line inside the grey group (account, help): smaller than a ListRow, there are many */
function Row({ label, onPress, last = false }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.rowPressed]}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
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
        .select('id, display_name, talk_time, locale, city, memory, user_id, medications(count)')
        .eq('role', 'senior')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setSenior(data as Senior | null));
    }, []),
  );

  const edit = (pathname: '/onboarding/talk' | '/onboarding/pills' | '/memory') =>
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
    await forgetFamilyPush();
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
      setError(text.deleteFailed);
      return;
    }
    // The user no longer exists; this only clears the session stored on the phone
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {text.title}
            </Text>
            {email ? <Text style={styles.subtitle}>{email}</Text> : null}
          </View>

          {senior ? (
            <View style={styles.section}>
              <Text style={styles.label}>{senior.display_name.toUpperCase()}</Text>
              <ListRow
                title={text.talk}
                detail={text.talkValue(senior.talk_time, senior.locale, senior.city)}
                onPress={() => edit('/onboarding/talk')}
              />
              <ListRow
                title={text.pills}
                detail={text.pillsValue(senior.medications[0]?.count ?? 0)}
                onPress={() => edit('/onboarding/pills')}
              />
              <ListRow
                title={text.memory}
                detail={text.memoryValue(Boolean(senior.memory?.trim()))}
                onPress={() => edit('/memory')}
              />
              <ListRow
                title={text.phone}
                detail={text.phoneValue(Boolean(senior.user_id))}
                onPress={() => (senior.user_id ? setRelinking(true) : pair())}
              />

              {relinking ? (
                <View style={styles.confirm}>
                  <Text style={styles.confirmTitle}>{text.relinkTitle}</Text>
                  <Text style={styles.confirmText}>{text.relinkText(senior.display_name)}</Text>
                  <BigButton scale="family" label={text.relinkYes} onPress={relink} />
                  <BigButton scale="family" variant="outline" label={text.cancel} onPress={() => setRelinking(false)} />
                  {relinkError ? <Text style={styles.error}>{relinkError}</Text> : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>{text.account}</Text>
            <View style={styles.group}>
              <Row label={text.subscription} onPress={() => Linking.openURL(SUBSCRIPTIONS_URL)} />
              <Row label={text.signOut} onPress={signOut} last />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{text.helpLegal}</Text>
            <View style={styles.group}>
              <Row label={text.help} onPress={() => WebBrowser.openBrowserAsync(SUPPORT_URL)} />
              <Row label={t.agree.terms} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
              <Row label={t.agree.privacy} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} last />
            </View>
            {/* MET Norway's licence asks for this credit wherever its forecasts are used */}
            <Text style={styles.credit}>{text.weatherCredit}</Text>
          </View>

          <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" style={styles.deleteLink}>
            <Text style={styles.danger}>{text.deleteAccount}</Text>
          </Pressable>

          {confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>{text.deleteTitle}</Text>
              <Text style={styles.confirmText}>{text.deleteText}</Text>
              <BigButton scale="family" label={deleting ? text.deleting : text.deleteYes} onPress={deleteAccount} />
              <BigButton scale="family" variant="outline" label={text.cancel} onPress={() => setConfirming(false)} />
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
    gap: 28,
  },
  head: {
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 36,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 18,
    color: colors.muted,
  },
  section: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  // One grey block with thin lines, the same grey and roundness as the rows above
  group: {
    borderRadius: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d4d4d4',
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
  },
  credit: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  danger: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
  },
  confirm: {
    padding: 20,
    gap: 12,
    borderRadius: 28,
    backgroundColor: colors.surface,
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
