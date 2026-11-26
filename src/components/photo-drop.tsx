import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { creep, DropRow, DropZone, useChew } from '@/components/file-drop';
import { photoLinks, removeChapterPhoto, uploadChapterPhoto } from '@/lib/book';

/**
 * File drop for photos on a story. Tap the zone: the photos you pick go into the Bot's mouth, it chews,
 * and they come out below as rows that upload, each with its thumbnail. A ✕ takes one off.
 * Private: the files live in the family's folder.
 */

type Props = {
  familyId: string;
  chapterId: string;
  photos: string[];
  /** The new list of paths, after an upload or a removal (the caller saves it on the chapter) */
  onChange: (photos: string[]) => void;
  title: string;
  hint: string;
  /** "Uploading" */
  uploading: string;
  removeLabel: string;
  /** Development sample: show the photos picked, upload nothing */
  dry?: boolean;
  max?: number;
};

type Row = { key: string; uri: string; path: string | null; progress: number; failed?: boolean };

export function PhotoDrop({ familyId, chapterId, photos, onChange, title, hint, uploading, removeLabel, dry = false, max = 8 }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const { mouth, squash, chew } = useChew();

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
      const timer = setInterval(() => setRows((r) => r.map((x) => (x.key === row.key ? { ...x, progress: creep(x.progress) } : x))), 120);
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

  return (
    <View>
      <DropZone title={title} hint={hint} onPress={pick} mouth={mouth} squash={squash} />
      {rows.map((row) => (
        <DropRow
          key={row.key}
          thumb={row.uri}
          label={row.failed ? '' : row.progress < 1 ? uploading : ''}
          progress={row.progress}
          failed={row.failed}
          onRemove={() => remove(row)}
          removeLabel={removeLabel}
        />
      ))}
    </View>
  );
}
