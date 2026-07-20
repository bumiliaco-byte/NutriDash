import type { DayLog, Macros, Meal, Plan } from './types';
import { macrosFor, optionMacros } from './data/foods';
import { mealsFor } from './data/plan';

const EMPTY: Macros = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

function add(a: Macros, b: Macros | null): Macros {
  if (!b) return a;
  return {
    kcal: a.kcal + b.kcal,
    carbs: a.carbs + b.carbs,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
  };
}

/** Macros contributed by a single meal given the day's selections. */
export function mealMacros(meal: Meal, day: DayLog): Macros {
  let total = { ...EMPTY };
  const piatto = !!day.piatto?.[meal.id];
  for (const slot of meal.slots) {
    // Piatto unico replaces gluc+prot with a combined dish; skip those slots.
    if (piatto && (slot.id === 'gluc' || slot.id === 'prot')) continue;

    if (slot.kind === 'choice' && slot.options) {
      const chosen = day.sel[`${meal.id}.${slot.id}`];
      const opt = slot.options.find(o => o.id === chosen);
      if (opt) total = add(total, optionMacros(opt));
    } else if (slot.kind === 'check') {
      const on = day.chk[`${meal.id}.${slot.id}`];
      if (on && slot.id === 'olio') {
        const grams = slot.grams ?? (slot.detail?.includes('40') ? 40 : 30);
        total = add(total, macrosFor('olio', grams));
      }
    }
  }
  return total;
}

/** Total macros for a whole day. */
export function dayMacros(day: DayLog, plan: Plan): Macros {
  const meals = mealsFor(day.dayType, plan, day);
  return meals.reduce((acc, m) => add(acc, mealMacros(m, day)), { ...EMPTY });
}

export function round(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    carbs: Math.round(m.carbs),
    protein: Math.round(m.protein),
    fat: Math.round(m.fat),
  };
}

/** Percentage split of energy from each macro (carbs/protein 4 kcal/g, fat 9). */
export function macroSplit(m: Macros): { carbs: number; protein: number; fat: number } {
  const c = m.carbs * 4, p = m.protein * 4, f = m.fat * 9;
  const tot = c + p + f;
  if (tot <= 0) return { carbs: 0, protein: 0, fat: 0 };
  return {
    carbs: Math.round((c / tot) * 100),
    protein: Math.round((p / tot) * 100),
    fat: Math.round((f / tot) * 100),
  };
}
