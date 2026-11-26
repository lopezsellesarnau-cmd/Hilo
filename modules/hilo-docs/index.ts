import { requireOptionalNativeModule } from 'expo';

/**
 * Hilo's documents, read on the phone (local Expo module, iOS: Vision, PDFKit, VisionKit).
 * Nothing leaves the phone. Where the module isn't there (web, Android for now), it reads nothing.
 */
type Scan = { uri: string; pages: number; text: string };
type Native = { canScan: boolean; recognize(uri: string): Promise<string>; scan(): Promise<Scan | null> };

const native = requireOptionalNativeModule<Native>('HiloDocs');

export const canScan = Boolean(native?.canScan);
/** This build can read documents on the phone */
export const canRead = Boolean(native);

/** The text of a photo or a PDF ('' if it can't read it) */
export async function recognize(uri: string): Promise<string> {
  try {
    return (await native?.recognize(uri)) ?? '';
  } catch {
    return '';
  }
}

/** The system document scanner: straightened pages, as one PDF with their text. null if cancelled */
export async function scan(): Promise<Scan | null> {
  return (await native?.scan()) ?? null;
}
