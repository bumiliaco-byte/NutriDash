<script lang="ts">
  import { onMount } from 'svelte';
  import type { DayLog, DayType, Plan } from './lib/types';
  import { ensureBootstrap, getActivePlan, db } from './lib/db/db';
  import { fmt, parseDate, todayStr, loadDay, saveDay } from './lib/state';
  import { mealsFor } from './lib/data/plan';
  import { syncEnabled, sync } from './lib/sync/supabase';
  import { downloadBackup, importBackup } from './lib/backup';
  import { weekDays, logsInRange, tallyFrequencies } from './lib/stats';
  import MacroSummary from './lib/components/MacroSummary.svelte';
  import DayProgress from './lib/components/DayProgress.svelte';
  import WaterCard from './lib/components/WaterCard.svelte';
  import MealCard from './lib/components/MealCard.svelte';
  import WeeklyFrequencies from './lib/components/WeeklyFrequencies.svelte';
  import WeekStats from './lib/components/WeekStats.svelte';
  import MonthHistory from './lib/components/MonthHistory.svelte';
  import ShoppingList from './lib/components/ShoppingList.svelte';
  import PlanEditor from './lib/components/PlanEditor.svelte';

  const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const MON = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const DAY_TYPES: { id: DayType; label: string; ic: string }[] = [
    { id: 'allenamento', label: 'Allenamento', ic: '🏋️' },
    { id: 'nonallenamento', label: 'Riposo', ic: '🛋️' },
    { id: 'pastolibero', label: 'Pasto libero', ic: '🎉' },
  ];

  let ready = $state(false);
  let pid = $state('');
  let plan = $state<Plan | null>(null);
  let dateStr = $state(todayStr());
  let day = $state<DayLog | null>(null);
  let profileName = $state('');
  let dataVersion = $state(0);
  let fileInput = $state<HTMLInputElement>();

  // UI preferences (persisted): compact view, dark theme, bold text.
  let dense = $state(localStorage.getItem('nd_dense') === '1');
  let dark = $state(localStorage.getItem('nd_dark') === '1');
  let bold = $state(localStorage.getItem('nd_bold') === '1');
  $effect(() => {
    const b = document.body;
    b.classList.toggle('dense', dense);
    b.classList.toggle('dark', dark);
    b.classList.toggle('bold', bold);
    localStorage.setItem('nd_dense', dense ? '1' : '0');
    localStorage.setItem('nd_dark', dark ? '1' : '0');
    localStorage.setItem('nd_bold', bold ? '1' : '0');
  });

  const meals = $derived(day && plan ? mealsFor(day.dayType, plan, day) : []);
  const dateLabel = $derived(labelFor(dateStr));
  const isToday = $derived(dateStr === todayStr());

  // Weekly frequency tallies (Mon–Sun of the shown date), refreshed on every save.
  let freqCounts = $state<Record<string, number>>({});
  $effect(() => {
    void dataVersion; // re-run after each save
    const ds = dateStr;
    const p = plan;
    if (!p || !pid) return;
    const wk = weekDays(ds);
    logsInRange(pid, wk[0], wk[6]).then((logs) => {
      freqCounts = tallyFrequencies(logs, p);
    });
  });

  function labelFor(s: string) {
    const d = parseDate(s);
    return { d1: DOW[d.getDay()], d2: `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` };
  }

  async function reloadDay() {
    if (!plan) return;
    day = await loadDay(pid, dateStr, plan);
  }

  async function onPlanChanged() {
    plan = await getActivePlan(pid);
    await reloadDay();
    dataVersion++;
  }

  async function save() {
    if (day) await saveDay(day);
    dataVersion++;
  }

  function shiftDay(delta: number) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + delta);
    dateStr = fmt(d);
    reloadDay();
  }

  async function setDayType(t: DayType) {
    if (!day) return;
    day.dayType = t;
    await save();
  }

  async function resetDay() {
    if (!day) return;
    if (!confirm('Azzerare questa giornata?')) return;
    await db.dayLogs.delete(day.id);
    await reloadDay();
    dataVersion++;
  }

  async function onImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const res = await importBackup(await file.text());
      await reloadDay();
      dataVersion++;
      alert(`Ripristino completato: ${res.dayLogs} giornate, ${res.plans} piani.`);
    } catch (err) {
      alert('Import non riuscito: ' + (err instanceof Error ? err.message : 'file non valido'));
    } finally {
      input.value = '';
    }
  }

  onMount(async () => {
    pid = await ensureBootstrap();
    plan = await getActivePlan(pid);
    const p = await db.profiles.get(pid);
    profileName = p?.name ?? '';
    await reloadDay();
    ready = true;
    if (syncEnabled()) sync().catch(() => {});
  });
</script>

<header class="top">
  <div class="wrap">
    <div class="brand">
      <span class="logo">🥗</span>
      <div>
        NutriDash <span class="ver">V4</span>
        <small>Piano di {profileName}</small>
      </div>
      <div class="grow"></div>
      <div class="prefs">
        <button class="pf" onclick={() => (dense = !dense)} title="Vista estesa / compatta">
          {dense ? 'Estesa' : 'Compatta'}
        </button>
        <button class="pf" onclick={() => (dark = !dark)} title="Tema chiaro / scuro">
          {dark ? '☀️ Chiaro' : '🌙 Scuro'}
        </button>
        <button class="pf" onclick={() => (bold = !bold)} title="Testo normale / grassetto">
          {bold ? 'Normale' : 'Grassetto'}
        </button>
      </div>
    </div>

    <div class="datebar">
      <button class="nav" onclick={() => shiftDay(-1)} aria-label="Giorno precedente">‹</button>
      <div class="today">
        <div class="d1">{dateLabel.d1}</div>
        <div class="d2">{dateLabel.d2}</div>
      </div>
      {#if !isToday}
        <button class="btn-oggi" onclick={() => { dateStr = todayStr(); reloadDay(); }}>Oggi</button>
      {/if}
      <button class="nav" onclick={() => shiftDay(1)} aria-label="Giorno successivo">›</button>
    </div>

    {#if day}
      <div class="daytypes">
        {#each DAY_TYPES as t}
          <button class="dt" class:active={day.dayType === t.id} onclick={() => setDayType(t.id)}>
            <span class="ic">{t.ic}</span>{t.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</header>

<div class="wrap">
  {#if ready && day && plan}
    <MacroSummary {day} {plan} />
    <DayProgress {day} {plan} />
    <WaterCard bind:day {save} />
    {#each meals as meal, i (meal.id)}
      {#if i > 0}<div class="mealsep"><span>+</span></div>{/if}
      <MealCard {meal} bind:day dayType={day.dayType} {plan} {freqCounts} {dense} {save} />
    {/each}
    <button class="reset" onclick={resetDay}>↺ Azzera questa giornata</button>

    <WeeklyFrequencies profileId={pid} {dateStr} {plan} {dataVersion} />
    <WeekStats profileId={pid} {dateStr} {plan} {dataVersion} />
    <ShoppingList profileId={pid} {dateStr} {plan} {dataVersion} />
    <MonthHistory profileId={pid} {dateStr} {plan} {dataVersion} onPick={(d) => { dateStr = d; reloadDay(); }} />

    <PlanEditor profileId={pid} {plan} onChanged={onPlanChanged} />

    <div class="toolbar">
      <button class="tbtn" onclick={() => downloadBackup()}><span class="ic">⬇️</span> Esporta backup</button>
      <button class="tbtn" onclick={() => fileInput?.click()}><span class="ic">⬆️</span> Importa backup</button>
    </div>
    <input type="file" accept="application/json" bind:this={fileInput} onchange={onImport} style="display:none" />

    <div class="foot">
      NutriDash · dati salvati sul dispositivo{syncEnabled() ? ' + sync cloud' : ''}.<br />
      Le kcal sono stime indicative dal piano.
    </div>
  {:else}
    <div class="foot" style="margin-top:40px">Caricamento…</div>
  {/if}
</div>
