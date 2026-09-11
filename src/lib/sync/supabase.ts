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

/** Auth user id of the signed-in account, or null when local-only. */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
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

/** Check the account password without disturbing the current session. */
export async function verifyPassword(password: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

/** Send the "reset password" email, pointing back at this app. */
export async function resetPassword(email: string): Promise<void> {
  if (!supabase) throw new Error('Sync non configurata');
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Set a new password for the signed-in (or recovering) user. */
export async function updatePassword(password: string): Promise<void> {
  if (!supabase) throw new Error('Sync non configurata');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Fires when the user lands on the app from a password-recovery email. */
export function onPasswordRecovery(cb: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') cb();
  });
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

/** Map a remote table name to its local Dexie table (for applying tombstones). */
const LOCAL_BY_TABLE: Record<string, () => Table<{ id: string; updatedAt?: string }, string>> = {
  profiles: () => db.profiles,
  plans: () => db.plans,
  day_logs: () => db.dayLogs,
  measurements: () => db.measurements,
};

type Row = { id: string; updated_at: string | null; data: { updatedAt?: string } };

function ts(rec: { updatedAt?: string } | undefined | null): number {
  return rec?.updatedAt ? new Date(rec.updatedAt).getTime() : 0;
}

/** True when the error means the `tombstones` table hasn't been created yet. */
function isMissingTombstones(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || '').toLowerCase();
  return err.code === 'PGRST205' || err.code === '42P01' ||
    (m.includes('tombstones') && (m.includes('schema cache') || m.includes('does not exist') || m.includes('find the table')));
}

/** Pull remote deletions, apply them locally, and resolve resurrections (record newer than delete wins). */
async function pullTombstones(sb: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await sb.from('tombstones').select('id,table_name,deleted_at').eq('user_id', userId);
  if (error) {
    if (isMissingTombstones(error)) return 0; // table not created yet: skip gracefully
    throw error;
  }
  let applied = 0;
  for (const row of (data ?? []) as { id: string; table_name: string; deleted_at: string }[]) {
    const { id, table_name: table, deleted_at: deletedAt } = row;
    const recordId = id.slice(table.length + 1);
    const localTomb = await db.tombstones.get(id);
    if (!localTomb || new Date(deletedAt) > new Date(localTomb.deletedAt)) {
      await db.tombstones.put({ id, table, recordId, deletedAt });
    }
    const local = LOCAL_BY_TABLE[table]?.();
    if (!local) continue;
    const rec = await local.get(recordId);
    if (rec) {
      if (ts(rec) > new Date(deletedAt).getTime()) {
        // Re-created/edited after the deletion: the record wins, drop the tombstone.
        await db.tombstones.delete(id);
        await sb.from('tombstones').delete().eq('id', id);
      } else {
        await local.delete(recordId);
        applied++;
      }
    }
  }
  return applied;
}

async function pushTombstones(sb: SupabaseClient, userId: string): Promise<void> {
  const all = await db.tombstones.toArray();
  if (!all.length) return;
  const rows = all.map((t) => ({ id: t.id, user_id: userId, table_name: t.table, deleted_at: t.deletedAt }));
  const { error } = await sb.from('tombstones').upsert(rows, { onConflict: 'id' });
  if (error && !isMissingTombstones(error)) throw error;
}

async function pullStore(
  sb: SupabaseClient,
  userId: string,
  table: string,
  local: Table<{ id: string; updatedAt?: string }, string>,
  owned?: Set<string>,
): Promise<number> {
  const { data, error } = await sb.from(table).select('id,updated_at,data').eq('user_id', userId);
  if (error) throw error;
  let pulled = 0;
  for (const row of (data ?? []) as Row[]) {
    const remote = row.data as { updatedAt?: string; ownerUserId?: string; profileId?: string };
    // Never take in someone else's records, even if they ended up in this account.
    if (table === 'profiles') {
      if (remote.ownerUserId && remote.ownerUserId !== userId) continue;
    } else if (owned && !owned.has(remote.profileId ?? '')) {
      continue;
    }
    // The record's own timestamp wins; the row's is only a fallback for legacy rows.
    const remoteTs = ts(remote) || (row.updated_at ? new Date(row.updated_at).getTime() : 0);
    // Don't resurrect a record that was deleted at/after this version.
    const tomb = await db.tombstones.get(`${table}:${row.id}`);
    if (tomb && new Date(tomb.deletedAt).getTime() >= remoteTs) continue;
    const existing = await local.get(row.id);
    if (!existing || remoteTs > ts(existing)) {
      const record = JSON.parse(JSON.stringify(remote));
      // Rows written before ownership existed still belong to the account that stores them.
      if (table === 'profiles' && !record.ownerUserId) record.ownerUserId = userId;
      await local.put(record);
      pulled++;
    }
  }
  return pulled;
}

/** Profiles belonging to the signed-in account: nothing else may leave this device. */
async function ownedProfileIds(userId: string): Promise<Set<string>> {
  const profiles = await db.profiles.toArray();
  return new Set(profiles.filter(p => p.ownerUserId === userId).map(p => p.id));
}

async function pushStore(
  sb: SupabaseClient,
  userId: string,
  table: string,
  local: Table<{ id: string; updatedAt?: string }, string>,
  owned: Set<string>,
): Promise<number> {
  const all = (await local.toArray()).filter((r) => {
    const rec = r as { id: string; profileId?: string };
    return owned.has(table === 'profiles' ? rec.id : rec.profileId ?? '');
  });
  if (!all.length) return 0;
  // Stamp the timestamp inside the record too, so every device compares the same value.
  const rows = all.map((r) => {
    const updatedAt = r.updatedAt ?? new Date().toISOString();
    return { id: r.id, user_id: userId, updated_at: updatedAt, data: { ...r, updatedAt } };
  });
  const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

/**
 * Two-way sync: pull remote deletions, then remote changes (newest `updatedAt`
 * wins), then push local deletions and the merged local state. Safe no-op when
 * sync is not configured or the user is not signed in.
 */
export async function sync(): Promise<{ pushed: number; pulled: number } | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const userId = auth.user.id;

  let pushed = 0;
  let pulled = 0;
  pulled += await pullTombstones(supabase, userId);
  // Profiles first: they decide which of the remaining records belong to this account.
  pulled += await pullStore(supabase, userId, 'profiles', db.profiles);
  const owned = await ownedProfileIds(userId);
  for (const s of STORES.slice(1)) pulled += await pullStore(supabase, userId, s.table, s.local(), owned);
  await pushTombstones(supabase, userId);
  for (const s of STORES) pushed += await pushStore(supabase, userId, s.table, s.local(), owned);
  return { pushed, pulled };
}
