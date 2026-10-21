import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { lang } from '@/i18n';
import { askForReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

/**
 * Push on the family's phones, for the alerts the server sends (she hasn't talked in 2 days).
 * The token goes straight to Apple's servers (APNs) from the Edge Function quiet-alert, without a push provider in between.
 */

/** Asks for notifications (once) and saves this phone's token. Quiet if it can't: the app works without it. */
export async function registerFamilyPush() {
  // The pushes go to Apple (APNs): a browser would only get a permission prompt that leads nowhere
  if (Platform.OS === 'web') return;
  try {
    if (!(await askForReminders())) return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== 'string') return;
    await supabase.rpc('save_push_token', { device_token: token, phone_locale: lang });
  } catch (e) {
    if (__DEV__) console.warn('registerFamilyPush failed', e);
  }
}

/** Before signing out: this phone stops getting the family's alerts. */
export async function forgetFamilyPush() {
  if (Platform.OS === 'web') return;
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token === 'string') await supabase.rpc('forget_push_token', { device_token: token });
  } catch (e) {
    if (__DEV__) console.warn('forgetFamilyPush failed', e);
  }
}
