import { Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';

/** Placeholder until the Today page: proves sign-in and the organisation check work. */
export default function StaffHome() {
  const me = useStaff();

  return (
    <View style={styles.page}>
      <Text style={staffText.label}>{me.orgName}</Text>
      <Text style={[staffText.title, styles.title]}>Hello, {me.name}</Text>
      <Text style={staffText.note}>
        {me.email} · {me.role}
      </Text>
      <Pressable onPress={() => supabase.auth.signOut()} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page, padding: 48 },
  title: { marginTop: 10, marginBottom: 8 },
  button: {
    marginTop: 32,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: staffColors.line,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: { fontFamily: staffFont, fontSize: 14, fontWeight: '500', color: staffColors.ink },
});
