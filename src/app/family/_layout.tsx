import { router, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { type ColorValue, View } from 'react-native';

import { t } from '@/i18n';
import { loadCalls } from '@/lib/calls';
import { familyHasAccess, myFamilyId } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

// SF Symbols for the tab icons (Hoy / Libro / Ajustes)
function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}
const icon = (name: SymbolViewProps['name']) =>
  function Icon({ color }: { color: ColorValue }) {
    return <TabIcon name={name} color={color} />;
  };

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

  return (
    <Tabs
      screenListeners={{ focus: refreshBadges }}
      screenOptions={{
        tabBarBadgeStyle: { backgroundColor: colors.ink, color: colors.background, fontSize: 12 },
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
        // No tab animation and no entering animations in the tab screens: both left blank tabs
        // All tabs are created at the start and load their data in the background, so switching shows
        // a ready screen instead of an empty one that fills in (safe now that there are no entering animations)
        lazy: false,
      }}>
      <Tabs.Screen name="today" options={{ title: t.today.title, tabBarIcon: icon('sun.max') }} />
      <Tabs.Screen
        name="talks"
        options={{
          title: t.talks.tab,
          tabBarIcon: icon('bubble.left.and.bubble.right'),
          tabBarBadge: badges.callDue ? '!' : undefined,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: t.familyBook.tab,
          tabBarIcon: icon('book.closed'),
          tabBarBadge: badges.stories || undefined,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: t.settings.title, tabBarIcon: icon('gearshape') }} />
    </Tabs>
  );
}
