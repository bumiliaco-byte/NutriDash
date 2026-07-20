import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/db';
import type { DayLog, Plan, Profile } from '../types';

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

/**
 * Push local changes then pull remote changes, resolving conflicts by newest
 * `updatedAt` (last-write-wins). Safe no-op when sync is not configured or the
 * user is not authenticated.
 */
export async function sync(): Promise<{ pushed: number; pulled: number } | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const userId = auth.user.id;

  const pushed = await pushDayLogs(supabase, userId);
  const pulled = await pullDayLogs(supabase, userId);
  await pushProfilesAndPlans(supabase, userId);
  return { pushed, pulled };
}

async function pushDayLogs(sb: SupabaseClient, userId: string): Promise<number> {
  const logs = await db.dayLogs.toArray();
  if (!logs.length) return 0;
  const rows = logs.map(l => ({ ...l, user_id: userId }));
  const { error } = await sb.from('day_logs').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

async function pullDayLogs(sb: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await sb.from('day_logs').select('*').eq('user_id', userId);
  if (error) throw error;
  if (!data) return 0;
  let pulled = 0;
  for (const remote of data as (DayLog & { user_id: string })[]) {
    const local = await db.dayLogs.get(remote.id);
    if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
      const { user_id: _drop, ...clean } = remote;
      await db.dayLogs.put(clean);
      pulled++;
    }
  }
  return pulled;
}

async function pushProfilesAndPlans(sb: SupabaseClient, userId: string): Promise<void> {
  const profiles = (await db.profiles.toArray()).map((p: Profile) => ({ ...p, user_id: userId }));
  const plans = (await db.plans.toArray()).map((p: Plan) => ({ ...p, user_id: userId }));
  if (profiles.length) await sb.from('profiles').upsert(profiles, { onConflict: 'id' });
  if (plans.length) await sb.from('plans').upsert(plans, { onConflict: 'id' });
}
