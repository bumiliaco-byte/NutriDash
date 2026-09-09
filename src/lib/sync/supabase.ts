import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Table } from 'dexie';
import { db } from '../db/db';

/**
 * Supabase is optional. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a
 * `.env.local` file to enable cloud sync. Until then, the app is fully local.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;

export function syncEnabled(): boolean {
  return supabase !== null;
}

// --- Auth helpers -----------------------------------------------------------

export async function currentEmail(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Sync non configurata');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<{ needsConfirm: boolean }> {
  if (!supabase) throw new Error('Sync non configurata');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // When email confirmation is on, there is no active session yet.
  return { needsConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// --- Sync engine ------------------------------------------------------------

/** Local stores mirrored to Supabase, keyed by table name. */
const STORES = [
  { table: 'profiles', local: () => db.profiles },
  { table: 'plans', local: () => db.plans },
  { table: 'day_logs', local: () => db.dayLogs },
  { table: 'measurements', local: () => db.measurements },
] as const;

type Row = { id: string; updated_at: string | null; data: { updatedAt?: string } };

function ts(rec: { updatedAt?: string } | undefined | null): number {
  return rec?.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
}

async function pullStore(sb: SupabaseClient, userId: string, table: string, local: Table<{ id: string; updatedAt?: string }, string>): Promise<number> {
  const { data, error } = await sb.from(table).select('id,updated_at,data').eq('user_id', userId);
  if (error) throw error;
  let pulled = 0;
  for (const row of (data ?? []) as Row[]) {
    const remote = row.data;
    const existing = await local.get(row.id);
    const remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : ts(remote);
    if (!existing || remoteTs > ts(existing)) {
      await local.put(JSON.parse(JSON.stringify(remote)));
      pulled++;
    }
  }
  return pulled;
}

async function pushStore(sb: SupabaseClient, userId: string, table: string, local: Table<{ id: string; updatedAt?: string }, string>): Promise<number> {
  const all = await local.toArray();
  if (!all.length) return 0;
  const rows = all.map((r) => ({
    id: r.id,
    user_id: userId,
    updated_at: r.updatedAt ?? new Date().toISOString(),
    data: r,
  }));
  const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

/**
 * Two-way sync: pull remote changes (newest `updatedAt` wins) into the local
 * store, then push the merged local state back. Safe no-op when sync is not
 * configured or the user is not signed in. Note: deletions are not propagated
 * in this version (no tombstones).
 */
export async function sync(): Promise<{ pushed: number; pulled: number } | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const userId = auth.user.id;

  let pushed = 0;
  let pulled = 0;
  for (const s of STORES) pulled += await pullStore(supabase, userId, s.table, s.local());
  for (const s of STORES) pushed += await pushStore(supabase, userId, s.table, s.local());
  return { pushed, pulled };
}
