<script lang="ts">
  import type { Plan, SlotOption } from '../types';
  import { savePlan, createPlanVersion, activatePlan, listPlans } from '../db/db';
  import { ALT_PROT, MEAL_IDEAS } from '../data/plan';

  let { profileId, plan, onChanged }: {
    profileId: string;
    plan: Plan;
    onChanged: () => void;
  } = $props();

  // Weekly protein rotation shown Monday→Sunday.
  const WD = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const altDays = [1, 2, 3, 4, 5, 6, 0].map((k, i) => ({ label: WD[i], pranzo: ALT_PROT[k].pranzo, cena: ALT_PROT[k].cena }));

  let locked = $state(true);
  let draft = $state<Plan | null>(null);
  let versions = $state<Plan[]>([]);
  let busy = $state(false);

  // Unlock is protected by a PIN to avoid accidental edits.
  const PIN = '230977';
  let pinAsk = $state(false);
  let pinTry = $state('');
  let pinErr = $state(false);
  function askPin() { pinAsk = true; pinTry = ''; pinErr = false; }
  function submitPin() {
    if (pinTry === PIN) { pinAsk = false; pinTry = ''; pinErr = false; startEdit(); }
    else { pinErr = true; }
  }

  function loadVersions() {
    listPlans(profileId).then(v => versions = v);
  }
  loadVersions();

  function ensureMacros(opt: SlotOption): SlotOption {
    return {
      ...opt,
      per100: opt.per100 ?? { kcal: 0, carbs: 0, protein: 0, fat: 0 },
    };
  }

  function startEdit() {
    const clone: Plan = JSON.parse(JSON.stringify(plan));
    clone.proteine = clone.proteine.map(ensureMacros);
    clone.glucidiAllenamento = clone.glucidiAllenamento.map(ensureMacros);
    clone.glucidiNonAllenamento = clone.glucidiNonAllenamento.map(ensureMacros);
    clone.colazioneProt = (clone.colazioneProt ?? []).map(ensureMacros);
    clone.colazioneCarb = (clone.colazioneCarb ?? []).map(ensureMacros);
    clone.spuntinoPost = (clone.spuntinoPost ?? []).map(ensureMacros);
    clone.spuntinoMattina = (clone.spuntinoMattina ?? []).map(ensureMacros);
    clone.spuntinoPomeriggio = (clone.spuntinoPomeriggio ?? []).map(ensureMacros);
    clone.verdura = ensureMacros(clone.verdura ?? { id: 'verdura', label: 'Verdura / ortaggio', grams: 200 });
    draft = clone;
    locked = false;
  }

  function cancelEdit() {
    draft = null;
    locked = true;
  }

  async function saveInPlace() {
    if (!draft) return;
    busy = true;
    await savePlan(draft);
    busy = false;
    draft = null;
    locked = true;
    loadVersions();
    onChanged();
  }

  async function saveAsNewVersion() {
    if (!draft) return;
    busy = true;
    await savePlan(draft);
    await createPlanVersion(draft);
    busy = false;
    draft = null;
    locked = true;
    loadVersions();
    onChanged();
  }

  async function useVersion(id: string) {
    if (id === plan.id) return;
    busy = true;
    await activatePlan(profileId, id);
    busy = false;
    loadVersions();
    onChanged();
  }

  function addOption(list: SlotOption[]) {
    list.push({
      id: crypto.randomUUID().slice(0, 8),
      label: 'Nuovo alimento',
      grams: 100,
      per100: { kcal: 0, carbs: 0, protein: 0, fat: 0 },
    });
  }

  function removeOption(list: SlotOption[], idx: number) {
    list.splice(idx, 1);
  }

  function optKcal(opt: SlotOption): number {
    if (!opt.per100 || !opt.grams) return 0;
    return Math.round(opt.per100.kcal * opt.grams / 100);
  }
</script>

{#snippet optSection(title: string, list: SlotOption[], addLabel: string)}
  <h4 class="sec">{title}</h4>
  {#each list as opt, i (opt.id)}
    <div class="pe-opt">
      <div class="optrow">
        <input class="lbl" bind:value={opt.label} placeholder="Nome" />
        <button class="del" onclick={() => removeOption(list, i)} aria-label="Rimuovi">✕</button>
      </div>
      <input class="det" bind:value={opt.detail} placeholder="Dettaglio (opzionale)" />
      <div class="macros">
        <label>g porz.<input type="number" bind:value={opt.grams} /></label>
        <label>kcal/100g<input type="number" bind:value={opt.per100!.kcal} /></label>
        <label>Carb<input type="number" bind:value={opt.per100!.carbs} /></label>
        <label>Prot<input type="number" bind:value={opt.per100!.protein} /></label>
        <label>Gras<input type="number" bind:value={opt.per100!.fat} /></label>
      </div>
      <div class="optkcal">≈ {optKcal(opt)} kcal a porzione</div>
    </div>
  {/each}
  <button class="btn ghost" onclick={() => addOption(list)}>{addLabel}</button>
{/snippet}

<div class="card">
  <div class="hd">
    <span class="ic">{locked ? '🔒' : '🔓'}</span>
    <div class="tt">
      Piano alimentare
      <small>v{plan.version} · {plan.name}</small>
    </div>
  </div>
  <div class="bd">
    <details class="pe-drop">
      <summary>🔄 Alternanza delle proteine nella settimana</summary>
      <div class="alt-table">
        {#each altDays as d (d.label)}
          <div class="alt-row">
            <span class="alt-day">{d.label}</span>
            <span class="alt-cell"><b>Pranzo</b> {d.pranzo}</span>
            <span class="alt-cell"><b>Cena</b> {d.cena}</span>
          </div>
        {/each}
      </div>
    </details>

    <details class="pe-drop">
      <summary>🍽️ Idee di pasto bilanciato</summary>
      <ol class="ideas">
        {#each MEAL_IDEAS as idea}
          <li>{idea}</li>
        {/each}
      </ol>
    </details>

    {#if locked}
      <p class="lockmsg">Il piano è bloccato per evitare modifiche accidentali.</p>
      {#if pinAsk}
        <div class="pinrow">
          <input
            class="pin"
            type="password"
            inputmode="numeric"
            maxlength="6"
            placeholder="PIN"
            bind:value={pinTry}
            onkeydown={(e) => { if (e.key === 'Enter') submitPin(); }}
          />
          <button class="btn primary" onclick={submitPin}>Sblocca</button>
          <button class="btn" onclick={() => { pinAsk = false; pinErr = false; }}>Annulla</button>
        </div>
        {#if pinErr}<p class="pinerr">PIN errato, riprova.</p>{/if}
      {:else}
        <button class="btn primary" onclick={askPin}>🔓 Sblocca per modificare</button>
      {/if}

      {#if versions.length > 1}
        <div class="verpick">
          <label for="ver">Versione attiva</label>
          <select id="ver" value={plan.id} onchange={(e) => useVersion(e.currentTarget.value)} disabled={busy}>
            {#each versions as v (v.id)}
              <option value={v.id}>v{v.version} · {v.name}</option>
            {/each}
          </select>
        </div>
      {/if}
    {:else if draft}
      <div class="field">
        <label for="tk">Obiettivo kcal / giorno</label>
        <input id="tk" type="number" bind:value={draft.targetKcal} />
      </div>

      <h4 class="sec">Fonte proteica (pranzo / cena)</h4>
      {#each draft.proteine as opt, i (opt.id)}
        <div class="pe-opt">
          <div class="optrow">
            <input class="lbl" bind:value={opt.label} placeholder="Nome" />
            <button class="del" onclick={() => removeOption(draft!.proteine, i)} aria-label="Rimuovi">✕</button>
          </div>
          <input class="det" bind:value={opt.detail} placeholder="Dettaglio (opzionale)" />
          <div class="macros">
            <label>g porz.<input type="number" bind:value={opt.grams} /></label>
            <label>kcal/100g<input type="number" bind:value={opt.per100!.kcal} /></label>
            <label>Carb<input type="number" bind:value={opt.per100!.carbs} /></label>
            <label>Prot<input type="number" bind:value={opt.per100!.protein} /></label>
            <label>Gras<input type="number" bind:value={opt.per100!.fat} /></label>
          </div>
          <div class="optkcal">≈ {optKcal(opt)} kcal a porzione</div>
        </div>
      {/each}
      <button class="btn ghost" onclick={() => addOption(draft!.proteine)}>+ Aggiungi proteina</button>

      <h4 class="sec">Glucidi · giorni allenamento</h4>
      {#each draft.glucidiAllenamento as opt, i (opt.id)}
        <div class="pe-opt">
          <div class="optrow">
            <input class="lbl" bind:value={opt.label} placeholder="Nome" />
            <button class="del" onclick={() => removeOption(draft!.glucidiAllenamento, i)} aria-label="Rimuovi">✕</button>
          </div>
          <div class="macros">
            <label>g porz.<input type="number" bind:value={opt.grams} /></label>
            <label>kcal/100g<input type="number" bind:value={opt.per100!.kcal} /></label>
            <label>Carb<input type="number" bind:value={opt.per100!.carbs} /></label>
            <label>Prot<input type="number" bind:value={opt.per100!.protein} /></label>
            <label>Gras<input type="number" bind:value={opt.per100!.fat} /></label>
          </div>
          <div class="optkcal">≈ {optKcal(opt)} kcal a porzione</div>
        </div>
      {/each}
      <button class="btn ghost" onclick={() => addOption(draft!.glucidiAllenamento)}>+ Aggiungi glucide</button>

      <h4 class="sec">Glucidi · giorni riposo</h4>
      {#each draft.glucidiNonAllenamento as opt, i (opt.id)}
        <div class="pe-opt">
          <div class="optrow">
            <input class="lbl" bind:value={opt.label} placeholder="Nome" />
            <button class="del" onclick={() => removeOption(draft!.glucidiNonAllenamento, i)} aria-label="Rimuovi">✕</button>
          </div>
          <div class="macros">
            <label>g porz.<input type="number" bind:value={opt.grams} /></label>
            <label>kcal/100g<input type="number" bind:value={opt.per100!.kcal} /></label>
            <label>Carb<input type="number" bind:value={opt.per100!.carbs} /></label>
            <label>Prot<input type="number" bind:value={opt.per100!.protein} /></label>
            <label>Gras<input type="number" bind:value={opt.per100!.fat} /></label>
          </div>
          <div class="optkcal">≈ {optKcal(opt)} kcal a porzione</div>
        </div>
      {/each}
      <button class="btn ghost" onclick={() => addOption(draft!.glucidiNonAllenamento)}>+ Aggiungi glucide</button>

      {@render optSection('Colazione · base proteica', draft.colazioneProt!, '+ Aggiungi opzione')}
      {@render optSection('Colazione · fonte glucidica', draft.colazioneCarb!, '+ Aggiungi opzione')}
      {@render optSection('Spuntino post-workout', draft.spuntinoPost!, '+ Aggiungi opzione')}
      {@render optSection('Spuntino mattina (e pomeriggio riposo)', draft.spuntinoMattina!, '+ Aggiungi opzione')}
      {@render optSection('Spuntino pomeriggio (allenamento)', draft.spuntinoPomeriggio!, '+ Aggiungi opzione')}

      <h4 class="sec">Verdura / ortaggio</h4>
      <div class="pe-opt">
        <div class="macros">
          <label>g porz.<input type="number" bind:value={draft.verdura!.grams} /></label>
          <label>kcal/100g<input type="number" bind:value={draft.verdura!.per100!.kcal} /></label>
          <label>Carb<input type="number" bind:value={draft.verdura!.per100!.carbs} /></label>
          <label>Prot<input type="number" bind:value={draft.verdura!.per100!.protein} /></label>
          <label>Gras<input type="number" bind:value={draft.verdura!.per100!.fat} /></label>
        </div>
        <div class="optkcal">≈ {optKcal(draft.verdura!)} kcal a porzione</div>
      </div>

      <h4 class="sec">Frequenze settimanali</h4>
      {#each draft.frequencies as f (f.key)}
        <div class="pe-freq">
          <input class="lbl" bind:value={f.label} />
          <label>max/sett<input type="number" min="0" placeholder="—" bind:value={f.max} /></label>
        </div>
      {/each}

      <div class="actions">
        <button class="btn" onclick={cancelEdit} disabled={busy}>Annulla</button>
        <button class="btn primary" onclick={saveInPlace} disabled={busy}>Salva</button>
        <button class="btn accent" onclick={saveAsNewVersion} disabled={busy}>Salva come nuova versione</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .lockmsg { color: var(--muted, #6b7d70); font-size: 14px; margin: 0 0 12px; }
  .pe-drop { border: 1px solid var(--line, #e2e8e3); border-radius: 10px; margin-bottom: 10px; background: var(--soft, #f2f7f3); overflow: hidden; }
  .pe-drop > summary { cursor: pointer; padding: 12px 14px; font-weight: 700; font-size: 14px; color: var(--ink, #16281c); list-style: none; user-select: none; }
  .pe-drop > summary::-webkit-details-marker { display: none; }
  .pe-drop > summary::after { content: '▸'; float: right; color: var(--muted, #6b7d70); transition: transform .18s ease; }
  .pe-drop[open] > summary::after { transform: rotate(90deg); }
  .alt-table { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .alt-row { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: var(--card, #fff); border-radius: 8px; }
  .alt-day { font-weight: 800; font-size: 13px; color: var(--green-d, #1f5b39); }
  .alt-cell { font-size: 13px; color: var(--ink, #20302a); }
  .alt-cell b { font-weight: 700; color: var(--muted, #6b7d70); margin-right: 4px; }
  .ideas { margin: 0; padding: 0 14px 12px 32px; display: flex; flex-direction: column; gap: 6px; }
  .ideas li { font-size: 13px; color: var(--ink, #20302a); line-height: 1.4; }
  .pinrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pin {
    width: 120px; padding: 10px 12px; border: 1.5px solid var(--line, #dce5df);
    border-radius: 8px; font-size: 18px; font-weight: 700; letter-spacing: 3px;
    text-align: center; color: var(--ink, #16281c); background: var(--card, #fff);
  }
  .pin:focus { outline: none; border-color: var(--green, #2e7d4f); }
  .pinerr { color: #c0392b; font-size: 13px; margin: 8px 0 0; font-weight: 600; }
  .btn {
    padding: 10px 14px;
    border: 1px solid var(--line, #dce5df);
    background: var(--card, #fff);
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    color: var(--ink, #16281c);
  }
  .btn.primary { background: var(--green, #2e7d4f); border-color: var(--green, #2e7d4f); color: #fff; font-weight: 600; }
  .btn.accent { background: #e9821e; border-color: #e9821e; color: #fff; font-weight: 600; }
  .btn.ghost { width: 100%; color: var(--green, #2e7d4f); border-style: dashed; margin: 4px 0 8px; }
  .verpick { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
  .verpick label { font-size: 13px; color: var(--muted, #6b7d70); }
  .verpick select { padding: 8px; border: 1px solid var(--line, #dce5df); border-radius: 8px; font-size: 14px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .field label { font-size: 13px; color: var(--muted, #6b7d70); }
  .field input { padding: 9px; border: 1px solid var(--line, #dce5df); border-radius: 8px; font-size: 15px; }
  .sec { margin: 16px 0 8px; font-size: 15px; color: var(--green, #2e7d4f); }
  .pe-opt { background: var(--soft, #f2f7f3); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .optrow { display: flex; gap: 6px; align-items: center; }
  .lbl { flex: 1; padding: 9px 10px; border: 1px solid var(--line, #dce5df); border-radius: 8px; font-size: 15px; font-weight: 600; color: var(--ink, #16281c); }
  .det { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 8px 10px; border: 1px solid var(--line, #dce5df); border-radius: 8px; font-size: 14px; color: var(--ink, #16281c); }
  .del { width: 36px; height: 36px; border: 1px solid var(--line, #dce5df); background: var(--card, #fff); border-radius: 8px; color: #c0392b; cursor: pointer; font-size: 15px; }
  .macros { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 10px; align-items: end; }
  .macros label { display: flex; flex-direction: column; align-items: center; font-size: 12px; font-weight: 600; color: var(--ink, #16281c); gap: 4px; text-align: center; line-height: 1.15; }
  .macros input { width: 100%; box-sizing: border-box; padding: 9px 4px; border: 1.5px solid var(--line, #dce5df); border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; color: var(--ink, #16281c); background: var(--card, #fff); }
  .macros input:focus { border-color: var(--green, #2e7d4f); outline: none; }
  .optkcal { margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--green-d, #1f5c39); text-align: right; }
  .pe-freq { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
  .pe-freq .lbl { flex: 2; }
  .pe-freq label { display: flex; flex-direction: column; align-items: center; font-size: 12px; font-weight: 600; color: var(--ink, #16281c); gap: 3px; }
  .pe-freq label input { width: 64px; padding: 9px; border: 1.5px solid var(--line, #dce5df); border-radius: 8px; text-align: center; font-size: 16px; font-weight: 600; color: var(--ink, #16281c); }
  .pe-freq label input:focus { border-color: var(--green, #2e7d4f); outline: none; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .actions .btn { flex: 1; min-width: 90px; }
</style>
