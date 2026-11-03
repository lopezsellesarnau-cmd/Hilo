import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { BotFace } from '@/components/icons';
import { colors, fontWeight } from '@/theme';

/** Black, grey, light, then again: the title left or right, the bot peeking out on the other side */
const LOOKS = [
  { ground: colors.ink, clear: 'rgba(0,0,0,0)', ink: colors.onAccent, soft: '#a8a8a8', right: false, face: colors.background, eyes: '#111111' },
  { ground: '#4a4a4a', clear: 'rgba(74,74,74,0)', ink: colors.onAccent, soft: '#d0d0d0', right: true, face: colors.background, eyes: '#111111' },
  { ground: '#dcdcdc', clear: 'rgba(220,220,220,0)', ink: colors.ink, soft: '#4a4a4a', right: true, face: colors.ink, eyes: colors.background },
] as const;

/** Height of a chapter card, in both books */
export const CHAPTER_CARD = 189;

type Props = {
  title: string;
  /** Which card in the book (0 first): picks its colour */
  index: number;
  /** "01" at the bottom, in her book */
  number?: number;
};

/** A chapter of her book as a card (Figma "Hilo book"): the family's stack and her Mi libro */
export function ChapterCard({ title, index, number }: Props) {
  const look = LOOKS[index % LOOKS.length];
  const side = look.right ? styles.right : styles.left;
  return (
    <View style={[styles.card, { backgroundColor: look.ground }]}>
      <Text style={[styles.title, side, { color: look.ink }]} numberOfLines={2}>
        {title}
      </Text>
      <View style={[styles.bot, look.right ? styles.botLeft : styles.botRight]}>
        <BotFace size={173} face={look.face} eyes={look.eyes} />
      </View>
      {/* The bot fades into the card at the bottom, like in the Figma */}
      <LinearGradient colors={[look.clear, look.ground]} style={styles.shade} pointerEvents="none" />
      {number ? <Text style={[styles.number, side, { color: look.soft }]}>{String(number).padStart(2, '0')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CHAPTER_CARD,
    borderRadius: 28,
    overflow: 'hidden',
  },
  title: {
    position: 'absolute',
    top: 14,
    maxWidth: '78%',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  left: {
    left: 22,
  },
  right: {
    right: 22,
    textAlign: 'right',
  },
  bot: {
    position: 'absolute',
    top: 57,
  },
  botRight: {
    right: 20,
  },
  botLeft: {
    left: 34,
  },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  number: {
    position: 'absolute',
    bottom: 16,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
});
