import type { Lang } from '@/i18n';

/** A town looked up once when the family types it. Only the town: enough for the weather and the holidays. */
export type Place = {
  city: string;
  /** Town, region and country, shown to the family so they can check it is the right one */
  label: string;
  latitude: number;
  longitude: number;
  country_code: string;
  region_code: string | null;
};

type NominatimResult = {
  lat: string;
  lon: string;
  name: string;
  address: Record<string, string | undefined>;
};

/**
 * OpenStreetMap's free search (Nominatim). Its rules: low volume and an app name in the User-Agent.
 * One call when the family saves the town, never from the senior's phone or on every talk.
 */
export async function findPlace(query: string, lang: Lang): Promise<Place | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    featureType: 'settlement',
    'accept-language': lang,
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'Hilo/1.0 (https://hilo-web.vercel.app)' },
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as NominatimResult[];
    if (!hit) return null;
    const a = hit.address;
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? hit.name;
    const country = a.country_code?.toUpperCase();
    if (!city || !country) return null;
    return {
      city: city.slice(0, 80),
      label: [city, a.state ?? a.province, a.country].filter(Boolean).join(', '),
      latitude: Number(hit.lat),
      longitude: Number(hit.lon),
      country_code: country,
      region_code: a['ISO3166-2-lvl4'] ?? null,
    };
  } catch {
    return null;
  }
}
