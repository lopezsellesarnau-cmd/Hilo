import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { colors, fontSize, fontWeight, lineHeight, size, spacing } from '@/theme';

const pill = require('../../assets/icons/pill-small.svg');
const book = require('../../assets/icons/book.svg');

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  // Never a fixed 265: on short screens a fixed bot overlaps the greeting (prototype bug)
  const botSize = Math.min(size.bot, width * 0.7, height * 0.28);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen} bounces={false}>
        <View accessibilityRole="header" style={styles.header}>
          <Text style={styles.title}>¡Hola, Carmen!</Text>
          <Text style={styles.subtitle}>¿Cómo estás?</Text>
        </View>

        <View style={styles.stage}>
          <Bot size={botSize} mood="idle" />
        </View>

        <View style={styles.buttons}>
          <BigButton label="Hablar" accessibilityHint="Empieza la charla de hoy" />
          <BigButton
            variant="outline"
            label="Mis pastillas"
            detail="0 de 3"
            icon={<Image source={pill} style={styles.icon} contentFit="contain" />}
          />
          <BigButton
            variant="outline"
            label="Mi libro"
            icon={<Image source={book} style={styles.bookIcon} contentFit="contain" />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.subtitle,
    lineHeight: lineHeight.subtitle,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  buttons: {
    gap: spacing.buttonGap,
  },
  icon: {
    width: size.pillIconSmall,
    height: size.pillIconSmall,
  },
  bookIcon: {
    // Figma book is 230 × 282; keep its proportion at button size
    width: 26,
    height: 32,
  },
});
