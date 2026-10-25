import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { signalText, useStaffPeople, useStaffSignals, type StaffPerson, type StaffSignal } from '@/staff/data';
import { BotMark } from '@/staff/icons';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';

const today = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const since = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Today: who to call. Seniors with an alert (staff_signals) go to "Needs a call", everyone else below.
 * Alerts are worked out when the page loads, so someone who talked this morning is already off the list.
 */
export default function Today() {
  const me = useStaff();
  const people = useStaffPeople();
  const signals = useStaffSignals();
  const data = people.data && signals.data ? people.data : null;
  const error = people.error || signals.error;
  const reload = () => {
    people.reload();
    signals.reload();
  };

  const alertsFor = (id: string) => (signals.data ?? []).filter((s) => s.person_id === id);
  const seniors = (data ?? []).filter((p) => p.role === 'senior');
  const toCall = seniors.filter((p) => alertsFor(p.id).length);
  const fine = seniors.filter((p) => !alertsFor(p.id).length);
  const familyCount = (familyId: string) =>
    (data ?? []).filter((p) => p.role === 'member' && p.family_id === familyId).length;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={staffText.label}>{today()}</Text>
          <Text style={styles.h1} accessibilityRole="header">
            Who to call today
          </Text>
        </View>
        {seniors.length ? (
          <View style={styles.headerRight}>
            <View style={styles.stack} accessibilityLabel={`${seniors.length} people`}>
              {/* Who needs a call first */}
              {[...toCall, ...fine].slice(0, 5).map((p, i) => (
                <View key={p.id} style={[styles.stackItem, { marginLeft: i ? -14 : 0, zIndex: 10 - i }]}>
                  <BotMark size={52} />
                </View>
              ))}
            </View>
            <View>
              <Text style={styles.headerCount}>{toCall.length} to call</Text>
              <Text style={staffText.note}>
                Updated now · {seniors.length} {seniors.length === 1 ? 'person' : 'people'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.card}>
          <Text style={staffText.body}>{"The list didn't load. Check the connection and try again."}</Text>
          <Pressable onPress={reload} style={styles.ghost} accessibilityRole="button">
            <Text style={styles.ghostText}>Try again</Text>
          </Pressable>
        </View>
      ) : !data ? (
        <Text style={staffText.note}>Loading…</Text>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.h2}>Needs a call</Text>
            {toCall.length ? (
              toCall.map((p) => (
                <Row key={p.id} person={p} family={familyCount(p.family_id)} alerts={alertsFor(p.id)} />
              ))
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nobody needs a call today</Text>
                <Text style={staffText.note}>
                  Someone shows up here after 2 days without talking to Hilo, a pill not confirmed yesterday, or 5
                  days without a family call.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.h2}>
              No alerts · {fine.length} of {seniors.length} at {me.orgName}
            </Text>
            {seniors.length ? (
              fine.map((p) => <Row key={p.id} person={p} family={familyCount(p.family_id)} alerts={[]} />)
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nobody here yet</Text>
                <Text style={staffText.note}>People you add with New person will show up here.</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Row({ person, family, alerts }: { person: StaffPerson; family: number; alerts: StaffSignal[] }) {
  return (
    <View style={[styles.row, alerts.length > 0 && styles.rowAlert]}>
      <View style={styles.avatar}>
        <BotMark size={31} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>{person.display_name}</Text>
        <Text style={staffText.note}>
          Since {since(person.created_at)} · {family ? `${family} in family` : 'No family yet'}
        </Text>
      </View>
      {alerts.length ? (
        <View style={styles.chips}>
          {alerts.map((a) => (
            <View key={a.kind} style={styles.chipAlert}>
              <Text style={styles.chipText}>{signalText(a)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.chip, !person.paired && styles.chipWarn]}>
          <Text style={styles.chipText}>{person.paired ? 'Phone paired' : 'Phone not paired'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 48, paddingHorizontal: 56, paddingBottom: 64, gap: 40, maxWidth: 1100 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 },
  titles: { gap: 10 },
  h1: { fontFamily: staffFont, fontSize: 44, lineHeight: 46, fontWeight: '500', letterSpacing: -1.5, color: staffColors.ink },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stack: { flexDirection: 'row' },
  stackItem: { borderRadius: 99, borderWidth: 3, borderColor: staffColors.page },
  headerCount: { fontFamily: staffFont, fontSize: 14, fontWeight: '500', color: staffColors.ink },
  section: { gap: 12 },
  h2: { ...staffText.label, fontWeight: '400', marginBottom: 4 },
  empty: { padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#ececec', gap: 6 },
  emptyTitle: { fontFamily: staffFont, fontSize: 17, fontWeight: '500', color: staffColors.ink },
  card: { padding: 24, borderRadius: 20, backgroundColor: staffColors.block, gap: 16 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 160, gap: 2 },
  name: { fontFamily: staffFont, fontSize: 17, fontWeight: '500', color: staffColors.ink },
  rowAlert: { backgroundColor: staffColors.block, borderColor: staffColors.block },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipAlert: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3e3e3' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#e3e3e3' },
  chipWarn: { backgroundColor: staffColors.block, borderColor: staffColors.block },
  chipText: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink },
  ghost: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.ink,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  ghostText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
});
