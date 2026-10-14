/**
 * Example book until it is written from the real talks. Mirrors the Figma book frames.
 */

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
