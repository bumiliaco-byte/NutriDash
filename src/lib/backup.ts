import { db, loadPlanIndex } from './db/db';
import type { DayLog, Measurement, Plan, Profile } from './types';
import { dayMacros } from './compute';
import { dayCompletion, planIndexResolver } from './stats';

interface Backup {
  app: 'nutridash';
  version: 1;
  exportedAt: string;
  profiles: Profile[];
  plans: Plan[];
  dayLogs: DayLog[];
  measurements: Measurement[];
}

/** Serialise the local database to a JSON backup object (one profile when given). */
export async function exportBackup(profileId?: string): Promise<Backup> {
  const [profiles, plans, dayLogs, measurements] = await Promise.all([
    db.profiles.toArray(),
    db.plans.toArray(),
    db.dayLogs.toArray(),
    db.measurements.toArray(),
  ]);
  const mine = <T extends { profileId: string }>(rows: T[]) =>
    profileId ? rows.filter(r => r.profileId === profileId) : rows;
  return {
    app: 'nutridash',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: profileId ? profiles.filter(p => p.id === profileId) : profiles,
    plans: mine(plans),
    dayLogs: mine(dayLogs),
    measurements: mine(measurements),
  };
}

/** Trigger a download of the current data as a JSON file. */
export async function downloadBackup(profileId?: string): Promise<void> {
  const data = await exportBackup(profileId);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutridash-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Restore a backup (merge by primary key; newer data wins on day logs).
 *
 * When `targetProfileId` is given, all imported data is re-mapped onto that
 * profile. This is essential on iOS/mobile where a freshly added home-screen
 * icon bootstraps a NEW profile id: without re-mapping, imported day logs stay
 * attached to the backup's old profile id and never show up.
 */
export async function importBackup(
  json: string,
  targetProfileId?: string,
): Promise<{ profiles: number; plans: number; dayLogs: number }> {
  const data = JSON.parse(json) as Backup;
  if (data.app !== 'nutridash') throw new Error('File non valido');

  const remap = !!targetProfileId;

  await db.transaction('rw', db.profiles, db.plans, db.dayLogs, db.measurements, async () => {
    if (remap) {
      // Keep the current profile id; adopt anthropometric fields from the backup.
      const src = data.profiles?.[0];
      const cur = await db.profiles.get(targetProfileId!);
      if (src && cur) {
        await db.profiles.put({
          ...cur,
          name: src.name ?? cur.name,
          sex: src.sex ?? cur.sex,
          birthDate: src.birthDate ?? cur.birthDate,
          heightM: src.heightM ?? cur.heightM,
          updatedAt: new Date().toISOString(),
        });
      }
      // Deactivate existing plans so the imported active plan wins.
      const existing = await db.plans.where('profileId').equals(targetProfileId!).toArray();
      for (const p of existing) if (p.active) await db.plans.update(p.id, { active: false });
    } else if (data.profiles?.length) {
      await db.profiles.bulkPut(data.profiles);
    }

    if (data.plans?.length) {
      const plans = remap ? data.plans.map((p) => ({ ...p, profileId: targetProfileId! })) : data.plans;
      await db.plans.bulkPut(plans);
    }

    if (data.measurements?.length) {
      const ms = remap
        ? data.measurements.map((m) => ({ ...m, profileId: targetProfileId!, id: `${targetProfileId}:${m.date}` }))
        : data.measurements;
      await db.measurements.bulkPut(ms);
    }

    for (const raw of data.dayLogs ?? []) {
      const log = remap ? { ...raw, profileId: targetProfileId!, id: `${targetProfileId}:${raw.date}` } : raw;
      const local = await db.dayLogs.get(log.id);
      if (!local || new Date(log.updatedAt) >= new Date(local.updatedAt)) {
        await db.dayLogs.put(log);
      }
    }
  });

  return {
    profiles: data.profiles?.length ?? 0,
    plans: data.plans?.length ?? 0,
    dayLogs: data.dayLogs?.length ?? 0,
  };
}

/** Export the daily diary as a CSV file (macros/water/completion per logged day). */
export async function downloadCsv(profileId: string, plan: Plan): Promise<void> {
  const logs = (await db.dayLogs.where('profileId').equals(profileId).toArray())
    .sort((a, b) => a.date.localeCompare(b.date));
  const planFor = planIndexResolver(await loadPlanIndex(profileId), plan);
  const rows: string[][] = [
    ['data', 'tipo', 'kcal', 'carboidrati_g', 'proteine_g', 'grassi_g', 'acqua_l', 'completamento_%', 'pasto_libero'],
  ];
  for (const l of logs) {
    const p = planFor(l);
    const m = dayMacros(l, p);
    rows.push([
      l.date,
      l.dayType,
      String(Math.round(m.kcal)),
      String(Math.round(m.carbs)),
      String(Math.round(m.protein)),
      String(Math.round(m.fat)),
      (l.water * 0.25).toFixed(2),
      String(Math.round(dayCompletion(l, p) * 100)),
      l.freeMeal ?? '',
    ]);
  }
  const csv = rows.map((r) => r.join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutridash-diario-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
