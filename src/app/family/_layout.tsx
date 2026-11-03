import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { t } from '@/i18n';
import { loadCalls } from '@/lib/calls';
import { familyHasAccess, myFamilyId } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

/** Same as quiet-alert and Hoy */
const CALL_DAYS = 3;

/** What the tab badges show: stories waiting in Libro, and a call that is due in Charlas */
async function loadBadges(): Promise<{ stories: number; callDue: boolean }> {
  const { data: senior } = await supabase.from('people').select('id, user_id').eq('role', 'senior').limit(1).maybeSingle();
  if (!senior) return { stories: 0, callDue: false };
  const [{ count }, calls] = await Promise.all([
    supabase.from('chapters').select('id', { count: 'exact', head: true }).eq('person_id', senior.id).eq('status', 'draft'),
    senior.user_id ? loadCalls(senior.id, 1) : Promise.resolve(null),
  ]);
  const callDue = Boolean(calls && (!calls.length || Date.now() - Date.parse(calls[0].at) >= CALL_DAYS * 86_400_000));
  return { stories: count ?? 0, callDue };
}

/** The family app: Hoy, Charlas, Libro and Ajustes. Only with a trial or a subscription: otherwise, the paywall. */
export default function FamilyLayout() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    myFamilyId()
      .then(async (id) => {
        if (id && !(await familyHasAccess(id))) return router.replace('/paywall');
        setAllowed(true);
      })
      .catch(() => setAllowed(true));
  }, []);

  // Again on every tab change, so a story approved or a call noted clears its badge
  const [badges, setBadges] = useState({ stories: 0, callDue: false });
  const refreshBadges = useCallback(() => {
    loadBadges()
      .then(setBadges)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (allowed) refreshBadges();
  }, [allowed, refreshBadges]);

  if (!allowed) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  // The system tab bar: Liquid Glass on iPhone, Material on Android. SF Symbols on iPhone, Material icons elsewhere.
  return (
    <NativeTabs
      screenListeners={{ focus: refreshBadges }}
      tintColor={colors.ink}
      iconColor={colors.muted}
      badgeBackgroundColor={colors.ink}
      labelStyle={{ fontWeight: '600' }}
      // The web has no system bar: a black pill with white labels, the open tab white
      {...(Platform.OS === 'web'
        ? {
            backgroundColor: colors.ink,
            indicatorColor: colors.background,
            labelStyle: { fontWeight: '600', color: colors.onAccent },
            badgeBackgroundColor: '#ff6a3d',
            badgeTextColor: colors.ink,
          }
        : {})}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label>{t.today.title}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max" md="light_mode" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="talks">
        <NativeTabs.Trigger.Label>{t.talks.tab}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="group" />
        <NativeTabs.Trigger.Badge hidden={!badges.callDue}>!</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="book">
        <NativeTabs.Trigger.Label>{t.familyBook.tab}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.closed" md="menu_book" />
        <NativeTabs.Trigger.Badge hidden={!badges.stories}>{String(badges.stories)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t.settings.title}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
