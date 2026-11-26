import { router, type Href } from 'expo-router';

/**
 * Back, or to `fallback` when there's nothing to go back to: a screen opened from a notification, a link,
 * or after a reload has no history, and router.back() there does nothing but warn ("GO_BACK was not handled").
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
