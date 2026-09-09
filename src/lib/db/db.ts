import Dexie, { type Table } from 'dexie';
import type { DayLog, Measurement, Plan, Profile } from '../types';
import { defaultPlan, SEED_VERSION } from '../data/plan';

/** IndexedDB database for NutriDash (local-first store). */
export class NutriDB extends Dexie {
  profiles!: Table<Profile, string>;
  plans!: Table<Plan, string>;
  dayLogs!: Table<DayLog, string>;
  measurements!: Table<Measurement, string>;

  constructor() {
    super('nutridash');
    this.version(1).stores({
      profiles: 'id, name',
      plans: 'id, profileId, version',
      dayLogs: 'id, profileId, date, [profileId+date]',
      measurements: 'id, profileId, date, [profileId+date]',
    });
  }
}

export const db = new NutriDB();

/** Ensure at least one profile + active plan exist. Returns the profile id. */
export async function ensureBootstrap(): Promise<string> {
  const migratedId = await migrateFromLocalStorage();
  if (migratedId) return migratedId;

  const picked = await pickProfileId();
  if (picked) return picked;

  const now = new Date().toISOString();
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: 'Bruno',
    sex: 'M',
    heightM: 2.02,
    createdAt: now,
    updatedAt: now,
  };
  await db.profiles.add(profile);
  await db.plans.add(defaultPlan(profile.id));
  return profile.id;
}

/**
 * Choose which profile the app should use. With a single profile it's trivial;
 * when several exist (e.g. after a re-mapped import or a cloud pull from another
 * device) pick the one holding the most day logs so the app never boots into an
 * empty profile. Returns '' when there are no profiles yet.
 */
export async function pickProfileId(): Promise<string> {
  const profiles = await db.profiles.toArray();
  if (!profiles.length) return '';
  if (profiles.length === 1) return profiles[0].id;
  let best = profiles[0];
  let bestN = -1;
  for (const p of profiles) {
    const n = await db.dayLogs.where('profileId').equals(p.id).count();
    if (n > bestN) { bestN = n; best = p; }
  }
  return best.id;
}

/** Get the active plan for a profile (creating a default if none exists). */
export async function getActivePlan(profileId: string): Promise<Plan> {
  const plans = await db.plans.where('profileId').equals(profileId).toArray();
  const active = plans.find(p => p.active)
    ?? plans.sort((a, b) => b.version - a.version)[0];
  if (active) {
    // Keep structural content in sync with the code defaults until the user
    // edits the plan in-app. A bumped SEED_VERSION forces a one-time re-align
    // even for user-edited plans so shipped plan fixes always reach the user.
    if (!active.userEdited || active.seedVersion !== SEED_VERSION) {
      const def = defaultPlan(profileId);
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

/** Persist in-place edits to a plan version. */
export async function savePlan(plan: Plan): Promise<void> {
  await db.plans.put(JSON.parse(JSON.stringify({ ...plan, userEdited: true })));
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
  await db.transaction('rw', db.plans, async () => {
    for (const p of plans) {
      const shouldBeActive = p.id === planId;
      if (p.active !== shouldBeActive) await db.plans.update(p.id, { active: shouldBeActive });
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
