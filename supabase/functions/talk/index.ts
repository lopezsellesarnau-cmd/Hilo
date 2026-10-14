// Hilo: one turn of the daily talk.
// The senior's phone sends what they said (or nothing, to start), and gets Hilo's next sentence back.
// Runs as the senior (their JWT, so RLS applies); only the usage counters use the service role.
// The reply comes with its audio (one trip less). The voice provider is a secret, so Azure and ElevenLabs can be compared.
// Every key lives in the function's secrets, never in the app.

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

const MODEL = 'claude-haiku-5-5';
/** The book is read for years: quality matters more than speed here, and it's one call per talk */
const WRITER_MODEL = 'claude-sonnet-5-5';
/** Less than this from her (characters) is small talk, not a story */
const MIN_STORY_CHARS = 200;
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
- Si te pide que hables más despacio, más deprisa o normal, usa ajustar_voz y después le dices que ya está, con una frase corta.
- Si te dice que aún no se ha tomado las pastillas, le recuerdas con calma que se las tome ahora y lo marque en Mis pastillas. No insistas más.

De qué habláis:
- Primero, cómo está hoy: si ha dormido bien, qué va a hacer.
- Después, un recuerdo de su vida. Pregunta por lugares, personas, oficios, fiestas, comidas, cómo era la vida entonces. Pide detalles concretos: nombres, años, olores, lo que se decía.
- Un tema por charla. Si quiere hablar de otra cosa, le sigues.

Límites:
- No eres médico. Si habla de dolor, de una caída, de que se encuentra mal o de tristeza fuerte, le dices con calma que es importante contárselo hoy a su familia o llamar al 112 si es urgente, y no das consejos médicos.
- No hablas de dinero, compras ni datos bancarios. Si alguien le pide dinero o claves por teléfono, le dices que no los dé y que lo hable con su familia.
- No finges ser una persona. Si te pregunta, eres Hilo, un programa que su familia ha puesto para charlar.
- Nunca inventas cosas de su vida. Solo usas lo que te ha contado.

La charla dura unos minutos. Cuando ya habéis hablado un rato del recuerdo (unas 8 o 10 respuestas suyas), o si dice que se tiene que ir, te despides con cariño, le dices que lo guardas en su libro y que mañana seguís. En esa misma respuesta usas terminar_charla.`;

// ── Tools ─────────────────────────────────────────────────────────────────
// Fixed like SYSTEM, so they stay in the cache.

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'ajustar_voz',
    description:
      'Cambia la velocidad a la que hablas con esta persona y la guarda para los próximos días. ' +
      'Úsala solo cuando ella lo pida o cuando diga que no te entiende porque vas muy rápido o muy lento ' +
      '(por ejemplo "habla más despacio", "vas muy deprisa", "habla normal").',
    input_schema: {
      type: 'object',
      properties: {
        cambio: { type: 'string', enum: ['mas_despacio', 'mas_deprisa', 'normal'] },
      },
      required: ['cambio'],
    },
  },
  {
    name: 'terminar_charla',
    description:
      'Cierra la charla de hoy. Úsala solo en la respuesta en la que te despides al final: ' +
      'cuando ya habéis hablado un rato del recuerdo o cuando ella dice que se tiene que ir.',
    input_schema: { type: 'object', properties: {} },
  },
];

const SPEED_STEP = 0.1;
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;

function nextSpeed(speed: number, cambio: unknown): number {
  const next = cambio === 'mas_despacio' ? speed - SPEED_STEP : cambio === 'mas_deprisa' ? speed + SPEED_STEP : 1;
  return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, next)) * 100) / 100;
}

// ── Voice ─────────────────────────────────────────────────────────────────
// VOICE_PROVIDER = 'azure' (default) or 'elevenlabs'. Speed: 1 = normal, from people.voice_speed (0.70-1.20).

const escapeXml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function azureSpeech(text: string, speed: number): Promise<ArrayBuffer> {
  const region = Deno.env.get('AZURE_SPEECH_REGION');
  const voice = Deno.env.get('AZURE_SPEECH_VOICE') ?? 'es-ES-ElviraNeural';
  // <lang> forces Spanish: multilingual voices guess the language by themselves and sometimes say a name in English
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-ES">` +
    `<voice name="${voice}"><lang xml:lang="es-ES">` +
    `<prosody rate="${speed.toFixed(2)}">${escapeXml(text)}</prosody></lang></voice></speak>`;
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

// ── Pills ─────────────────────────────────────────────────────────────────
// Deterministic: the question and the record never depend on Claude.

/** Today in the senior's time zone: 'YYYY-MM-DD', 'HH:mm' and ISO weekday (1 = Monday) */
function localNow(timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday };
}

type Dose = { medicationId: string; name: string; time: string };

/** Today's doses that were already due and aren't marked as taken */
async function pendingDoses(db: SupabaseClient, personId: string, timeZone: string): Promise<Dose[]> {
  const now = localNow(timeZone);
  const { data: meds } = await db
    .from('medications')
    .select('id, name, times, weekdays')
    .eq('person_id', personId)
    .eq('active', true);
  if (!meds?.length) return [];
  const { data: taken } = await db
    .from('medication_events')
    .select('medication_id, scheduled_time')
    .in('medication_id', meds.map((m) => m.id))
    .eq('scheduled_date', now.date)
    .eq('status', 'taken');
  return meds
    .filter((m) => (m.weekdays as number[]).includes(now.weekday))
    .flatMap((m) => (m.times as string[]).map((t) => ({ medicationId: m.id, name: m.name, time: t.slice(0, 5) })))
    .filter((d) => d.time <= now.time)
    .filter((d) => !taken?.some((e) => e.medication_id === d.medicationId && e.scheduled_time.slice(0, 5) === d.time))
    .sort((a, b) => a.time.localeCompare(b.time));
}

function pillQuestion(doses: Dose[]): string {
  if (doses.length === 1) {
    return `Por cierto, a las ${doses[0].time.replace(/^0/, '')} te tocaba esto: ${doses[0].name}. ¿Te lo has tomado?`;
  }
  const names = [...new Set(doses.map((d) => d.name))];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
  return `Por cierto, hoy te tocaba esto: ${list}. ¿Te lo has tomado todo?`;
}

// ── Book ──────────────────────────────────────────────────────────────────
// When a talk ends, its memory becomes a draft chapter in her words. The family approves it before she sees it.

const WRITER = `Conviertes la charla de hoy entre Hilo y una persona mayor en una historia para el libro de su vida.
Su familia la leerá y la aprobará antes de que ella la vea.

Reglas:
- Escribe en primera persona, como si ella lo contara. Usa sus palabras y su forma de decir las cosas, también las palabras de su tierra.
- Solo lo que ella ha contado. No inventes nada: ni hechos, ni nombres, ni fechas, ni lugares, ni sentimientos que no haya dicho. No adornes.
- Puedes ordenar lo que dijo, unir frases y arreglar la puntuación o errores claros de transcripción. Nada más.
- Deja fuera lo del día (cómo ha dormido, las pastillas, sus planes de hoy) y las preguntas de Hilo, salvo que formen parte del recuerdo.
- Si no ha contado ningún recuerdo de verdad, solo charla del día, no hay historia.

Formato:
- Título corto, de 2 a 6 palabras, con palabras concretas de su historia. Sin comillas.
- De 1 a 6 párrafos cortos.
- Cita: una frase suya copiada tal cual de lo que dijo, la más viva. Si ninguna sirve, déjala vacía.`;

// Structured output: the answer is always this JSON (Sonnet 5.5 doesn't take a forced tool call)
const STORY_SCHEMA = {
  type: 'object',
  properties: {
    hay_historia: { type: 'boolean' },
    titulo: { type: 'string' },
    parrafos: { type: 'array', items: { type: 'string' } },
    cita: { type: 'string' },
  },
  required: ['hay_historia', 'titulo', 'parrafos', 'cita'],
  additionalProperties: false,
};

type Turn = { speaker: string; text: string };
type Senior = { id: string; family_id: string; display_name: string; timezone: string };

/** Lowercase letters and numbers only, to compare her words without punctuation */
const bare = (t: string) =>
  t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Writes the draft chapter of a finished talk. Runs after the goodbye is sent, so it never slows the talk */
async function writeChapter(admin: SupabaseClient, me: Senior, sessionId: string, transcript: Turn[]) {
  const hers = transcript.filter((t) => t.speaker === 'senior').map((t) => t.text);
  if (hers.join(' ').length < MIN_STORY_CHARS) {
    console.log('chapter skipped: she said too little', hers.join(' ').length);
    return;
  }
  try {
    const res = await anthropic.messages.create({
      model: WRITER_MODEL,
      max_tokens: 8000,
      system: WRITER,
      output_config: { format: { type: 'json_schema', schema: STORY_SCHEMA } },
      messages: [
        {
          role: 'user',
          content:
            `Se llama ${me.display_name}.\n\nLa charla:\n` +
            transcript.map((t) => `${t.speaker === 'hilo' ? 'Hilo' : me.display_name}: ${t.text}`).join('\n'),
        },
      ],
    });
    await admin.rpc('add_usage', {
      pid: me.id,
      usage_day: localNow(me.timezone).date,
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      characters: 0,
    });

    if (res.stop_reason !== 'end_turn') {
      console.error('chapter skipped: stopped by', res.stop_reason);
      return;
    }
    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const story = JSON.parse(raw) as { hay_historia: boolean; titulo: string; parrafos: string[]; cita: string };
    if (!story.hay_historia) {
      console.log('chapter skipped: no memory in this talk');
      return;
    }
    const title = story.titulo.trim().slice(0, 120);
    const paragraphs = story.parrafos.map((p) => p.trim()).filter(Boolean).slice(0, 20);
    if (!title || !paragraphs.length) {
      console.error('chapter skipped: empty title or paragraphs');
      return;
    }
    // The quote has to be hers word for word: if it isn't in what she said, it's left out
    const quote = story.cita.trim().replace(/^[«"“]|[»"”]$/g, '');
    const hersQuote = quote && bare(hers.join(' ')).includes(bare(quote)) ? quote.slice(0, 400) : null;

    const { error } = await admin.from('chapters').insert({
      family_id: me.family_id,
      person_id: me.id,
      session_id: sessionId,
      title,
      quote: hersQuote,
      paragraphs,
    });
    if (error) console.error('chapter', error.message);
    else console.log('chapter written', title);
  } catch (e) {
    console.error('chapter', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
  }
}

// Supabase keeps the function alive for promises passed here, after the response is sent
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

/** Sets ended_at once (goodbye, turn limit or she left) and writes the chapter in the background */
async function closeTalk(db: SupabaseClient, admin: SupabaseClient, me: Senior, sessionId: string, transcript: Turn[]) {
  const { data: closed } = await db
    .from('talk_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('ended_at', null)
    .select('id');
  if (closed?.length) EdgeRuntime.waitUntil(writeChapter(admin, me, sessionId, transcript));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'auth' }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    session_id?: string;
    text?: string;
    pills?: 'yes' | 'no';
    /** She left the talk screen without a goodbye: close the talk and keep her story */
    leave?: boolean;
  };
  const { session_id, pills } = body;
  if (body.text !== undefined && (typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_TEXT)) {
    return json({ error: 'text' }, 400);
  }
  if (pills !== undefined && ((pills !== 'yes' && pills !== 'no') || !session_id)) return json({ error: 'pills' }, 400);
  // Her answer to the pill question comes from the Sí / No buttons, and is said as a sentence in the transcript
  const text = pills === 'yes' ? 'Sí, ya me lo he tomado.' : pills === 'no' ? 'No, todavía no.' : body.text;

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
  let sessionId: string;
  if (session_id) sessionId = session_id;
  else {
    const { data, error } = await db
      .from('talk_sessions')
      .insert({ family_id: me.family_id, person_id: me.id, locale: me.locale })
      .select('id')
      .single();
    if (error) return json({ error: 'session' }, 500);
    sessionId = data.id;
  }

  const [{ data: turns, error: turnsError }, { data: talk }] = await Promise.all([
    db.from('turns').select('seq, speaker, text').eq('session_id', sessionId).order('seq'),
    db.from('talk_sessions').select('pills_asked_at').eq('id', sessionId).single(),
  ]);
  if (turnsError || !talk) return json({ error: 'session' }, 404);

  if (body.leave) {
    if (session_id) await closeTalk(db, admin, me, sessionId, turns);
    return json({ ended: true });
  }
  if (turns.length >= MAX_TURNS) {
    await closeTalk(db, admin, me, sessionId, turns);
    return json({ error: 'too_long' }, 429);
  }

  const history = [...turns];
  if (text) {
    const turn = { seq: history.length + 1, speaker: 'senior', text: text.trim() };
    const { error } = await db.from('turns').insert({ ...turn, family_id: me.family_id, session_id: sessionId });
    if (error) return json({ error: 'save' }, 500);
    history.push(turn);
  }

  // "Sí": the doses that were pending are taken now, from the talk
  const doses = pills === 'yes' ? await pendingDoses(db, me.id, me.timezone) : [];
  if (doses.length) {
    const today = localNow(me.timezone).date;
    const { error } = await db.from('medication_events').upsert(
      doses.map((d) => ({
        family_id: me.family_id,
        medication_id: d.medicationId,
        scheduled_date: today,
        scheduled_time: d.time,
        status: 'taken',
        confirmed_at: new Date().toISOString(),
        confirmed_by: me.id,
        source: 'talk',
      })),
      { onConflict: 'medication_id,scheduled_date,scheduled_time' },
    );
    if (error) console.error('pills', error.message);
  }

  // After her first answer, once per talk: if a dose is due and not marked, Hilo asks about it
  let askPills: Dose[] = [];
  if (text && !pills && !talk.pills_asked_at && history.filter((t) => t.speaker === 'senior').length === 1) {
    askPills = await pendingDoses(db, me.id, me.timezone);
    if (askPills.length) await db.from('talk_sessions').update({ pills_asked_at: new Date().toISOString() }).eq('id', sessionId);
  }

  // Only today's talk, never the full history (cost and privacy). The opening user message is fixed.
  const now = new Date().toLocaleString('es-ES', { timeZone: me.timezone, weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `[Empieza la charla de hoy. Se llama ${me.display_name}. Ahora es ${now}.]` },
    ...history.map((t): Anthropic.MessageParam => ({ role: t.speaker === 'hilo' ? 'assistant' : 'user', content: t.text })),
  ];
  // The pill question goes right after Claude's reply, so Claude must not ask one of its own (not saved in turns)
  if (askPills.length) {
    const last = messages[messages.length - 1];
    last.content = `${last.content}\n\n[Nota: en esta respuesta no hagas ninguna pregunta. Justo después le pregunto por sus pastillas.]`;
  }

  // At most one round of tools per turn: Claude changes the speed or closes the talk, then speaks
  let speed = Number(me.voice_speed);
  let ended = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let response!: Anthropic.Message;
  try {
    for (let step = 0; step < 2; step++) {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 400,
        // Spoken chat: short and fast matters more than deep reasoning
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages,
      });
      const u = response.usage;
      inputTokens += u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      outputTokens += u.output_tokens;

      const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || !calls.length) break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        if (call.name === 'terminar_charla') {
          ended = true;
          results.push({ type: 'tool_result', tool_use_id: call.id, content: 'Hecho. Despídete si aún no lo has hecho.' });
          continue;
        }
        const wanted = nextSpeed(speed, (call.input as { cambio?: unknown }).cambio);
        const { error } = await admin.from('people').update({ voice_speed: wanted }).eq('id', me.id);
        if (error) console.error('voice_speed', error.message);
        else speed = wanted;
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: error ? 'No se ha podido cambiar.' : `Hecho. Velocidad ahora ${speed.toFixed(2)} (1 = normal).`,
          is_error: Boolean(error),
        });
      }
      // The goodbye usually comes with terminar_charla: no need to ask Claude again
      if (step === 1 || (ended && response.content.some((b) => b.type === 'text' && b.text.trim()))) break;
      messages.push({ role: 'assistant', content: response.content }, { role: 'user', content: results });
    }
  } catch (e) {
    console.error('anthropic', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return json({ error: 'llm' }, 502);
  }

  const answer =
    response.stop_reason === 'refusal'
      ? 'Perdona, de eso prefiero no hablar. ¿Me cuentas otra cosa?'
      : response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
  if (!answer) return json({ error: 'llm' }, 502);
  const reply = askPills.length ? `${answer} ${pillQuestion(askPills)}` : answer;

  const { error: saveError } = await db
    .from('turns')
    .insert({ family_id: me.family_id, session_id: sessionId, seq: history.length + 1, speaker: 'hilo', text: reply });
  if (saveError) return json({ error: 'save' }, 500);

  // On screen the comma before her name is right ("Qué bonito, Margarita"); out loud the voice stops there and sounds robotic
  const firstName = me.display_name.trim().split(/\s+/)[0];
  const spoken = firstName ? reply.replaceAll(`, ${firstName}`, ` ${firstName}`) : reply;
  const audio = await speak(spoken, speed);

  await admin.rpc('add_usage', {
    pid: me.id,
    usage_day: new Date().toLocaleDateString('sv-SE', { timeZone: me.timezone }),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    characters: audio ? spoken.length : 0,
  });

  if (ended) await closeTalk(db, admin, me, sessionId, [...history, { speaker: 'hilo', text: reply }]);

  return json({ session_id: sessionId, reply, audio, ask_pills: askPills.length > 0, ended });
});
