import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { colors, family, fontWeight } from '@/theme';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** "Acepto los Términos y la Política de privacidad", with links that open in the app. */
export function AgreeBox({ checked, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="Acepto los Términos y la Política de privacidad"
        hitSlop={10}
        style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </Pressable>
      <Text style={styles.text}>
        Acepto los{' '}
        <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} accessibilityRole="link">
          Términos
        </Text>{' '}
        y la{' '}
        <Text style={styles.link} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} accessibilityRole="link">
          Política de privacidad
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  box: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  boxOn: {
    backgroundColor: colors.sage,
  },
  tick: {
    fontSize: 18,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  text: {
    flex: 1,
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  link: {
    color: colors.ink,
    fontWeight: fontWeight.semibold,
    textDecorationLine: 'underline',
  },
});
