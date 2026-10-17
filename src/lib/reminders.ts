import * as Notifications from 'expo-notifications';
import { t } from '@/i18n';

/**
 * Local reminders on the senior's phone: the daily talk and each pill.
 * Scheduled on the phone itself (no server, no push), so they also work without internet.
 */

// Shown even when Hilo is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Where a tapped reminder (or the family's alert) should open */
export function reminderUrl(n: Notifications.Notification) {
  const url = n.request.content.data?.url;
  return url === '/talk' || url === '/pills' || url === '/family/today' ? url : null;
}

type Medication = { id: string; name: string; times: string[]; weekdays: number[] };

/** Asks once. Returns whether Hilo can show reminders. */
export async function askForReminders() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** 'HH:mm' or 'HH:mm:ss' → hour and minute */
const parts = (t: string) => ({ hour: Number(t.slice(0, 2)), minute: Number(t.slice(3, 5)) });

/**
 * Replaces every scheduled reminder with the current schedule.
 * Called on the home, so changes made by the family arrive the next time the senior opens Hilo.
 */
export async function scheduleReminders(talkTime: string | null, meds: Medication[]) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (talkTime) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Hilo', body: t.reminders.talk, data: { url: '/talk' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...parts(talkTime) },
    });
  }

  for (const med of meds) {
    const content = { title: 'Hilo', body: t.reminders.pill(med.name), data: { url: '/pills' } };
    for (const time of med.times) {
      if (med.weekdays.length === 7) {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...parts(time) },
        });
        continue;
      }
      // ISO weekday (1 = Monday) → iOS calendar weekday (1 = Sunday)
      for (const day of med.weekdays) {
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: (day % 7) + 1, ...parts(time) },
        });
      }
    }
  }
}

/** "Recuérdamelo en un rato": one extra reminder for this pill */
export async function remindLater(name: string, minutes: number) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Hilo', body: t.reminders.later(name), data: { url: '/pills' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
  });
}
