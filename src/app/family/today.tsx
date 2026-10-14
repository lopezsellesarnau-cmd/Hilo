import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { TodayPills } from '@/components/today-pills';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
import { colors, family, fontWeight, spacing } from '@/theme';

type Senior = { id: string; display_name: string; talk_time: string | null; user_id: string | null; timezone: string };

/** '10:00:00' → '10:00' */
const showTime = (t: string) => t.slice(0, 5).replace(/^0/, '');

type Talk = { started_at: string; ended_at: string | null };

// Texts of the talk card, together for the translation later
const text = {
  talked: (time: string, minutes: number | null, count: number) =>
    `Ha charlado hoy a las ${time}` +
    (minutes !== null ? ` · ${minutes} min` : '') +
    (count > 1 ? ` · ${count} charlas` : '') +
    '.',
  story: 'Nueva historia',
  stories: (n: number) => `${n} historias para revisar`,
  review: 'Revisar',
  notYet: (time: string | null) => `Aún no ha charlado hoy.${time ? ` Su charla es a las ${time}.` : ''}`,
};

/** Her talks today, in her time zone. The latest one first */
const talkedToday = (talks: Talk[], timeZone: string) => {
  const today = localNow(timeZone).date;
  return talks.filter((t) => localNow(timeZone, new Date(t.started_at)).date === today);
};

/**
 * Hoy: how the senior's day is going.
 * Talk time, phone connected and today's pills; stories come next.
 */
export default function TodayScreen() {
  const [senior, setSenior] = useState<Senior | null>(null);
  const [talks, setTalks] = useState<Talk[]>([]);
  // Stories from her talks waiting for the family, newest first
  const [drafts, setDrafts] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reload when coming back to the tab, e.g. after pairing their phone
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('people')
        .select('id, display_name, talk_time, user_id, timezone')
        .eq('role', 'senior')
        .limit(1)
        .maybeSingle()
        .then(({ data, error: e }) => {
          if (e) {
            setError('No hemos podido cargar los datos. Comprueba tu conexión.');
            return;
          }
          setError(null);
          setSenior(data as Senior | null);
          if (!data) return;
          // Enough to cover today even with several talks
          supabase
            .from('talk_sessions')
            .select('started_at, ended_at')
            .eq('person_id', data.id)
            .order('started_at', { ascending: false })
            .limit(10)
            .then(({ data: rows }) => setTalks(talkedToday(rows ?? [], data.timezone)));
          supabase
            .from('chapters')
            .select('id, title')
            .eq('person_id', data.id)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .then(({ data: rows }) => setDrafts(rows ?? []));
        });
    }, []),
  );

  const pair = () =>
    senior && router.push({ pathname: '/onboarding/pair', params: { seniorId: senior.id, seniorName: senior.display_name } });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          Hoy
        </Text>
        {senior ? <Text style={styles.subtitle}>Con {senior.display_name}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {senior ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardBot}>
                <Bot size={56} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>La charla</Text>
                <Text style={styles.cardBody}>
                  {talks.length
                    ? text.talked(
                        localNow(senior.timezone, new Date(talks[0].started_at)).time.replace(/^0/, ''),
                        talks[0].ended_at
                          ? Math.max(1, Math.round((Date.parse(talks[0].ended_at) - Date.parse(talks[0].started_at)) / 60_000))
                          : null,
                        talks.length,
                      )
                    : text.notYet(senior.talk_time ? showTime(senior.talk_time) : null)}
                </Text>
              </View>
            </View>

            {drafts.length ? (
              <View style={[styles.card, styles.cardTodo]}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{drafts.length === 1 ? text.story : text.stories(drafts.length)}</Text>
                  <Text style={styles.cardBody}>«{drafts[0].title}»</Text>
                </View>
                <BigButton
                  scale="family"
                  label={text.review}
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: drafts[0].id } })}
                />
              </View>
            ) : null}

            {senior.user_id ? (
              <View style={styles.card}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Su móvil</Text>
                  <Text style={styles.cardBody}>Conectado. Hilo ya puede avisarle.</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.card, styles.cardTodo]}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Falta conectar su móvil</Text>
                  <Text style={styles.cardBody}>Sin esto, Hilo no puede hablar con {senior.display_name}.</Text>
                </View>
                <BigButton scale="family" label="Conectar su móvil" onPress={pair} />
              </View>
            )}

            <TodayPills seniorId={senior.id} seniorName={senior.display_name} timezone={senior.timezone} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: family.fontSize.title,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    marginTop: -10,
    marginBottom: 8,
    fontSize: family.fontSize.subtitle,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#f2f5f1',
  },
  cardTodo: {
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: colors.sage,
  },
  cardBot: {
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  cardBody: {
    fontSize: family.fontSize.body,
    lineHeight: 25,
    color: '#555555',
  },
  error: {
    fontSize: family.fontSize.note,
    color: '#b3261e',
    fontWeight: '600',
  },
});
