import { router, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { type ColorValue, View } from 'react-native';

import { t } from '@/i18n';
import { familyHasAccess, myFamilyId } from '@/lib/purchases';
import { colors } from '@/theme';

// SF Symbols for now. TODO: tab icons from Figma (Hoy / Libro / Ajustes)
function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}
const icon = (name: SymbolViewProps['name']) =>
  function Icon({ color }: { color: ColorValue }) {
    return <TabIcon name={name} color={color} />;
  };

/** The family app: Hoy, Libro and Ajustes. Only with a trial or a subscription: otherwise, the paywall. */
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

  if (!allowed) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
        // Switching tabs cross-fades instead of jumping
        animation: 'fade',
      }}>
      <Tabs.Screen name="today" options={{ title: t.today.title, tabBarIcon: icon('sun.max') }} />
      <Tabs.Screen name="book" options={{ title: t.familyBook.tab, tabBarIcon: icon('book.closed') }} />
      <Tabs.Screen name="settings" options={{ title: t.settings.title, tabBarIcon: icon('gearshape') }} />
    </Tabs>
  );
}
