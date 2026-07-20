import type { Food } from '../types';

/**
 * Macro database. Values are per 100 g of edible/raw food (as weighed for the
 * plan: dry pasta/rice/legumes, raw meat/fish). Figures are approximate,
 * suitable for daily tracking; refine per brand from the food label.
 */
export const FOODS: Record<string, Food> = {
  // ---- Fonti proteiche ----
  carneBianca: { id: 'carneBianca', label: 'Carne bianca', category: 'proteina', per100: { kcal: 110, carbs: 0, protein: 23, fat: 2 } },
  carneRossa: { id: 'carneRossa', label: 'Carne rossa', category: 'proteina', per100: { kcal: 130, carbs: 0, protein: 21, fat: 5 } },
  affettato: { id: 'affettato', label: 'Affettato magro', category: 'proteina', per100: { kcal: 150, carbs: 0.5, protein: 32, fat: 2 } },
  pesceFresco: { id: 'pesceFresco', label: 'Pesce fresco', category: 'proteina', per100: { kcal: 105, carbs: 0, protein: 20, fat: 3 } },
  pesceScatola: { id: 'pesceScatola', label: 'Pesce in scatola', category: 'proteina', per100: { kcal: 115, carbs: 0, protein: 25, fat: 1 } },
  uova: { id: 'uova', label: 'Uova', category: 'proteina', per100: { kcal: 143, carbs: 0.7, protein: 13, fat: 10 } },
  formFreschi: { id: 'formFreschi', label: 'Formaggi freschi', category: 'proteina', per100: { kcal: 160, carbs: 3, protein: 11, fat: 11 } },
  formSpalm: { id: 'formSpalm', label: 'Formaggi spalmabili', category: 'proteina', per100: { kcal: 250, carbs: 4, protein: 6, fat: 24 } },
  formStag: { id: 'formStag', label: 'Formaggi stagionati', category: 'proteina', per100: { kcal: 350, carbs: 1, protein: 25, fat: 27 } },
  tofu: { id: 'tofu', label: 'Tofu', category: 'proteina', per100: { kcal: 120, carbs: 2, protein: 12, fat: 7 } },
  tempeh: { id: 'tempeh', label: 'Tempeh', category: 'proteina', per100: { kcal: 190, carbs: 8, protein: 19, fat: 11 } },
  legumiSecchi: { id: 'legumiSecchi', label: 'Legumi secchi', category: 'proteina', per100: { kcal: 330, carbs: 50, protein: 22, fat: 2 } },
  legumiFreschi: { id: 'legumiFreschi', label: 'Legumi freschi o in scatola', category: 'proteina', per100: { kcal: 120, carbs: 20, protein: 8, fat: 1 } },
  legumiSurgelati: { id: 'legumiSurgelati', label: 'Legumi surgelati', category: 'proteina', per100: { kcal: 110, carbs: 18, protein: 8, fat: 1 } },

  // ---- Fonti glucidiche ----
  pasta: { id: 'pasta', label: 'Pasta', category: 'glucide', per100: { kcal: 360, carbs: 72, protein: 12, fat: 1.5 } },
  riso: { id: 'riso', label: 'Riso', category: 'glucide', per100: { kcal: 360, carbs: 78, protein: 7, fat: 0.6 } },
  pane: { id: 'pane', label: 'Pane', category: 'glucide', per100: { kcal: 270, carbs: 50, protein: 9, fat: 3 } },
  patate: { id: 'patate', label: 'Patate', category: 'glucide', per100: { kcal: 78, carbs: 17, protein: 2, fat: 0.1 } },
  farro: { id: 'farro', label: 'Farro / orzo / quinoa', category: 'glucide', per100: { kcal: 350, carbs: 70, protein: 12, fat: 2 } },
  crostini: { id: 'crostini', label: 'Crostini', category: 'glucide', per100: { kcal: 400, carbs: 70, protein: 10, fat: 8 } },

  // ---- Condimento ----
  olio: { id: 'olio', label: 'Olio EVO', category: 'condimento', per100: { kcal: 900, carbs: 0, protein: 0, fat: 100 } },
};

/** Compute macros for a given food id and grams. */
export function macrosFor(foodId: string | undefined, grams: number | undefined): import('../types').Macros | null {
  if (!foodId || !grams) return null;
  const f = FOODS[foodId];
  if (!f) return null;
  const k = grams / 100;
  return {
    kcal: f.per100.kcal * k,
    carbs: f.per100.carbs * k,
    protein: f.per100.protein * k,
    fat: f.per100.fat * k,
  };
}

/**
 * Macros for a plan option. Prefers the per100 values embedded in the option
 * (editable in the plan editor) and falls back to the FOODS database by id.
 */
export function optionMacros(opt: import('../types').SlotOption): import('../types').Macros | null {
  const grams = opt.grams;
  if (!grams) return null;
  const per100 = opt.per100 ?? (opt.foodId ? FOODS[opt.foodId]?.per100 : undefined);
  if (!per100) return null;
  const k = grams / 100;
  return {
    kcal: per100.kcal * k,
    carbs: per100.carbs * k,
    protein: per100.protein * k,
    fat: per100.fat * k,
  };
}
