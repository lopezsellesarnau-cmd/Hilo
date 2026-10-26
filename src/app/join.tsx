import { Redirect, useLocalSearchParams } from 'expo-router';

import { codeFromInviteQr, setPendingInvite } from '@/lib/invite';

/**
 * hilo://join?code=12345678: the invite QR, scanned with the iPhone's Camera instead of inside Hilo.
 * Joining needs their email and name first, so the code is kept and the usual start takes them from here:
 * Welcome when signed out, the join step (code filled in) once they reach it.
 */
export default function JoinLink() {
  const { code = '' } = useLocalSearchParams<{ code?: string }>();
  setPendingInvite(codeFromInviteQr(code));
  return <Redirect href="/" />;
}
