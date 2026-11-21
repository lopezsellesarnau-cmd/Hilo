import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  clock,
  markDone,
  signalText,
  undoDone,
  useStaffActionsToday,
  useStaffPeople,
  useStaffSignals,
  type StaffAction,
  type StaffPerson,
  type StaffSignal,
} from '@/staff/data';
import { toast } from '@/components/toast';
import { PersonBot, shapesFor } from '@/staff/icons';
import type { BotShape } from '@/components/live-bot';
import { useStaff } from '@/staff/session';
import { WhyPanel } from '@/staff/why-panel';
import { staffColors, staffFont, staffText } from '@/staff/theme';

const today = () =>
  new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

const since = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * Today: who to call. Seniors with an alert (staff_signals) go to "Needs a call", everyone else below.
 * Alerts are worked out when the page loads, so someone who talked this morning is already off the list.
 */
export default function Today() {
  const me = useStaff();
  const people = useStaffPeople();
  const signals = useStaffSignals();
  const actions = useStaffActionsToday();
  const [picked, setPicked] = useState<string | null>(null);
  const data = people.data && signals.data && actions.data ? people.data : null;
  const error = people.error || signals.error || actions.error;
  const reload = () => {
    people.reload();
    signals.reload();
    actions.reload();
  };

  const alertsFor = (id: string) => (signals.data ?? []).filter((s) => s.person_id === id);
  const seniors = (data ?? []).filter((p) => p.role === 'senior');
  const shapes = shapesFor(seniors);
  // Newest "Done" today for this person (actions come newest first)
  const doneFor = (id: string) => (actions.data ?? []).find((a) => a.person_id === id);
  const flagged = seniors.filter((p) => alertsFor(p.id).length);
  // Still to call first, then the ones already done today
  const toCall = [...flagged.filter((p) => !doneFor(p.id)), ...flagged.filter((p) => doneFor(p.id))];
  const open = flagged.filter((p) => !doneFor(p.id));
  const fine = seniors.filter((p) => !alertsFor(p.id).length);
  const selected = seniors.find((p) => p.id === picked) ?? open[0] ?? toCall[0];
  const selectedDone = selected && doneFor(selected.id);
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
                  <PersonBot shape={shapes[p.id]} size={41} />
                </View>
              ))}
            </View>
            <View>
              <Text style={styles.headerCount}>{open.length} to call</Text>
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
        <View style={styles.body}>
          <View style={styles.lists}>
            <View style={styles.section}>
              <Text style={styles.h2}>Needs a call</Text>
              {toCall.length ? (
                toCall.map((p) => (
                  <Row
                    key={p.id}
                    person={p}
                    shape={shapes[p.id]}
                    family={familyCount(p.family_id)}
                    alerts={alertsFor(p.id)}
                    done={doneFor(p.id)}
                    selected={p.id === selected?.id}
                    onPick={() => setPicked(p.id)}
                  />
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
                fine.map((p) => (
                  <Row
                    key={p.id}
                    person={p}
                    shape={shapes[p.id]}
                    family={familyCount(p.family_id)}
                    alerts={[]}
                    done={doneFor(p.id)}
                    selected={p.id === selected?.id}
                    onPick={() => setPicked(p.id)}
                  />
                ))
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Nobody here yet</Text>
                  <Text style={staffText.note}>People you add with New person will show up here.</Text>
                </View>
              )}
            </View>
          </View>

          {selected ? (
            <View style={styles.aside}>
              <WhyPanel
                key={selected.id}
                person={selected}
                family={(data ?? []).filter((p) => p.role === 'member' && p.family_id === selected.family_id)}
                alerts={alertsFor(selected.id)}
                done={selectedDone}
                mine={!!selectedDone && selectedDone.user_id === me.userId}
                onDone={async (note) => {
                  const id = await markDone(selected.id, note);
                  if (!id) return false;
                  actions.reload();
                  // Undo right in the toast, for a Done pressed on the wrong person
                  toast(`${selected.display_name} marked as done`, {
                    action: {
                      label: 'Undo',
                      onPress: async () => {
                        if (!(await undoDone(id))) return toast.error("Couldn't undo. Try again from the panel.");
                        actions.reload();
                        toast('Undone');
                      },
                    },
                  });
                  return true;
                }}
                onUndo={async () => {
                  const ok = selectedDone ? await undoDone(selectedDone.id) : false;
                  if (ok) {
                    actions.reload();
                    toast('Undone');
                  }
                  return ok;
                }}
              />
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

type RowProps = {
  person: StaffPerson;
  family: number;
  alerts: StaffSignal[];
  done: StaffAction | undefined;
  selected: boolean;
  onPick: () => void;
  shape: BotShape | undefined;
};

function Row({ person, family, alerts, done, selected, onPick, shape }: RowProps) {
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={`Why ${person.display_name} is on the list`}
      style={[
        styles.row,
        alerts.length > 0 && !done && styles.rowAlert,
        selected && styles.rowSelected,
        done && alerts.length > 0 && styles.rowDone,
      ]}>
      <View style={styles.avatar}>
        <PersonBot shape={shape} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>{person.display_name}</Text>
        <Text style={staffText.note}>
          Since {since(person.created_at)} · {family ? `${family} in family` : 'No family yet'}
        </Text>
      </View>
      {done && alerts.length ? (
        <Text style={staffText.note}>
          Done · {clock(done.created_at)} · {done.by}
        </Text>
      ) : alerts.length ? (
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: {
    paddingTop: 48,
    paddingHorizontal: 56,
    paddingBottom: 64,
    gap: 40,
    maxWidth: 1320,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 24,
  },
  titles: { gap: 10 },
  h1: {
    fontFamily: staffFont,
    fontSize: 44,
    lineHeight: 46,
    fontWeight: '500',
    letterSpacing: -1.5,
    color: staffColors.ink,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stack: { flexDirection: 'row' },
  // An ink circle like the list's avatars, filled with the page colour so each one hides the bot behind it
  stackItem: {
    width: 58,
    height: 58,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: staffColors.ink,
    backgroundColor: staffColors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCount: {
    fontFamily: staffFont,
    fontSize: 14,
    fontWeight: '500',
    color: staffColors.ink,
  },
  body: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 40,
    alignItems: 'flex-start',
  },
  lists: { flexGrow: 999, flexShrink: 1, flexBasis: 520, minWidth: 0, gap: 40 },
  aside: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 360,
    minWidth: 0,
    maxWidth: 480,
  },
  section: { gap: 12 },
  h2: { ...staffText.label, fontWeight: '400', marginBottom: 4 },
  empty: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ececec',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: staffFont,
    fontSize: 17,
    fontWeight: '500',
    color: staffColors.ink,
  },
  card: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: staffColors.block,
    gap: 16,
  },
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
  name: {
    fontFamily: staffFont,
    fontSize: 17,
    fontWeight: '500',
    color: staffColors.ink,
  },
  rowSelected: { borderColor: staffColors.ink },
  rowDone: { opacity: 0.55 },
  rowAlert: {
    backgroundColor: staffColors.block,
    borderColor: staffColors.block,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipAlert: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },
  chipWarn: {
    backgroundColor: staffColors.block,
    borderColor: staffColors.block,
  },
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
