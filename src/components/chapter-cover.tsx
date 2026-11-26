import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { chapterShape } from '@/components/chapter-card';
import { LiveBot } from '@/components/live-bot';
import { colors } from '@/theme';

/** Quiet tones for the covers, one per chapter, round and round (no colour in v2) */
// all light: on the black page a dark cover read as a shadow block
const TONES = ['#ffffff', '#e9e7e2', '#d9d6cf', '#f2f2f0', '#cfcbc2', '#ecebe7'];

/**
 * A chapter's cover in her book: its first photo, or else a Bot shape, big and calm, on a quiet tone.
 * `index` keeps each chapter's tone and shape the same everywhere. `size` scales the Bot (the thumbnail is small).
 */
export function ChapterCover({ index, photo, size = 120 }: { index: number; photo?: string; size?: number }) {
  const tone = TONES[index % TONES.length];
  if (photo) return <Image source={{ uri: photo }} style={[StyleSheet.absoluteFill, { backgroundColor: tone }]} contentFit="cover" transition={200} />;
  return (
    <View style={[styles.cover, { backgroundColor: tone, paddingBottom: size / 4 }]}>
      <LiveBot size={size} shape={chapterShape(index + 1)} color={colors.ink} eyeColor={colors.background} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
