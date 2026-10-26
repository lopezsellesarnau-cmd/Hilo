import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { clock, usePeopleOverview, useTeam, type PersonOverview } from '@/staff/data';
import { BotMark } from '@/staff/icons';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';

type Filter = 'all' | 'mine' | 'unpaired';

const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const since = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Today, 10:34" / "Yesterday" / "3 days ago" */
function when(iso: string | null, none: string): string {
  if (!iso) return none;
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return `Today, ${clock(iso)}`;
  const n = Math.max(1, daysAgo(iso));
  return n === 1 ? 'Yesterday' : `${n} days ago`;
}

/**
 * People: everyone in the organisation, as a list to search and open. Numbers only (last talk, pills,
 * family calls), never what she said. There is no People frame in the canvas: same language as Today.
 */
export default function People() {
  const me = useStaff();
  const people = usePeopleOverview();
  const team = useTeam();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { width } = useWindowDimensions();
  // Narrow windows keep name, last talk and phone; carer, pills and family go into the line under the name
  const wide = width >= 1180;

  const carerName = (id: string | null) =>
    id ? ((team.data ?? []).find((m) => m.user_id === id)?.display_name ?? 'Former staff') : null;

  const all = people.data ?? [];
  const counts = {
    all: all.length,
    mine: all.filter((p) => p.carer_id === me.userId).length,
    unpaired: all.filter((p) => !p.paired).length,
  };
  const q = query.trim().toLocaleLowerCase();
  const shown = all
    .filter((p) => (filter === 'mine' ? p.carer_id === me.userId : filter === 'unpaired' ? !p.paired : true))
    .filter((p) => !q || p.display_name.toLocaleLowerCase().includes(q));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={staffText.label}>{me.orgName}</Text>
          <Text style={styles.h1} accessibilityRole="header">
            People
          </Text>
        </View>
        <Link href="/staff/new" asChild>
          <Pressable style={styles.primary} accessibilityRole="link">
            <Text style={styles.primaryText}>+ New person</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name"
          placeholderTextColor="#8a8a86"
          style={styles.search}
          accessibilityLabel="Search by name"
        />
        <View style={styles.filters}>
          {(
            [
              ['all', 'All'],
              ['mine', 'My people'],
              ['unpaired', 'Phone not paired'],
            ] as const
          ).map(([value, label]) => {
            const on = filter === value;
            return (
              <Pressable
                key={value}
                onPress={() => setFilter(value)}
                style={on ? styles.filterOn : styles.filter}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}>
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{`${label} · ${counts[value]}`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {people.error ? (
        <View style={styles.card}>
          <Text style={staffText.body}>{"The list didn't load. Check the connection and try again."}</Text>
          <Pressable onPress={people.reload} style={styles.ghost} accessibilityRole="button">
            <Text style={styles.ghostText}>Try again</Text>
          </Pressable>
        </View>
      ) : !people.data ? (
        <Text style={staffText.note}>Loading…</Text>
      ) : !all.length ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Nobody here yet</Text>
          <Text style={staffText.note}>People you add with New person will show up here.</Text>
        </View>
      ) : (
        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[staffText.label, styles.colName]}>Name</Text>
            {wide ? <Text style={[staffText.label, styles.col]}>Carer</Text> : null}
            <Text style={[staffText.label, styles.col]}>Last talk</Text>
            {wide ? <Text style={[staffText.label, styles.col]}>Pills · 7 days</Text> : null}
            {wide ? <Text style={[staffText.label, styles.col]}>Family</Text> : null}
            <Text style={[staffText.label, styles.colPhone]}>Phone</Text>
          </View>
          {shown.length ? (
            shown.map((p) => <Row key={p.id} person={p} carer={carerName(p.carer_id)} wide={wide} />)
          ) : (
            <Text style={[staffText.note, styles.noMatch]}>
              {filter === 'mine' && !q ? 'Nobody has you as their carer yet.' : 'Nobody matches.'}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Row({ person: p, carer, wide }: { person: PersonOverview; carer: string | null; wide: boolean }) {
  const [hovered, setHovered] = useState(false);
  const pct = p.pills_due_7d ? Math.round((100 * p.pills_taken_7d) / p.pills_due_7d) : null;
  const pills = pct === null ? 'No pills' : `${pct} %`;
  const pillsDetail = pct === null ? null : `${p.pills_taken_7d} of ${p.pills_due_7d}`;
  const family = p.family_members ? `${p.family_members} in family` : 'No family yet';
  const familyDetail = p.family_members ? `Last call: ${when(p.last_call, 'none yet')}` : null;
  // Same rule as the no_talk alert on Today: 2 days or more without a talk (only once her phone is paired)
  const quiet = p.paired && (!p.last_talk || daysAgo(p.last_talk) >= 2);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/staff/person/[id]', params: { id: p.id } })}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={hovered ? styles.rowHover : styles.row}
      accessibilityRole="link"
      accessibilityLabel={`Open ${p.display_name}`}>
      <View style={[styles.colName, styles.nameCell]}>
        <View style={styles.avatar}>
          <BotMark size={31} />
        </View>
        <View style={styles.nameText}>
          <Text style={styles.name} numberOfLines={1}>
            {p.display_name}
          </Text>
          <Text style={staffText.note} numberOfLines={1}>
            {wide
              ? `Since ${since(p.created_at)}`
              : [carer ?? 'No carer', pills, family].join(' · ')}
          </Text>
        </View>
      </View>
      {wide ? (
        <Text style={[styles.cell, styles.col, !carer && styles.muted]} numberOfLines={1}>
          {carer ?? 'Not assigned'}
        </Text>
      ) : null}
      <View style={styles.col}>
        <Text style={[styles.cell, quiet && styles.strong]}>{when(p.last_talk, p.paired ? 'No talk yet' : '—')}</Text>
        {p.paired ? <Text style={staffText.note}>{`${p.talks_7d} in 7 days`}</Text> : null}
      </View>
      {wide ? (
        <View style={styles.col}>
          <Text style={[styles.cell, pct !== null && pct < 80 && styles.strong]}>{pills}</Text>
          {pillsDetail ? <Text style={staffText.note}>{pillsDetail}</Text> : null}
        </View>
      ) : null}
      {wide ? (
        <View style={styles.col}>
          <Text style={styles.cell}>{family}</Text>
          {familyDetail ? <Text style={staffText.note}>{familyDetail}</Text> : null}
        </View>
      ) : null}
      <View style={styles.colPhone}>
        <View style={p.paired ? styles.chip : styles.chipWarn}>
          <Text style={styles.chipText}>{p.paired ? 'Paired' : 'Not paired'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const row = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 18,
} as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 48, paddingHorizontal: 56, paddingBottom: 64, gap: 32, maxWidth: 1320 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 },
  titles: { gap: 10 },
  h1: { fontFamily: staffFont, fontSize: 44, lineHeight: 46, fontWeight: '500', letterSpacing: -1.5, color: staffColors.ink },
  primary: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },

  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  search: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 260,
    maxWidth: 420,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 99,
    backgroundColor: staffColors.block,
    fontFamily: staffFont,
    fontSize: 15,
    color: staffColors.ink,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.line,
    justifyContent: 'center',
  },
  filterOn: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.ink,
    backgroundColor: staffColors.ink,
    justifyContent: 'center',
  },
  filterText: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  filterTextOn: { color: '#fff' },

  table: { gap: 4 },
  headRow: { ...row, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: staffColors.line, borderRadius: 0 },
  row: { ...row },
  rowHover: { ...row, backgroundColor: staffColors.active },
  colName: { flexGrow: 2, flexShrink: 1, flexBasis: 240, minWidth: 0 },
  col: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
  colPhone: { flexGrow: 0, flexShrink: 0, flexBasis: 110, alignItems: 'flex-start' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    borderWidth: 3,
    borderColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: staffFont, fontSize: 17, fontWeight: '500', color: staffColors.ink },
  cell: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '600' },
  muted: { color: staffColors.muted },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: staffColors.block },
  chipWarn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: staffColors.ink },
  chipText: { fontFamily: staffFont, fontSize: 13, color: staffColors.ink },
  noMatch: { paddingVertical: 20, paddingHorizontal: 16 },

  card: { backgroundColor: staffColors.block, borderRadius: 28, padding: 28, gap: 12 },
  emptyTitle: { fontFamily: staffFont, fontSize: 18, fontWeight: '500', color: staffColors.ink },
  ghost: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.line,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  ghostText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
});
