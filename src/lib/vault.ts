import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  crypto_box_keypair,
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_pwhash,
  crypto_pwhash_ALG_DEFAULT,
  crypto_pwhash_MEMLIMIT_INTERACTIVE,
  crypto_pwhash_OPSLIMIT_INTERACTIVE,
  crypto_pwhash_SALTBYTES,
  crypto_secretbox_easy,
  crypto_secretbox_KEYBYTES,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_open_easy,
  from_base64,
  randombytes_buf,
  randombytes_uniform,
  to_base64,
} from 'react-native-libsodium';

import { supabase } from '@/lib/supabase';

/**
 * The family's document vault: the keys (plan in the vault: Senior-App/11-documentos-cifrados-plan).
 * - The family key (32 random bytes) locks the documents. It's never stored in the clear anywhere.
 * - This phone's private key lives only in the iPhone's Keychain (SecureStore), never on the server.
 * - The server keeps the family key sealed for each approved phone, and once more locked with the
 *   recovery code (Argon2id, on the phone). Without a phone or the code, nobody can open it, Hilo included.
 * The family key is kept in memory while the app runs, never written to disk.
 */

const SK = 'hilo.vault.secret';
const PK = 'hilo.vault.public';
const KEYCHAIN = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } as const;

export type Device = { id: string; memberId: string; name: string; publicKey: string; approved: boolean; mine: boolean };
export type VaultState =
  | { kind: 'none' } // no folder yet
  | { kind: 'locked'; registered: boolean } // folder exists; this phone hasn't been let in (registered: it asked)
  | { kind: 'open'; devices: Device[] };

let familyKey: Uint8Array | null = null;
export const vaultKey = () => familyKey;

/** This phone's key pair, made the first time */
async function myKeys() {
  let sk = await SecureStore.getItemAsync(SK);
  let pk = await SecureStore.getItemAsync(PK);
  if (!sk || !pk) {
    const pair = crypto_box_keypair();
    sk = to_base64(pair.privateKey);
    pk = to_base64(pair.publicKey);
    await SecureStore.setItemAsync(SK, sk, KEYCHAIN);
    await SecureStore.setItemAsync(PK, pk, KEYCHAIN);
  }
  return { sk: from_base64(sk), pk: from_base64(pk), pkB64: pk };
}

async function me() {
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase.from('people').select('id, family_id, display_name').eq('user_id', auth.user?.id ?? '').eq('role', 'member').maybeSingle();
  if (!data) throw new Error('not a family member');
  return data as { id: string; family_id: string; display_name: string };
}

/** Where this phone stands, and opens the vault in memory if it can */
export async function vaultState(): Promise<VaultState> {
  if (Platform.OS === 'web') return { kind: 'locked', registered: false };
  const person = await me();
  const { data: vault } = await supabase.from('family_vault').select('family_id').eq('family_id', person.family_id).maybeSingle();
  if (!vault) return { kind: 'none' };
  const keys = await myKeys();
  const [{ data: devices }, { data: wraps }] = await Promise.all([
    supabase.from('family_devices').select('id, member_id, name, public_key').eq('family_id', person.family_id).order('created_at'),
    supabase.from('family_key_wraps').select('device_id, wrapped_key').eq('family_id', person.family_id),
  ]);
  const approved = new Map((wraps ?? []).map((w) => [w.device_id, w.wrapped_key as string]));
  const list: Device[] = (devices ?? []).map((d) => ({
    id: d.id,
    memberId: d.member_id,
    name: d.name,
    publicKey: d.public_key,
    approved: approved.has(d.id),
    mine: d.public_key === keys.pkB64,
  }));
  const mine = list.find((d) => d.mine);
  if (!mine || !mine.approved) return { kind: 'locked', registered: Boolean(mine) };
  familyKey = crypto_box_seal_open(from_base64(approved.get(mine.id)!), keys.pk, keys.sk);
  return { kind: 'open', devices: list };
}

/** A recovery code: 6 groups of 4, no letters that look alike (I, L, O, U) */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newCode() {
  const chars = Array.from({ length: 24 }, () => ALPHABET[randombytes_uniform(ALPHABET.length)]);
  return Array.from({ length: 6 }, (_, i) => chars.slice(i * 4, i * 4 + 4).join('')).join('-');
}
const clean = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

function codeKey(code: string, salt: Uint8Array) {
  return crypto_pwhash(crypto_secretbox_KEYBYTES, clean(code), salt, crypto_pwhash_OPSLIMIT_INTERACTIVE, crypto_pwhash_MEMLIMIT_INTERACTIVE, crypto_pwhash_ALG_DEFAULT);
}

/** Adds this phone to the family's list (asking for access) and returns its id */
async function registerDevice(person: { id: string; family_id: string; display_name: string }) {
  const name = `${person.display_name} · ${Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'web'}`.slice(0, 60);
  const keys = await myKeys();
  const { data: found } = await supabase.from('family_devices').select('id').eq('family_id', person.family_id).eq('public_key', keys.pkB64).maybeSingle();
  if (found) return { id: found.id as string, keys };
  const { data, error } = await supabase.from('family_devices').insert({ family_id: person.family_id, member_id: person.id, public_key: keys.pkB64, name }).select('id').single();
  if (error) throw error;
  return { id: data.id as string, keys };
}

/** Creates the folder: a new family key, sealed for this phone and locked with a new recovery code (shown once) */
export async function createVault(): Promise<string> {
  const person = await me();
  const key = randombytes_buf(32);
  const code = newCode();
  const salt = randombytes_buf(crypto_pwhash_SALTBYTES);
  const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
  const locked = crypto_secretbox_easy(key, nonce, codeKey(code, salt));
  const wrap = new Uint8Array(nonce.length + locked.length);
  wrap.set(nonce);
  wrap.set(locked, nonce.length);
  const { error } = await supabase.from('family_vault').insert({ family_id: person.family_id, recovery_wrap: to_base64(wrap), recovery_salt: to_base64(salt), created_by: person.id });
  if (error) throw error;
  const device = await registerDevice(person);
  const { error: e2 } = await supabase.from('family_key_wraps').insert({ device_id: device.id, family_id: person.family_id, wrapped_key: to_base64(crypto_box_seal(key, device.keys.pk)) });
  if (e2) throw e2;
  familyKey = key;
  return code;
}

/** This phone asks to be let in: another family phone approves it */
export async function askForAccess() {
  await registerDevice(await me());
}

/** Another phone asked: seal the family key for it (only from a phone that's already in) */
export async function approveDevice(device: Device) {
  if (!familyKey) throw new Error('vault closed');
  const person = await me();
  const keys = await myKeys();
  const { data: mine } = await supabase.from('family_devices').select('id').eq('family_id', person.family_id).eq('public_key', keys.pkB64).maybeSingle();
  const { error } = await supabase.from('family_key_wraps').insert({
    device_id: device.id,
    family_id: person.family_id,
    wrapped_key: to_base64(crypto_box_seal(familyKey, from_base64(device.publicKey))),
    approved_by: mine?.id ?? null,
  });
  if (error) throw error;
}

/** Removes a phone (lost, replaced): it loses its sealed key */
export async function removeDevice(device: Device) {
  const { error } = await supabase.from('family_devices').delete().eq('id', device.id);
  if (error) throw error;
}

/** Opens the folder with the recovery code on this phone; false if the code is wrong */
export async function recoverWithCode(code: string): Promise<boolean> {
  const person = await me();
  const { data: vault } = await supabase.from('family_vault').select('recovery_wrap, recovery_salt').eq('family_id', person.family_id).single();
  if (!vault) return false;
  const wrap = from_base64(vault.recovery_wrap);
  let key: Uint8Array;
  try {
    key = crypto_secretbox_open_easy(wrap.slice(crypto_secretbox_NONCEBYTES), wrap.slice(0, crypto_secretbox_NONCEBYTES), codeKey(code, from_base64(vault.recovery_salt)));
  } catch {
    return false;
  }
  const device = await registerDevice(person);
  await supabase.from('family_key_wraps').delete().eq('device_id', device.id); // a stale one, if any
  const { error } = await supabase.from('family_key_wraps').insert({ device_id: device.id, family_id: person.family_id, wrapped_key: to_base64(crypto_box_seal(key, device.keys.pk)) });
  if (error) throw error;
  familyKey = key;
  return true;
}
