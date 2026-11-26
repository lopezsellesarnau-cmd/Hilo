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
  /** Storage paths in 'chapter-photos' (the first is the book's cover) */
  photos: string[];
};

/** One of her books on her phone: its chapters with the stories the family approved */
export type HerBook = { id: string; number: number; title: string | null; chapters: { id: string; number: number; title: string | null; stories: Chapter[] }[]; stories: number };

type Loaded = { name: string; chapters: Chapter[]; books: HerBook[] };
type Book = Loaded | { error: string };

/** The last book loaded on this phone: Mi libro and the chapter open with it at once, then refresh */
let lastBook: Loaded | null = null;
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

  const [{ data, error }, { data: books }, { data: parts }] = await Promise.all([
    supabase.from('chapters').select('id, title, quote, paragraphs, photos, book_chapter_id').eq('person_id', me.id).eq('status', 'approved').order('created_at'),
    supabase.from('books').select('id, number, title').eq('person_id', me.id).order('number'),
    supabase.from('book_chapters').select('id, book_id, number, title').eq('person_id', me.id).order('number'),
  ]);
  if (error) return { error: t.common.offline };

  const chapters: (Chapter & { bookChapterId: string | null })[] = data.map(({ book_chapter_id, photos, ...c }, i) => ({
    ...c,
    photos: photos ?? [],
    number: i + 1,
    bookChapterId: book_chapter_id ?? null,
  }));
  // Her books (vault Senior-App/13-libro-en-libros-plan): only what has an approved story; anything not placed, at the end
  const herBooks: HerBook[] = (books ?? []).map((b) => {
    const mine = (parts ?? [])
      .filter((p) => p.book_id === b.id)
      .map((p) => ({ id: p.id, number: p.number, title: p.title, stories: chapters.filter((c) => c.bookChapterId === p.id) }))
      .filter((p) => p.stories.length);
    return { id: b.id, number: b.number, title: b.title, chapters: mine, stories: mine.reduce((n, p) => n + p.stories.length, 0) };
  });
  const loose = chapters.filter((c) => !c.bookChapterId || !(parts ?? []).some((p) => p.id === c.bookChapterId));
  if (loose.length) herBooks.push({ id: 'loose', number: (books?.length ?? 0) + 1, title: null, chapters: [{ id: 'loose', number: 1, title: null, stories: loose }], stories: loose.length });

  lastBook = { name: me.display_name, chapters, books: herBooks.filter((b) => b.stories) };
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
  /** The chapter of her book it went into (vault Senior-App/13-libro-en-libros-plan); null if not placed yet */
  bookChapterId: string | null;
};

/** The parts of her book, in the order of a life */
export const PARTS = ['childhood', 'school', 'youth', 'love', 'work', 'children', 'home', 'travels', 'traditions', 'today', 'more'] as const;
export type Part = (typeof PARTS)[number];

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
    .select('id, title, quote, paragraphs, status, unheard_words, created_at, family_id, photos, part, year, book_chapter_id')
    .eq('person_id', senior.id)
    .order('created_at', { ascending: false });
  if (error) return { error: t.common.loadFailed };

  return {
    name: senior.display_name,
    chapters: data.map(({ unheard_words, created_at, family_id, photos, part, year, book_chapter_id, ...c }) => ({
      ...c,
      bookChapterId: book_chapter_id ?? null,
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

/** A chapter of one of her books: up to ~1000 characters of stories, one after another */
export type BookChapter = { id: string; number: number; title: string | null; stories: Draft[]; waiting: number };
/** One of her books: up to 3 chapters, in the order she told them */
export type LifeBook = { id: string; number: number; title: string | null; chapters: BookChapter[]; stories: number; waiting: number; years: string };

/** "1934–46", "1952", or nothing */
const yearSpan = (stories: Draft[]) => {
  const years = stories.map((s) => s.year).filter((y): y is number => y !== null);
  if (!years.length) return '';
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo}–${Math.floor(lo / 100) === Math.floor(hi / 100) ? String(hi).slice(2) : hi}`;
};

/**
 * The family's book as books (oldest first), each with its chapters and their stories.
 * A story not placed yet (it happens only if the server failed) goes at the end, in a book of its own.
 */
export async function loadFamilyBooks(): Promise<{ name: string; books: LifeBook[]; stories: Draft[] } | { error: string }> {
  const book = await loadFamilyBook();
  if ('error' in book) return book;
  const [{ data: books, error: e1 }, { data: chapters, error: e2 }] = await Promise.all([
    supabase.from('books').select('id, number, title').order('number'),
    supabase.from('book_chapters').select('id, book_id, number, title').order('number'),
  ]);
  if (e1 || e2) return { error: t.common.loadFailed };

  const told = [...book.chapters].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const result: LifeBook[] = (books ?? []).map((b) => {
    const mine: BookChapter[] = (chapters ?? [])
      .filter((c) => c.book_id === b.id)
      .map((c) => {
        const stories = told.filter((s) => s.bookChapterId === c.id);
        return { id: c.id, number: c.number, title: c.title, stories, waiting: stories.filter((s) => s.status === 'draft').length };
      })
      .filter((c) => c.stories.length);
    const all = mine.flatMap((c) => c.stories);
    return { id: b.id, number: b.number, title: b.title, chapters: mine, stories: all.length, waiting: all.filter((s) => s.status === 'draft').length, years: yearSpan(all) };
  });
  const loose = told.filter((s) => !s.bookChapterId || !(chapters ?? []).some((c) => c.id === s.bookChapterId));
  if (loose.length) {
    const n = (books?.length ?? 0) + 1;
    result.push({
      id: 'loose',
      number: n,
      title: null,
      chapters: [{ id: 'loose', number: 1, title: null, stories: loose, waiting: loose.filter((s) => s.status === 'draft').length }],
      stories: loose.length,
      waiting: loose.filter((s) => s.status === 'draft').length,
      years: yearSpan(loose),
    });
  }
  return { name: book.name, books: result.filter((b) => b.stories), stories: told };
}
