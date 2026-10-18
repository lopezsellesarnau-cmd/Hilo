import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { OnboardingStep } from '@/components/onboarding-step';
import { PressScale } from '@/components/press-scale';
import { t } from '@/i18n';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { buy, loadPackages, myFamilyId, packageId, restore, type Period, type Plan } from '@/lib/purchases';
import { colors, family, fontWeight } from '@/theme';

const text = t.paywall;

const PERIODS = [
  { value: 'monthly', label: text.monthly },
  { value: 'annual', label: text.annual },
] as const;

/**
 * After the onboarding, before Hoy: the family starts the 14-day trial (like Mealia).
 * Prices come from the App Store, in the family's currency. Apple asks for the price, the renewal and the links here.
 */
export default function PaywallScreen() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [packages, setPackages] = useState<Record<string, PurchasesPackage> | null>(null);
  const [period, setPeriod] = useState<Period>('monthly');
  const [plan, setPlan] = useState<Plan>('family');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myFamilyId()
      .then(async (id) => {
        if (!id) return router.replace('/');
        setFamilyId(id);
        setPackages(await loadPackages(id));
      })
      .catch(() => setError(text.loadFailed));
  }, []);

  const chosen = packages?.[packageId(plan, period)];
  const price = (p: PurchasesPackage | undefined) =>
    p ? (period === 'monthly' ? text.perMonth(p.product.priceString) : text.perYear(p.product.priceString)) : '';
  const trial = Boolean(chosen?.product.introPrice);

  const done = () => {
    router.dismissAll();
    router.replace('/family/today');
  };

  const start = async () => {
    if (!familyId || !chosen || busy) return;
    setBusy(true);
    setError(null);
    const result = await buy(familyId, chosen);
    setBusy(false);
    if (result === 'ok') return done();
    if (result === 'failed') setError(text.failed);
  };

  const restoreNow = async () => {
    if (!familyId || busy) return;
    setBusy(true);
    setError(null);
    const ok = await restore(familyId);
    setBusy(false);
    if (ok) return done();
    setError(text.restoreNone);
  };

  const card = (p: Plan, name: string, points: string) => {
    const on = plan === p;
    return (
      <PressScale
        onPress={() => setPlan(p)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${name}, ${price(packages?.[packageId(p, period)])}. ${points}`}
        animateColor
        style={[styles.card, on && styles.cardOn]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardName, on && styles.onDark]}>{name}</Text>
          <Text style={[styles.cardPrice, on && styles.onDark]}>{price(packages?.[packageId(p, period)])}</Text>
        </View>
        <Text style={[styles.cardPoints, on && styles.pointsOn]}>{points}</Text>
      </PressScale>
    );
  };

  return (
    <OnboardingStep
      mood={busy ? 'thinking' : 'idle'}
      question={text.question}
      hint={text.hint}
      footer={
        <>
          <BigButton
            scale="family"
            label={busy ? text.buying : trial ? text.startTrial : text.subscribe}
            onPress={chosen && !busy ? start : undefined}
          />
          {chosen ? (
            <Text style={styles.small}>{trial ? text.after(price(chosen)) : text.afterNoTrial(price(chosen))}</Text>
          ) : null}
          <View style={styles.links}>
            <Pressable onPress={restoreNow} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>{text.restore}</Text>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.link}>{t.agree.terms}</Text>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.link}>{t.agree.privacy}</Text>
            </Pressable>
          </View>
        </>
      }>
      <ChoiceChips label={text.periodA11y} options={PERIODS} value={period} onChange={setPeriod} />
      <View style={styles.cards} accessibilityRole="radiogroup">
        {card('family', text.family, text.familyPoints)}
        {card('basic', text.basic, text.basicPoints)}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: 12,
    marginTop: 6,
  },
  // Grey like the rows of the app; the chosen plan turns black, like a selected chip
  card: {
    flexShrink: 0,
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  cardOn: {
    backgroundColor: colors.accent,
  },
  onDark: {
    color: colors.onAccent,
  },
  pointsOn: {
    color: 'rgba(255,255,255,0.75)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  cardName: {
    fontSize: family.fontSize.button,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  cardPrice: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  cardPoints: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  small: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 18,
  },
  link: {
    fontSize: family.fontSize.note,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
