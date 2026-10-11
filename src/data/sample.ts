/**
 * Example data until Supabase is connected. Mirrors the Figma "APP pills" frames.
 */

export type Pill = {
  id: string;
  name: string;
  /** Local time "HH:mm" */
  time: string;
  /** Local time it was confirmed, or null */
  takenAt: string | null;
};

export const samplePills: Pill[] = [
  { id: 'tension', name: 'Pastilla de la tensión', time: '09:00', takenAt: '09:15' },
  { id: 'vitamina-d', name: 'Vitamina D', time: '12:00', takenAt: null },
  { id: 'colesterol', name: 'Pastilla del colesterol', time: '21:20', takenAt: null },
];

export type Chapter = {
  number: number;
  title: string;
  /** Only chapters the family approved are shown to the senior */
  status: 'approved' | 'writing';
  /** One sentence of theirs, shown large in the middle of the chapter */
  quote?: string;
  paragraphs: string[];
};

export const sampleBook = {
  title: 'La vida de Carmen',
  place: 'Alcoy · 1946',
  storyCount: 14,
};

export const sampleChapters: Chapter[] = [
  {
    number: 1,
    title: 'Infancia en Alcoy',
    status: 'approved',
    quote: 'Los domingos subíamos con mi padre a la Font Roja.',
    paragraphs: [
      'Nací en la calle San Nicolás, en una casa con un patio pequeño donde mi madre tendía la ropa.',
      'Los domingos subíamos con mi padre a la Font Roja. Él llevaba la merienda y yo siempre quería llevar la bota de agua.',
      'En invierno hacía mucho frío y dormíamos mi hermana y yo en la misma cama para calentarnos.',
    ],
  },
  {
    number: 2,
    title: 'Mi primer trabajo',
    status: 'approved',
    quote: 'Le daba el sobre entero a mi madre y ella me devolvía una peseta para el cine.',
    paragraphs: [
      'Entré en la fábrica de tejidos con quince años. Mi madre me acompañó el primer día hasta la puerta, porque yo no quería ir sola.',
      'La encargada era muy seria, pero a las nuevas nos enseñaba con paciencia. Al principio solo me dejaban recoger las bobinas.',
      'Los sábados le daba el sobre entero a mi madre y ella me devolvía una peseta para el cine. Con mi amiga Pepa íbamos al Calderón.',
    ],
  },
  { number: 3, title: 'Cuando conocí a Paco', status: 'writing', paragraphs: [] },
];

export type TalkStep = {
  say: string;
  /** What the senior does after the bot speaks */
  input: 'hold' | 'yesno' | 'end';
  /** Scripted answer shown after releasing the button (until real speech recognition) */
  reply?: string;
};

/** Scripted daily session, same as the approved HTML prototype */
export const sampleTalk: TalkStep[] = [
  { say: 'Buenos días, Carmen. ¿Qué tal has dormido hoy?', input: 'hold', reply: 'Bien, aunque me he despertado pronto.' },
  { say: 'Me alegro. ¿Te has tomado la pastilla de la tensión?', input: 'yesno' },
  {
    say: 'Hoy quiero que me cuentes algo: ¿cómo era tu primer trabajo?',
    input: 'hold',
    reply: 'Entré en una fábrica de tejidos con quince años…',
  },
  { say: 'Qué bonito, Carmen. He guardado tu historia en tu libro. Mañana seguimos. ¡Hasta mañana!', input: 'end' },
];
