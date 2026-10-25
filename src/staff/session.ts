import { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type StaffMember = {
  userId: string;
  orgId: string;
  orgName: string;
  role: 'admin' | 'carer';
  name: string;
  email: string;
};

export type StaffSession =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Signed in, but not staff of any organisation (e.g. a family account in the same browser) */
  | { status: 'notStaff'; email: string }
  | { status: 'staff'; member: StaffMember };

async function load(): Promise<StaffSession> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) return { status: 'signedOut' };

  // First organisation only: one person working for two organisations comes later
  const { data: row } = await supabase
    .from('org_members')
    .select('org_id, role, display_name, organizations (name)')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!row) return { status: 'notStaff', email: user.email ?? '' };

  const org = row.organizations as { name: string } | { name: string }[] | null;
  return {
    status: 'staff',
    member: {
      userId: user.id,
      orgId: row.org_id,
      orgName: (Array.isArray(org) ? org[0]?.name : org?.name) ?? '',
      role: row.role,
      name: row.display_name,
      email: user.email ?? '',
    },
  };
}

/** Who is using the staff web, kept up to date on sign-in and sign-out. */
export function useStaffSession(): StaffSession {
  const [session, setSession] = useState<StaffSession>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    const refresh = () => load().then((s) => live && setSession(s));
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') refresh();
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return session;
}

/** The signed-in staff member, for pages inside the staff layout (which only renders them for staff). */
export const StaffContext = createContext<StaffMember | null>(null);

export function useStaff(): StaffMember {
  const member = useContext(StaffContext);
  if (!member) throw new Error('useStaff() outside the staff layout');
  return member;
}
