import { writable } from 'svelte/store';
import { db, ensureBootstrap, getActivePlan } from './db/db';
import type { DayLog, DayType, Plan } from './types';

/** YYYY-MM-DD for a Date. */
export function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayStr(): string {
  return fmt(new Date());
}

/** Default day type: rest day (pasto libero is now a per-meal toggle, not a day type). */
export function defaultType(_dateStr: string): DayType {
  return 'nonallenamento';
}

export const currentDate = writable<string>(todayStr());
export const profileId = writable<string>('');
export const activePlan = writable<Plan | null>(null);

/** Bootstrap DB + load the active profile and plan. */
export async function initApp(): Promise<void> {
  const pid = await ensureBootstrap();
  profileId.set(pid);
  const plan = await getActivePlan(pid);
  activePlan.set(plan);
}

/** Load (or create) the day log for a profile/date. */
export async function loadDay(pid: string, date: string, plan: Plan): Promise<DayLog> {
  const id = `${pid}:${date}`;
  const existing = await db.dayLogs.get(id);
  if (existing) return existing;
  return {
    id, profileId: pid, planId: plan.id, planVersion: plan.version,
    date, dayType: defaultType(date), water: 0,
    sel: {}, chk: {}, piatto: {}, notes: {},
    updatedAt: new Date().toISOString(),
  };
}

/** Persist a day log (updates the sync timestamp). */
export async function saveDay(day: DayLog): Promise<void> {
  day.updatedAt = new Date().toISOString();
  // Strip Svelte 5 $state proxies: IndexedDB cannot structured-clone proxies.
  const plain: DayLog = JSON.parse(JSON.stringify(day));
  await db.dayLogs.put(plain);
}
