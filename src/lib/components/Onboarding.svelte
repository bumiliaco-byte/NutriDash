<script lang="ts">
  import { untrack } from 'svelte';
  import type { Sex } from '../types';
  import { createProfile, db, setActiveProfileId } from '../db/db';
  import { todayStr } from '../state';

  let { ownerUserId, email, onDone }: {
    ownerUserId: string | null;
    email: string | null;
    onDone: (profileId: string) => void;
  } = $props();

  const ACTIVITIES = [
    { v: 1.2, label: 'Sedentario', hint: 'ufficio, poco movimento' },
    { v: 1.375, label: 'Leggermente attivo', hint: '1-3 allenamenti / sett.' },
    { v: 1.55, label: 'Moderatamente attivo', hint: '3-5 allenamenti / sett.' },
    { v: 1.725, label: 'Molto attivo', hint: '6-7 allenamenti / sett.' },
  ];

  let name = $state(untrack(() => (email ? email.split('@')[0].replace(/[._-]+/g, ' ') : '')));
  let sex = $state<Sex>('M');
  let birthDate = $state('');
  let heightCm = $state<number | null>(null);
  let weightKg = $state<number | null>(null);
  let activity = $state(1.375);
  let kcal = $state<number | null>(null);
  let pin = $state('');
  let kcalTouched = $state(false);
  let busy = $state(false);
  let err = $state('');

  const age = $derived(ageFrom(birthDate));
  const bmr = $derived(
    heightCm && weightKg && age
      ? Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'M' ? 5 : -161))
      : null,
  );
  const tdee = $derived(bmr ? Math.round((bmr * activity) / 10) * 10 : null);
  const bmi = $derived(heightCm && weightKg ? +(weightKg / (heightCm / 100) ** 2).toFixed(1) : null);
  const complete = $derived(!!name.trim() && !!heightCm && !!weightKg && !!age && /^\d{4,8}$/.test(pin));

  // Keep the suggestion in sync until the user types their own target.
  $effect(() => {
    const suggested = tdee;
    if (!kcalTouched && suggested) kcal = suggested;
  });

  function ageFrom(iso: string): number | null {
    if (!iso) return null;
    const b = new Date(iso);
    if (Number.isNaN(b.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a > 0 && a < 120 ? a : null;
  }

  async function start() {
    if (!complete || busy) return;
    busy = true; err = '';
    try {
      const profile = await createProfile({
        name,
        sex,
        birthDate: birthDate || undefined,
        heightM: +(heightCm! / 100).toFixed(2),
        activity,
        planPin: pin,
        ownerUserId,
        targetKcal: kcal ?? tdee ?? undefined,
      });
      await db.measurements.put({
        id: `${profile.id}:${todayStr()}`,
        profileId: profile.id,
        date: todayStr(),
        weightKg: weightKg!,
        bmi: bmi ?? undefined,
        bmr: bmr ?? undefined,
        tdee: tdee ?? undefined,
        updatedAt: new Date().toISOString(),
      });
      setActiveProfileId(profile.id);
      onDone(profile.id);
    } catch (e) {
      err = e instanceof Error ? e.message : 'Errore durante la creazione del profilo';
      busy = false;
    }
  }
</script>

<div class="gate">
  <div class="gatecard wide">
    <div class="gatelogo">👋</div>
    <h1>Benvenuto</h1>
    <p class="gatesub">Due minuti per impostare il tuo piano. Potrai cambiare tutto in seguito.</p>

    <div class="obform">
      <label class="ob2">Come ti chiami<input class="syncinput" bind:value={name} placeholder="Nome" /></label>

      <div class="obfield ob2">
        <span>Sesso</span>
        <div class="obseg">
          <button class:on={sex === 'M'} onclick={() => (sex = 'M')}>Uomo</button>
          <button class:on={sex === 'F'} onclick={() => (sex = 'F')}>Donna</button>
        </div>
      </div>

      <label>Data di nascita<input class="syncinput" type="date" bind:value={birthDate} /></label>
      <label>Altezza (cm)<input class="syncinput" type="number" inputmode="numeric" min="80" max="250" bind:value={heightCm} placeholder="175" /></label>
      <label>Peso attuale (kg)<input class="syncinput" type="number" inputmode="decimal" step="0.1" min="25" max="300" bind:value={weightKg} placeholder="72.5" /></label>
      <label>PIN per modificare il piano<input class="syncinput" type="password" inputmode="numeric" maxlength="8" bind:value={pin} placeholder="4-8 cifre" /></label>

      <div class="obfield ob2">
        <span>Quanto ti muovi</span>
        <div class="obacts">
          {#each ACTIVITIES as a}
            <button class="obact" class:on={activity === a.v} onclick={() => (activity = a.v)}>
              <b>{a.label}</b><small>{a.hint}</small>
            </button>
          {/each}
        </div>
      </div>

      {#if bmr && tdee}
        <div class="obcalc ob2">
          Metabolismo basale stimato <b>{bmr} kcal</b> · fabbisogno giornaliero <b>{tdee} kcal</b>
          {#if bmi}· BMI <b>{bmi}</b>{/if}
        </div>
      {/if}

      <label class="ob2">Obiettivo calorico giornaliero
        <input class="syncinput" type="number" inputmode="numeric" step="10" min="1000" max="5000"
          bind:value={kcal} oninput={() => (kcalTouched = true)} placeholder="es. 2200" />
      </label>
    </div>

    <button class="syncmain" onclick={start} disabled={!complete || busy}>{busy ? '…' : 'Crea il mio piano'}</button>
    {#if err}<div class="syncmsg err">{err}</div>{/if}

    <div class="gatefoot">
      Il piano parte da una struttura standard (colazione, spuntini, pranzo, cena) con le porzioni
      riproporzionate al tuo obiettivo. Sono stime: adatta le quantità a quelle del tuo nutrizionista
      dalla sezione <b>Piano nutrizionale</b>.
    </div>
  </div>
</div>
