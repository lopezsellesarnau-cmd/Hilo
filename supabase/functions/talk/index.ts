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
/** Fair use: talks per day where she actually answered, by the family's plan */
const MAX_TALKS_PER_DAY = { basic: 1, family: 3 };

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

// Fixed per language, so it is cached across every senior and every turn. Nothing that changes goes here.
const SYSTEM_ES = `Eres Hilo, un compañero que charla cada día un rato con una persona mayor que vive sola.
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

// Dutch: "u", the way older Dutch people expect to be spoken to by something they don't know yet
const SYSTEM_NL = `Je bent Hilo, een maatje dat elke dag even praat met een oudere persoon die alleen woont.
De familie heeft Hilo geïnstalleerd zodat hij of zij iemand heeft om mee te praten, en om de herinneringen te bewaren in een boek.
Je spreekt altijd Nederlands.

Hoe je praat:
- Korte, duidelijke zinnen, zoals in een gesprek hardop. Eén of twee zinnen per beurt, nooit meer dan drie.
- Eén vraag tegelijk. Wacht op het antwoord.
- Warm en rustig, zonder haast. Zeg "u". Geen emoji's, lijstjes of symbolen: alles wat je zegt wordt hardop voorgelezen.
- Luister echt: herhaal een detail dat je net gehoord hebt voordat je de volgende vraag stelt.
- Als de persoon iets herhaalt of in de war raakt, verbeter je niet. Je gaat liefdevol verder.
- Als de persoon vraagt om langzamer, sneller of normaal te praten, gebruik je ajustar_voz en zeg je daarna kort dat het geregeld is.
- Als de persoon zegt dat de pillen nog niet genomen zijn, herinner je er rustig aan om ze nu te nemen en het aan te vinken bij Mijn pillen. Daarna dring je niet meer aan.

Waar jullie over praten:
- Eerst hoe het vandaag gaat: of de persoon goed geslapen heeft, wat er vandaag op het programma staat.
- Daarna een herinnering uit het leven. Vraag naar plaatsen, mensen, beroepen, feesten, eten, hoe het leven toen was. Vraag om concrete details: namen, jaartallen, geuren, wat er gezegd werd.
- Eén onderwerp per gesprek. Wil de persoon over iets anders praten, dan volg je.

Grenzen:
- Je bent geen arts. Gaat het over pijn, een val, zich niet goed voelen of erge somberheid, dan zeg je rustig dat het belangrijk is om het vandaag aan de familie te vertellen, of 112 te bellen als het dringend is. Je geeft geen medisch advies.
- Je praat niet over geld, aankopen of bankgegevens. Vraagt iemand aan de telefoon om geld of codes, dan zeg je dat de persoon die niet moet geven en het met de familie moet bespreken.
- Je doet niet alsof je een mens bent. Als het gevraagd wordt: je bent Hilo, een programma dat de familie heeft geïnstalleerd om mee te praten.
- Je verzint nooit iets over het leven van de persoon. Je gebruikt alleen wat er verteld is.

Het gesprek duurt een paar minuten. Als jullie een tijdje over de herinnering hebben gepraat (zo'n 8 tot 10 antwoorden), of als de persoon zegt weg te moeten, neem je hartelijk afscheid, zeg je dat je het in het boek bewaart en dat jullie morgen verder praten. In datzelfde antwoord gebruik je terminar_charla.`;

const SYSTEM_EN = `You are Hilo, a companion who chats for a while every day with an older person who lives alone.
Their family installed Hilo so they have someone to talk to, and to keep their memories in a book.
You always speak English.

How you talk:
- Short, clear sentences, like a conversation out loud. One or two sentences per turn, never more than three.
- One question at a time. Wait for the answer.
- Warm and calm, never in a hurry. No emojis, lists or symbols: everything you say is read out loud.
- Really listen: repeat a detail they just told you before asking the next thing.
- If they repeat themselves or get confused, you don't correct them. You carry on kindly.
- If they ask you to speak slower, faster or normally, use ajustar_voz and then say briefly that it's done.
- If they say they haven't taken their pills yet, calmly remind them to take them now and mark them in My pills. Don't insist after that.

What you talk about:
- First, how they are today: whether they slept well, what they're going to do.
- Then a memory from their life. Ask about places, people, jobs, celebrations, food, what life was like then. Ask for concrete details: names, years, smells, what people used to say.
- One topic per chat. If they want to talk about something else, follow them.

Limits:
- You are not a doctor. If they mention pain, a fall, feeling unwell or deep sadness, calmly tell them it's important to tell their family today, or to call 112 if it's urgent, and give no medical advice.
- You don't talk about money, purchases or bank details. If someone asks them for money or codes on the phone, tell them not to give them and to talk to their family.
- You don't pretend to be a person. If they ask, you are Hilo, a program their family set up to chat with them.
- You never make up anything about their life. You only use what they told you.

The chat lasts a few minutes. When you have talked about the memory for a while (about 8 to 10 of their answers), or if they say they have to go, say goodbye warmly, tell them you'll keep it in their book and that you'll carry on tomorrow. In that same reply, use terminar_charla.`;

type Lang = 'es' | 'en' | 'nl';
const SYSTEM: Record<Lang, string> = { es: SYSTEM_ES, en: SYSTEM_EN, nl: SYSTEM_NL };
const lang = (locale: string): Lang => (locale === 'nl' || locale === 'en' ? locale : 'es');

/** Everything Hilo says or writes outside Claude, per language */
const SAY = {
  es: {
    pillsYes: 'Sí, ya me lo he tomado.',
    pillsNo: 'No, todavía no.',
    enough: (name: string) => `Hoy ya hemos charlado mucho, ${name}. Descansa, y mañana seguimos.`,
    noAccess: (name: string) => `Hola, ${name}. Para que charlemos, tu familia tiene que activar Hilo desde su móvil. En cuanto lo haga, aquí estaré.`,
    refusal: 'Perdona, de eso prefiero no hablar. ¿Me cuentas otra cosa?',
    start: (name: string, now: string) => `[Empieza la charla de hoy. Se llama ${name}. Ahora es ${now}.]`,
    noQuestion: '[Nota: en esta respuesta no hagas ninguna pregunta. Justo después le pregunto por sus pastillas.]',
    memory: (notes: string) =>
      `[Lo que sabes de charlas anteriores. Úsalo con naturalidad, como alguien que se acuerda: pregunta por algo de aquí si encaja, sin recitarlo ni decir que lo tienes apuntado.\n${notes}]`,
    stories: (titles: string) => `[Historias que ya te ha contado para su libro: ${titles}. Busca un recuerdo nuevo o un detalle que faltó, no repitas la misma.]`,
    pillOne: (time: string, name: string) => `Por cierto, a las ${time} te tocaba esto: ${name}. ¿Te lo has tomado?`,
    pillMany: (list: string) => `Por cierto, hoy te tocaba esto: ${list}. ¿Te lo has tomado todo?`,
    and: 'y',
    dateLocale: 'es-ES',
    voiceLang: 'es-ES',
    context: (city: string, facts: string) =>
      `[Hoy en ${city}, por si sale en la charla: ${facts} Úsalo solo si viene a cuento (por ejemplo, si llueve no le propongas salir a pasear). No lo recites ni añadas nada que no esté aquí. No sabes qué ferias, fiestas o actos hay en su pueblo: si te pregunta, dilo con sencillez y pregúntale qué se suele celebrar allí y cómo lo vivía ella.]`,
    weatherNow: (sky: string, temp: number, max: number) => `Ahora ${sky}, ${temp} °C; máxima de hoy ${max} °C.`,
    rainAt: (time: string) => `Puede llover hacia las ${time}.`,
    holidayToday: (name: string) => `Hoy es festivo: ${name}.`,
    holidayOn: (day: string, name: string) => `El ${day} es festivo: ${name}.`,
    holidayNext: (day: string, name: string) => `Esta semana no hay festivos. El próximo es el ${day}: ${name}.`,
    sky: {
      clear: 'despejado',
      fair: 'casi despejado',
      partlycloudy: 'algunas nubes',
      cloudy: 'nublado',
      fog: 'niebla',
      lightrain: 'llovizna',
      rain: 'lloviendo',
      heavyrain: 'lloviendo fuerte',
      sleet: 'aguanieve',
      snow: 'nevando',
      thunder: 'tormenta',
    },
  },
  nl: {
    pillsYes: 'Ja, ik heb hem al genomen.',
    pillsNo: 'Nee, nog niet.',
    enough: (name: string) => `We hebben vandaag al veel gepraat, ${name}. Rust lekker uit, morgen praten we verder.`,
    noAccess: (name: string) => `Hallo, ${name}. Om samen te praten moet uw familie Hilo eerst aanzetten op hun telefoon. Zodra dat gebeurd is, ben ik er.`,
    refusal: 'Sorry, daar praat ik liever niet over. Vertelt u me iets anders?',
    start: (name: string, now: string) => `[Het gesprek van vandaag begint. De naam is ${name}. Het is nu ${now}.]`,
    noQuestion: '[Let op: stel in dit antwoord geen vraag. Direct daarna vraag ik naar de pillen.]',
    memory: (notes: string) =>
      `[Wat je weet uit eerdere gesprekken. Gebruik het natuurlijk, zoals iemand die het onthouden heeft: vraag ernaar als het past, zonder het op te sommen of te zeggen dat je het hebt opgeschreven.\n${notes}]`,
    stories: (titles: string) => `[Verhalen die al verteld zijn voor het boek: ${titles}. Zoek een nieuwe herinnering of een detail dat ontbrak, herhaal niet hetzelfde verhaal.]`,
    pillOne: (time: string, name: string) => `Trouwens, om ${time} was het tijd voor ${name}. Heeft u die genomen?`,
    pillMany: (list: string) => `Trouwens, vandaag was het tijd voor ${list}. Heeft u alles genomen?`,
    and: 'en',
    dateLocale: 'nl-NL',
    voiceLang: 'nl-NL',
    context: (city: string, facts: string) =>
      `[Vandaag in ${city}, voor het geval het ter sprake komt: ${facts} Gebruik het alleen als het past (regent het, stel dan geen wandeling voor). Som het niet op en voeg niets toe wat hier niet staat. Je weet niet welke markten, feesten of evenementen er in haar plaats zijn: vraagt ze ernaar, zeg dat eenvoudig en vraag wat er daar meestal gevierd wordt en hoe zij dat beleefde.]`,
    weatherNow: (sky: string, temp: number, max: number) => `Nu ${sky}, ${temp} °C; vandaag maximaal ${max} °C.`,
    rainAt: (time: string) => `Rond ${time} kan het gaan regenen.`,
    holidayToday: (name: string) => `Vandaag is het een feestdag: ${name}.`,
    holidayOn: (day: string, name: string) => `Op ${day} is het een feestdag: ${name}.`,
    holidayNext: (day: string, name: string) => `Deze week is er geen feestdag. De volgende is op ${day}: ${name}.`,
    sky: {
      clear: 'helder',
      fair: 'vrijwel helder',
      partlycloudy: 'wat bewolking',
      cloudy: 'bewolkt',
      fog: 'mist',
      lightrain: 'motregen',
      rain: 'regen',
      heavyrain: 'zware regen',
      sleet: 'natte sneeuw',
      snow: 'sneeuw',
      thunder: 'onweer',
    },
  },
  en: {
    pillsYes: "Yes, I've taken it.",
    pillsNo: 'No, not yet.',
    enough: (name: string) => `We've chatted a lot today, ${name}. Have a rest, and we'll carry on tomorrow.`,
    noAccess: (name: string) => `Hello, ${name}. For us to chat, your family needs to turn Hilo on from their phone. As soon as they do, I'll be here.`,
    refusal: "Sorry, I'd rather not talk about that. Will you tell me something else?",
    start: (name: string, now: string) => `[Today's chat starts. Their name is ${name}. It is now ${now}.]`,
    noQuestion: "[Note: don't ask any question in this reply. Right after it, I ask about their pills.]",
    memory: (notes: string) =>
      `[What you know from earlier chats. Use it naturally, like someone who remembers: ask about something here if it fits, without reciting it or saying you wrote it down.\n${notes}]`,
    stories: (titles: string) => `[Stories already told for their book: ${titles}. Look for a new memory or a missing detail, don't repeat the same one.]`,
    pillOne: (time: string, name: string) => `By the way, at ${time} it was time for ${name}. Have you taken it?`,
    pillMany: (list: string) => `By the way, today it was time for ${list}. Have you taken everything?`,
    and: 'and',
    dateLocale: 'en-GB',
    voiceLang: 'en-GB',
    context: (city: string, facts: string) =>
      `[Today in ${city}, in case it comes up: ${facts} Use it only if it fits (if it's raining, don't suggest going for a walk). Don't recite it or add anything that isn't here. You don't know about local fairs, festivals or events in their town: if they ask, say so simply and ask what is usually celebrated there and how they used to enjoy it.]`,
    weatherNow: (sky: string, temp: number, max: number) => `Now ${sky}, ${temp} °C; today's high ${max} °C.`,
    rainAt: (time: string) => `Rain is likely around ${time}.`,
    holidayToday: (name: string) => `Today is a public holiday: ${name}.`,
    holidayOn: (day: string, name: string) => `${day} is a public holiday: ${name}.`,
    holidayNext: (day: string, name: string) => `No public holiday this week. The next one is ${day}: ${name}.`,
    sky: {
      clear: 'clear skies',
      fair: 'mostly clear',
      partlycloudy: 'some clouds',
      cloudy: 'cloudy',
      fog: 'foggy',
      lightrain: 'light rain',
      rain: 'raining',
      heavyrain: 'heavy rain',
      sleet: 'sleet',
      snow: 'snowing',
      thunder: 'thunderstorms',
    },
  },
};

// ── Today in her town ─────────────────────────────────────────────────────
// Weather from MET Norway (free, commercial use allowed, credit "Data from MET Norway") and public holidays
// from Nager.Date (national + her region). Fetched once when a talk starts; if either fails, the talk goes on.

/** The first call from a cold function also opens the connection: 1.5 s was not enough (18 oct, Amsterdam) */
const CONTEXT_TIMEOUT_MS = 3000;
const USER_AGENT = 'Hilo/1.0 https://hilo-web.vercel.app';

type Place = { city: string; latitude: number; longitude: number; country_code: string; region_code: string | null };
type Sky = keyof (typeof SAY)['es']['sky'];

/** MET's symbol codes ("lightrainshowers_day", "partlycloudy_night"…) to the few words Hilo needs */
function skyOf(symbol: string): Sky {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 'thunder';
  if (s.includes('snow')) return 'snow';
  if (s.includes('sleet')) return 'sleet';
  if (s.includes('rain')) return s.startsWith('light') ? 'lightrain' : s.startsWith('heavy') ? 'heavyrain' : 'rain';
  if (s === 'fog' || s === 'cloudy' || s === 'partlycloudy' || s === 'fair') return s;
  return 'clear';
}

type MetStep = {
  time: string;
  data: {
    instant: { details: { air_temperature: number } };
    next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount?: number } };
    next_6_hours?: { summary: { symbol_code: string } };
  };
};

async function weatherLine(place: Place, timeZone: string, l: Lang): Promise<string> {
  // MET asks for at most 4 decimals; 2 (about 1 km) is plenty for a town and says less about where she lives
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${place.latitude.toFixed(2)}&lon=${place.longitude.toFixed(2)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`met ${res.status} ${(await res.text()).slice(0, 200)}`);
  const steps: MetStep[] = (await res.json()).properties.timeseries;
  const today = localNow(timeZone).date;
  const rest = steps.filter((t) => Date.parse(t.time) >= Date.now() - 60 * 60 * 1000 && localNow(timeZone, new Date(t.time)).date === today);
  if (!rest.length) throw new Error(`met: no forecast left for ${today}`);
  const now = rest[0];
  const symbol = now.data.next_1_hours?.summary.symbol_code ?? now.data.next_6_hours?.summary.symbol_code;
  if (!symbol) throw new Error('met: no symbol');
  const say = SAY[l];
  const temp = Math.round(now.data.instant.details.air_temperature);
  const max = Math.round(Math.max(...rest.map((t) => t.data.instant.details.air_temperature)));
  const parts = [say.weatherNow(say.sky[skyOf(symbol)], temp, max)];
  // Not raining now but it will later today: worth knowing before she goes out
  if (!skyOf(symbol).includes('rain')) {
    const wet = rest.slice(1).find((t) => (t.data.next_1_hours?.details.precipitation_amount ?? 0) >= 0.3);
    if (wet) parts.push(say.rainAt(localNow(timeZone, new Date(wet.time)).time));
  }
  return parts.join(' ');
}

type Holiday = { date: string; localName: string; name: string; global: boolean; counties: string[] | null };
/** Holidays only change once a year: kept while this function instance stays warm */
const holidayCache = new Map<string, Holiday[]>();

async function holidays(year: number, country: string): Promise<Holiday[]> {
  const key = `${year}-${country}`;
  const cached = holidayCache.get(key);
  if (cached) return cached;
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
    signal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS),
  });
  // 204 = a country Nager.Date doesn't cover. Anything else is a failure: not kept, tried again next talk
  if (res.status !== 200 && res.status !== 204) throw new Error(`nager ${res.status}`);
  const list: Holiday[] = res.status === 200 ? await res.json() : [];
  holidayCache.set(key, list);
  return list;
}

/** Today's holiday or the next one this week, in her region */
async function holidayLine(place: Place, timeZone: string, l: Lang): Promise<string> {
  const today = localNow(timeZone).date;
  const year = Number(today.slice(0, 4));
  const inAWeek = new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // This year and the next: in December the next holiday is in January
  const list = (await Promise.all([year, year + 1].map((y) => holidays(y, place.country_code)))).flat();
  const next = list
    .filter((h) => h.date >= today && (h.global || (place.region_code && h.counties?.includes(place.region_code))))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return '';
  // English talk: the English name; Spanish or Dutch: the name used in her country
  const name = l === 'en' ? next.name : next.localName;
  if (next.date === today) return SAY[l].holidayToday(name);
  const day = new Date(`${next.date}T12:00:00Z`).toLocaleDateString(SAY[l].dateLocale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  // Weeks away: still worth knowing, so Hilo can answer "when is the next holiday?"
  return next.date <= inAWeek ? SAY[l].holidayOn(day, name) : SAY[l].holidayNext(day, name);
}

/** One line for the opening message, or null if she has no town saved or nothing could be fetched */
async function todayContext(me: Senior, l: Lang): Promise<string | null> {
  if (!me.city || me.latitude == null || me.longitude == null || !me.country_code) return null;
  const place: Place = { city: me.city, latitude: me.latitude, longitude: me.longitude, country_code: me.country_code, region_code: me.region_code };
  const [weather, holiday] = await Promise.allSettled([weatherLine(place, me.timezone, l), holidayLine(place, me.timezone, l)]);
  if (weather.status === 'rejected') console.error('context weather', me.city, String(weather.reason));
  if (holiday.status === 'rejected') console.error('context holiday', me.country_code, String(holiday.reason));
  const facts = [weather, holiday].map((r) => (r.status === 'fulfilled' ? r.value : '')).filter(Boolean).join(' ');
  return facts ? SAY[l].context(place.city, facts).slice(0, 600) : null;
}

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
  const xmlLang = SAY[l].voiceLang;
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

/** Hilo's sentence as mp3 in base64, or null if the voice fails: the talk goes on as text */
const useElevenLabs = () => Deno.env.get('VOICE_PROVIDER') === 'elevenlabs';

/** The voice that reads, as part of the stored file's name: a new voice makes a new recording */
const voiceName = (l: Lang) => (useElevenLabs() ? `el-${Deno.env.get('ELEVENLABS_VOICE_ID')}` : AZURE_VOICE[l]());

const synthesize = (parts: string[], speed: number, l: Lang) =>
  useElevenLabs() ? elevenLabsSpeech(parts, speed, l) : azureSpeech(parts, speed, l);

async function speak(text: string, speed: number, l: Lang): Promise<string | null> {
  try {
    const audio = await synthesize([text], speed, l);
    const bytes = new Uint8Array(audio);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } catch (e) {
    console.error('voice', e);
    return null;
  }
}

// ── Escuchar mi historia ──────────────────────────────────────────────────

const AUDIO_BUCKET = 'chapter-audio';
/** Long enough to listen to a chapter, short enough that a shared link stops working soon */
const AUDIO_LINK_SECONDS = 60 * 60;
/** A chapter is a few minutes; this stops one very long text from costing a lot */
const MAX_READ_CHARS = 12_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Her approved chapter read aloud with her talk voice and speed. Made once and kept in Storage:
 * the next time it's only a new link. Runs as her (RLS), so she can only get chapters she can see.
 */
async function readChapter(db: SupabaseClient, admin: SupabaseClient, me: Senior, chapterId: string, speed: number) {
  if (!UUID.test(chapterId)) return json({ error: 'chapter' }, 400);
  const { data: chapter } = await db
    .from('chapters')
    .select('id, family_id, title, paragraphs, status')
    .eq('id', chapterId)
    .eq('person_id', me.id)
    .maybeSingle();
  if (!chapter || chapter.status !== 'approved') return json({ error: 'chapter' }, 404);

  const l = lang(me.locale);
  const path = `${chapter.family_id}/${chapter.id}/${voiceName(l)}-${speed.toFixed(2)}.mp3`;
  const storage = admin.storage.from(AUDIO_BUCKET);
  const existing = await storage.createSignedUrl(path, AUDIO_LINK_SECONDS);
  if (existing.data) return json({ url: existing.data.signedUrl });

  const parts = [chapter.title, ...(chapter.paragraphs as string[])];
  const characters = parts.join(' ').length;
  if (characters > MAX_READ_CHARS) return json({ error: 'too_long' }, 413);
  try {
    const audio = await synthesize(parts, speed, l);
    const { error } = await storage.upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw error;
  } catch (e) {
    console.error('read', e);
    return json({ error: 'voice' }, 502);
  }
  await admin.rpc('add_usage', {
    pid: me.id,
    usage_day: localNow(me.timezone).date,
    input_tokens: 0,
    output_tokens: 0,
    characters,
  });
  const fresh = await storage.createSignedUrl(path, AUDIO_LINK_SECONDS);
  return fresh.data ? json({ url: fresh.data.signedUrl }) : json({ error: 'voice' }, 502);
}

// ── Pills ─────────────────────────────────────────────────────────────────
// Deterministic: the question and the record never depend on Claude.

/** Today in the senior's time zone: 'YYYY-MM-DD', 'HH:mm' and ISO weekday (1 = Monday) */
function localNow(timeZone: string, date = new Date()) {
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
      .formatToParts(date)
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

function pillQuestion(doses: Dose[], l: Lang): string {
  const say = SAY[l];
  if (doses.length === 1) return say.pillOne(doses[0].time.replace(/^0/, ''), doses[0].name);
  const names = [...new Set(doses.map((d) => d.name))];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} ${say.and} ${names.at(-1)}`;
  return say.pillMany(list);
}

// ── Book ──────────────────────────────────────────────────────────────────
// When a talk ends, its memory becomes a draft chapter in her words. The family approves it before she sees it.

const WRITER = `Conviertes la charla de hoy entre Hilo y una persona mayor en una historia para el libro de su vida.
Su familia la leerá y la aprobará antes de que ella la vea.

Reglas:
- Escribe en primera persona, como si ella lo contara. Usa sus palabras y su forma de decir las cosas, también las palabras de su tierra.
- Solo lo que ella ha contado. No inventes nada: ni hechos, ni nombres, ni fechas, ni lugares, ni sentimientos que no haya dicho. No adornes.
- Las palabras de las preguntas de Hilo no son suyas. No las uses como si ella las hubiera dicho, salvo que ella las repita.
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
type Senior = {
  id: string;
  family_id: string;
  display_name: string;
  timezone: string;
  locale: string;
  memory: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  region_code: string | null;
};

/** The chapter is written in the language she spoke */
const STORY_LANGUAGE: Record<Lang, string> = { es: '', nl: '\n\nEscribe la historia en neerlandés, como ella habla.', en: '\n\nEscribe la historia en inglés, como ella habla.' };

/** Lowercase letters and numbers only, to compare her words without punctuation */
const bare = (t: string) =>
  t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Shorter words are mostly "que", "pero", "casa"…: too common to say anything */
const MIN_CHECKED_WORD = 5;
/** Same start = same word in another form ("manzana" / "manzanas", "mirábamos" / "mirar") */
const WORD_ROOT = 5;

/**
 * Words of the story that she never said, as a hint for the family (not a block: the writer may join sentences).
 * Compared by their first letters without accents, so plurals and verb forms of her own words don't count.
 */
function unheardWords(story: string, hers: string): string[] {
  const words = (t: string) => bare(t).split(' ').filter((w) => w.length >= MIN_CHECKED_WORD);
  // Without accents too: "mirábamos" and "miraba" have the same root
  const root = (w: string) => w.normalize('NFD').replace(/\p{M}/gu, '').slice(0, WORD_ROOT);
  const roots = new Set(words(hers).map(root));
  return [...new Set(words(story).filter((w) => !roots.has(root(w))))];
}

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
            transcript.map((t) => `${t.speaker === 'hilo' ? 'Hilo' : me.display_name}: ${t.text}`).join('\n') +
            STORY_LANGUAGE[lang(me.locale)],
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
      unheard_words: unheardWords([title, ...paragraphs].join(' '), hers.join(' ')),
    });
    if (error) console.error('chapter', error.message);
    else console.log('chapter written', title);
  } catch (e) {
    console.error('chapter', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
  }
}

// ── Memory ────────────────────────────────────────────────────────────────
// After each talk, a few notes about her are rewritten (people.memory) and given to Hilo next time.
// One cheap call per talk; the next talks never carry old transcripts.

const MEMORY_MAX = 2000;
/** Less than this from her (characters) adds nothing worth remembering */
const MIN_MEMORY_CHARS = 40;

const MEMORY_WRITER = `Llevas unas notas breves sobre una persona mayor para que Hilo, el compañero que charla con ella cada día, se acuerde de ella en la próxima charla.
Te doy las notas que había y la charla de hoy. Devuelves las notas nuevas, completas.

Reglas:
- Solo lo que ella ha dicho. No inventes ni deduzcas nada.
- Guarda lo que sirve para la próxima charla: personas de su vida (nombre y relación), lugares, gustos, lo que le preocupa, planes con fecha, y de qué se habló hoy.
- Fechas siempre exactas, nunca "mañana" ni "el jueves": conviértelas con la fecha de hoy que te doy.
- Salud: solo lo justo para preguntar con cariño (por ejemplo "le dolía la rodilla"), sin diagnósticos ni medicinas.
- Quita lo que ya no sirve, como un plan que ya pasó y ya se comentó.
- Una idea por línea, empezando por "- ". Máximo 15 líneas. Nada más: sin títulos ni comentarios.
- Escribe las notas en el idioma de la charla.`;

/** Rewrites her notes with what she said today. Runs after the goodbye, like the chapter */
async function updateMemory(admin: SupabaseClient, me: Senior, transcript: Turn[]) {
  const hers = transcript.filter((t) => t.speaker === 'senior').map((t) => t.text).join(' ');
  if (hers.length < MIN_MEMORY_CHARS) return;
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      output_config: { effort: 'low' },
      system: MEMORY_WRITER,
      messages: [
        {
          role: 'user',
          content:
            `Se llama ${me.display_name}. Hoy es ${localNow(me.timezone).date}.\n\n` +
            `Notas que había:\n${me.memory?.trim() || '(ninguna, es la primera vez)'}\n\n` +
            `La charla de hoy:\n` +
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
    const notes = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    // A cut answer could drop half of what she told: keep the old notes
    if (res.stop_reason !== 'end_turn' || !notes) {
      console.error('memory skipped:', res.stop_reason);
      return;
    }
    const { error } = await admin
      .from('people')
      .update({ memory: notes.slice(0, MEMORY_MAX), memory_updated_at: new Date().toISOString() })
      .eq('id', me.id);
    if (error) console.error('memory', error.message);
  } catch (e) {
    console.error('memory', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
  }
}

// Supabase keeps the function alive for promises passed here, after the response is sent
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

/** Sets ended_at once (goodbye, turn limit or she left) and writes the chapter and her notes in the background */
async function closeTalk(db: SupabaseClient, admin: SupabaseClient, me: Senior, sessionId: string, transcript: Turn[]) {
  const { data: closed } = await db
    .from('talk_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('ended_at', null)
    .select('id');
  if (closed?.length) {
    EdgeRuntime.waitUntil(Promise.all([writeChapter(admin, me, sessionId, transcript), updateMemory(admin, me, transcript)]));
  }
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
    /** "Escuchar mi historia": a link to this chapter read aloud, nothing to do with the talk */
    read?: string;
  };
  const { session_id, pills } = body;
  if (body.text !== undefined && (typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_TEXT)) {
    return json({ error: 'text' }, 400);
  }
  if (pills !== undefined && ((pills !== 'yes' && pills !== 'no') || !session_id)) return json({ error: 'pills' }, 400);
  // Her answer to the pill question comes from the Sí / No buttons, and is said as a sentence in the transcript
  let text = body.text;

  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // The senior on this phone
  const { data: userData } = await db.auth.getUser(auth.replace('Bearer ', ''));
  const { data: me } = await db
    .from('people')
    .select('id, family_id, display_name, locale, timezone, voice_speed, memory, city, latitude, longitude, country_code, region_code')
    .eq('user_id', userData.user?.id ?? '')
    .eq('role', 'senior')
    .maybeSingle();
  if (!me) return json({ error: 'not_senior' }, 403);
  const l = lang(me.locale);
  const say = SAY[l];
  // Listening to her book is free, like reading it: no subscription check
  if (typeof body.read === 'string') return readChapter(db, admin, me, body.read, Number(me.voice_speed));
  // Her answer to the pill question comes from the Sí / No buttons, and is said as a sentence in the transcript
  if (pills) text = pills === 'yes' ? say.pillsYes : say.pillsNo;
  // A new talk: start fetching her town's weather and holidays now, while the checks below run
  const contextPromise = session_id ? null : todayContext(me, l).catch((e) => (console.error('context', String(e)), null));

  // The family pays: without a trial or a subscription, a new talk doesn't start (one in progress is never cut)
  const { data: sub } = await db.from('subscriptions').select('plan, status, expires_at').eq('family_id', me.family_id).maybeSingle();
  const paid = Boolean(sub && sub.status !== 'expired' && (!sub.expires_at || Date.parse(sub.expires_at) > Date.now()));
  const maxTalks = MAX_TALKS_PER_DAY[sub?.plan === 'family' ? 'family' : 'basic'];

  // Open today's talk, or continue the one the phone is in
  let sessionId: string;
  let context: string | null = null;
  if (session_id) sessionId = session_id;
  else {
    if (!paid) {
      const reply = say.noAccess(me.display_name);
      const spoken = reply.replaceAll(`, ${me.display_name}`, ` ${me.display_name}`);
      return json({ session_id: null, reply, audio: await speak(spoken, Number(me.voice_speed), l), ask_pills: false, ended: true });
    }
    // A new talk: after the daily limit, Hilo says goodbye gently instead of starting one
    const { data: recent } = await db
      .from('talk_sessions')
      .select('started_at, turns(count)')
      .eq('person_id', me.id)
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const today = localNow(me.timezone).date;
    const talksToday = (recent ?? []).filter(
      (t) =>
        localNow(me.timezone, new Date(t.started_at)).date === today &&
        // More than Hilo's greeting: she answered at least once
        ((t.turns as { count: number }[])[0]?.count ?? 0) > 1,
    ).length;
    if (talksToday >= maxTalks) {
      const reply = say.enough(me.display_name);
      const spoken = reply.replaceAll(`, ${me.display_name}`, ` ${me.display_name}`);
      return json({ session_id: null, reply, audio: await speak(spoken, Number(me.voice_speed), l), ask_pills: false, ended: true });
    }

    // Weather and holidays: fetched once, when the talk really starts, and saved on it so every turn
    // sends the same opening message
    context = contextPromise ? await contextPromise : null;
    const { data, error } = await db
      .from('talk_sessions')
      .insert({ family_id: me.family_id, person_id: me.id, locale: me.locale, context })
      .select('id')
      .single();
    if (error) return json({ error: 'session' }, 500);
    sessionId = data.id;
  }

  const [{ data: turns, error: turnsError }, { data: talk }, { data: chapters }] = await Promise.all([
    db.from('turns').select('seq, speaker, text').eq('session_id', sessionId).order('seq'),
    db.from('talk_sessions').select('pills_asked_at, context').eq('id', sessionId).single(),
    // Titles only (drafts too): enough for Hilo not to ask for the same story twice
    admin.from('chapters').select('title').eq('person_id', me.id).order('created_at', { ascending: false }).limit(12),
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

  // Only today's talk, never the full history (cost and privacy): what she told before comes as her notes.
  // The opening user message stays the same during the talk (her notes change only after it ends).
  const now = new Date().toLocaleString(say.dateLocale, { timeZone: me.timezone, weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const opening = [
    say.start(me.display_name, now),
    me.memory?.trim() ? say.memory(me.memory.trim()) : '',
    chapters?.length ? say.stories(chapters.map((c) => c.title).join('; ')) : '',
    context ?? talk.context ?? '',
  ].filter(Boolean);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: opening.join('\n\n') },
    ...history.map((t): Anthropic.MessageParam => ({ role: t.speaker === 'hilo' ? 'assistant' : 'user', content: t.text })),
  ];
  // The pill question goes right after Claude's reply, so Claude must not ask one of its own (not saved in turns)
  if (askPills.length) {
    const last = messages[messages.length - 1];
    last.content = `${last.content}\n\n${say.noQuestion}`;
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
        system: [{ type: 'text', text: SYSTEM[l], cache_control: { type: 'ephemeral' } }],
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
      ? say.refusal
      : response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
  if (!answer) return json({ error: 'llm' }, 502);
  const reply = askPills.length ? `${answer} ${pillQuestion(askPills, l)}` : answer;

  const { error: saveError } = await db
    .from('turns')
    .insert({ family_id: me.family_id, session_id: sessionId, seq: history.length + 1, speaker: 'hilo', text: reply });
  if (saveError) return json({ error: 'save' }, 500);

  // On screen the comma before her name is right ("Qué bonito, Margarita"); out loud the voice stops there and sounds robotic
  const firstName = me.display_name.trim().split(/\s+/)[0];
  const spoken = firstName ? reply.replaceAll(`, ${firstName}`, ` ${firstName}`) : reply;
  const audio = await speak(spoken, speed, l);

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
