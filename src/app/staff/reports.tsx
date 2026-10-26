import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useFirstDay, useReport, type Report } from '@/staff/data';
import { BellIcon, PillIcon } from '@/staff/icons';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';

/** 'YYYY-MM-DD' of a local date */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthStart = (y: number, m: number) => new Date(y, m, 1);
const monthEnd = (y: number, m: number) => new Date(y, m + 1, 0);
const monthName = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });
const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const one = (n: number) => n.toFixed(1);
/** Week of the pilot today, counting its first day's week as 1 */
const pilotWeek = (firstDay: string) =>
  Math.floor((Date.now() - new Date(`${firstDay}T00:00:00`).getTime()) / (7 * 86_400_000)) + 1;
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;

type Period = { key: string; label: string; title: string; from: string; to: string; before: { from: string; to: string } | null };

const GOAL = 80;
const KINDS = [
  ['pills', 'Pills not confirmed'],
  ['no_talk', 'No talk for 2+ days'],
  ['no_family', 'No family call for 5+ days'],
] as const;

/**
 * Reports, as the "Reports" frame of the staff canvas. Totals only, from staff_report(): the alerts are worked
 * out again for each past day with Today's rules. Left out until Hilo records them: "said bad 3 times" (needs
 * the 3-button check-in), visits, and sending the report as a PDF.
 */
export default function Reports() {
  const me = useStaff();
  const now = new Date();
  // The day the organisation's first person was added; until it loads, this month and the one before
  const firstDay = useFirstDay(me.orgId);
  const [key, setKey] = useState(`${now.getFullYear()}-${now.getMonth()}`);

  const periods = useMemo<Period[]>(() => {
    const start = firstDay ? new Date(`${firstDay}T12:00:00`) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const list: Period[] = [];
    const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    for (let i = 0; i <= months; i++) {
      const y = start.getFullYear();
      const m = start.getMonth() + i;
      // Date rolls month 12 over into the next year
      const from = monthStart(y, m);
      list.push({
        key: `${from.getFullYear()}-${from.getMonth()}`,
        label: monthName(from),
        title: `${monthName(from)} report`,
        from: iso(from),
        to: iso(monthEnd(y, m)),
        before: { from: iso(monthStart(y, m - 1)), to: iso(monthEnd(y, m - 1)) },
      });
    }
    // Only the last three months as buttons; the whole pilot covers the rest
    const shown = list.slice(-3);
    shown.push({
      key: 'all',
      label: 'Whole pilot',
      title: 'Whole pilot',
      from: firstDay ?? iso(start),
      to: iso(now),
      before: null,
    });
    return shown;
    // `now` changes every render; the list only depends on the pilot's first day
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay]);

  const period = periods.find((p) => p.key === key) ?? periods[periods.length - 2] ?? periods[0];
  const report = useReport(me.orgId, period.from, period.to, period.before);
  const r = report.data?.now;

  const week = firstDay ? pilotWeek(firstDay) : null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={staffText.label}>{week ? `${me.orgName} · pilot week ${week}` : me.orgName}</Text>
          <Text style={styles.h1} accessibilityRole="header">
            {period.title}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Period">
            {periods.map((p) => {
              const on = p.key === period.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setKey(p.key)}
                  style={on ? styles.segOn : styles.seg}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}>
                  <Text style={[styles.segText, on && styles.segTextOn]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {r && Platform.OS === 'web' ? (
            <Pressable onPress={() => downloadCsv(r, period, me.orgName)} style={styles.outline} accessibilityRole="button">
              <Text style={styles.outlineText}>Download CSV</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {report.error ? (
        <View style={styles.greyCard}>
          <Text style={staffText.body}>{"The report didn't load. Check the connection and try again."}</Text>
          <Pressable onPress={report.reload} style={styles.outline} accessibilityRole="button">
            <Text style={styles.outlineText}>Try again</Text>
          </Pressable>
        </View>
      ) : !r ? (
        <Text style={staffText.note}>Loading…</Text>
      ) : (
        <Body r={r} before={report.data?.before ?? null} periodLabel={period.key === 'all' ? 'the pilot' : period.label} />
      )}
    </ScrollView>
  );
}

function Body({ r, before, periodLabel }: { r: Report; before: Report | null; periodLabel: string }) {
  const talks = r.paired_days ? (r.talk_days / r.paired_days) * 7 : null;
  const talksBefore = before?.paired_days ? (before.talk_days / before.paired_days) * 7 : null;
  const pills = r.doses_due ? Math.round((100 * r.doses_taken) / r.doses_due) : null;
  const pillsBefore = before?.doses_due ? Math.round((100 * before.doses_taken) / before.doses_due) : null;
  const l = r.loneliness;
  const lonelyChange = l.start !== null && l.now !== null ? l.now - l.start : null;

  return (
    <>
      <View style={styles.kpis}>
        <Kpi
          label="People"
          icon={<PeopleIcon />}
          chip={r.joined ? `+${r.joined}` : null}
          value={String(r.people)}
          line={`${r.joined} joined in ${periodLabel} · ${r.paired} with the phone paired`}
        />
        <Kpi
          label="Talks"
          icon={<TalkIcon />}
          chip={talks !== null && talksBefore !== null ? signed(talks - talksBefore) : null}
          value={talks === null ? '—' : one(talks)}
          unit="days / week"
          line="Per person with a paired phone, on average"
        />
        <Kpi
          label="Pills"
          icon={<PillIcon color="#fff" size={20} />}
          chip={pills !== null && pillsBefore !== null ? `${signed(pills - pillsBefore, 0)} pts` : null}
          value={pills === null ? '—' : `${pills} %`}
          unit={pills === null ? undefined : 'confirmed'}
          line={pills === null ? 'No pills set up' : `${r.doses_taken} of ${r.doses_due} doses`}
        />
        <Kpi
          dark
          label="Loneliness"
          icon={<ScaleIcon color={staffColors.ink} />}
          chip={lonelyChange === null ? null : lonelyChange < 0 ? 'Better' : lonelyChange > 0 ? 'Worse' : 'Same'}
          value={lonelyChange !== null ? signed(lonelyChange) : l.first_only !== null ? one(l.first_only) : '—'}
          unit="UCLA-3"
          line={
            lonelyChange !== null
              ? `Since the first check, scale 3 to 9 · ${l.followed} ${l.followed === 1 ? 'person' : 'people'}`
              : l.people
                ? 'Average at the first check · second checks after a month'
                : 'No checks yet: ask the 3 questions on each Person page'
          }
        />
      </View>

      <View style={styles.row}>
        <Engagement weeks={r.weeks.slice(-12)} />
        <Alerts r={r} />
      </View>

      <View style={styles.row}>
        <Carers carers={r.carers} />
        <LonelinessScale l={l} />
      </View>

      <View style={styles.footer}>
        <View style={styles.footIcon}>
          <LockIcon />
        </View>
        <Text style={styles.footText}>Totals only. The report never includes talks, audio or stories.</Text>
      </View>
    </>
  );
}

function Kpi(props: {
  label: string;
  icon: ReactNode;
  chip: string | null;
  value: string;
  unit?: string;
  line: string;
  dark?: boolean;
}) {
  const d = props.dark;
  return (
    <View style={[styles.kpi, d && styles.kpiDark]} accessibilityLabel={props.label}>
      <View style={styles.kpiHead}>
        <View style={styles.cardHead}>
          <View style={d ? styles.iconLight : styles.iconDark}>{props.icon}</View>
          <Text style={[styles.cardLabel, d && styles.onDarkMuted]}>{props.label}</Text>
        </View>
        {props.chip ? (
          <View style={d ? styles.chipLight : styles.chipDark}>
            <Text style={[styles.chipText, d && styles.chipTextDark]}>{props.chip}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, d && styles.onDark]}>{props.value}</Text>
        {props.unit ? <Text style={[styles.unit, d && styles.onDarkMuted]}>{props.unit}</Text> : null}
      </View>
      <Text style={[styles.line, d && styles.onDarkMuted]}>{props.line}</Text>
    </View>
  );
}

const CHART = 230;

function Engagement({ weeks }: { weeks: Report['weeks'] }) {
  const values = weeks.map((w) => (w.people ? Math.round((100 * w.engaged) / w.people) : 0));
  const summary = weeks.length
    ? `From ${values[0]} % in the week of ${short(weeks[0].monday)} to ${values[values.length - 1]} % in the week of ${short(weeks[weeks.length - 1].monday)}, goal ${GOAL} %`
    : 'No weeks yet';
  return (
    <View style={[styles.greyCard, styles.wide]} accessibilityLabel="Engagement per week">
      <View style={styles.cardHeadRow}>
        <View style={styles.cardHead}>
          <View style={styles.iconDark}>
            <TalkIcon />
          </View>
          <View>
            <Text style={styles.cardLabel}>Engagement</Text>
            <Text style={styles.cardTitle}>People who talk 4+ days a week</Text>
          </View>
        </View>
        <Text style={styles.small}>{weeks.length === 1 ? '1 week' : `${weeks.length} weeks`}</Text>
      </View>
      {weeks.length ? (
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={summary}>
          <View style={[styles.goalLine, { bottom: 46 + (CHART * GOAL) / 100 }]} />
          <View style={[styles.goalTag, { bottom: 54 + (CHART * GOAL) / 100 }]}>
            <Text style={styles.goalText}>{`Goal ${GOAL} %`}</Text>
          </View>
          {weeks.map((w, i) => {
            const last = i === weeks.length - 1;
            return (
              <View key={w.monday} style={styles.barCol}>
                <Text style={[styles.barValue, last && styles.bold]}>{`${values[i]} %`}</Text>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(8, (CHART * values[i]) / 100) },
                    last ? styles.barOn : values[i] >= GOAL ? styles.barGood : null,
                  ]}
                />
                <Text style={styles.barLabel}>{w.partial ? `${short(w.monday)} · so far` : short(w.monday)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.line}>Weeks show up once someone has a paired phone.</Text>
      )}
    </View>
  );
}

function Alerts({ r }: { r: Report }) {
  const max = Math.max(1, ...KINDS.map(([k]) => r.alerts_by_kind[k] ?? 0));
  const pct = r.alerts ? Math.round((100 * r.alerts_same_day) / r.alerts) : null;
  return (
    <View style={[styles.darkCard, styles.narrow]} accessibilityLabel="Alerts">
      <View style={styles.cardHead}>
        <View style={styles.iconLight}>
          <BellIcon color={staffColors.ink} size={20} />
        </View>
        <Text style={[styles.cardLabel, styles.onDarkMuted]}>Alerts</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, styles.onDark]}>{r.alerts}</Text>
        <Text style={[styles.unit, styles.onDarkMuted]}>
          {pct === null ? 'none in this period' : `${pct} % solved the same day`}
        </Text>
      </View>
      <View style={styles.kinds}>
        {KINDS.map(([k, label]) => {
          const n = r.alerts_by_kind[k] ?? 0;
          return (
            <View key={k} style={styles.kind}>
              <View style={styles.kindRow}>
                <Text style={styles.kindText}>{label}</Text>
                <Text style={[styles.kindText, styles.bold]}>{n}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(100 * n) / max}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
      <Text style={[styles.small, styles.onDarkMuted]}>
        {"Each day on Today's list counts once. Solved = marked Done that day."}
      </Text>
    </View>
  );
}

function Carers({ carers }: { carers: Report['carers'] }) {
  return (
    <View style={[styles.lineCard, styles.wide]} accessibilityLabel="By carer">
      <View style={styles.cardHead}>
        <View style={styles.iconGrey}>
          <PeopleIcon color={staffColors.ink} />
        </View>
        <Text style={styles.cardLabel}>By carer</Text>
      </View>
      <View style={styles.tHead}>
        <Text style={[styles.th, styles.tName]}>Carer</Text>
        <Text style={[styles.th, styles.tNum]}>People</Text>
        <Text style={[styles.th, styles.tNum]}>Alerts</Text>
        <Text style={[styles.th, styles.tBar]}>Solved the same day</Text>
        <Text style={[styles.th, styles.tNum]}>Calls</Text>
      </View>
      {carers.map((c) => {
        const pct = c.alerts ? Math.round((100 * c.same_day) / c.alerts) : null;
        const initials = c.name
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        return (
          <View key={c.user_id} style={styles.tRow}>
            <View style={[styles.tName, styles.carer]}>
              <View style={styles.initials}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
              <Text style={styles.td} numberOfLines={1}>
                {c.name}
              </Text>
            </View>
            <Text style={[styles.td, styles.tNum]}>{c.people}</Text>
            <Text style={[styles.td, styles.tNum]}>{c.alerts}</Text>
            <View style={[styles.tBar, styles.barCell]}>
              <View style={styles.trackLight}>
                <View style={[styles.fillDark, { width: `${pct ?? 0}%` }]} />
              </View>
              <Text style={[styles.td, styles.bold]}>{pct === null ? '—' : `${pct} %`}</Text>
            </View>
            <Text style={[styles.td, styles.tNum]}>{c.calls}</Text>
          </View>
        );
      })}
      <Text style={styles.small}>Calls = people marked Done on Today by this carer.</Text>
    </View>
  );
}

function LonelinessScale({ l }: { l: Report['loneliness'] }) {
  // 3 (less lonely) on the left, 9 on the right
  const at = (v: number) => `${((v - 3) / 6) * 100}%` as const;
  const both = l.start !== null && l.now !== null;
  return (
    <View style={[styles.greyCard, styles.narrow]} accessibilityLabel="Loneliness score">
      <View style={styles.cardHead}>
        <View style={styles.iconDark}>
          <ScaleIcon color="#fff" />
        </View>
        <Text style={styles.cardLabel}>Loneliness score</Text>
      </View>
      {both ? (
        <View
          accessibilityRole="image"
          accessibilityLabel={`Average went from ${one(l.start!)} at the first check to ${one(l.now!)} now, on a scale from 3 to 9`}>
          <View style={styles.scale}>
            <View style={styles.scaleTrack} />
            <View
              style={[
                styles.scaleSpan,
                { left: at(Math.min(l.start!, l.now!)), width: `${(Math.abs(l.start! - l.now!) / 6) * 100}%` },
              ]}
            />
            <View style={[styles.dotStart, { left: at(l.start!) }]} />
            <View style={[styles.dotNow, { left: at(l.now!) }]} />
            <Text style={[styles.scaleTag, styles.tagTop, { left: at(l.start!) }]}>{`Start ${one(l.start!)}`}</Text>
            <Text style={[styles.scaleTag, styles.tagBottom, styles.bold, { left: at(l.now!) }]}>{`Now ${one(l.now!)}`}</Text>
          </View>
          <View style={styles.scaleEnds}>
            <Text style={styles.small}>3 · less lonely</Text>
            <Text style={styles.small}>9 · more lonely</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.cardTitle}>
          {l.people
            ? `${l.people} ${l.people === 1 ? 'person' : 'people'} with a first check (average ${one(l.first_only ?? 0)}). The change shows after the second, a month later.`
            : 'No checks yet.'}
        </Text>
      )}
      <Text style={styles.line}>Three short questions at sign-up and every month, answered with her carer.</Text>
    </View>
  );
}

/** The report as a CSV file: one "section,metric,value" line per number (web only). */
function downloadCsv(r: Report, p: Period, org: string) {
  const rows: (string | number | null)[][] = [['section', 'metric', 'value']];
  const add = (section: string, metric: string, value: string | number | null) => rows.push([section, metric, value]);
  add('period', 'organisation', org);
  add('period', 'from', p.from);
  add('period', 'to', p.to);
  add('people', 'people', r.people);
  add('people', 'joined', r.joined);
  add('people', 'phone paired', r.paired);
  add('talks', 'days with a talk per week', r.paired_days ? one((r.talk_days / r.paired_days) * 7) : null);
  add('pills', 'doses due', r.doses_due);
  add('pills', 'doses confirmed', r.doses_taken);
  add('alerts', 'total', r.alerts);
  add('alerts', 'solved the same day', r.alerts_same_day);
  for (const [k, label] of KINDS) add('alerts', label, r.alerts_by_kind[k] ?? 0);
  for (const w of r.weeks) add('engagement', `week of ${w.monday}${w.partial ? ' (so far)' : ''}`, `${w.engaged} of ${w.people}`);
  for (const c of r.carers) {
    add(`carer ${c.name}`, 'people', c.people);
    add(`carer ${c.name}`, 'alerts', c.alerts);
    add(`carer ${c.name}`, 'solved the same day', c.same_day);
    add(`carer ${c.name}`, 'calls', c.calls);
  }
  add('loneliness', 'people with a check', r.loneliness.people);
  add('loneliness', 'people with 2+ checks', r.loneliness.followed);
  add('loneliness', 'average at first check (2+ checks)', r.loneliness.start);
  add('loneliness', 'average now (2+ checks)', r.loneliness.now);
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((row) => row.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `hilo-report-${p.key === 'all' ? 'pilot' : p.from.slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PeopleIcon({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7}>
      <Circle cx={9} cy={8} r={3.2} />
      <Path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" strokeLinecap="round" />
      <Circle cx={17} cy={9} r={2.4} />
      <Path d="M16 14.2c2.4.2 4 1.8 4.5 4.3" strokeLinecap="round" />
    </Svg>
  );
}

function TalkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round">
      <Path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-8l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" />
    </Svg>
  );
}

function ScaleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
      <Path d="M4 16h16" />
      <Circle cx={8} cy={16} r={2.4} fill={color} />
      <Path d="M6 10.5c1.2-2 2.9-3 6-3s4.8 1 6 3" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={staffColors.ink} strokeWidth={1.8}>
      <Rect x={5} y={10.5} width={14} height={10} rx={2} />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </Svg>
  );
}

const card = { borderRadius: 28, paddingVertical: 24, paddingHorizontal: 28, gap: 20, minWidth: 0 } as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 48, paddingHorizontal: 56, paddingBottom: 64, gap: 32, maxWidth: 1320 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 },
  titles: { gap: 10 },
  h1: { fontFamily: staffFont, fontSize: 44, lineHeight: 46, fontWeight: '500', letterSpacing: -1.5, color: staffColors.ink },
  headerRight: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 99, backgroundColor: staffColors.block },
  seg: { minHeight: 40, paddingHorizontal: 16, borderRadius: 99, justifyContent: 'center' },
  segOn: { minHeight: 40, paddingHorizontal: 16, borderRadius: 99, justifyContent: 'center', backgroundColor: staffColors.ink },
  segText: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink },
  segTextOn: { color: '#fff' },
  outline: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.ink,
    justifyContent: 'center',
  },
  outlineText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  kpi: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 230,
    minWidth: 0,
    backgroundColor: staffColors.block,
    borderRadius: 28,
    padding: 24,
    gap: 18,
  },
  kpiDark: { backgroundColor: staffColors.ink },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeadRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  iconDark: { width: 40, height: 40, borderRadius: 99, backgroundColor: staffColors.ink, alignItems: 'center', justifyContent: 'center' },
  iconLight: { width: 40, height: 40, borderRadius: 99, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  iconGrey: { width: 40, height: 40, borderRadius: 99, backgroundColor: staffColors.active, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontFamily: staffFont, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase', color: staffColors.soft },
  cardTitle: { fontFamily: staffFont, fontSize: 17, lineHeight: 23, fontWeight: '500', color: staffColors.ink },
  chipDark: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 99, backgroundColor: staffColors.ink },
  chipLight: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 99, backgroundColor: '#fff' },
  chipText: { fontFamily: staffFont, fontSize: 13, color: '#fff', fontVariant: ['tabular-nums'] },
  chipTextDark: { color: staffColors.ink },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  value: {
    fontFamily: staffFont,
    fontSize: 52,
    lineHeight: 54,
    fontWeight: '500',
    letterSpacing: -2,
    color: staffColors.ink,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: staffFont, fontSize: 16, color: staffColors.soft },
  line: { fontFamily: staffFont, fontSize: 15, lineHeight: 21, color: staffColors.soft },
  small: { fontFamily: staffFont, fontSize: 13, lineHeight: 18, color: staffColors.soft },
  onDark: { color: '#fff' },
  onDarkMuted: { color: '#bdbdbd' },
  bold: { fontWeight: '600' },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' },
  wide: { flexGrow: 2, flexShrink: 1, flexBasis: 520 },
  narrow: { flexGrow: 1, flexShrink: 1, flexBasis: 320 },
  greyCard: { ...card, backgroundColor: staffColors.block },
  darkCard: { ...card, backgroundColor: staffColors.ink },
  lineCard: { ...card, borderWidth: 1, borderColor: '#e3e3e3', gap: 12 },

  chart: { height: CHART + 76, flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 30 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: staffColors.ink },
  goalTag: { position: 'absolute', right: 0, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 99, backgroundColor: staffColors.ink },
  goalText: { fontFamily: staffFont, fontSize: 12, color: '#fff' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 },
  barValue: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  bar: { width: '100%', maxWidth: 56, borderRadius: 99, backgroundColor: '#d6d6d3' },
  barGood: { backgroundColor: '#8f8f8b' },
  barOn: { backgroundColor: staffColors.ink },
  barLabel: { fontFamily: staffFont, fontSize: 12, color: staffColors.soft, textAlign: 'center', minHeight: 30 },

  kinds: { gap: 16 },
  kind: { gap: 6 },
  kindRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kindText: { fontFamily: staffFont, fontSize: 16, color: '#fff', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 99, backgroundColor: staffColors.soft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99, backgroundColor: '#fff' },

  tHead: { flexDirection: 'row', gap: 12, paddingTop: 8, paddingBottom: 4 },
  th: { fontFamily: staffFont, fontSize: 13, color: staffColors.soft },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#ececec' },
  tName: { flexGrow: 2, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  tNum: { flexGrow: 0, flexShrink: 0, flexBasis: 64 },
  tBar: { flexGrow: 2, flexShrink: 1, flexBasis: 170, minWidth: 0 },
  td: { fontFamily: staffFont, fontSize: 16, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  carer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  initials: { width: 36, height: 36, borderRadius: 99, backgroundColor: staffColors.active, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: staffFont, fontSize: 13, fontWeight: '700', color: staffColors.ink },
  barCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackLight: { flex: 1, height: 8, borderRadius: 99, backgroundColor: '#ececec', overflow: 'hidden' },
  fillDark: { height: 8, borderRadius: 99, backgroundColor: staffColors.ink },

  scale: { height: 64, marginTop: 8, marginHorizontal: 12 },
  scaleTrack: { position: 'absolute', left: 0, right: 0, top: 30, height: 4, borderRadius: 99, backgroundColor: '#dcdcd9' },
  scaleSpan: { position: 'absolute', top: 30, height: 4, backgroundColor: staffColors.ink },
  dotStart: {
    position: 'absolute',
    top: 20,
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 99,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: staffColors.ink,
  },
  dotNow: { position: 'absolute', top: 20, width: 24, height: 24, marginLeft: -12, borderRadius: 99, backgroundColor: staffColors.ink },
  scaleTag: { position: 'absolute', width: 90, marginLeft: -45, textAlign: 'center', fontFamily: staffFont, fontSize: 13, color: staffColors.soft },
  tagTop: { top: 0 },
  tagBottom: { top: 48, color: staffColors.ink },
  scaleEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footIcon: { width: 32, height: 32, borderRadius: 99, backgroundColor: staffColors.active, alignItems: 'center', justifyContent: 'center' },
  footText: { fontFamily: staffFont, fontSize: 14, color: staffColors.soft },
});
