import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { supabase } from '@/lib/supabase';

/**
 * Subscriptions through RevenueCat. The family pays, not the person: the RevenueCat user is the family_id,
 * so any family member's phone sees the same subscription, and the webhook saves it in Supabase for the senior's phone.
 * Entitlements in RevenueCat: "basic" and "family" (Familia includes everything in Básico).
 * On the web the same calls go to RevenueCat Web Billing (Stripe): same family, same entitlements, same webhook.
 */

const KEY = Platform.OS === 'web' ? process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY : process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

export type Plan = 'basic' | 'family';
export type Period = 'monthly' | 'annual';
/** Package identifiers in the RevenueCat offering: basic_monthly, basic_annual, family_monthly, family_annual */
export const packageId = (plan: Plan, period: Period) => `${plan}_${period}`;

/** The signed-in member's family */
export async function myFamilyId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from('people')
    .select('family_id')
    .eq('user_id', session.user.id)
    .eq('role', 'member')
    .limit(1)
    .maybeSingle();
  return data?.family_id ?? null;
}

/** RevenueCat, signed in as the family. Safe to call more than once. */
async function ready(familyId: string) {
  if (!KEY) throw new Error(`Missing the RevenueCat key for ${Platform.OS}`);
  if (!(await Purchases.isConfigured())) Purchases.configure({ apiKey: KEY, appUserID: familyId });
  else if ((await Purchases.getAppUserID()) !== familyId) await Purchases.logIn(familyId);
}

const hasEntitlement = (info: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>) =>
  Boolean(info.entitlements.active.basic || info.entitlements.active.family);

/**
 * Can this family use Hilo? Yes with a trial or a subscription, in Supabase (also given by hand) or in RevenueCat
 * (right after buying, before the webhook arrives). On the phone, offline counts as yes: never lock a family out for a bad signal.
 */
export async function familyHasAccess(familyId: string): Promise<boolean> {
  // Supabase answered and this family has never had a subscription (a new family): nothing to protect from a bad signal
  let neverSubscribed = false;
  try {
    const { data, error } = await supabase.from('subscriptions').select('status, expires_at').eq('family_id', familyId).maybeSingle();
    if (error) return true;
    if (data && data.status !== 'expired' && (!data.expires_at || Date.parse(data.expires_at) > Date.now())) return true;
    neverSubscribed = !data;
    await ready(familyId);
    return hasEntitlement(await Purchases.getCustomerInfo());
  } catch (e) {
    if (__DEV__) console.warn('familyHasAccess', e);
    // A new family goes to the paywall, which shows its own error if RevenueCat is still failing.
    // On the web a family that has paid is already in Supabase (checked first): an error here is not a reason to open the app
    return !neverSubscribed && Platform.OS !== 'web';
  }
}

/** The four packages of the current offering, by identifier */
export async function loadPackages(familyId: string): Promise<Record<string, PurchasesPackage>> {
  await ready(familyId);
  const offerings = await Purchases.getOfferings();
  return Object.fromEntries((offerings.current?.availablePackages ?? []).map((p) => [p.identifier, p]));
}

/** Buys a package. 'cancelled' when the person closes Apple's sheet: not an error. */
export async function buy(familyId: string, pkg: PurchasesPackage): Promise<'ok' | 'cancelled' | 'failed'> {
  try {
    await ready(familyId);
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasEntitlement(customerInfo) ? 'ok' : 'failed';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    if (__DEV__) console.warn('buy', e);
    return 'failed';
  }
}

/** "Restaurar compras": a family that already paid on another phone or after reinstalling */
export async function restore(familyId: string): Promise<boolean> {
  try {
    await ready(familyId);
    return hasEntitlement(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}
