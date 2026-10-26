// Hilo: one sample sentence in Hilo's talk voice, for the staff web's New person ("Listen to Hilo").
// Staff hear her language and speed before the visit. Only staff of an organisation can call it, and the
// sentence is fixed (with her name, if typed): nobody can make Hilo say anything else here.
// Called from the browser, so it answers CORS. One file, so it can be pasted in the Dashboard editor.

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

// ── Voice ─────────────────────────────────────────────────────────────────
// A copy of talk/index.ts's voice (same providers, voices and secrets), so staff hear what she will hear.
// The Dashboard deploys one file per function: keep this in step with talk when the voice changes.

type Lang = 'es' | 'en' | 'nl';

/** The language tag the voice speaks in */
const VOICE_LANG: Record<Lang, string> = { es: 'es-ES', nl: 'nl-NL', en: 'en-GB' };

const escapeXml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** A native voice per language; Spanish keeps the one chosen by ear (AZURE_SPEECH_VOICE) */
const AZURE_VOICE: Record<Lang, () => string> = {
  es: () => Deno.env.get('AZURE_SPEECH_VOICE') ?? 'es-ES-ElviraNeural',
  nl: () => Deno.env.get('AZURE_SPEECH_VOICE_NL') ?? 'nl-NL-FennaNeural',
  en: () => Deno.env.get('AZURE_SPEECH_VOICE_EN') ?? 'en-GB-SoniaNeural',
};

/** Pause between paragraphs when Hilo reads a chapter */
const PARAGRAPH_BREAK_MS = 900;

async function azureSpeech(parts: string[], speed: number, l: Lang): Promise<ArrayBuffer> {
  const region = Deno.env.get('AZURE_SPEECH_REGION');
  const voice = AZURE_VOICE[l]();
  const xmlLang = VOICE_LANG[l];
  // <lang> forces the language: multilingual voices guess it by themselves and sometimes say a name in English
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${xmlLang}">` +
    `<voice name="${voice}"><lang xml:lang="${xmlLang}">` +
    `<prosody rate="${speed.toFixed(2)}">${parts.map(escapeXml).join(`<break time="${PARAGRAPH_BREAK_MS}ms"/>`)}</prosody></lang></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': Deno.env.get('AZURE_SPEECH_KEY')!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'hilo-talk',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`azure ${res.status} ${await res.text()}`);
  return res.arrayBuffer();
}

async function elevenLabsSpeech(parts: string[], speed: number, l: Lang): Promise<ArrayBuffer> {
  const voice = Deno.env.get('ELEVENLABS_VOICE_ID');
  const text = parts.join('\n\n');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', language_code: l, voice_settings: { speed } }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status} ${await res.text()}`);
  return res.arrayBuffer();
}

const useElevenLabs = () => Deno.env.get('VOICE_PROVIDER') === 'elevenlabs';

/** The voice that reads, as part of the stored file's name: a new voice makes a new recording */
const voiceName = (l: Lang) => (useElevenLabs() ? `el-${Deno.env.get('ELEVENLABS_VOICE_ID')}` : AZURE_VOICE[l]());

const synthesize = (parts: string[], speed: number, l: Lang) =>
  useElevenLabs() ? elevenLabsSpeech(parts, speed, l) : azureSpeech(parts, speed, l);

// ── Sample ────────────────────────────────────────────────────────────────

const SAMPLE: Record<Lang, (name: string) => string> = {
  es: (name) => `Buenos días${name ? `, ${name}` : ''}. ¿Qué tal has dormido?`,
  en: (name) => `Good morning${name ? `, ${name}` : ''}. How did you sleep?`,
  nl: (name) => `Goedemorgen${name ? `, ${name}` : ''}. Hoe heeft u geslapen?`,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// The same sample is asked for again and again (each language × 6 speeds): keep it while the function is warm
const cache = new Map<string, string>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'auth' }, 401);

  const body = (await req.json().catch(() => ({}))) as { locale?: string; speed?: number; name?: string };
  const l: Lang = body.locale === 'en' || body.locale === 'nl' ? body.locale : 'es';
  const speed = Math.round(Number(body.speed) * 10) / 10;
  if (!(speed >= 0.7 && speed <= 1.2)) return json({ error: 'speed' }, 400);
  // Her first name only, without anything that could be read as SSML or a second sentence
  const name = (typeof body.name === 'string' ? body.name : '').trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, '').slice(0, 30) ?? '';

  // Staff only: the caller's own org_members row (RLS lets staff read their organisation's rows)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await db.auth.getUser(auth.replace('Bearer ', ''));
  if (!userData.user || userData.user.is_anonymous) return json({ error: 'auth' }, 401);
  const { data: member } = await db.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1).maybeSingle();
  if (!member) return json({ error: 'not_staff' }, 403);

  const text = SAMPLE[l](name);
  const key = `${voiceName(l)}|${speed.toFixed(1)}|${text}`;
  let audio = cache.get(key);
  if (!audio) {
    try {
      const bytes = new Uint8Array(await synthesize([text], speed, l));
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      audio = btoa(binary);
    } catch (e) {
      console.error('voice', e);
      return json({ error: 'voice' }, 502);
    }
    if (cache.size > 200) cache.clear();
    cache.set(key, audio);
  }
  return json({ text, audio });
});
