import { db } from './db/db';
import type { DayLog, Measurement, Plan, Profile } from './types';

interface Backup {
  app: 'nutridash';
  version: 1;
  exportedAt: string;
  profiles: Profile[];
  plans: Plan[];
  dayLogs: DayLog[];
  measurements: Measurement[];
}

/** Serialise the whole local database to a JSON backup object. */
export async function exportBackup(): Promise<Backup> {
  const [profiles, plans, dayLogs, measurements] = await Promise.all([
    db.profiles.toArray(),
    db.plans.toArray(),
    db.dayLogs.toArray(),
    db.measurements.toArray(),
  ]);
  return { app: 'nutridash', version: 1, exportedAt: new Date().toISOString(), profiles, plans, dayLogs, measurements };
}

/** Trigger a download of the current data as a JSON file. */
export async function downloadBackup(): Promise<void> {
  const data = await exportBackup();
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

/** Restore a backup (merge by primary key; newer data wins on day logs). */
export async function importBackup(json: string): Promise<{ profiles: number; plans: number; dayLogs: number }> {
  const data = JSON.parse(json) as Backup;
  if (data.app !== 'nutridash') throw new Error('File non valido');

  await db.transaction('rw', db.profiles, db.plans, db.dayLogs, db.measurements, async () => {
    if (data.profiles?.length) await db.profiles.bulkPut(data.profiles);
    if (data.plans?.length) await db.plans.bulkPut(data.plans);
    if (data.measurements?.length) await db.measurements.bulkPut(data.measurements);
    for (const log of data.dayLogs ?? []) {
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
