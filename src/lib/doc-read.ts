import { dateLocale, lang } from '@/i18n';

/**
 * Making sense of a document's text, on the phone (phase C of vault Senior-App/11-documentos-cifrados-plan).
 * No AI and no network: word lists in Spanish, Catalan, English and Dutch.
 * - read(): the type (report, prescription…), the specialty (cardiology…), the date and a title
 * - ask(): "Ask Hilo". The question is matched against titles, tags, dates and the text, with synonyms
 *   (cardiólogo ~ cardiología ~ corazón ~ heart), months ("the one from March") and "the last one".
 * Hilo finds; it never interprets (no medical advice).
 */

type Lang = 'es' | 'en' | 'nl';
type Group = { id: string; label: Record<Lang, string>; words: string[] };

/** Lowercase, no accents, single spaces */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// What kind of paper it is. The first that matches wins, so the more specific go first.
const KINDS: Group[] = [
  { id: 'card', label: { es: 'Tarjeta sanitaria', en: 'Health card', nl: 'Zorgpas' }, words: ['tarjeta sanitaria', 'tarjeta sip', 'targeta sanitaria', 'health card', 'insurance card', 'zorgpas', 'verzekeringspas', 'cip', 'sip'] },
  {
    id: 'prescription',
    label: { es: 'Receta', en: 'Prescription', nl: 'Recept' },
    words: ['receta', 'recepta', 'prescripcion', 'prescription', 'recept', 'hoja de medicacion', 'plan de medicacion', 'medication plan', 'medicatieoverzicht', 'posologia', 'dosage'],
  },
  {
    id: 'analysis',
    label: { es: 'Análisis', en: 'Test results', nl: 'Uitslag' },
    words: ['analisis', 'analitica', 'hemograma', 'bioquimica', 'laboratorio', 'blood test', 'lab results', 'laboratory', 'bloedonderzoek', 'laboratorium', 'uitslag', 'glucosa', 'glucose', 'colesterol', 'cholesterol', 'hemoglobina', 'hemoglobin', 'creatinina', 'creatinine', 'orina', 'urine'],
  },
  {
    id: 'imaging',
    label: { es: 'Imagen', en: 'Imaging', nl: 'Beeldvorming' },
    words: ['radiografia', 'resonancia', 'ecografia', 'tomografia', 'mamografia', 'densitometria', 'x-ray', 'xray', 'mri', 'ultrasound', 'ct scan', 'mammogram', 'rontgen', 'echografie', 'mri-scan', 'ct-scan'],
  },
  {
    id: 'report',
    label: { es: 'Informe', en: 'Report', nl: 'Verslag' },
    words: ['informe', 'report', 'verslag', 'alta hospitalaria', 'informe de alta', 'discharge', 'ontslagbrief', 'consulta', 'consultation', 'epicrisis', 'diagnostico', 'diagnosis', 'diagnose'],
  },
  { id: 'appointment', label: { es: 'Cita', en: 'Appointment', nl: 'Afspraak' }, words: ['cita', 'citacion', 'appointment', 'afspraak', 'convocatoria'] },
  { id: 'invoice', label: { es: 'Factura', en: 'Invoice', nl: 'Factuur' }, words: ['factura', 'invoice', 'recibo', 'receipt', 'factuur', 'rekening'] },
  { id: 'insurance', label: { es: 'Seguro', en: 'Insurance', nl: 'Verzekering' }, words: ['seguro', 'poliza', 'mutua', 'insurance', 'policy', 'verzekering', 'polis'] },
  { id: 'id', label: { es: 'DNI', en: 'ID', nl: 'ID-kaart' }, words: ['dni', 'documento nacional', 'pasaporte', 'passport', 'identity card', 'paspoort', 'identiteitskaart', 'nie'] },
];

const SPECIALTIES: Group[] = [
  {
    id: 'cardiology',
    label: { es: 'Cardiología', en: 'Cardiology', nl: 'Cardiologie' },
    words: ['cardiologia', 'cardiologo', 'cardiologa', 'cardiaco', 'corazon', 'cardio', 'electrocardiograma', 'ecg', 'holter', 'cardiology', 'cardiologist', 'heart', 'cardiologie', 'cardioloog', 'hart', 'tension arterial', 'blood pressure', 'bloeddruk'],
  },
  { id: 'neurology', label: { es: 'Neurología', en: 'Neurology', nl: 'Neurologie' }, words: ['neurologia', 'neurologo', 'cerebro', 'neurology', 'neurologist', 'brain', 'neurologie', 'neuroloog', 'hersenen', 'memoria', 'memory', 'geheugen', 'alzheimer', 'parkinson'] },
  {
    id: 'trauma',
    label: { es: 'Traumatología', en: 'Orthopaedics', nl: 'Orthopedie' },
    words: ['traumatologia', 'traumatologo', 'hueso', 'fractura', 'cadera', 'rodilla', 'orthopaedic', 'orthopedic', 'bone', 'fracture', 'hip', 'knee', 'orthopedie', 'breuk', 'heup', 'knie'],
  },
  { id: 'eyes', label: { es: 'Oftalmología', en: 'Ophthalmology', nl: 'Oogheelkunde' }, words: ['oftalmologia', 'oftalmologo', 'ojo', 'ojos', 'vista', 'cataratas', 'gafas', 'eye', 'eyes', 'ophthalmology', 'cataract', 'glasses', 'oog', 'ogen', 'oogarts', 'bril', 'staar'] },
  { id: 'skin', label: { es: 'Dermatología', en: 'Dermatology', nl: 'Dermatologie' }, words: ['dermatologia', 'dermatologo', 'piel', 'dermatology', 'skin', 'dermatologie', 'huid', 'huidarts'] },
  {
    id: 'endocrine',
    label: { es: 'Endocrinología', en: 'Endocrinology', nl: 'Endocrinologie' },
    words: ['endocrinologia', 'endocrino', 'diabetes', 'tiroides', 'insulina', 'endocrinology', 'thyroid', 'insulin', 'endocrinologie', 'schildklier', 'suiker', 'azucar', 'sugar'],
  },
  { id: 'lungs', label: { es: 'Neumología', en: 'Pulmonology', nl: 'Longgeneeskunde' }, words: ['neumologia', 'neumologo', 'pulmon', 'pulmones', 'respiratorio', 'lung', 'lungs', 'pulmonology', 'longen', 'longarts', 'epoc', 'copd'] },
  { id: 'kidney', label: { es: 'Nefrología', en: 'Nephrology', nl: 'Nefrologie' }, words: ['nefrologia', 'rinon', 'rinones', 'kidney', 'kidneys', 'nephrology', 'nier', 'nieren', 'dialisis', 'dialysis'] },
  { id: 'urology', label: { es: 'Urología', en: 'Urology', nl: 'Urologie' }, words: ['urologia', 'urologo', 'prostata', 'urology', 'prostate', 'urologie', 'uroloog'] },
  { id: 'gyn', label: { es: 'Ginecología', en: 'Gynaecology', nl: 'Gynaecologie' }, words: ['ginecologia', 'ginecologo', 'gynaecology', 'gynecology', 'gynaecologie', 'gynaecoloog'] },
  { id: 'oncology', label: { es: 'Oncología', en: 'Oncology', nl: 'Oncologie' }, words: ['oncologia', 'oncologo', 'cancer', 'tumor', 'quimioterapia', 'oncology', 'chemotherapy', 'oncologie', 'kanker', 'chemo'] },
  { id: 'digestive', label: { es: 'Digestivo', en: 'Gastroenterology', nl: 'Maag-darm-lever' }, words: ['digestivo', 'gastroenterologia', 'estomago', 'colonoscopia', 'higado', 'stomach', 'colonoscopy', 'liver', 'gastro', 'maag', 'darm', 'lever'] },
  { id: 'ent', label: { es: 'Otorrino', en: 'ENT', nl: 'KNO' }, words: ['otorrino', 'otorrinolaringologia', 'oido', 'oidos', 'audifono', 'audiometria', 'ear', 'ears', 'hearing', 'hearing aid', 'kno', 'oor', 'oren', 'gehoor', 'hoortoestel'] },
  { id: 'dental', label: { es: 'Dentista', en: 'Dentist', nl: 'Tandarts' }, words: ['dentista', 'odontologia', 'dientes', 'dentadura', 'dentist', 'dental', 'teeth', 'denture', 'tandarts', 'tanden', 'kunstgebit'] },
  { id: 'rheuma', label: { es: 'Reumatología', en: 'Rheumatology', nl: 'Reumatologie' }, words: ['reumatologia', 'reuma', 'artrosis', 'artritis', 'rheumatology', 'arthritis', 'reumatologie', 'artrose'] },
  { id: 'geriatrics', label: { es: 'Geriatría', en: 'Geriatrics', nl: 'Geriatrie' }, words: ['geriatria', 'geriatra', 'geriatrics', 'geriatrie', 'geriater'] },
  {
    id: 'gp',
    label: { es: 'Médico de cabecera', en: 'GP', nl: 'Huisarts' },
    words: ['atencion primaria', 'medico de cabecera', 'medicina familiar', 'centro de salud', 'general practitioner', 'family doctor', 'gp', 'huisarts', 'huisartsenpraktijk'],
  },
];

const MONTHS: Record<string, number> = {};
[
  ['enero', 'gener', 'january', 'jan', 'januari', 'ene'],
  ['febrero', 'febrer', 'february', 'feb', 'februari'],
  ['marzo', 'marc', 'march', 'mar', 'maart'],
  ['abril', 'april', 'apr'],
  ['mayo', 'maig', 'may', 'mei'],
  ['junio', 'juny', 'june', 'jun', 'juni'],
  ['julio', 'juliol', 'july', 'jul', 'juli'],
  ['agosto', 'agost', 'august', 'aug', 'augustus', 'ago'],
  ['septiembre', 'setembre', 'september', 'sep', 'sept', 'setiembre'],
  ['octubre', 'october', 'oct', 'oktober', 'okt'],
  ['noviembre', 'novembre', 'november', 'nov'],
  ['diciembre', 'desembre', 'december', 'dec', 'dic'],
].forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)));

const LATEST = ['ultimo', 'ultima', 'reciente', 'nuevo', 'last', 'latest', 'newest', 'recent', 'laatste', 'nieuwste', 'darrer'];

const STOP = new Set(
  (
    'donde esta estan el la los las lo un una unos unas de del al a en y o que cual cuales mi mis su sus tu tus es son hay me dame ensename muestra busca buscar encuentra quiero ver ' +
    'mama mami madre papa padre abuela abuelo yaya yayo iaia avi avia tia tio ' +
    'where is are the a an of my his her their our your show find me get give see want look for and or with from in on to ' +
    'mum mom mother dad father grandma grandmother grandpa grandfather nan gran ' +
    'waar is zijn de het een van mijn zijn haar hun laat zien vind ik wil toon en of met in op naar ' +
    'moeder vader mama papa oma opa ' +
    'document documento documentos documents documenten papel papeles paper papers hilo'
  ).split(' '),
);

const LONG_MONTH_FIRST = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;
const ISO = /\b(19|20)(\d{2})-(\d{2})-(\d{2})\b/;
const WORDS_DATE = /\b(\d{1,2})\s+(?:de\s+)?([a-z]{3,10})\.?\s+(?:de\s+|del\s+)?((?:19|20)\d{2})\b/;

/** The first believable date in the text, as YYYY-MM-DD */
export function findDate(raw: string): string | undefined {
  const text = norm(raw);
  const now = new Date().getFullYear();
  const ok = (y: number, m: number, d: number) => y >= 1950 && y <= now + 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const iso = text.match(ISO);
  if (iso) {
    const [y, m, d] = [Number(iso[1] + iso[2]), Number(iso[3]), Number(iso[4])];
    if (ok(y, m, d)) return fmt(y, m, d);
  }
  const words = text.match(WORDS_DATE);
  if (words && MONTHS[words[2]]) {
    const [y, m, d] = [Number(words[3]), MONTHS[words[2]], Number(words[1])];
    if (ok(y, m, d)) return fmt(y, m, d);
  }
  // Day first (Spain, the Netherlands, the UK)
  const num = text.match(LONG_MONTH_FIRST);
  if (num) {
    let y = Number(num[3]);
    if (y < 100) y += y > (now % 100) + 1 ? 1900 : 2000;
    const [m, d] = [Number(num[2]), Number(num[1])];
    if (ok(y, m, d)) return fmt(y, m, d);
  }
  return undefined;
}

const has = (hay: string, word: string) => (word.length <= 3 ? new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(hay) : hay.includes(word));

export type Reading = { kind?: string; tags: string[]; date?: string; title?: string };

/** What a document seems to be, from its text */
export function read(raw: string): Reading {
  const text = norm(raw).slice(0, 8000);
  if (!text) return { tags: [] };
  // The type: the group with most hits, the first one on a tie
  let kind: Group | undefined;
  let best = 0;
  for (const g of KINDS) {
    const hits = g.words.filter((w) => has(text, w)).length;
    if (hits > best) {
      best = hits;
      kind = g;
    }
  }
  const scored = SPECIALTIES.map((g) => ({ g, hits: g.words.filter((w) => has(text, w)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const specialty = scored[0]?.g;
  const date = findDate(raw);
  const l = lang as Lang;
  const title = kind
    ? specialty
      ? `${kind.label[l]} · ${specialty.label[l]}`
      : date
        ? `${kind.label[l]} · ${new Date(`${date}T12:00:00`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : kind.label[l]
    : specialty
      ? specialty.label[l]
      : undefined;
  return { kind: kind?.id, tags: scored.slice(0, 3).map((x) => x.g.id), date, title };
}

/** A tag's words for the screen */
export const tagLabel = (id: string) => {
  const g = [...KINDS, ...SPECIALTIES].find((x) => x.id === id);
  return g ? g.label[lang as Lang] : id;
};

export type Askable = { id: string; title: string; text?: string; kind?: string; tags?: string[]; date?: string; createdAt: string };

/** "Ask Hilo": the best matches for a question, best first (empty: nothing found) */
export function ask(question: string, docs: Askable[]): string[] {
  const q = norm(question);
  if (!q || !docs.length) return [];
  const groups = [...KINDS, ...SPECIALTIES].filter((g) => g.words.some((w) => has(q, w) || q.split(' ').some((t) => t.length >= 5 && w.startsWith(t))));
  const tokens = q.split(' ').filter((t) => t.length >= 3 && !STOP.has(t) && !MONTHS[t] && !LATEST.includes(t) && !/^\d+$/.test(t));
  // Asked for a specialty ("the cardiologist's"): a document has to be about it, not just the same type
  const wantSpecialty = groups.filter((g) => SPECIALTIES.includes(g));
  const months = q
    .split(' ')
    .map((t) => MONTHS[t])
    .filter(Boolean);
  const years = (q.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  const latest = LATEST.some((w) => q.includes(w));

  const scored = docs.map((d) => {
    const title = norm(d.title);
    const text = norm(d.text ?? '');
    const tags = [d.kind, ...(d.tags ?? [])].filter(Boolean) as string[];
    const when = new Date(d.date ? `${d.date}T12:00:00` : d.createdAt);
    let score = 0;
    for (const t of tokens) {
      if (groups.some((g) => g.words.includes(t))) continue; // counted with its group
      if (title.includes(t)) score += 4;
      if (text.includes(t)) score += 1 + Math.min(2, text.split(t).length - 2) * 0.5;
    }
    for (const g of groups) {
      if (tags.includes(g.id)) score += 5;
      else if (g.words.some((w) => has(title, w))) score += 4;
      else if (g.words.some((w) => has(text, w))) score += 2;
    }
    if (wantSpecialty.length && !wantSpecialty.some((g) => tags.includes(g.id) || g.words.some((w) => has(title, w) || has(text, w)))) score = 0;
    if (months.length && months.includes(when.getMonth() + 1)) score += 3;
    if (years.length && years.includes(when.getFullYear())) score += 2;
    return { id: d.id, score, time: when.getTime() };
  });

  // Something to go on beyond "the last one"?
  const asked = tokens.length || groups.length || months.length || years.length;
  let found = scored.filter((s) => s.score > 0);
  if (!asked && latest) found = scored;
  if (!found.length) return [];
  const top = Math.max(...found.map((s) => s.score));
  return found
    .filter((s) => s.score >= top * 0.5)
    .sort((a, b) => (latest ? b.time - a.time || b.score - a.score : b.score - a.score || b.time - a.time))
    .slice(0, 3)
    .map((s) => s.id);
}
