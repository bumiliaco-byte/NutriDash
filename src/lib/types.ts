/** Domain types for NutriDash. */

export type DayType = 'allenamento' | 'nonallenamento' | 'pastolibero';

export type Sex = 'M' | 'F';

/** Macro-nutrients per 100 g of edible food. */
export interface Macros {
  kcal: number;
  carbs: number; // g
  protein: number; // g
  fat: number; // g
}

/** A food item in the nutrition database (values per 100 g). */
export interface Food {
  id: string;
  label: string;
  /** Free-text category, e.g. "proteina", "glucide", "verdura". */
  category: string;
  /** Macros per 100 g. */
  per100: Macros;
}

/** A slot inside a meal: either a single/multiple choice or a simple check. */
export type SlotKind = 'choice' | 'check' | 'piatto' | 'freeToggle';

export interface SlotOption {
  id: string;
  label: string;
  detail?: string;
  /** Optional link to a Food id for macro computation. */
  foodId?: string;
  /** Grams of the referenced food, when the option maps 1:1 to a food. */
  grams?: number;
  /** Macros per 100 g, embedded so a plan version is self-contained/editable. */
  per100?: Macros;
  /** Frequency bucket this option contributes to (see FrequencyRule). */
  freq?: string;
  /** Weekly limit hint shown in UI, e.g. "max 1 / sett". */
  lim?: string;
}

export interface Slot {
  id: string;
  kind: SlotKind;
  label: string;
  detail?: string;
  /** Grams used for macro computation (e.g. olio EVO). */
  grams?: number;
  options?: SlotOption[];
}

export interface Meal {
  id: string;
  name: string;
  icon: string;
  note?: string;
  /** Only show note on training days. */
  noteOnlyTraining?: boolean;
  waterNote?: string;
  hasPiatto?: boolean;
  slots: Slot[];
}

/** Weekly frequency recommendation for a food category. */
export interface FrequencyRule {
  key: string;
  label: string;
  /** Minimum per week (optional). */
  min?: number;
  /** Maximum per week (optional). When absent the entry is informational (no cap). */
  max?: number;
}

/** Seasonal produce for a month (0-based month index). */
export interface Season {
  month: number;
  label: string;
  frutta: string;
  verdura: string;
}

/**
 * A versioned nutrition plan. Editing the plan creates a new version so that
 * historical day logs keep referring to the version that was active then.
 */
export interface Plan {
  id: string;
  profileId: string;
  version: number;
  name: string;
  createdAt: string; // ISO
  active: boolean;
  /** True once the user edits the plan in-app; prevents auto re-seed from code defaults. */
  userEdited?: boolean;
  /** Structural seed version; when it lags behind the code's SEED_VERSION the plan is re-aligned once. */
  seedVersion?: number;
  /** Target macros/energy (optional, from the nutritionist). */
  targetKcal?: number;
  /** Structured plan content. */
  glucidiAllenamento: SlotOption[];
  glucidiNonAllenamento: SlotOption[];
  proteine: SlotOption[];
  frequencies: FrequencyRule[];
  seasons: Season[];
  /** Serialised meal templates keyed by day type is derived in code. */
}

/** A person using the app. */
export interface Profile {
  id: string;
  name: string;
  sex?: Sex;
  birthDate?: string;
  heightM?: number;
  createdAt: string;
  updatedAt: string;
}

/** Anthropometric measurement (a "Visita"). */
export interface Measurement {
  id: string;
  profileId: string;
  date: string; // ISO date
  weightKg?: number;
  bmi?: number;
  bmr?: number;
  tdee?: number;
  fmPct?: number;
  ffmPct?: number;
  circumferences?: Record<string, number>;
  skinfolds?: Record<string, number>;
}

/** Per-day diary entry. */
export interface DayLog {
  id: string; // `${profileId}:${date}`
  profileId: string;
  planId: string;
  planVersion: number;
  date: string; // YYYY-MM-DD
  dayType: DayType;
  water: number; // glasses
  /** Selected choice per `${mealId}.${slotId}` -> optionId. */
  sel: Record<string, string>;
  /** Checked flags per `${mealId}.${slotId}`. */
  chk: Record<string, boolean>;
  /** Piatto unico selected per mealId. */
  piatto: Record<string, boolean>;
  /** Free notes per key. */
  notes: Record<string, string>;
  freeMeal?: string;
  updatedAt: string; // ISO, for sync conflict resolution
}
