import { useWindowDimensions } from 'react-native';

/** iPad on its side: wider than tall and roomy enough for two columns (bot left, content right).
 * iPhone is portrait only, so it never gets here. */
export function useWide() {
  const { width, height } = useWindowDimensions();
  return width > height && width >= 900;
}

/** The bot on the left half of a wide screen: big, but never taller than half the screen */
export const wideBotSize = (width: number, height: number) => Math.min(360, width * 0.3, height * 0.5);
