<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { DayLog, DayType, Plan, Profile } from './lib/types';
  import { db, getActivePlan, loadPlanIndex, resolveProfileId, deleteDayLog } from './lib/db/db';
  import { fmt, parseDate, todayStr, loadDay, saveDay } from './lib/state';
  import { mealsFor } from './lib/data/plan';
  import { syncEnabled, sync, currentEmail, currentUserId, onPasswordRecovery } from './lib/sync/supabase';
  import { downloadBackup, downloadCsv, importBackup } from './lib/backup';
  import { weekDays, logsInRange, tallyFrequencies, planIndexResolver } from './lib/stats';
  import MacroSummary from './lib/components/MacroSummary.svelte';
  import DayProgress from './lib/components/DayProgress.svelte';
  import WaterCard from './lib/components/WaterCard.svelte';
  import MealCard from './lib/components/MealCard.svelte';
  import WeeklyFrequencies from './lib/components/WeeklyFrequencies.svelte';
  import WeekStats from './lib/components/WeekStats.svelte';
  import MonthHistory from './lib/components/MonthHistory.svelte';
  import ShoppingList from './lib/components/ShoppingList.svelte';
  import MeasurementsCard from './lib/components/MeasurementsCard.svelte';
  import SyncPanel from './lib/components/SyncPanel.svelte';
  import PlanEditor from './lib/components/PlanEditor.svelte';
  import AuthGate from './lib/components/AuthGate.svelte';
  import Onboarding from './lib/components/Onboarding.svelte';
  import ProfileCard from './lib/components/ProfileCard.svelte';

  const DOW = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const MON = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const DAY_TYPES: { id: DayType; label: string; ic: string }[] = [
    { id: 'allenamento', label: 'Allenamento', ic: '🏋️' },
    { id: 'nonallenamento', label: 'Riposo', ic: '🛋️' },
  ];

  /** loading → auth (sign in) → setup (first run) → app. */
  let phase = $state<'loading' | 'auth' | 'setup' | 'app'>('loading');
  let recovery = $state(false);
  let account = $state<string | null>(null);
  let uid = $state<string | null>(null);
  let pid = $state('');
  let profile = $state<Profile | null>(null);
  let plan = $state<Plan | null>(null);
  let planIndex = $state<Map<string, Plan>>(new Map());
  let dateStr = $state(todayStr());
  let day = $state<DayLog | null>(null);
  let dataVersion = $state(0);
  let fileInput = $state<HTMLInputElement>();

  const profileName = $derived(profile?.name ?? '');

  // UI preferences (persisted): compact view, dark theme, bold text.
  let dense = $state(localStorage.getItem('nd_dense') === '1');
  let dark = $state(localStorage.getItem('nd_dark') === '1');
  let bold = $state(localStorage.getItem('nd_bold') === '1');
  $effect(() => {
    const b = document.body;
    b.classList.toggle('dense', dense);
    b.classList.toggle('dark', dark);
    b.classList.toggle('bold', bold);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1613' : '#2e7d4f');
    localStorage.setItem('nd_dense', dense ? '1' : '0');
    localStorage.setItem('nd_dark', dark ? '1' : '0');
    localStorage.setItem('nd_bold', bold ? '1' : '0');
  });

  // A logged day keeps the plan version it was recorded with, so its macros and
  // options stay faithful even after the plan changes.
  const dayPlan = $derived(day && plan ? (planIndex.get(day.planId) ?? plan) : plan);
  const meals = $derived(day && dayPlan ? mealsFor(day.dayType, dayPlan, day) : []);
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
    const planFor = planIndexResolver(planIndex, p);
    logsInRange(pid, wk[0], wk[6]).then((logs) => {
      freqCounts = tallyFrequencies(logs, p, planFor);
    });
  });

  function labelFor(s: string) {
    const d = parseDate(s);
    return { d1: DOW[d.getDay()], d2: `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` };
  }

  async function reloadPlan() {
    plan = await getActivePlan(pid);
    planIndex = await loadPlanIndex(pid);
  }

  async function reloadDay() {
    if (!plan) return;
    day = await loadDay(pid, dateStr, plan);
  }

  async function onPlanChanged() {
    await reloadPlan();
    await reloadDay();
    dataVersion++;
  }

  async function onProfileChanged() {
    profile = (await db.profiles.get(pid)) ?? profile;
    dataVersion++;
    scheduleAutoSync();
  }

  // After a cloud sync, converge on the profile that now holds the data.
  async function onSynced() {
    const best = await resolveProfileId(uid);
    if (best && best !== pid) pid = best;
    profile = (await db.profiles.get(pid)) ?? profile;
    await reloadPlan();
    await reloadDay();
    dataVersion++;
  }

  // Debounced automatic cloud sync after local changes (no-op if not signed in).
  let autoSyncTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleAutoSync() {
    if (!syncEnabled()) return;
    clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(async () => {
      try {
        const r = await sync();
        if (r && r.pulled > 0) await onSynced(); // refresh only when remote brought changes
      } catch { /* offline or transient: will retry on next change/open */ }
    }, 1500);
  }

  async function save() {
    if (day) await saveDay(day);
    dataVersion++;
    scheduleAutoSync();
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
    await deleteDayLog(day.id);
    await reloadDay();
    dataVersion++;
    scheduleAutoSync();
  }

  async function onImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const res = await importBackup(await file.text(), pid);
      await reloadPlan();
      await reloadDay();
      dataVersion++;
      alert(`Ripristino completato: ${res.dayLogs} giornate, ${res.plans} piani.`);
    } catch (err) {
      alert('Import non riuscito: ' + (err instanceof Error ? err.message : 'file non valido'));
    } finally {
      input.value = '';
    }
  }

  function currentMealId(hour: number, availableMeals: { id: string }[]): string {
    const preferredId = hour >= 19 || hour < 5
      ? 'cena'
      : hour >= 16
        ? 'spuntinoPomeriggio'
        : hour >= 12
          ? 'pranzo'
          : hour >= 10
            ? (availableMeals.some((meal) => meal.id === 'spuntinoMattina') ? 'spuntinoMattina' : 'postworkout')
            : 'colazione';
    return availableMeals.some((meal) => meal.id === preferredId) ? preferredId : availableMeals[0]?.id;
  }

  async function scrollToCurrentMeal() {
    if (!isToday) return;
    await tick();
    const mealId = currentMealId(new Date().getHours(), meals);
    if (!mealId) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    requestAnimationFrame(() => document.getElementById(`meal-${mealId}`)?.scrollIntoView({ behavior, block: 'start' }));
  }

  // Horizontal swipe on the content area moves to the previous/next day.
  let touchX = 0;
  let touchY = 0;
  function onTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    touchX = t.clientX;
    touchY = t.clientY;
  }
  function onTouchEnd(e: TouchEvent) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) shiftDay(dx < 0 ? 1 : -1);
  }

  /** Give a slow/absent network a bounded chance instead of blocking the first run. */
  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
  }

  /** Open the diary for the signed-in account, or send it to the first-run setup. */
  async function boot() {
    phase = 'loading';
    uid = await currentUserId();
    pid = await resolveProfileId(uid);
    if (!pid && uid) {
      // Nothing local for this account yet: it may live in the cloud (other device).
      try { await withTimeout(sync(), 12000); } catch { /* offline: fall through to setup */ }
      pid = await resolveProfileId(uid);
    }
    if (!pid) { phase = 'setup'; return; }
    profile = (await db.profiles.get(pid)) ?? null;
    await reloadPlan();
    await reloadDay();
    phase = 'app';
    await scrollToCurrentMeal();
  }

  async function onSignedIn() {
    account = await currentEmail();
    recovery = false;
    await boot();
  }

  function onSignedOut() {
    account = null;
    uid = null;
    pid = '';
    profile = null;
    plan = null;
    day = null;
    phase = 'auth';
  }

  async function onSetupDone(newPid: string) {
    pid = newPid;
    profile = (await db.profiles.get(newPid)) ?? null;
    await reloadPlan();
    await reloadDay();
    phase = 'app';
    scheduleAutoSync();
  }

  onMount(async () => {
    if (!syncEnabled()) {
      // Local-only build (no Supabase keys): keep working without an account.
      await boot();
      if (!pid) phase = 'setup';
    } else {
      onPasswordRecovery(() => { recovery = true; phase = 'auth'; });
      account = await currentEmail();
      if (!account) phase = 'auth';
      else await boot();
    }
    // Auto-sync when returning to the app (foreground / tab focus).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleAutoSync(); });
    window.addEventListener('focus', scheduleAutoSync);
  });
</script>

{#if phase === 'auth'}
  <AuthGate {recovery} onDone={onSignedIn} />
{:else if phase === 'setup'}
  <Onboarding ownerUserId={uid} email={account} onDone={onSetupDone} />
{:else if phase === 'loading'}
  <div class="gate"><div class="gatecard"><div class="gatelogo">🥗</div><p class="gatesub">Caricamento…</p></div></div>
{:else}
<header class="top">
  <div class="wrap">
    <div class="brand">
      <span class="logo">🥗</span>
      <div>
        NutriDash <span class="ver">V5</span>
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

<div class="wrap" role="group" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
  {#if day && plan && dayPlan}
    <MacroSummary {day} plan={dayPlan} />
    <DayProgress {day} plan={dayPlan} />
    <WaterCard bind:day {save} />
    {#each meals as meal, i (meal.id)}
      {#if i > 0}<div class="mealsep"><span>+</span></div>{/if}
      <MealCard {meal} bind:day dayType={day.dayType} {plan} {freqCounts} {dense} {save} />
    {/each}
    <button class="reset" onclick={resetDay}>↺ Azzera questa giornata</button>

    <WeeklyFrequencies profileId={pid} {dateStr} {plan} {planIndex} {dataVersion} />
    <WeekStats profileId={pid} {dateStr} {plan} {planIndex} {dataVersion} />
    <ShoppingList profileId={pid} {dateStr} {plan} {planIndex} {dataVersion} />
    <MonthHistory profileId={pid} {dateStr} {plan} {planIndex} {dataVersion} onPick={(d) => { dateStr = d; reloadDay(); }} />
    <MeasurementsCard profileId={pid} {dataVersion} onChanged={scheduleAutoSync} />
    {#if profile}<ProfileCard {profile} onChanged={onProfileChanged} />{/if}
    <SyncPanel {onSynced} {onSignedOut} />

    <PlanEditor profileId={pid} {plan} pin={profile?.planPin} onChanged={onPlanChanged} />

    <div class="toolbar">
      <button class="tbtn" onclick={() => downloadBackup(pid)}><span class="ic">⬇️</span> Esporta backup</button>
      <button class="tbtn" onclick={() => fileInput?.click()}><span class="ic">⬆️</span> Importa backup</button>
      <button class="tbtn" onclick={() => plan && downloadCsv(pid, plan)}><span class="ic">🧾</span> Esporta CSV</button>
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
{/if}