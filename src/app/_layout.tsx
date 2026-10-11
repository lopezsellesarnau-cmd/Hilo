import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // Calm page change for older users: a soft fade instead of a fast slide.
          // The iOS swipe-back gesture still works.
          animation: 'fade',
          animationDuration: 320,
        }}
      />
    </>
  );
}
