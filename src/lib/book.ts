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

/**
 * The senior's book on this phone: only the chapters the family approved, oldest first.
 * RLS already hides the drafts from the senior; the filter says it here too.
 */
export async function loadBook(): Promise<{ name: string; chapters: Chapter[] } | { error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: me } = await supabase
    .from('people')
    .select('id, display_name')
    .eq('user_id', session?.user.id ?? '')
    .eq('role', 'senior')
    .maybeSingle();
  if (!me) return { error: 'Este móvil aún no está conectado con tu familia.' };

  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, quote, paragraphs')
    .eq('person_id', me.id)
    .eq('status', 'approved')
    .order('created_at');
  if (error) return { error: 'No hay conexión. Prueba otra vez en un momento.' };

  return { name: me.display_name, chapters: data.map((c, i) => ({ ...c, number: i + 1 })) };
}
