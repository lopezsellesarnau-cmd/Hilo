import { t } from '@/i18n';
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
  const { data: me } = await supabase
    .from('people')
    .select('id, display_name')
    .eq('user_id', session?.user.id ?? '')
    .eq('role', 'senior')
    .maybeSingle();
  if (!me) return { error: t.common.notPaired };

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
};

/** The family's view of the book: every chapter of their senior, drafts included (RLS), newest first */
export async function loadFamilyBook(): Promise<{ name: string; chapters: Draft[] } | { error: string }> {
  const { data: senior } = await supabase.from('people').select('id, display_name').eq('role', 'senior').limit(1).maybeSingle();
  if (!senior) return { error: t.common.loadFailed };

  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, quote, paragraphs, status, unheard_words, created_at')
    .eq('person_id', senior.id)
    .order('created_at', { ascending: false });
  if (error) return { error: t.common.loadFailed };

  return {
    name: senior.display_name,
    chapters: data.map(({ unheard_words, created_at, ...c }) => ({ ...c, unheardWords: unheard_words, createdAt: created_at })),
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

/** Discard a story for good */
export async function deleteChapter(id: string) {
  const { error } = await supabase.from('chapters').delete().eq('id', id);
  return !error;
}
