<script lang="ts">
  import { untrack } from 'svelte';
  import type { Profile, Sex } from '../types';
  import { updateProfile } from '../db/db';
  import { syncEnabled, verifyPassword } from '../sync/supabase';

  let { profile, onChanged }: { profile: Profile; onChanged: () => void } = $props();

  const ACTIVITIES = [
    { v: 1.2, label: 'Sedentario' },
    { v: 1.375, label: 'Leggero' },
    { v: 1.55, label: 'Moderato' },
    { v: 1.725, label: 'Intenso' },
  ];

  const init = untrack(() => profile);
  let open = $state(false);
  let name = $state(init.name);
  let sex = $state<Sex>(init.sex ?? 'M');
  let birthDate = $state(init.birthDate ?? '');
  let heightCm = $state<number | null>(init.heightM ? Math.round(init.heightM * 100) : null);
  let activity = $state(init.activity ?? 1.375);
  let msg = $state('');

  let pinOpen = $state(false);
  let pinOld = $state('');
  let pinNew = $state('');
  let pinErr = $state('');
  /** Forgot-PIN mode: the account password takes the place of the current PIN. */
  let pinForgot = $state(false);
  let pinPwd = $state('');
  let pinBusy = $state(false);

  async function save() {
    await updateProfile(profile.id, {
      name: name.trim() || profile.name,
      sex,
      birthDate: birthDate || undefined,
      heightM: heightCm ? +(heightCm / 100).toFixed(2) : undefined,
      activity,
    });
    msg = 'Profilo aggiornato';
    setTimeout(() => (msg = ''), 2500);
    onChanged();
  }

  async function savePin() {
    pinErr = '';
    if (!/^\d{4,8}$/.test(pinNew)) { pinErr = 'Il nuovo PIN deve avere 4-8 cifre'; return; }
    if (profile.planPin) {
      if (pinForgot) {
        pinBusy = true;
        const ok = await verifyPassword(pinPwd).catch(() => false);
        pinBusy = false;
        if (!ok) { pinErr = 'Password dell’account non corretta'; return; }
      } else if (pinOld !== profile.planPin) {
        pinErr = 'PIN attuale errato';
        return;
      }
    }
    await updateProfile(profile.id, { planPin: pinNew });
    closePin();
    msg = 'PIN aggiornato';
    setTimeout(() => (msg = ''), 2500);
    onChanged();
  }

  function closePin() {
    pinOpen = false; pinForgot = false;
    pinOld = ''; pinNew = ''; pinPwd = ''; pinErr = '';
  }
</script>

<div class="card">
  <div class="hd clickable" role="button" tabindex="0"
    onclick={() => (open = !open)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open = !open; } }}>
    <span class="ic">👤</span>
    <div class="tt">Il tuo profilo<small>{profile.name}{profile.heightM ? ` · ${Math.round(profile.heightM * 100)} cm` : ''}</small></div>
    <span class="chev" class:open>›</span>
  </div>
  {#if open}
    <div class="bd">
      <div class="measform">
        <label>Nome<input bind:value={name} /></label>
        <label>Data di nascita<input type="date" bind:value={birthDate} /></label>
        <label>Altezza (cm)<input type="number" inputmode="numeric" min="80" max="250" bind:value={heightCm} /></label>
        <label>Sesso
          <select bind:value={sex}><option value="M">Uomo</option><option value="F">Donna</option></select>
        </label>
        <label class="ob2">Attività
          <select bind:value={activity}>
            {#each ACTIVITIES as a}<option value={a.v}>{a.label}</option>{/each}
          </select>
        </label>
      </div>
      <button class="measadd" onclick={save}>Salva profilo</button>

      {#if pinOpen}
        <div class="measform" style="margin-top:10px">
          {#if profile.planPin && !pinForgot}
            <label class="ob2">PIN attuale<input type="password" inputmode="numeric" maxlength="8" bind:value={pinOld} /></label>
          {:else if profile.planPin}
            <label class="ob2">Password dell’account<input type="password" autocomplete="current-password" bind:value={pinPwd} /></label>
          {/if}
          <label class="ob2">Nuovo PIN<input type="password" inputmode="numeric" maxlength="8" bind:value={pinNew} /></label>
        </div>
        {#if profile.planPin && !pinForgot && syncEnabled()}
          <button class="synclink" onclick={() => { pinForgot = true; pinErr = ''; }}>Non ricordi il PIN attuale? Usa la password dell’account</button>
        {/if}
        <div class="syncbtns" style="margin-top:8px">
          <button class="syncmain" onclick={savePin} disabled={pinBusy}>{pinBusy ? '…' : 'Salva PIN'}</button>
          <button class="syncghost" onclick={closePin}>Annulla</button>
        </div>
        {#if pinErr}<div class="syncmsg err">{pinErr}</div>{/if}
      {:else}
        <button class="synclink" onclick={() => (pinOpen = true)}>
          {profile.planPin ? 'Cambia il PIN del piano' : 'Imposta un PIN per proteggere il piano'}
        </button>
      {/if}

      {#if msg}<div class="syncmsg ok">{msg}</div>{/if}
    </div>
  {/if}
</div>
