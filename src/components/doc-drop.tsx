import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';

import { creep, DropRow, DropZone, useChew } from '@/components/file-drop';
import { toast } from '@/components/toast';
import { dateLocale, t } from '@/i18n';
import { read } from '@/lib/doc-read';
import { addDocument, MAX_BYTES } from '@/lib/documents';

import { canScan, recognize, scan } from '../../modules/hilo-docs';

const text = t.docs;

type Picked = { uri: string; mime: string; name: string; title: string; size?: number; thumb?: string; text?: string };
type Row = { key: string; picked: Picked; stage: 'reading' | 'locking' | 'uploading' | 'done'; progress: number; failed?: string };

const today = () => new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
const noExt = (name: string) => name.replace(/\.[a-z0-9]{2,4}$/i, '');

/**
 * File drop for her documents: the zone with her Bot. Tap it and choose camera, photos or a PDF;
 * what you pick goes into the Bot's mouth, it chews, and each file comes out below as a row:
 * the phone reads it (no network) and names it, locks it, then it goes up. When they're up,
 * `onAdded` refreshes the list. The scanner (VisionKit) straightens the pages into one PDF.
 */
export function DocDrop({ onAdded }: { onAdded: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const { mouth, squash, chew } = useChew();

  const fromImages = (assets: ImagePicker.ImagePickerAsset[]): Picked[] =>
    assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'foto.jpg', title: text.photoTitle(today()), size: a.fileSize, thumb: a.uri }));

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return [];
    try {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      return res.canceled ? [] : fromImages(res.assets);
    } catch {
      toast.error(text.noCamera);
      return [];
    }
  };
  const pickScan = async (): Promise<Picked[]> => {
    const res = await scan();
    if (!res) return [];
    return [{ uri: res.uri, mime: 'application/pdf', name: 'scan.pdf', title: text.scanTitle(today()), text: res.text }];
  };
  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.7 });
    return res.canceled ? [] : fromImages(res.assets);
  };
  const pickFiles = async (): Promise<Picked[]> => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return [];
    return res.assets.map((a) => {
      const mime = a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      return { uri: a.uri, mime, name: a.name, title: noExt(a.name), size: a.size, thumb: mime.startsWith('image/') ? a.uri : undefined };
    });
  };

  const add = async (pick: () => Promise<Picked[]>) => {
    const picked = await pick();
    if (!picked.length) return;
    chew();
    const fresh: Row[] = picked.map((p) => ({ key: `${p.uri}-${Math.random()}`, picked: p, stage: 'reading', progress: 0 }));
    setRows((r) => [...r, ...fresh]);
    const set = (key: string, patch: Partial<Row> | ((x: Row) => Partial<Row>)) =>
      setRows((r) => r.map((x) => (x.key === key ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)));

    let any = false;
    for (const row of fresh) {
      if (row.picked.size && row.picked.size > MAX_BYTES) {
        set(row.key, { failed: text.tooBig });
        continue;
      }
      const timer = setInterval(() => set(row.key, (x) => ({ progress: creep(x.progress) })), 120);
      let ok = false;
      try {
        // Read on the phone, and named after what it is ("Informe · Cardiología") when it can tell
        const words = row.picked.text ?? (await recognize(row.picked.uri));
        const title = read(words).title ?? row.picked.title;
        const picked = { ...row.picked, text: words, title };
        set(row.key, { stage: 'locking', picked });
        ok = await addDocument(picked, () => set(row.key, { stage: 'uploading' }));
      } catch {
        ok = false;
      }
      clearInterval(timer);
      set(row.key, ok ? { stage: 'done', progress: 1 } : { failed: t.common.saveFailed });
      if (ok) any = true;
    }
    if (any) {
      onAdded();
      // the finished rows leave; the documents are in the list now
      setTimeout(() => setRows((r) => r.filter((x) => x.stage !== 'done')), 900);
    }
  };

  const choose = () => {
    const options = [
      canScan ? { label: text.fromScan, run: () => add(pickScan) } : { label: text.fromCamera, run: () => add(pickCamera) },
      { label: text.fromPhotos, run: () => add(pickPhotos) },
      { label: text.fromFiles, run: () => add(pickFiles) },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => o.label), text.cancel], cancelButtonIndex: options.length }, (i) => options[i]?.run());
    } else {
      Alert.alert(text.add, undefined, [...options.map((o) => ({ text: o.label, onPress: o.run })), { text: text.cancel, style: 'cancel' }]);
    }
  };

  return (
    <View>
      <DropZone title={text.add} hint={text.addHint} onPress={choose} mouth={mouth} squash={squash} />
      {rows.map((row) => (
        <DropRow
          key={row.key}
          thumb={row.picked.thumb}
          tag="PDF"
          label={row.failed ?? (row.stage === 'reading' ? text.reading : row.stage === 'locking' ? text.locking : row.stage === 'uploading' ? text.uploading : row.picked.title)}
          progress={row.progress}
          failed={Boolean(row.failed)}
          onRemove={row.failed ? () => setRows((r) => r.filter((x) => x.key !== row.key)) : undefined}
          removeLabel={t.common.close}
        />
      ))}
    </View>
  );
}
