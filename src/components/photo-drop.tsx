import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LiveBot } from '@/components/live-bot';
import { photoLinks, removeChapterPhoto, uploadChapterPhoto } from '@/lib/book';
import { colors, fontWeight } from '@/theme';

/**
 * File drop (StackD Kit 13), for photos on a story, in React Native.
 * A dashed zone with her Bot in the middle. Tap it: the photos you pick go into its mouth, it chews,
 * and they come out below as rows that upload with a rolling percentage and a bar, each with its
 * thumbnail. A ✕ takes one off. Private: the files live in the family's folder.
 */

type Props = {
  familyId: string;
  chapterId: string;
  photos: string[];
  /** The new list of paths, after an upload or a removal (the caller saves it on the chapter) */
  onChange: (photos: string[]) => void;
  title: string;
  hint: string;
  /** "Uploading" / "Uploaded" */
  uploading: string;
  removeLabel: string;
  /** Development sample: show the photos picked, upload nothing */
  dry?: boolean;
  max?: number;
};

type Row = { key: string; uri: string; path: string | null; progress: number; failed?: boolean };

export function PhotoDrop({ familyId, chapterId, photos, onChange, title, hint, uploading, removeLabel, dry = false, max = 8 }: Props) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<Row[]>([]);
  const mouth = useSharedValue(0); // the Bot's mouth: 0 closed, 1 wide
  const squash = useSharedValue(1);

  // Photos already on the story: their links (private bucket)
  useEffect(() => {
    let live = true;
    photoLinks(photos).then((links) => {
      if (!live) return;
      setRows((r) => {
        const known = new Set(r.map((x) => x.path));
        return [...r, ...photos.filter((p) => !known.has(p) && links[p]).map((p) => ({ key: p, uri: links[p], path: p, progress: 1 }))];
      });
    });
    return () => {
      live = false;
    };
    // only the first list: later ones come from this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chew = () => {
    if (reduce) return;
    // it opens wide, takes them in, chews three times, closes
    mouth.value = withSequence(
      withTiming(1, { duration: 160 }),
      withRepeat(withSequence(withTiming(0.25, { duration: 110 }), withTiming(0.8, { duration: 110 })), 3),
      withTiming(0, { duration: 160 }),
    );
    squash.value = withSequence(withTiming(0.88, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 260 }));
  };

  const pick = async () => {
    const left = max - rows.length;
    if (left <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: left, quality: 0.7 });
    if (res.canceled || !res.assets.length) return;
    chew();
    const fresh: Row[] = res.assets.map((a) => ({ key: `${a.uri}-${Math.random()}`, uri: a.uri, path: null, progress: 0 }));
    setRows((r) => [...r, ...fresh]);
    const added: string[] = [];
    for (const [i, a] of res.assets.entries()) {
      const row = fresh[i];
      // a rolling percentage while it goes up (Supabase gives no progress): eases towards 90 %
      const timer = setInterval(() => setRows((r) => r.map((x) => (x.key === row.key ? { ...x, progress: Math.min(0.9, x.progress + (0.9 - x.progress) * 0.18) } : x))), 120);
      const path = dry ? `dry/${row.key}` : await uploadChapterPhoto(familyId, chapterId, a.uri, a.mimeType ?? 'image/jpeg');
      if (dry) await new Promise((ok) => setTimeout(ok, 900));
      clearInterval(timer);
      setRows((r) => r.map((x) => (x.key === row.key ? { ...x, path, progress: path ? 1 : x.progress, failed: !path } : x)));
      if (path) added.push(path);
    }
    if (added.length && !dry) onChange([...photos, ...added]);
  };

  const remove = (row: Row) => {
    setRows((r) => r.filter((x) => x.key !== row.key));
    if (!row.path || dry) return;
    onChange(photos.filter((p) => p !== row.path));
    removeChapterPhoto(row.path).catch(() => {});
  };

  const bot = useAnimatedStyle(() => ({ transform: [{ scaleY: squash.value }, { scaleX: 2 - squash.value }] }));
  useEffect(() => () => cancelAnimation(mouth), [mouth]);

  return (
    <View>
      <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} style={({ pressed }) => [styles.zone, pressed && styles.zonePressed]}>
        <Animated.View style={bot}>
          <LiveBot size={64} voice={mouth} />
        </Animated.View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </Pressable>

      {rows.map((row) => (
        <Animated.View key={row.key} entering={reduce ? undefined : FadeInDown.springify().damping(15)} layout={reduce ? undefined : LinearTransition.springify().damping(18)} style={styles.row}>
          <Image source={{ uri: row.uri }} style={styles.thumb} contentFit="cover" />
          <View style={styles.rowMid}>
            <View style={styles.rowTop}>
              <Text style={styles.rowText}>{row.failed ? '!' : row.progress < 1 ? uploading : ''}</Text>
              <Text style={styles.pct}>{row.failed ? '' : `${Math.round(row.progress * 100)}%`}</Text>
            </View>
            <View style={styles.track}>
              <Bar progress={row.progress} failed={row.failed} />
            </View>
          </View>
          <Pressable onPress={() => remove(row)} accessibilityRole="button" accessibilityLabel={removeLabel} hitSlop={10} style={styles.x}>
            <Text style={styles.xText}>✕</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

function Bar({ progress, failed }: { progress: number; failed?: boolean }) {
  const w = useSharedValue(progress);
  useEffect(() => {
    w.value = withTiming(progress, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [progress, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return <Animated.View style={[styles.bar, failed && styles.barFailed, style]} />;
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', paddingVertical: 22, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.18)', backgroundColor: colors.background },
  zonePressed: { backgroundColor: colors.surface },
  title: { marginTop: 12, fontSize: 17, fontWeight: fontWeight.bold, color: colors.ink },
  hint: { marginTop: 4, fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 20 },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: colors.surface },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#e6e6e6' },
  rowMid: { flex: 1, gap: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowText: { fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  pct: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.ink, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.08)' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  barFailed: { backgroundColor: colors.error },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  xText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
});
