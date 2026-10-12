import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, family, spacing } from '@/theme';

const bookIcon = require('../../../assets/icons/book.svg');

/** Libro: the chapters to review. Empty until the daily talks start. */
export default function FamilyBookScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          Libro
        </Text>
        <View style={styles.empty}>
          <Image source={bookIcon} style={styles.book} contentFit="contain" />
          <Text style={styles.emptyTitle}>Aún no hay historias</Text>
          <Text style={styles.emptyText}>
            Cuando empiece a charlar con Hilo, aquí aparecerán sus historias para que las revises.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
  },
  title: {
    fontSize: family.fontSize.title,
    fontWeight: '700',
    color: colors.ink,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 60,
  },
  book: {
    width: 92,
    height: 113,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyText: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
});
