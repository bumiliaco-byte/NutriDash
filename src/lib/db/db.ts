import Dexie, { type Table } from 'dexie';
import type { DayLog, Measurement, Plan, Profile, Sex, SlotOption, Tombstone } from '../types';
import { defaultPlan, scalePlanTo, SEED_VERSION } from '../data/plan';

function replaceOption(list: SlotOption[] | undefined, defaults: SlotOption[] | undefined, id: string): SlotOption[] | undefined {
  if (!list || !defaults) return list;
  const replacement = defaults.find(option => option.id === id);
  if (!replacement) return list;
  return list.map(option => option.id === id ? replacement : option);
}

/** IndexedDB database for NutriDash (local-first store). */
export class NutriDB extends Dexie {
  profiles!: Table<Profile, string>;
  plans!: Table<Plan, string>;
  dayLogs!: Table<DayLog, string>;
  measurements!: Table<Measurement, string>;
  tombstones!: Table<Tombstone, string>;

  constructor() {
    super('nutridash');
    this.version(1).stores({
      profiles: 'id, name',
      plans: 'id, profileId, version',
      dayLogs: 'id, profileId, date, [profileId+date]',
      measurements: 'id, profileId, date, [profileId+date]',
    });
    this.version(2).stores({
      tombstones: 'id, table',
    });
  }
}

export const db = new NutriDB();

/** Record a deletion tombstone (so it propagates on next cloud sync). */
async function tombstone(table: string, recordId: string): Promise<void> {
  await db.tombstones.put({ id: `${table}:${recordId}`, table, recordId, deletedAt: new Date().toISOString() });
}

/** Delete a day log locally and mark a tombstone for cross-device sync. */
export async function deleteDayLog(id: string): Promise<void> {
  await tombstone('day_logs', id);
  await db.dayLogs.delete(id);
}

/** Delete a measurement locally and mark a tombstone for cross-device sync. */
export async function deleteMeasurement(id: string): Promise<void> {
  await tombstone('measurements', id);
  await db.measurements.delete(id);
}

// --- Profiles ---------------------------------------------------------------

const ACTIVE_PROFILE_KEY = 'nd_active_profile';
const LAST_USER_KEY = 'nd_last_user';

/** Profile last shown on this device ('' when never chosen). */
export function storedProfileId(): string {
  try { return localStorage.getItem(ACTIVE_PROFILE_KEY) ?? ''; } catch { return ''; }
}

export function setActiveProfileId(id: string): void {
  try { localStorage.setItem(ACTIVE_PROFILE_KEY, id); } catch { /* storage unavailable: fall back to the heuristic */ }
}

/**
 * Profiles this device may show. When signed in, only the ones belonging to
 * that account (plus not-yet-claimed local ones), so nobody ever sees another
 * account's diary even if they share a device.
 */
export async function listProfiles(ownerUserId?: string | null): Promise<Profile[]> {
  const all = await db.profiles.toArray();
  const scoped = ownerUserId ? all.filter(p => !p.ownerUserId || p.ownerUserId === ownerUserId) : all;
  return scoped.sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a profile with its own copy of the plan template. */
export async function createProfile(input: {
  name: string; sex?: Sex; heightM?: number; birthDate?: string; activity?: number;
  planPin?: string; ownerUserId?: string | null; targetKcal?: number;
}): Promise<Profile> {
  const now = new Date().toISOString();
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Utente',
    sex: input.sex,
    birthDate: input.birthDate,
    heightM: input.heightM,
    activity: input.activity,
    planPin: input.planPin,
    ownerUserId: input.ownerUserId ?? undefined,
    onboardedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const plan = defaultPlan(profile.id);
  if (input.targetKcal) {
    plan.name = `Piano di ${profile.name}`;
    scalePlanTo(plan, input.targetKcal);
  }
  await db.profiles.add(profile);
  await db.plans.add(plan);
  return profile;
}

/** Update a profile's personal data. */
export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'name' | 'sex' | 'heightM' | 'birthDate' | 'activity' | 'planPin'>>,
): Promise<void> {
  await db.profiles.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

/** Erase every local record (used when handing the device over / signing out for good). */
export async function wipeLocalData(): Promise<void> {
  await db.transaction('rw', db.profiles, db.plans, db.dayLogs, db.measurements, db.tombstones, async () => {
    await Promise.all([db.profiles.clear(), db.plans.clear(), db.dayLogs.clear(), db.measurements.clear(), db.tombstones.clear()]);
  });
  setActiveProfileId('');
  try { localStorage.removeItem(LAST_USER_KEY); } catch { /* storage unavailable */ }
}

/**
 * Attach profiles created before signing in to the current account. Only done
 * when this device has never hosted a different account: otherwise the local
 * data belongs to whoever used the app before, and must stay out of reach.
 */
async function claimProfiles(ownerUserId: string): Promise<void> {
  let last: string | null = null;
  try { last = localStorage.getItem(LAST_USER_KEY); } catch { /* storage unavailable */ }
  try { localStorage.setItem(LAST_USER_KEY, ownerUserId); } catch { /* storage unavailable */ }
  if (last && last !== ownerUserId) return;
  const orphans = (await db.profiles.toArray()).filter(p => !p.ownerUserId);
  const now = new Date().toISOString();
  for (const p of orphans) await db.profiles.update(p.id, { ownerUserId, updatedAt: now });
}

/**
 * The profile the signed-in account should use, or '' when it has none yet
 * (first run: the app then shows the setup wizard). Never auto-creates, so a
 * pending cloud pull can still bring the real profile in.
 */
export async function resolveProfileId(ownerUserId: string | null): Promise<string> {
  if (!ownerUserId) return ensureBootstrap();
  await claimProfiles(ownerUserId);
  const picked = await pickProfileId(ownerUserId);
  if (picked) setActiveProfileId(picked);
  return picked;
}

/** Ensure at least one profile + active plan exist (local-only builds without cloud sync). */
export async function ensureBootstrap(): Promise<string> {
  const migratedId = await migrateFromLocalStorage();
  if (migratedId) { setActiveProfileId(migratedId); return migratedId; }

  const picked = await pickProfileId();
  if (picked) { setActiveProfileId(picked); return picked; }
  return '';
}

/**
 * Choose which profile the app should use: normally there is exactly one. When
 * several exist (re-mapped import, cloud pull from another device) prefer the
 * last one shown, falling back to the one holding the most day logs so the app
 * never boots into an empty profile. Returns '' when there are no profiles.
 */
export async function pickProfileId(ownerUserId?: string | null): Promise<string> {
  const profiles = await listProfiles(ownerUserId);
  if (!profiles.length) return '';
  if (profiles.length === 1) return profiles[0].id;
  const stored = storedProfileId();
  let best = profiles[0].id;
  let bestN = -1;
  for (const p of profiles) {
    const n = await db.dayLogs.where('profileId').equals(p.id).count();
    if (p.id === stored && n > 0) return stored;
    if (n > bestN) { bestN = n; best = p.id; }
  }
  return best;
}

/** Get the active plan for a profile (creating a default if none exists). */
export async function getActivePlan(profileId: string): Promise<Plan> {
  const plans = await db.plans.where('profileId').equals(profileId).toArray();
  const active = plans.find(p => p.active)
    ?? plans.sort((a, b) => b.version - a.version)[0];
  if (active) {
    const def = defaultPlan(profileId);
    if (!active.updatedAt) {
      // Plans predate the sync timestamp: backfill it so cloud merges stay deterministic.
      active.updatedAt = active.createdAt;
      await db.plans.update(active.id, { updatedAt: active.createdAt });
    }
    if (active.userEdited && active.seedVersion !== SEED_VERSION) {
      const refreshed: Plan = {
        ...active,
        glucidiAllenamento: replaceOption(active.glucidiAllenamento, def.glucidiAllenamento, 'pastaPane')!,
        glucidiNonAllenamento: replaceOption(active.glucidiNonAllenamento, def.glucidiNonAllenamento, 'pastaPane')!,
        colazioneProt: replaceOption(active.colazioneProt, def.colazioneProt, 'yogurt'),
        seedVersion: SEED_VERSION,
        updatedAt: new Date().toISOString(),
      };
      await db.plans.put(JSON.parse(JSON.stringify(refreshed)));
      return refreshed;
    }
    // Plans that were never customized follow the complete current default.
    if (!active.userEdited) {
      const refreshed: Plan = {
        ...active,
        targetKcal: def.targetKcal,
        glucidiAllenamento: def.glucidiAllenamento,
        glucidiNonAllenamento: def.glucidiNonAllenamento,
        proteine: def.proteine,
        colazioneProt: def.colazioneProt,
        colazioneCarb: def.colazioneCarb,
        colazioneDolce: def.colazioneDolce,
        spuntinoPost: def.spuntinoPost,
        spuntinoMattina: def.spuntinoMattina,
        spuntinoPomeriggio: def.spuntinoPomeriggio,
        verdura: def.verdura,
        frequencies: def.frequencies,
        seasons: def.seasons,
        seedVersion: SEED_VERSION,
        updatedAt: new Date().toISOString(),
      };
      await db.plans.put(JSON.parse(JSON.stringify(refreshed)));
      return refreshed;
    }
    return active;
  }
  const plan = defaultPlan(profileId);
  await db.plans.add(plan);
  return plan;
}

/** All plan versions for a profile, newest first. */
export async function listPlans(profileId: string): Promise<Plan[]> {
  const plans = await db.plans.where('profileId').equals(profileId).toArray();
  return plans.sort((a, b) => b.version - a.version);
}

/** Every plan version keyed by id, so past days can be recomputed with their own version. */
export async function loadPlanIndex(profileId: string): Promise<Map<string, Plan>> {
  const plans = await db.plans.where('profileId').equals(profileId).toArray();
  return new Map(plans.map(p => [p.id, p]));
}

/** Persist in-place edits to a plan version. */
export async function savePlan(plan: Plan): Promise<void> {
  await db.plans.put(JSON.parse(JSON.stringify({ ...plan, userEdited: true, updatedAt: new Date().toISOString() })));
}

/** Duplicate a plan into a new active version (keeps history intact). */
export async function createPlanVersion(source: Plan, name?: string): Promise<Plan> {
  const plans = await db.plans.where('profileId').equals(source.profileId).toArray();
  const nextVersion = Math.max(0, ...plans.map(p => p.version)) + 1;
  const clone: Plan = JSON.parse(JSON.stringify(source));
  clone.id = crypto.randomUUID();
  clone.version = nextVersion;
  clone.name = name?.trim() || source.name;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  clone.active = true;
  clone.userEdited = true;
  await db.transaction('rw', db.plans, async () => {
    for (const p of plans) if (p.active) await db.plans.update(p.id, { active: false });
    await db.plans.add(clone);
  });
  return clone;
}

/** Make a specific plan version the active one. */
export async function activatePlan(profileId: string, planId: string): Promise<void> {
  const plans = await db.plans.where('profileId').equals(profileId).toArray();
  const now = new Date().toISOString();
  await db.transaction('rw', db.plans, async () => {
    for (const p of plans) {
      const shouldBeActive = p.id === planId;
      if (p.active !== shouldBeActive) await db.plans.update(p.id, { active: shouldBeActive, updatedAt: now });
    }
  });
}

const LS_KEY = 'nutriBruno_V1';
const MIGRATION_FLAG = 'nutridash_migrated_v1';

/**
 * Migrate the legacy single-file localStorage state into IndexedDB.
 * Returns the created profile id, or null if nothing to migrate.
 */
async function migrateFromLocalStorage(): Promise<string | null> {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return null;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const legacy = JSON.parse(raw) as { days?: Record<string, LegacyDay> };
    if (!legacy || !legacy.days) return null;

    const now = new Date().toISOString();
    const profile: Profile = {
      id: crypto.randomUUID(), name: 'Bruno', sex: 'M', heightM: 2.02,
      createdAt: now, updatedAt: now,
    };
    const plan = defaultPlan(profile.id);

    const logs: DayLog[] = Object.entries(legacy.days).map(([date, d]) => ({
      id: `${profile.id}:${date}`,
      profileId: profile.id,
      planId: plan.id,
      planVersion: plan.version,
      date,
      dayType: (d.dayType as DayLog['dayType']) || 'nonallenamento',
      water: d.water || 0,
      sel: d.sel || {},
      chk: d.chk || {},
      piatto: normalizePiatto(d.piatto),
      notes: d.notes || {},
      freeMeal: d.freeMeal,
      updatedAt: now,
    }));

    await db.transaction('rw', db.profiles, db.plans, db.dayLogs, async () => {
      await db.profiles.add(profile);
      await db.plans.add(plan);
      if (logs.length) await db.dayLogs.bulkAdd(logs);
    });

    localStorage.setItem(MIGRATION_FLAG, '1');
    return profile.id;
  } catch {
    return null;
  }
}

function normalizePiatto(p: unknown): Record<string, boolean> {
  if (!p) return {};
  if (typeof p === 'object') return p as Record<string, boolean>;
  return p ? { pranzo: true } : {};
}

interface LegacyDay {
  dayType?: string;
  water?: number;
  sel?: Record<string, string>;
  chk?: Record<string, boolean>;
  piatto?: unknown;
  notes?: Record<string, string>;
  freeMeal?: string;
}
