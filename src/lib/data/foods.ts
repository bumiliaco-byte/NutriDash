import type { Food } from '../types';

/**
 * Macro database. Values are per 100 g of edible portion (as weighed for the
 * plan: dry pasta/rice/legumes, raw meat/fish), aligned to the CREA
 * "Tabelle di composizione degli alimenti" (ex-INRAN). Grouped foods (e.g.
 * "carne bianca", "pesce fresco") use a representative average of the items
 * listed in the plan. Refine per brand from the food label when available.
 */
export const FOODS: Record<string, Food> = {
  // ---- Fonti proteiche ----
  carneBianca: { id: 'carneBianca', label: 'Carne bianca', category: 'proteina', per100: { kcal: 110, carbs: 0, protein: 23, fat: 2 } },
  carneRossa: { id: 'carneRossa', label: 'Carne rossa', category: 'proteina', per100: { kcal: 130, carbs: 0, protein: 21, fat: 5 } },
  affettato: { id: 'affettato', label: 'Affettato magro', category: 'proteina', per100: { kcal: 151, carbs: 0.5, protein: 32, fat: 2 } },
  pesceFresco: { id: 'pesceFresco', label: 'Pesce fresco', category: 'proteina', per100: { kcal: 120, carbs: 0, protein: 20, fat: 4 } },
  pesceScatola: { id: 'pesceScatola', label: 'Pesce in scatola', category: 'proteina', per100: { kcal: 130, carbs: 0, protein: 26, fat: 3 } },
  uova: { id: 'uova', label: 'Uova', category: 'proteina', per100: { kcal: 128, carbs: 0.6, protein: 12.4, fat: 8.7 } },
  formFreschi: { id: 'formFreschi', label: 'Formaggi freschi', category: 'proteina', per100: { kcal: 170, carbs: 3, protein: 11, fat: 12 } },
  formSpalm: { id: 'formSpalm', label: 'Formaggi spalmabili', category: 'proteina', per100: { kcal: 230, carbs: 4, protein: 7, fat: 21 } },
  formStag: { id: 'formStag', label: 'Formaggi stagionati', category: 'proteina', per100: { kcal: 360, carbs: 1, protein: 25, fat: 28 } },
  tofu: { id: 'tofu', label: 'Tofu', category: 'proteina', per100: { kcal: 100, carbs: 2, protein: 11, fat: 6 } },
  tempeh: { id: 'tempeh', label: 'Tempeh', category: 'proteina', per100: { kcal: 190, carbs: 8, protein: 19, fat: 11 } },
  legumiSecchi: { id: 'legumiSecchi', label: 'Legumi secchi', category: 'proteina', per100: { kcal: 300, carbs: 50, protein: 22, fat: 2.5 } },
  legumiFreschi: { id: 'legumiFreschi', label: 'Legumi freschi o in scatola', category: 'proteina', per100: { kcal: 110, carbs: 18, protein: 8, fat: 1 } },
  legumiSurgelati: { id: 'legumiSurgelati', label: 'Legumi surgelati', category: 'proteina', per100: { kcal: 100, carbs: 16, protein: 7, fat: 1 } },

  // ---- Fonti glucidiche ----
  pasta: { id: 'pasta', label: 'Pasta', category: 'glucide', per100: { kcal: 353, carbs: 72, protein: 11, fat: 1.5 } },
  riso: { id: 'riso', label: 'Riso', category: 'glucide', per100: { kcal: 350, carbs: 78, protein: 7, fat: 0.5 } },
  pane: { id: 'pane', label: 'Pane', category: 'glucide', per100: { kcal: 275, carbs: 55, protein: 9, fat: 1 } },
  patate: { id: 'patate', label: 'Patate', category: 'glucide', per100: { kcal: 78, carbs: 17, protein: 2, fat: 0.1 } },
  farro: { id: 'farro', label: 'Farro / orzo / quinoa', category: 'glucide', per100: { kcal: 340, carbs: 68, protein: 13, fat: 2.5 } },
  crostini: { id: 'crostini', label: 'Crostini', category: 'glucide', per100: { kcal: 400, carbs: 70, protein: 10, fat: 8 } },

  // ---- Colazione / spuntini ----
  yogurtGreco: { id: 'yogurtGreco', label: 'Yogurt greco 0%', category: 'proteina', per100: { kcal: 57, carbs: 4, protein: 10, fat: 0.4 } },
  ricottaLight: { id: 'ricottaLight', label: 'Ricotta light', category: 'proteina', per100: { kcal: 138, carbs: 3.5, protein: 11, fat: 8 } },
  albume: { id: 'albume', label: 'Albume', category: 'proteina', per100: { kcal: 48, carbs: 0.7, protein: 11, fat: 0.2 } },
  cereali: { id: 'cereali', label: 'Cereali', category: 'glucide', per100: { kcal: 360, carbs: 60, protein: 12, fat: 6 } },
  fette: { id: 'fette', label: 'Fette biscottate', category: 'glucide', per100: { kcal: 410, carbs: 82, protein: 11, fat: 6 } },
  marmellata: { id: 'marmellata', label: 'Marmellata', category: 'glucide', per100: { kcal: 250, carbs: 60, protein: 0.5, fat: 0.1 } },
  miele: { id: 'miele', label: 'Miele', category: 'glucide', per100: { kcal: 304, carbs: 80, protein: 0.3, fat: 0 } },
  fruttoDolce: { id: 'fruttoDolce', label: 'Frutto (frutti di bosco / lamponi / mezza banana)', category: 'frutta', per100: { kcal: 55, carbs: 12, protein: 1, fat: 0.3 } },

  // ---- Verdura ----
  verdura: { id: 'verdura', label: 'Verdura / ortaggio', category: 'verdura', per100: { kcal: 25, carbs: 4, protein: 1.5, fat: 0.3 } },

  // ---- Condimento ----
  olio: { id: 'olio', label: 'Olio EVO', category: 'condimento', per100: { kcal: 899, carbs: 0, protein: 0, fat: 99.9 } },
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
