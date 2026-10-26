import { Link, usePathname, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';

import { AddPersonIcon, BotMark, ReportsIcon, SignOutIcon, TodayIcon } from './icons';
import type { StaffMember } from './session';
import { staffColors, staffFont } from './theme';

type Item = { label: string; icon: ReactNode; href?: Href; badge?: string };

/** Pages that exist link; the rest show "Soon" until their step is built. */
const groups: { title?: string; items: Item[] }[] = [
  { items: [{ label: 'Today', icon: <TodayIcon />, href: '/staff' }] },
  {
    title: 'Care',
    items: [
      { label: 'People', icon: <BotMark size={20} />, href: '/staff/people' },
      { label: 'New person', icon: <AddPersonIcon />, href: '/staff/new' },
    ],
  },
  { title: 'Measure', items: [{ label: 'Reports', icon: <ReportsIcon />, href: '/staff/reports' }] },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/**
 * One menu row. Hover lives in state, not in a style function: Link asChild drops a function style,
 * and the row lost its icon-left layout.
 */
function NavItem({ item, active, compact }: { item: Item; active: boolean; compact: boolean }) {
  const [hovered, setHovered] = useState(false);
  const row = (
    <Pressable
      disabled={!item.href}
      accessibilityLabel={item.label}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      // Flattened: Link asChild (expo-router's Slot) warns about style arrays
      style={StyleSheet.flatten([
        styles.item,
        compact && styles.itemCompact,
        active && styles.itemActive,
        hovered && item.href && !active && styles.itemHover,
      ])}>
      <View style={!item.href && styles.soon}>{item.icon}</View>
      {compact ? null : (
        <>
          <Text style={[styles.itemText, active && styles.itemTextActive, !item.href && styles.soon]}>
            {item.label}
          </Text>
          {item.href ? null : <Text style={styles.soonTag}>Soon</Text>}
        </>
      )}
    </Pressable>
  );
  return item.href ? (
    <Link href={item.href} asChild>
      {row}
    </Link>
  ) : (
    row
  );
}

export function Sidebar({ me, compact }: { me: StaffMember; compact: boolean }) {
  const pathname = usePathname();

  return (
    <View style={[styles.nav, compact && styles.navCompact]} accessibilityRole="menu">
      <View style={styles.brand}>
        <BotMark size={28} />
        {compact ? null : <Text style={styles.brandText}>Hilo</Text>}
      </View>

      {compact ? null : (
        <View style={styles.org}>
          <View style={styles.orgBadge}>
            <Text style={styles.orgLetter}>{me.orgName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={styles.orgName} numberOfLines={1}>
            {me.orgName}
          </Text>
        </View>
      )}

      {groups.map((g, gi) => (
        <View key={gi} style={styles.group}>
          {g.title && !compact ? <Text style={styles.groupTitle}>{g.title}</Text> : null}
          {g.items.map((item) => (
            <NavItem key={item.label} item={item} active={item.href === pathname} compact={compact} />
          ))}
        </View>
      ))}

      <View style={[styles.me, compact && styles.meCompact]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(me.name)}</Text>
        </View>
        {compact ? null : (
          <View style={styles.meText}>
            <Text style={styles.meName} numberOfLines={1}>
              {me.name}
            </Text>
            <Text style={styles.meRole}>{me.role === 'admin' ? 'Coordinator' : 'Carer'}</Text>
          </View>
        )}
        <Pressable
          onPress={() => supabase.auth.signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ hovered }) => [styles.signOut, hovered && styles.itemHover]}>
          <SignOutIcon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    width: 240,
    borderRightWidth: 1,
    borderRightColor: '#ececec',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 20,
    backgroundColor: staffColors.page,
  },
  navCompact: { width: 76, paddingHorizontal: 12, alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, minHeight: 44 },
  brandText: { fontFamily: staffFont, fontSize: 22, fontWeight: '500', letterSpacing: -0.7, color: staffColors.ink },
  org: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e3e3e3',
    borderRadius: 12,
  },
  orgBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLetter: { fontFamily: staffFont, fontSize: 13, fontWeight: '700', color: '#fff' },
  orgName: { flex: 1, fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
  group: { gap: 2 },
  groupTitle: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    fontFamily: staffFont,
    fontSize: 13,
    color: staffColors.muted,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemCompact: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  itemActive: { backgroundColor: staffColors.active },
  itemHover: { backgroundColor: '#f7f7f5' },
  itemText: { flex: 1, fontFamily: staffFont, fontSize: 15, color: staffColors.soft },
  itemTextActive: { color: staffColors.ink },
  soon: { opacity: 0.45 },
  soonTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: staffColors.active,
    fontFamily: staffFont,
    fontSize: 12,
    color: staffColors.muted,
  },
  me: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#ececec',
  },
  meCompact: { flexDirection: 'column', paddingHorizontal: 0 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 99,
    backgroundColor: staffColors.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: staffFont, fontSize: 13, fontWeight: '700', color: staffColors.ink },
  meText: { flex: 1 },
  meName: { fontFamily: staffFont, fontSize: 14, fontWeight: '500', color: staffColors.ink },
  meRole: { fontFamily: staffFont, fontSize: 13, color: staffColors.muted },
  signOut: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
