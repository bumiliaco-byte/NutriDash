import type { DayLog, FrequencyRule, Meal, Plan, Season, Slot, SlotOption } from '../types';
import { FOODS } from './foods';

/** Attach embedded per100 macros (from FOODS) so the plan is self-contained. */
function withMacros(opts: SlotOption[]): SlotOption[] {
  return opts.map(o => ({
    ...o,
    per100: o.per100 ?? (o.foodId ? FOODS[o.foodId]?.per100 : undefined),
  }));
}

/** Proteine (fonte proteica) options with macro links. */
export const PROTEINE: SlotOption[] = [
  { id: 'carneBianca', label: 'Carne bianca', detail: '150–200g · pollo, tacchino, coniglio', freq: 'carneBianca', foodId: 'carneBianca', grams: 175 },
  { id: 'carneRossa', label: 'Carne rossa', detail: '150–200g · manzo, vitello', freq: 'carneRossa', lim: 'max 1 / sett', foodId: 'carneRossa', grams: 175 },
  { id: 'affettato', label: 'Affettato magro', detail: '60–80g · bresaola, fesa di tacchino, prosciutto cotto/crudo', freq: 'salumi', lim: 'max 1 / sett', foodId: 'affettato', grams: 70 },
  { id: 'pesceFresco', label: 'Pesce fresco', detail: '200–250g · merluzzo, nasello, sogliola, trota, salmone, sgombro, sardine, aringa', freq: 'pesce', foodId: 'pesceFresco', grams: 225 },
  { id: 'pesceScatola', label: 'Pesce in scatola', detail: '100–120g · tonno, sgombro al naturale o in olio EVO, sgocciolati', freq: 'pesce', foodId: 'pesceScatola', grams: 110 },
  { id: 'uova', label: 'Uova', detail: '2 uova', freq: 'uova', foodId: 'uova', grams: 100 },
  { id: 'formFreschi', label: 'Formaggi freschi', detail: '100g · ricotta, mozzarella, squacquerone, fiocchi di latte', freq: 'formFreschi', foodId: 'formFreschi', grams: 100 },
  { id: 'formSpalm', label: 'Formaggi spalmabili', detail: '80g · robiola, crescenza, Philadelphia light', freq: 'formFreschi', foodId: 'formSpalm', grams: 80 },
  { id: 'formStag', label: 'Formaggi stagionati', detail: '50g · provola, provolone, caciotta, galbanino', freq: 'formStag', foodId: 'formStag', grams: 50 },
  { id: 'tofu', label: 'Tofu', detail: '100g', freq: 'vegetale', foodId: 'tofu', grams: 100 },
  { id: 'tempeh', label: 'Tempeh', detail: '80–100g', freq: 'vegetale', foodId: 'tempeh', grams: 90 },
  { id: 'legumiSecchi', label: 'Legumi secchi', detail: '30g · ceci, lenticchie decorticate, fagioli, piselli (vedi piatto unico)', freq: 'legumi', foodId: 'legumiSecchi', grams: 30 },
  { id: 'legumiFreschi', label: 'Legumi freschi o in scatola', detail: '100g · fagioli, ceci, lenticchie, piselli, fave (vedi piatto unico)', freq: 'legumi', foodId: 'legumiFreschi', grams: 100 },
  { id: 'legumiSurgelati', label: 'Legumi surgelati', detail: '100g (vedi piatto unico)', freq: 'legumi', foodId: 'legumiSurgelati', grams: 100 },
];

export const GLUC_ALL: SlotOption[] = [
  { id: 'pasta', label: 'Pasta normale o integrale', detail: '100g', foodId: 'pasta', grams: 100 },
  { id: 'riso', label: 'Riso', detail: '100g', foodId: 'riso', grams: 100 },
  { id: 'pane', label: 'Pane', detail: '130g', foodId: 'pane', grams: 130 },
  { id: 'pastaPane', label: 'Pasta + pane', detail: '80g + 30g', foodId: 'pasta', grams: 80 },
  { id: 'patate', label: 'Patate', detail: '460g', foodId: 'patate', grams: 460 },
  { id: 'farro', label: 'Farro / orzo / quinoa', detail: '80g', foodId: 'farro', grams: 80 },
  { id: 'crostini', label: 'Crostini', detail: "60–70g · Buitoni / Fiori d'Acqua Mulino Bianco", foodId: 'crostini', grams: 65 },
];

export const GLUC_NON: SlotOption[] = [
  { id: 'pasta', label: 'Pasta normale o integrale', detail: '80g', foodId: 'pasta', grams: 80 },
  { id: 'riso', label: 'Riso', detail: '80g', foodId: 'riso', grams: 80 },
  { id: 'pane', label: 'Pane', detail: '100g', foodId: 'pane', grams: 100 },
  { id: 'pastaPane', label: 'Pasta + pane', detail: '60g + 30g', foodId: 'pasta', grams: 60 },
  { id: 'patate', label: 'Patate', detail: '370g', foodId: 'patate', grams: 370 },
  { id: 'farro', label: 'Farro / orzo / quinoa', detail: '80g', foodId: 'farro', grams: 80 },
  { id: 'crostini', label: 'Crostini', detail: "50g · Buitoni / Fiori d'Acqua Mulino Bianco", foodId: 'crostini', grams: 50 },
];

export const FREQUENCIES: FrequencyRule[] = [
  { key: 'pesce', label: 'Pesce' },
  { key: 'carneBianca', label: 'Carne bianca' },
  { key: 'carneRossa', label: 'Carne rossa', max: 1 },
  { key: 'salumi', label: 'Salumi / affettati', max: 1 },
  { key: 'parmigiano', label: 'Parmigiano (spuntino)', max: 3 },
  { key: 'formFreschi', label: 'Formaggi freschi' },
  { key: 'formStag', label: 'Formaggi stagionati' },
  { key: 'uova', label: 'Uova (pasto)' },
  { key: 'legumi', label: 'Legumi' },
  { key: 'vegetale', label: 'Proteine vegetali (tofu/tempeh)' },
  { key: 'piattoUnico', label: 'Piatto unico' },
  { key: 'pastolibero', label: 'Pasto libero', max: 1 },
];

export const SEASONS: Season[] = [
  { month: 6, label: 'Luglio', frutta: 'Anguria, melone, pesche, nettarine, albicocche, fichi, prugne, mirtilli', verdura: 'Melanzane, peperoni, pomodori, cetrioli, zucchine, fagiolini, lattuga' },
  { month: 7, label: 'Agosto', frutta: 'Anguria, melone, fichi, uva precoce, pesche, prugne, more, lamponi', verdura: 'Pomodori, melanzane, peperoni, cetrioli, zucchine, fagiolini, rucola, radicchio' },
];

/** Weekday protein rotation hint (0 = Sunday). */
export const ALT_PROT: Record<number, { pranzo: string; cena: string }> = {
  0: { pranzo: 'Pesce / carne bianca', cena: 'Formaggio' },
  1: { pranzo: 'Uova', cena: 'Legumi' },
  2: { pranzo: 'Formaggio (fiocchi di latte / ricotta / philadelphia light)', cena: 'Pesce / carne bianca' },
  3: { pranzo: 'Salmone affumicato / sgombro', cena: 'Uova' },
  4: { pranzo: 'Affettato magro / proteina vegetale', cena: 'Legumi' },
  5: { pranzo: 'Tonno', cena: 'Carne bianca / pesce' },
  6: { pranzo: 'Carne rossa / uova', cena: 'Pasto libero' },
};

/** Balanced meal ideas (from the nutritionist's plan). */
export const MEAL_IDEAS: string[] = [
  'Riso basmati + salmone + asparagi',
  'Patate + uova + agretti (o zucchine)',
  'Bowl con tonno + riso + cetriolo + avocado',
  'Quinoa + pollo + carote + zucchine',
  'Pasta di riso + gamberi + zucchine e limone',
  'Riso + uovo + zucchine',
  'Tofu + patate + peperoni saltati',
  'Bresaola + pane + rucola e pomodorini',
  'Orata al forno + melanzane e zucchine grigliate',
  'Frittata (2 uova) + riso + zucchine e basilico',
  'Pollo + lattuga + carote + pane di segale',
  'Cous cous + salmone + zucchine e carote al vapore',
  'Filetto di manzo + asparagi + patate al forno',
  'Ricotta di capra + broccoli + pane',
  'Grano saraceno + zucchine + uova sode + songino',
  'Branzino + cicoria (o bietoline) + pane integrale',
  'Hummus + insalata di lattuga, cetrioli e carote + pane azzimo',
  'Hamburger + zucchine e melanzane grigliate',
  'Orata panata + zucchine trifolate + wasa integrali',
  'Pasta + ceci + zucchine',
  'Filetti di branzino con olive e capperi + patate e pomodorini al forno',
  'Pasta con zucchine e feta',
  'Polpette di tacchino al limone + verdure miste (zucchine, carote, peperoni) + pane',
  'Lenticchie + zucchine + carote al forno + crostini',
  'Torta salata con zucchine e ricotta + insalata fresca',
];

/** Build the default (V1) plan for a profile. */
/** Bump when the plan's structural content changes so stored plans re-align once. */
export const SEED_VERSION = 7;

export function defaultPlan(profileId: string): Plan {
  return {
    id: crypto.randomUUID(),
    profileId,
    version: 1,
    name: 'Piano Silvia Cavaliere',
    createdAt: new Date().toISOString(),
    active: true,
    seedVersion: SEED_VERSION,
    targetKcal: 2504,
    glucidiAllenamento: withMacros(GLUC_ALL),
    glucidiNonAllenamento: withMacros(GLUC_NON),
    proteine: withMacros(PROTEINE),
    colazioneProt: withMacros(COLAZIONE_OPTS),
    colazioneCarb: withMacros(COLAZIONE_CARBS),
    colazioneDolce: withMacros(COLAZIONE_DOLCE),
    spuntinoPost: withMacros(SP_POST_OPTS),
    spuntinoMattina: withMacros(SP_MATT_OPTS),
    spuntinoPomeriggio: withMacros(SP_POM_OPTS),
    verdura: { ...VERDURA, per100: VERDURA.per100 ?? FOODS[VERDURA.foodId!]?.per100 },
    frequencies: FREQUENCIES,
    seasons: SEASONS,
  };
}

// ---- Meal templates (built from the plan + day type) ----

const COLAZIONE_OPTS: SlotOption[] = [
  { id: 'yogurt', label: 'Yogurt greco 0%', detail: '150g', foodId: 'yogurtGreco', grams: 150 },
  { id: 'ricotta', label: 'Ricotta light', detail: '50g · mezza porzione', foodId: 'ricottaLight', grams: 50 },
  { id: 'uovo', label: 'Uovo strapazzato', detail: '1 uovo', foodId: 'uova', grams: 50 },
  { id: 'albume', label: 'Albume', detail: '140g', foodId: 'albume', grams: 140 },
];
const COLAZIONE_CARBS: SlotOption[] = [
  { id: 'pane', label: 'Pane bianco o integrale', detail: '50g', foodId: 'pane', grams: 50 },
  { id: 'cereali', label: 'Cereali', detail: '40g · All Bran / fiocchi di riso soffiato / avena / muesli', foodId: 'cereali', grams: 40 },
  { id: 'fette', label: 'Fette biscottate', detail: '4–5 fette', foodId: 'fette', grams: 35 },
];
const COLAZIONE_DOLCE: SlotOption[] = [
  { id: 'marmellata', label: 'Marmellata', detail: '20g', foodId: 'marmellata', grams: 20 },
  { id: 'miele', label: 'Miele', detail: '1 cucchiaino (~8g)', foodId: 'miele', grams: 8 },
  { id: 'frutto', label: 'Frutto', detail: 'frutti di bosco, lamponi o mezza banana', foodId: 'fruttoDolce', grams: 80 },
];

// Spuntini composti: per100 = totale stimato sommando i componenti (valori CREA)
// alle grammature indicate nel testo; grams:100 così la stima = il totale.
const SP_POST_OPTS: SlotOption[] = [
  { id: 'o1', label: 'Opzione 1', detail: 'Shaker whey 20g + 1 frutto 200g + pane 40g (o 3–4 gallette) + 1 cucchiaino di miele (o 2 cucchiaini di marmellata)', grams: 100, per100: { kcal: 295, carbs: 49, protein: 20, fat: 2 } },
  { id: 'o2', label: 'Opzione 2', detail: 'Shaker whey 20g + 1 frutto 200g + barretta di cereali (crostatina di marmellata)', grams: 100, per100: { kcal: 264, carbs: 38, protein: 19, fat: 5 } },
];

const SP_MATT_OPTS: SlotOption[] = [
  { id: 'o1', label: 'Opzione 1', detail: 'Shaker whey 20g + 1 frutto 200g', grams: 100, per100: { kcal: 164, carbs: 22, protein: 17, fat: 2 } },
  { id: 'o2', label: 'Opzione 2', detail: 'Budino proteico (es. Milk Pro) / YOEGGS / barretta / merenda proteica', grams: 100, per100: { kcal: 150, carbs: 14, protein: 18, fat: 3 } },
  { id: 'o3', label: 'Opzione 3', detail: '1 frutto + frutta secca 10g / burro di arachidi 100% (1 cucchiaino)', grams: 100, per100: { kcal: 150, carbs: 22, protein: 3, fat: 6 } },
  { id: 'o4', label: 'Opzione 4', detail: 'Yogurt magro 125g + 50g frutta fresca (mirtilli o frutti di bosco)', grams: 100, per100: { kcal: 75, carbs: 12, protein: 5, fat: 1 } },
];

const SP_POM_OPTS: SlotOption[] = [
  { id: 'o1', label: 'Opzione 1', detail: '1 frutto + parmigiano 15g', freq: 'parmigiano', lim: 'max 3 / sett', grams: 100, per100: { kcal: 149, carbs: 20, protein: 6, fat: 5 } },
  { id: 'o2', label: 'Opzione 2', detail: 'Pane 50g + 30g bresaola / fesa / philadelphia', grams: 100, per100: { kcal: 185, carbs: 28, protein: 14, fat: 3 } },
  { id: 'o3', label: 'Opzione 3', detail: 'Budino proteico / YOEGGS / barretta', grams: 100, per100: { kcal: 150, carbs: 14, protein: 18, fat: 3 } },
  { id: 'o4', label: 'Opzione 4', detail: '1 frutto + frutta secca 10g / burro di arachidi 100% (1 cucchiaino)', grams: 100, per100: { kcal: 150, carbs: 22, protein: 3, fat: 6 } },
  { id: 'o5', label: 'Opzione 5', detail: 'Yogurt magro 125g + 50g frutta fresca (mirtilli o frutti di bosco) + 10g frutta secca', grams: 100, per100: { kcal: 135, carbs: 14, protein: 7, fat: 6 } },
];

const VERDURA: SlotOption = { id: 'verdura', label: 'Verdura / ortaggio', detail: 'mezzo piatto piano, cotta o cruda', foodId: 'verdura', grams: 200, per100: { kcal: 25, carbs: 4, protein: 1.5, fat: 0.3 } };

function colazione(plan: Plan): Meal {
  return {
    id: 'colazione', name: 'Colazione', icon: '☕',
    note: "~1h30 prima dell'allenamento", noteOnlyTraining: true,
    waterNote: "1 bicchiere d'acqua non fredda",
    slots: [
      { id: 'prot', kind: 'choice', label: 'Base proteica', options: plan.colazioneProt ?? COLAZIONE_OPTS },
      { id: 'gluc', kind: 'choice', label: 'Fonte glucidica', options: plan.colazioneCarb ?? COLAZIONE_CARBS },
      { id: 'dolce', kind: 'choice', label: 'Marmellata / miele / frutto', options: plan.colazioneDolce ?? COLAZIONE_DOLCE },
    ],
  };
}

function spPost(plan: Plan): Meal {
  return {
    id: 'postworkout', name: 'Spuntino post-workout', icon: '🥤',
    slots: [{ id: 'opt', kind: 'choice', label: "Scegli un'opzione", options: plan.spuntinoPost ?? SP_POST_OPTS }],
  };
}

function spMattina(plan: Plan, id: string, name: string, icon: string): Meal {
  return {
    id, name, icon,
    slots: [{ id: 'opt', kind: 'choice', label: "Scegli un'opzione", options: plan.spuntinoMattina ?? SP_MATT_OPTS }],
  };
}

function spPomTraining(plan: Plan): Meal {
  return {
    id: 'spuntinoPomeriggio', name: 'Spuntino pomeriggio', icon: '🍏',
    slots: [{ id: 'opt', kind: 'choice', label: "Scegli un'opzione", options: plan.spuntinoPomeriggio ?? SP_POM_OPTS }],
  };
}

function verduraSlot(plan: Plan): Slot {
  const v = plan.verdura ?? VERDURA;
  return { id: 'verdura', kind: 'check', label: 'Verdura / ortaggio', detail: VERDURA.detail, grams: v.grams, per100: v.per100, foodId: v.foodId };
}

function mainMeal(id: string, name: string, icon: string, plan: Plan, dayType: DayTypeLite): Meal {
  const gluc = dayType === 'allenamento' ? plan.glucidiAllenamento : plan.glucidiNonAllenamento;
  const olioGrams = dayType === 'allenamento' ? 40 : 30;
  return {
    id, name, icon, hasPiatto: true,
    waterNote: '1 bicchiere prima del pasto e 1 durante',
    slots: [
      { id: 'libero', kind: 'freeToggle', label: 'Pasto libero', detail: 'goditelo senza sensi di colpa · max 1 / sett' },
      verduraSlot(plan),
      { id: 'gluc', kind: 'choice', label: 'Fonte glucidica', options: gluc },
      { id: 'prot', kind: 'choice', label: 'Fonte proteica', options: plan.proteine },
      { id: 'olio', kind: 'check', label: 'Olio EVO', detail: `${olioGrams === 40 ? '4' : '3'} cucchiai (${olioGrams}g)`, grams: olioGrams, foodId: 'olio' },
    ],
  };
}

type DayTypeLite = 'allenamento' | 'nonallenamento' | 'pastolibero';

/** Return the meals for a given day type, using the active plan. */
export function mealsFor(dt: DayTypeLite, plan: Plan, _day?: Partial<DayLog>): Meal[] {
  if (dt === 'allenamento') {
    return [colazione(plan), spPost(plan), mainMeal('pranzo', 'Pranzo', '🍽️', plan, 'allenamento'), spPomTraining(plan), mainMeal('cena', 'Cena', '🌙', plan, 'allenamento')];
  }
  // 'nonallenamento' (and legacy 'pastolibero' days) share the same structure;
  // the free meal is now a toggle inside pranzo/cena rather than a day type.
  return [colazione(plan), spMattina(plan, 'spuntinoMattina', 'Spuntino mattina', '🍎'), mainMeal('pranzo', 'Pranzo', '🍽️', plan, 'nonallenamento'), spMattina(plan, 'spuntinoPomeriggio', 'Spuntino pomeriggio', '🍏'), mainMeal('cena', 'Cena', '🌙', plan, 'nonallenamento')];
}
