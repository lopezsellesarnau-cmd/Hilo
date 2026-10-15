import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { startRoute } from '@/lib/onboarding';
import { reminderUrl } from '@/lib/reminders';
import { colors, family, fontWeight, spacing } from '@/theme';

/**
 * First screen when nobody is signed in.
 * "Soy familiar" starts the family onboarding; "Tengo un código" is for the senior's phone.
 */
export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const logoSize = Math.min(170, width * 0.42);
  // Signed in already? Go straight to the right place instead of showing Welcome
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    startRoute()
      .then((route) => {
        if (!route) return setChecking(false);
        router.replace(route);
        // Hilo was opened by tapping a reminder: go on to the talk or the pills
        const last = Notifications.getLastNotificationResponse();
        const url = route === '/home' && last ? reminderUrl(last.notification) : null;
        if (url) router.push(url);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) return <View style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.center}>
          <Animated.View entering={FadeIn.duration(700)}>
            <Bot size={logoSize} look="left" />
          </Animated.View>
          <Animated.Text entering={FadeInDown.duration(500).delay(150)} style={styles.name} accessibilityRole="header">
            Hilo
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(500).delay(250)} style={styles.tagline}>
            Una charla al día para quien más quieres.
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.buttons}>
          <BigButton scale="family" label="Soy familiar" onPress={() => router.push('/onboarding/email')} />
          <BigButton scale="family" variant="outline" label="Tengo un código" onPress={() => router.push('/pair-code')} />
          <Text style={styles.note}>«Tengo un código» es para el móvil de tu madre, padre o abuelo.</Text>
        </Animated.View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 20,
    marginBottom: 6,
  },
  tagline: {
    fontSize: family.fontSize.subtitle,
    lineHeight: 26,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  buttons: {
    gap: 12,
  },
  note: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
  },
});
