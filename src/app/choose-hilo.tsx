import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { BOT_SHAPES, LiveBot, type BotShape } from '@/components/live-bot';
import { toast } from '@/components/toast';
import { WheelPicker } from '@/components/wheel-picker';
import { t } from '@/i18n';
import { getHiloShape, saveHiloShape, saveMyHiloShape } from '@/lib/hilo-shape';
import { colors, fontWeight } from '@/theme';

const text = t.chooseHilo;
// Hexagon first: it's the app icon
const ORDER: BotShape[] = ['hexagon', ...BOT_SHAPES.filter((s) => s !== 'hexagon')];

/**
 * Choose your Hilo (v2, frame "1 · Choose your Hilo"). On her phone, right after she agrees to Hilo:
 * she spins the wheel and picks the shape of her companion. The family sees the same Bot everywhere.
 * From Ajustes (`from=settings`) a family member can change it for her.
 */
export default function ChooseHilo() {
  const { from = '', seniorId = '' } = useLocalSearchParams<{ from?: string; seniorId?: string }>();
  const family = from === 'settings';
  const [shape, setShape] = useState<BotShape>(getHiloShape());
  const [saving, setSaving] = useState(false);

  const done = async () => {
    if (saving) return;
    setSaving(true);
    const ok = family ? await saveHiloShape(seniorId, shape) : await saveMyHiloShape(shape);
    setSaving(false);
    if (!ok) return toast.error(t.common.saveFailed);
    if (family) {
      router.back();
      toast(t.common.saved);
    } else router.replace('/home');
  };

  const options = ORDER.map((s) => ({
    value: s,
    label: text.names[s],
    icon: <LiveBot size={124} shape={s} />,
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        {family ? (
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {t.settings.title}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} accessibilityRole="header">
          {family ? text.titleFamily : text.title}
        </Text>
        <Text style={styles.hint}>{text.hint}</Text>
        <View style={styles.wheel}>
          <WheelPicker options={options} value={shape} onChange={setShape} label={text.a11y} itemHeight={180} rows={2.4} />
        </View>
        <BigButton scale={family ? 'family' : 'senior'} label={saving ? t.common.saving : text.ok} onPress={done} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 12 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  title: { fontSize: 56, lineHeight: 56, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.ink },
  hint: { marginTop: 12, fontSize: 20, lineHeight: 26, fontWeight: fontWeight.semibold, color: colors.muted },
  wheel: { flex: 1, justifyContent: 'center' },
});
