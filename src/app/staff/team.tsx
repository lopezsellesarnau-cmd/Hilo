import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clock, useAccessLog, useStaffPeople, useTeam, type AccessEntry, type TeamMember } from '@/staff/data';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';

const PERIODS = [7, 30, 90] as const;

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const roleName = (role: TeamMember['role']) => (role === 'admin' ? 'Coordinator' : 'Carer');

/**
 * Team: the organisation's staff, and for coordinators the access log (who opened whose page or the reports,
 * and when). The database writes the log (staff_access_log migration); nobody can change or delete it.
 * Adding or removing staff is still done by Hilo: there is no invite flow yet.
 */
export default function Team() {
  const me = useStaff();
  const team = useTeam();
  const admin = me.role === 'admin';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.titles}>
        <Text style={staffText.label}>{me.orgName}</Text>
        <Text style={styles.h1} accessibilityRole="header">
          Team
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>{team.data ? `Staff · ${team.data.length}` : 'Staff'}</Text>
        {team.error ? (
          <Failed onRetry={team.reload} />
        ) : !team.data ? (
          <Text style={staffText.note}>Loading…</Text>
        ) : (
          <View style={styles.table}>
            {team.data.map((m) => (
              <View key={m.user_id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(m.display_name)}</Text>
                </View>
                <View style={styles.nameText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {m.user_id === me.userId ? `${m.display_name} (you)` : m.display_name}
                  </Text>
                  <Text style={staffText.note}>{`Since ${day(m.created_at)}`}</Text>
                </View>
                <View style={m.role === 'admin' ? styles.chipDark : styles.chip}>
                  <Text style={[styles.chipText, m.role === 'admin' && styles.chipTextDark]}>{roleName(m.role)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <Text style={staffText.note}>
          To add someone, remove someone or change a role, write to Hilo at lopezsellesarnau@gmail.com.
        </Text>
      </View>

      {admin ? (
        <AccessLog team={team.data ?? []} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Access log</Text>
          <Text style={staffText.note}>
            Every time someone opens a person&apos;s page or the reports, Hilo writes it down. Only coordinators can
            see the log.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function AccessLog({ team }: { team: TeamMember[] }) {
  const me = useStaff();
  const people = useStaffPeople();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [who, setWho] = useState<string | null>(null);
  const log = useAccessLog(me.orgId, days, true);

  const staffName = (id: string | null) =>
    (id && team.find((m) => m.user_id === id)?.display_name) || 'Former staff';
  const opened = (e: AccessEntry) =>
    e.what === 'report'
      ? 'Reports'
      : ((people.data ?? []).find((p) => p.id === e.person_id)?.display_name ?? 'A person');

  const shown = (log.data ?? []).filter((e) => !who || e.user_id === who);

  return (
    <View style={styles.section}>
      <View style={styles.logHeader}>
        <View style={styles.logTitles}>
          <Text style={styles.h2}>Access log</Text>
          <Text style={staffText.note}>
            Every time someone on the staff opens a person&apos;s page or the reports. Written by the database:
            nobody can change or delete it.
          </Text>
        </View>
        {shown.length ? (
          <Pressable
            onPress={() => downloadCsv(shown, days, me.orgName, staffName, opened)}
            style={styles.outline}
            accessibilityRole="button">
            <Text style={styles.outlineText}>Download CSV</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        {PERIODS.map((d) => (
          <Chip key={d} label={`Last ${d} days`} on={days === d} onPress={() => setDays(d)} />
        ))}
        <View style={styles.divider} />
        <Chip label="Everyone" on={!who} onPress={() => setWho(null)} />
        {team.map((m) => (
          <Chip key={m.user_id} label={m.display_name} on={who === m.user_id} onPress={() => setWho(m.user_id)} />
        ))}
      </View>

      {log.error ? (
        <Failed onRetry={log.reload} />
      ) : !log.data ? (
        <Text style={staffText.note}>Loading…</Text>
      ) : !shown.length ? (
        <Text style={[staffText.note, styles.empty]}>Nothing opened in this period.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[staffText.label, styles.colWhen]}>When</Text>
            <Text style={[staffText.label, styles.col]}>Who</Text>
            <Text style={[staffText.label, styles.col]}>Opened</Text>
          </View>
          {shown.map((e) => (
            <View key={e.id} style={styles.logRow}>
              <Text style={[styles.cell, styles.colWhen]}>{`${day(e.at)}, ${clock(e.at)}`}</Text>
              <Text style={[styles.cell, styles.col, !e.user_id && styles.muted]} numberOfLines={1}>
                {staffName(e.user_id)}
              </Text>
              <Text style={[styles.cell, styles.col]} numberOfLines={1}>
                {opened(e)}
              </Text>
            </View>
          ))}
          {log.data.length === 1000 ? (
            <Text style={[staffText.note, styles.empty]}>Showing the latest 1,000. Choose a shorter period.</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={on ? styles.filterOn : styles.filter}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}>
      <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={staffText.body}>{"This didn't load. Check the connection and try again."}</Text>
      <Pressable onPress={onRetry} style={styles.outline} accessibilityRole="button">
        <Text style={styles.outlineText}>Try again</Text>
      </Pressable>
    </View>
  );
}

/** What's on screen as a CSV file, one line per access (web only), for the organisation's own records. */
function downloadCsv(
  rows: AccessEntry[],
  days: number,
  org: string,
  staffName: (id: string | null) => string,
  opened: (e: AccessEntry) => string,
) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [['when', 'who', 'opened'], ...rows.map((e) => [e.at, staffName(e.user_id), opened(e)])];
  const csv = lines.map((l) => l.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `hilo-access-log-${org.replace(/\W+/g, '-').toLowerCase()}-${days}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const row = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
  paddingVertical: 12,
  paddingHorizontal: 16,
} as const;

const chip = {
  minHeight: 40,
  paddingHorizontal: 16,
  borderRadius: 99,
  borderWidth: 1,
  justifyContent: 'center',
} as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 48, paddingHorizontal: 56, paddingBottom: 64, gap: 48, maxWidth: 1100 },
  titles: { gap: 10 },
  h1: { fontFamily: staffFont, fontSize: 44, lineHeight: 46, fontWeight: '500', letterSpacing: -1.5, color: staffColors.ink },
  h2: { fontFamily: staffFont, fontSize: 22, fontWeight: '500', letterSpacing: -0.5, color: staffColors.ink },
  section: { gap: 16 },

  table: { gap: 2 },
  row: { ...row, borderBottomWidth: 1, borderBottomColor: staffColors.line },
  headRow: { ...row, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: staffColors.line },
  logRow: { ...row, paddingVertical: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: staffColors.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: staffFont, fontSize: 14, fontWeight: '700', color: staffColors.ink },
  nameText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: staffFont, fontSize: 17, fontWeight: '500', color: staffColors.ink },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: staffColors.block },
  chipDark: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: staffColors.ink },
  chipText: { fontFamily: staffFont, fontSize: 13, color: staffColors.ink },
  chipTextDark: { color: '#fff' },

  logHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  logTitles: { flexShrink: 1, flexBasis: 480, gap: 6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 24, marginHorizontal: 4, backgroundColor: staffColors.line },
  filter: { ...chip, borderColor: staffColors.line },
  filterOn: { ...chip, borderColor: staffColors.ink, backgroundColor: staffColors.ink },
  filterText: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink },
  filterTextOn: { color: '#fff' },
  colWhen: { flexGrow: 0, flexShrink: 0, flexBasis: 190 },
  col: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  cell: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  muted: { color: staffColors.muted },
  empty: { paddingVertical: 20, paddingHorizontal: 16 },

  card: { backgroundColor: staffColors.block, borderRadius: 28, padding: 28, gap: 12 },
  cardTitle: { fontFamily: staffFont, fontSize: 18, fontWeight: '500', color: staffColors.ink },
  outline: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.line,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  outlineText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
});
