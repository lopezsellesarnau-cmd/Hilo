import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  base64_variants,
  crypto_secretbox_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_open_easy,
  from_base64,
  randombytes_buf,
  to_base64,
  to_hex,
  to_string,
} from 'react-native-libsodium';

import { recognize } from '../../modules/hilo-docs';

import { read } from '@/lib/doc-read';
import { supabase } from '@/lib/supabase';
import { me, vaultKey } from '@/lib/vault';

/**
 * Her documents (phase B of vault Senior-App/11-documentos-cifrados-plan).
 * Everything is locked on this phone before it leaves: the file and its meta (title, type, name),
 * each document with its own key, that key locked with the family key. Hilo's server only sees bytes.
 */

const BUCKET = 'family-docs';
export const MAX_BYTES = 25 * 1024 * 1024;

/** Locked with the document's key. text/kind/tags/date: what the phone read in it (phase C); `read` once it tried */
export type DocMeta = { title: string; mime: string; name: string; text?: string; kind?: string; tags?: string[]; date?: string; read?: boolean };
const MAX_TEXT = 20000;
export type Doc = { id: string; path: string; size: number; createdAt: string; meta: DocMeta; key: Uint8Array };

const isPdf = (mime: string) => mime === 'application/pdf';
export const docKind = (d: { meta: DocMeta }) => (isPdf(d.meta.mime) ? 'PDF' : 'IMG');

function lock(data: Uint8Array, key: Uint8Array) {
  const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
  const box = crypto_secretbox_easy(data, nonce, key);
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return out;
}
function unlock(data: Uint8Array, key: Uint8Array) {
  return crypto_secretbox_open_easy(data.slice(crypto_secretbox_NONCEBYTES), data.slice(0, crypto_secretbox_NONCEBYTES), key);
}

function familyKey() {
  const k = vaultKey();
  if (!k) throw new Error('vault closed');
  return k;
}

// The list, open in memory (so the viewer finds a document without fetching it again)
let cache: Doc[] = [];
export const cachedDoc = (id: string) => cache.find((d) => d.id === id);

/** The family's documents, newest first, opened on this phone */
export async function listDocuments(): Promise<Doc[]> {
  const fk = familyKey();
  const { data, error } = await supabase.from('documents').select('id, path, size, key_wrap, meta, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  cache = (data ?? []).flatMap((r) => {
    try {
      const key = unlock(from_base64(r.key_wrap), fk);
      const meta = JSON.parse(to_string(unlock(from_base64(r.meta), key))) as DocMeta;
      return [{ id: r.id, path: r.path, size: r.size, createdAt: r.created_at, meta, key }];
    } catch {
      return []; // locked with another family key: not readable here
    }
  });
  return cache;
}

/** Locks a file on this phone and uploads it. `onLocked` fires once it's locked, before the upload */
export async function addDocument(file: { uri: string; mime: string; name: string; title: string; text?: string }, onLocked?: () => void): Promise<boolean> {
  const fk = familyKey();
  const person = await me();
  const bytes = new Uint8Array(await (await fetch(file.uri)).arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return false;
  const key = randombytes_buf(32);
  const text = (file.text ?? '').slice(0, MAX_TEXT);
  const seen = read(text);
  const meta: DocMeta = { title: file.title.slice(0, 120), mime: file.mime, name: file.name.slice(0, 120), text, kind: seen.kind, tags: seen.tags, date: seen.date, read: true };
  const locked = lock(bytes, key);
  onLocked?.();
  const path = `${person.family_id}/${to_hex(randombytes_buf(16))}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, locked, { contentType: 'application/octet-stream' });
  if (error) return false;
  const { error: e2 } = await supabase.from('documents').insert({
    family_id: person.family_id,
    path,
    size: bytes.length,
    key_wrap: to_base64(lock(key, fk)),
    meta: to_base64(lock(new TextEncoder().encode(JSON.stringify(meta)), key)),
    created_by: person.id,
  });
  if (e2) {
    await supabase.storage.from(BUCKET).remove([path]);
    return false;
  }
  return true;
}

/** Downloads a document and opens it in memory */
async function openBytes(doc: Doc) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.path, 60);
  if (!data?.signedUrl) throw new Error('no link');
  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error('download failed');
  return unlock(new Uint8Array(await res.arrayBuffer()), doc.key);
}

// Photos already unlocked this session (in memory only)
const images = new Map<string, string>();

/** A photo, ready for <Image> (stays in memory, never on disk) */
export async function imageUri(doc: Doc) {
  const known = images.get(doc.id);
  if (known) return known;
  const uri = `data:${doc.meta.mime};base64,${to_base64(await openBytes(doc), base64_variants.ORIGINAL)}`;
  images.set(doc.id, uri);
  return uri;
}

/** A PDF: opened into a temporary file and shown with the system's viewer; the file is removed after */
export async function showPdf(doc: Doc) {
  const file = new File(Paths.cache, `${safeName(doc.meta.title)}.pdf`);
  if (file.exists) file.delete();
  file.create();
  file.write(await openBytes(doc));
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } finally {
    if (file.exists) file.delete();
  }
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'documento';

/** Changes the meta (locked again with the document's own key) */
async function updateMeta(doc: Doc, patch: Partial<DocMeta>) {
  const meta = { ...doc.meta, ...patch };
  const { error } = await supabase
    .from('documents')
    .update({ meta: to_base64(lock(new TextEncoder().encode(JSON.stringify(meta)), doc.key)) })
    .eq('id', doc.id);
  if (error) return false;
  doc.meta = meta;
  return true;
}

/** A new title */
export async function renameDocument(doc: Doc, title: string) {
  return updateMeta(doc, { title: title.trim().slice(0, 120) || doc.meta.title });
}

/**
 * Reads a document added before the phone could read (phase B): unlocked into a temporary file
 * for the reader, removed right after. Titles stay as the family wrote them.
 */
export async function readLater(doc: Doc) {
  const file = new File(Paths.cache, `read-${doc.id}.${isPdf(doc.meta.mime) ? 'pdf' : 'jpg'}`);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(await openBytes(doc));
    const text = (await recognize(file.uri)).slice(0, MAX_TEXT);
    const seen = read(text);
    return updateMeta(doc, { text, kind: seen.kind, tags: seen.tags, date: seen.date, read: true });
  } finally {
    if (file.exists) file.delete();
  }
}

/** Deletes the file and its row */
export async function deleteDocument(doc: Doc) {
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  if (error) return false;
  await supabase.storage.from(BUCKET).remove([doc.path]);
  cache = cache.filter((d) => d.id !== doc.id);
  images.delete(doc.id);
  return true;
}
