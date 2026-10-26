import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * hilo://pair?code=123456: what the QR holds, opened when it is scanned with the iPhone's Camera instead of
 * inside Hilo. Opens the code screen with the code filled in; she still taps to pair (pairing signs out any
 * family account on this phone, so a link alone must never do it).
 */
export default function PairLink() {
  const { code = '' } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={{ pathname: '/pair-code', params: { code } }} />;
}
