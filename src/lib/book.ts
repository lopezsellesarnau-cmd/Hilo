import { t } from '@/i18n';
import { missing } from '@/lib/found';
import { supabase } from '@/lib/supabase';

export type Chapter = {
  id: string;
  /** 1, 2, 3… in the order the stories were told */
  number: number;
  title: string;
  /** One sentence of hers, word for word, shown large in the middle of the chapter */
  quote: string | null;
  paragraphs: string[];
};

type Book = { name: string; chapters: Chapter[] } | { error: string };

/** The last book loaded on this phone: Mi libro and the chapter open with it at once, then refresh */
let lastBook: { name: string; chapters: Chapter[] } | null = null;
export const cachedBook = () => lastBook;

/**
 * The senior's book on this phone: only the chapters the family approved, oldest first.
 * RLS already hides the drafts from the senior; the filter says it here too.
 */
export async function loadBook(): Promise<Book> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const found = await supabase
    .from('people')
    .select('id, display_name')
    .eq('user_id', session?.user.id ?? '')
    .eq('role', 'senior')
    .maybeSingle();
  const me = found.data;
  if (!me) return { error: missing(found) ? t.common.notPaired : t.common.offline };

  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, quote, paragraphs')
    .eq('person_id', me.id)
    .eq('status', 'approved')
    .order('created_at');
  if (error) return { error: t.common.offline };

  lastBook = { name: me.display_name, chapters: data.map((c, i) => ({ ...c, number: i + 1 })) };
  return lastBook;
}

export type Draft = Omit<Chapter, 'number'> & {
  status: 'draft' | 'approved';
  /** Words of the story that don't appear in what she said: the family checks them */
  unheardWords: string[];
  createdAt: string;
  familyId: string;
  /** Storage paths in 'chapter-photos' */
  photos: string[];
  /** The part of her life it belongs to (frame "8 · A chapter"); stories from before have none: 'more' */
  part: Part;
  /** The year it happened, when she said it */
  year: number | null;
};

/** The parts of her book, in the order of a life */
export const PARTS = ['childhood', 'school', 'youth', 'love', 'work', 'children', 'home', 'travels', 'traditions', 'today', 'more'] as const;
export type Part = (typeof PARTS)[number];

export type BookPart = { part: Part; number: number; stories: Draft[]; years: string; waiting: number };

/** The stories grouped in their parts, in the order of a life; each part's stories in the order they were told */
export function groupParts(stories: Draft[]): BookPart[] {
  const parts: BookPart[] = [];
  for (const part of PARTS) {
    const mine = stories.filter((s) => s.part === part).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!mine.length) continue;
    const years = mine.map((s) => s.year).filter((y): y is number => y !== null);
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    parts.push({
      part,
      number: parts.length + 1,
      stories: mine,
      // "1934–46", "1952", or nothing
      years: !years.length ? '' : lo === hi ? String(lo) : `${lo}–${Math.floor(lo / 100) === Math.floor(hi / 100) ? String(hi).slice(2) : hi}`,
      waiting: mine.filter((s) => s.status === 'draft').length,
    });
  }
  return parts;
}

/** Moves a story to another part of her book */
export async function setChapterPart(id: string, part: Part) {
  const { error } = await supabase.from('chapters').update({ part }).eq('id', id);
  return !error;
}

/** The family's view of the book: every chapter of their senior, drafts included (RLS), newest first */
export async function loadFamilyBook(): Promise<{ name: string; chapters: Draft[] } | { error: string }> {
  const { data: senior } = await supabase.from('people').select('id, display_name').eq('role', 'senior').limit(1).maybeSingle();
  if (!senior) return { error: t.common.loadFailed };

  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, quote, paragraphs, status, unheard_words, created_at, family_id, photos, part, year')
    .eq('person_id', senior.id)
    .order('created_at', { ascending: false });
  if (error) return { error: t.common.loadFailed };

  return {
    name: senior.display_name,
    chapters: data.map(({ unheard_words, created_at, family_id, photos, part, year, ...c }) => ({
      ...c,
      part: (PARTS as readonly string[]).includes(part) ? (part as Part) : 'more',
      year: year ?? null,
      unheardWords: unheard_words,
      createdAt: created_at,
      familyId: family_id,
      photos: photos ?? [],
    })),
  };
}

/** Approve (she sees it in Mi libro) or take it back to the drafts */
export async function setChapterStatus(id: string, status: 'draft' | 'approved') {
  const { error } = await supabase
    .from('chapters')
    .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null })
    .eq('id', id);
  return !error;
}

/** Discard a story for good, and its photos right away (the hourly cleanup catches any left) */
export async function deleteChapter(id: string, photos: string[] = []) {
  const { error } = await supabase.from('chapters').delete().eq('id', id);
  if (!error && photos.length) await supabase.storage.from('chapter-photos').remove(photos);
  return !error;
}

/** The family fixed words Hilo wasn't sure of: the new text, and the words still to check */
export async function saveChapterText(id: string, paragraphs: string[], unheardWords: string[]) {
  const { error } = await supabase.from('chapters').update({ paragraphs, unheard_words: unheardWords }).eq('id', id);
  return !error;
}

const PHOTOS = 'chapter-photos';

/** Uploads one photo from the phone to the story's folder; returns its path */
export async function uploadChapterPhoto(familyId: string, chapterId: string, uri: string, mime = 'image/jpeg') {
  const body = await (await fetch(uri)).arrayBuffer();
  const ext = mime === 'image/png' ? 'png' : mime === 'image/heic' ? 'heic' : 'jpg';
  const path = `${familyId}/${chapterId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PHOTOS).upload(path, body, { contentType: mime });
  return error ? null : path;
}

/** Saves the story's list of photos */
export async function setChapterPhotos(id: string, photos: string[]) {
  const { error } = await supabase.from('chapters').update({ photos }).eq('id', id);
  return !error;
}

/** Removes a photo file (after taking it off the list) */
export async function removeChapterPhoto(path: string) {
  await supabase.storage.from(PHOTOS).remove([path]);
}

/** Short-lived links to show the photos (private bucket) */
export async function photoLinks(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(PHOTOS).createSignedUrls(paths, 3600);
  return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}
