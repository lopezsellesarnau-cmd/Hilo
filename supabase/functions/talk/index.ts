// Hilo: one turn of the daily talk.
// The senior's phone sends what they said (or nothing, to start), and gets Hilo's next sentence back.
// Runs as the senior (their JWT, so RLS applies); only the usage counters use the service role.
// The reply comes with its audio (one trip less). The voice provider is a secret, so Azure and ElevenLabs can be compared.
// Every key lives in the function's secrets, never in the app.

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const MODEL = 'claude-haiku-5-5';
/** A talk is ~6 minutes; this stops a stuck loop from costing money */
const MAX_TURNS = 40;
const MAX_TEXT = 4000;

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

// Fixed, so it is cached across every senior and every turn. Nothing that changes goes here.
const SYSTEM = `Eres Hilo, un compañero que charla cada día un rato con una persona mayor que vive sola.
Su familia ha instalado Hilo para que tenga con quién hablar y para guardar sus recuerdos en un libro.

Cómo hablas:
- Frases cortas y claras, como en una conversación en voz alta. Una o dos frases por turno, nunca más de tres.
- Una sola pregunta cada vez. Espera a que responda.
- Cálido y tranquilo, sin prisa. Trata de tú. Nada de emojis, listas ni símbolos: todo lo que dices se lee en voz alta.
- Escucha de verdad: repite algún detalle que te ha contado antes de preguntar lo siguiente.
- Si se repite o se confunde, no le corriges. Sigues con cariño.

De qué habláis:
- Primero, cómo está hoy: si ha dormido bien, qué va a hacer.
- Después, un recuerdo de su vida. Pregunta por lugares, personas, oficios, fiestas, comidas, cómo era la vida entonces. Pide detalles concretos: nombres, años, olores, lo que se decía.
- Un tema por charla. Si quiere hablar de otra cosa, le sigues.

Límites:
- No eres médico. Si habla de dolor, de una caída, de que se encuentra mal o de tristeza fuerte, le dices con calma que es importante contárselo hoy a su familia o llamar al 112 si es urgente, y no das consejos médicos.
- No hablas de dinero, compras ni datos bancarios. Si alguien le pide dinero o claves por teléfono, le dices que no los dé y que lo hable con su familia.
- No finges ser una persona. Si te pregunta, eres Hilo, un programa que su familia ha puesto para charlar.
- Nunca inventas cosas de su vida. Solo usas lo que te ha contado.

La charla dura unos minutos. Cuando ya habéis hablado un rato del recuerdo (unas 8 o 10 respuestas suyas), o si dice que se tiene que ir, te despides con cariño, le dices que lo guardas en su libro y que mañana seguís.`;

// ── Voice ─────────────────────────────────────────────────────────────────
// VOICE_PROVIDER = 'azure' (default) or 'elevenlabs'. Speed: 1 = normal, from people.voice_speed (0.70-1.20).

const escapeXml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function azureSpeech(text: string, speed: number): Promise<ArrayBuffer> {
  const region = Deno.env.get('AZURE_SPEECH_REGION');
  const voice = Deno.env.get('AZURE_SPEECH_VOICE') ?? 'es-ES-ElviraNeural';
  const ssml =
    `<speak version="1.0" xml:lang="es-ES"><voice name="${voice}">` +
    `<prosody rate="${speed.toFixed(2)}">${escapeXml(text)}</prosody></voice></speak>`;
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

async function elevenLabsSpeech(text: string, speed: number): Promise<ArrayBuffer> {
  const voice = Deno.env.get('ELEVENLABS_VOICE_ID');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', language_code: 'es', voice_settings: { speed } }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status} ${await res.text()}`);
  return res.arrayBuffer();
}

/** Hilo's sentence as mp3 in base64, or null if the voice fails: the talk goes on as text */
async function speak(text: string, speed: number): Promise<string | null> {
  try {
    const audio =
      Deno.env.get('VOICE_PROVIDER') === 'elevenlabs' ? await elevenLabsSpeech(text, speed) : await azureSpeech(text, speed);
    const bytes = new Uint8Array(audio);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } catch (e) {
    console.error('voice', e);
    return null;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'auth' }, 401);

  const { session_id, text } = (await req.json().catch(() => ({}))) as { session_id?: string; text?: string };
  if (text !== undefined && (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT)) {
    return json({ error: 'text' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // The senior on this phone
  const { data: userData } = await db.auth.getUser(auth.replace('Bearer ', ''));
  const { data: me } = await db
    .from('people')
    .select('id, family_id, display_name, locale, timezone, voice_speed')
    .eq('user_id', userData.user?.id ?? '')
    .eq('role', 'senior')
    .maybeSingle();
  if (!me) return json({ error: 'not_senior' }, 403);

  // Open today's talk, or continue the one the phone is in
  let sessionId = session_id;
  if (!sessionId) {
    const { data, error } = await db
      .from('talk_sessions')
      .insert({ family_id: me.family_id, person_id: me.id, locale: me.locale })
      .select('id')
      .single();
    if (error) return json({ error: 'session' }, 500);
    sessionId = data.id;
  }

  const { data: turns, error: turnsError } = await db
    .from('turns')
    .select('seq, speaker, text')
    .eq('session_id', sessionId)
    .order('seq');
  if (turnsError) return json({ error: 'session' }, 404);
  if (turns.length >= MAX_TURNS) return json({ error: 'too_long' }, 429);

  const history = [...turns];
  if (text) {
    const turn = { seq: history.length + 1, speaker: 'senior', text: text.trim() };
    const { error } = await db.from('turns').insert({ ...turn, family_id: me.family_id, session_id: sessionId });
    if (error) return json({ error: 'save' }, 500);
    history.push(turn);
  }

  // Only today's talk, never the full history (cost and privacy). The opening user message is fixed.
  const now = new Date().toLocaleString('es-ES', { timeZone: me.timezone, weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `[Empieza la charla de hoy. Se llama ${me.display_name}. Ahora es ${now}.]` },
    ...history.map((t): Anthropic.MessageParam => ({ role: t.speaker === 'hilo' ? 'assistant' : 'user', content: t.text })),
  ];

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      // Spoken chat: short and fast matters more than deep reasoning
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages,
    });
  } catch (e) {
    console.error('anthropic', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return json({ error: 'llm' }, 502);
  }

  const reply =
    response.stop_reason === 'refusal'
      ? 'Perdona, de eso prefiero no hablar. ¿Me cuentas otra cosa?'
      : response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join(' ')
          .trim();
  if (!reply) return json({ error: 'llm' }, 502);

  const { error: saveError } = await db
    .from('turns')
    .insert({ family_id: me.family_id, session_id: sessionId, seq: history.length + 1, speaker: 'hilo', text: reply });
  if (saveError) return json({ error: 'save' }, 500);

  // On screen the comma before her name is right ("Qué bonito, Margarita"); out loud the voice stops there and sounds robotic
  const firstName = me.display_name.trim().split(/\s+/)[0];
  const spoken = firstName ? reply.replaceAll(`, ${firstName}`, ` ${firstName}`) : reply;
  const audio = await speak(spoken, Number(me.voice_speed));

  const u = response.usage;
  await admin.rpc('add_usage', {
    pid: me.id,
    usage_day: new Date().toLocaleDateString('sv-SE', { timeZone: me.timezone }),
    input_tokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    output_tokens: u.output_tokens,
    characters: audio ? spoken.length : 0,
  });

  return json({ session_id: sessionId, reply, audio });
});
