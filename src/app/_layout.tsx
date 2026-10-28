import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CaptchaHost } from '@/lib/captcha';
import { reminderUrl } from '@/lib/reminders';
import { colors } from '@/theme';

export default function RootLayout() {
  // Tapping a reminder while Hilo is running opens the talk or the pills (cold start: see index.tsx)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = reminderUrl(r.notification);
      if (url) router.push(url);
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // Calm page change for older users: the new page fades in while rising a little, no fast slide.
          // The iOS swipe-back gesture still works.
          animation: 'fade_from_bottom',
          animationDuration: 350,
        }}
      />
      <CaptchaHost />
    </>
  );
}
