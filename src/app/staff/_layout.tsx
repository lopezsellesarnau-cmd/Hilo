import { Redirect, Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { StaffContext, useStaffSession } from '@/staff/session';
import { Sidebar } from '@/staff/sidebar';
import { staffColors, staffFont, staffText } from '@/staff/theme';

/**
 * Staff web (organisations). Web only, and only for accounts in org_members: everything below /staff goes
 * through here. It shares nothing with the family and senior screens except the Supabase client.
 */
export default function StaffLayout() {
  const session = useStaffSession();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  // The phone app never shows the staff pages (App Review included)
  if (Platform.OS !== 'web') return <Redirect href="/" />;

  const head = (
    <Head>
      <title>Hilo for organisations</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );

  if (session.status === 'loading') return <View style={styles.page}>{head}</View>;

  if (pathname === '/staff/login') {
    if (session.status === 'staff') return <Redirect href="/staff" />;
    return (
      <>
        {head}
        <Slot />
      </>
    );
  }

  if (session.status === 'signedOut') return <Redirect href="/staff/login" />;

  if (session.status === 'notStaff') {
    return (
      <View style={[styles.page, styles.center]}>
        {head}
        <View style={styles.box}>
          <Text style={staffText.title}>Not a staff account</Text>
          <Text style={[staffText.body, styles.gap]}>
            {`${session.email} is signed in, but it isn't part of an organisation on Hilo. Sign out and use your work email.`}
          </Text>
          <Pressable onPress={() => supabase.auth.signOut()} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <StaffContext.Provider value={session.member}>
      {head}
      <View style={styles.shell}>
        {/* Below 900 px the menu keeps only its icons */}
        <Sidebar me={session.member} compact={width < 900} />
        <View style={styles.main}>
          <Slot />
        </View>
      </View>
    </StaffContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: staffColors.page },
  main: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 440 },
  gap: { marginTop: 16, color: staffColors.soft },
  button: {
    marginTop: 32,
    alignSelf: 'flex-start',
    backgroundColor: staffColors.ink,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  buttonText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
});
