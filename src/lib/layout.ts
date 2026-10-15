import { useWindowDimensions } from 'react-native';

/** iPad on its side: wider than tall and roomy enough for two columns (bot left, content right).
 * iPhone is portrait only, so it never gets here. */
export function useWide() {
  const { width, height } = useWindowDimensions();
  return width > height && width >= 900;
}
