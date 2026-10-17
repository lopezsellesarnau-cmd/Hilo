import { getLocales } from 'expo-localization';

import { en } from './en';
import { es } from './es';
import { nl } from './nl';

export type Lang = 'es' | 'en' | 'nl';

/**
 * The app's language is the phone's: iOS restarts the app when it changes, so it is read once.
 * Spain's other languages get Spanish, anything else English.
 * The talk itself (voice, prompt, listening) follows people.locale, not this.
 */
function phoneLang(): Lang {
  const code = getLocales()[0]?.languageCode ?? 'es';
  if (code === 'nl') return 'nl';
  if (['es', 'ca', 'gl', 'eu'].includes(code)) return 'es';
  return 'en';
}

export const lang = phoneLang();

/** All the app's texts in the phone's language: `t.welcome.tagline`, `t.home.hello(name)`. */
export const t = { es, en, nl }[lang];

/** For toLocaleDateString and friends. */
export const dateLocale = { es: 'es-ES', en: 'en-GB', nl: 'nl-NL' }[lang];
