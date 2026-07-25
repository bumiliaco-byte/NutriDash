import type { DayLog, Macros, Meal, Plan, Slot } from './types';
import { macrosFor, optionMacros } from './data/foods';
import { mealsFor } from './data/plan';

const EMPTY: Macros = { kcal: 0, carbs: 0, protein: 0, fat: 0 };

/**
 * Estimated macros for a "piatto unico" (≈90g cereale + 30g legumi secchi + verdure),
 * aligned to CREA values. Olio EVO is counted separately as its own check slot.
 */
export const PIATTO_UNICO: Macros = { kcal: 458, carbs: 88, protein: 20, fat: 3 };

function add(a: Macros, b: Macros | null): Macros {
  if (!b) return a;
  return {
    kcal: a.kcal + b.kcal,
    carbs: a.carbs + b.carbs,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
  };
}

/** Macros contributed by a check slot (e.g. verdura, olio EVO). */
export function slotMacros(slot: Slot): Macros | null {
  if (slot.id === 'olio') {
    const grams = slot.grams ?? (slot.detail?.includes('40') ? 40 : 30);
    return macrosFor('olio', grams);
  }
  if (!slot.grams) return null;
  if (slot.per100) {
    const k = slot.grams / 100;
    return {
      kcal: slot.per100.kcal * k,
      carbs: slot.per100.carbs * k,
      protein: slot.per100.protein * k,
      fat: slot.per100.fat * k,
    };
  }
  return macrosFor(slot.foodId, slot.grams);
}

/** Macros contributed by a single meal given the day's selections. */
export function mealMacros(meal: Meal, day: DayLog): Macros {
  // A free meal is untracked: it doesn't contribute to the day's macro totals.
  if (day.freeMeal === meal.id) return { ...EMPTY };
  let total = { ...EMPTY };
  const piatto = !!day.piatto?.[meal.id];
  if (piatto) total = add(total, PIATTO_UNICO);
  for (const slot of meal.slots) {
    // Piatto unico replaces gluc+prot with a combined dish; verdura stays as a side.
    if (piatto && (slot.id === 'gluc' || slot.id === 'prot')) continue;

    if (slot.kind === 'choice' && slot.options) {
      const chosen = day.sel[`${meal.id}.${slot.id}`];
      const opt = slot.options.find(o => o.id === chosen);
      if (opt) total = add(total, optionMacros(opt));
    } else if (slot.kind === 'check') {
      const on = day.chk[`${meal.id}.${slot.id}`];
      if (on) total = add(total, slotMacros(slot));
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
