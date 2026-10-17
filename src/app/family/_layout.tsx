import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { t } from '@/i18n';
import { colors } from '@/theme';

// SF Symbols for now. TODO: tab icons from Figma (Hoy / Libro / Ajustes)
function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}
const icon = (name: SymbolViewProps['name']) =>
  function Icon({ color }: { color: ColorValue }) {
    return <TabIcon name={name} color={color} />;
  };

/** The family app: Hoy, Libro and Ajustes. */
export default function FamilyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="today" options={{ title: t.today.title, tabBarIcon: icon('sun.max') }} />
      <Tabs.Screen name="book" options={{ title: t.familyBook.tab, tabBarIcon: icon('book.closed') }} />
      <Tabs.Screen name="settings" options={{ title: t.settings.title, tabBarIcon: icon('gearshape') }} />
    </Tabs>
  );
}
