import { db } from './db/db';
import type { DayLog, Macros, Plan } from './types';
import { fmt, parseDate } from './state';
import { mealsFor } from './data/plan';
import { dayMacros } from './compute';

/** The 7 dates (Mon..Sun) of the week containing `dateStr`. */
export function weekDays(dateStr: string): string[] {
  const d = parseDate(dateStr);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return fmt(x);
  });
}

/** Load logs for a contiguous date range [start, end] for a profile. */
export async function logsInRange(profileId: string, start: string, end: string): Promise<DayLog[]> {
  return db.dayLogs
    .where('[profileId+date]')
    .between([profileId, start], [profileId, end], true, true)
    .toArray();
}

/** Count how many times each frequency category was chosen across the logs. */
export function tallyFrequencies(logs: DayLog[], plan: Plan): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of plan.frequencies) counts[f.key] = 0;

  for (const log of logs) {
    const meals = mealsFor(log.dayType, plan, log);
    for (const meal of meals) {
      if (log.piatto?.[meal.id]) {
        if ('piattoUnico' in counts) counts.piattoUnico++;
        if ('legumi' in counts) counts.legumi++; // piatto unico includes legumes
      }
      for (const slot of meal.slots) {
        if (slot.kind !== 'choice' || !slot.options) continue;
        const sel = log.sel[`${meal.id}.${slot.id}`];
        if (!sel) continue;
        const opt = slot.options.find(o => o.id === sel);
        if (opt?.freq && opt.freq in counts) counts[opt.freq]++;
      }
    }
  }
  return counts;
}

export interface ShoppingItem {
  /** The note the user typed (brand / recipe / type). */
  note: string;
  count: number;
  /** Foods this note was attached to, for context. */
  foods: string[];
}

/** Build a shopping list from the free notes attached to selected foods. */
export function shoppingList(logs: DayLog[], plan: Plan): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const log of logs) {
    const notes = log.notes ?? {};
    // Map each selection key to the chosen option label for context.
    const labelByKey: Record<string, string> = {};
    const meals = mealsFor(log.dayType, plan, log);
    for (const meal of meals) {
      if (log.piatto?.[meal.id]) labelByKey[`${meal.id}.piatto`] = 'Piatto unico';
      for (const slot of meal.slots) {
        if (slot.kind !== 'choice' || !slot.options) continue;
        const k = `${meal.id}.${slot.id}`;
        const sel = log.sel[k];
        if (!sel) continue;
        const opt = slot.options.find(o => o.id === sel);
        if (opt) labelByKey[k] = opt.label;
      }
    }
    for (const [k, raw] of Object.entries(notes)) {
      const text = raw.trim();
      if (!text) continue;
      if (!labelByKey[k]) continue; // only notes tied to a current selection / piatto
      const mapKey = text.toLowerCase();
      const cur = map.get(mapKey) ?? { note: text, count: 0, foods: [] };
      cur.count += 1;
      const food = labelByKey[k];
      if (food && !cur.foods.includes(food)) cur.foods.push(food);
      map.set(mapKey, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.note.localeCompare(b.note));
}

/** How "complete" a day is (0..1): fraction of meal slots filled. */
export function dayCompletion(log: DayLog, plan: Plan): number {
  const meals = mealsFor(log.dayType, plan, log);
  let total = 0;
  let filled = 0;
  for (const meal of meals) {
    const piatto = !!log.piatto?.[meal.id];
    for (const slot of meal.slots) {
      if (slot.kind === 'freeToggle') continue; // not a fillable slot
      if (piatto && (slot.id === 'gluc' || slot.id === 'prot' || slot.id === 'verdura')) {
        total++; filled++; // covered by piatto
        continue;
      }
      total++;
      if (slot.kind === 'choice') {
        if (log.sel[`${meal.id}.${slot.id}`]) filled++;
      } else if (slot.kind === 'check') {
        if (log.chk[`${meal.id}.${slot.id}`]) filled++;
      }
    }
  }
  return total ? filled / total : 0;
}

export interface WeekSummary {
  loggedDays: number;
  avgKcal: number;
  avgMacros: Macros;
  avgWater: number; // litres
  avgCompletion: number; // 0..1
}

/** Aggregate stats over logs (averaged across days that have any data). */
export function weekSummary(logs: DayLog[], plan: Plan): WeekSummary {
  const active = logs.filter(l =>
    Object.keys(l.sel).length || Object.keys(l.chk).length || l.water > 0);
  const n = active.length || 1;
  let kcal = 0, carbs = 0, protein = 0, fat = 0, water = 0, compl = 0;
  for (const l of active) {
    const m = dayMacros(l, plan);
    kcal += m.kcal; carbs += m.carbs; protein += m.protein; fat += m.fat;
    water += l.water * 0.25;
    compl += dayCompletion(l, plan);
  }
  return {
    loggedDays: active.length,
    avgKcal: Math.round(kcal / n),
    avgMacros: {
      kcal: Math.round(kcal / n),
      carbs: Math.round(carbs / n),
      protein: Math.round(protein / n),
      fat: Math.round(fat / n),
    },
    avgWater: +(water / n).toFixed(2),
    avgCompletion: compl / n,
  };
}

export interface DayBar {
  date: string;
  label: string; // Lun, Mar…
  kcal: number;
  macros: Macros;
  hasData: boolean;
}

/** Per-day kcal/macro breakdown for the 7 given dates (Mon..Sun). */
export function weeklyBreakdown(logs: DayLog[], plan: Plan, days: string[]): DayBar[] {
  const WD = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const byDate = new Map(logs.map(l => [l.date, l]));
  return days.map((date, i) => {
    const log = byDate.get(date);
    const hasData = !!log && (Object.keys(log.sel).length > 0 || Object.keys(log.chk).length > 0 || log.water > 0);
    const m = log && hasData ? dayMacros(log, plan) : { kcal: 0, carbs: 0, protein: 0, fat: 0 };
    return {
      date,
      label: WD[i],
      kcal: Math.round(m.kcal),
      macros: {
        kcal: Math.round(m.kcal),
        carbs: Math.round(m.carbs),
        protein: Math.round(m.protein),
        fat: Math.round(m.fat),
      },
      hasData: !!hasData,
    };
  });
}
