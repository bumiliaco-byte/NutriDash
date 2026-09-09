<script lang="ts">
  import { db } from '../db/db';
  import type { Measurement } from '../types';
  import { todayStr } from '../state';

  let { profileId, dataVersion = 0 }: { profileId: string; dataVersion?: number } = $props();

  let items = $state<Measurement[]>([]);
  let heightM = $state<number | undefined>(undefined);
  let open = $state(false);

  let fDate = $state(todayStr());
  let fWeight = $state<number | null>(null);
  let fVita = $state<number | null>(null);
  let fFianchi = $state<number | null>(null);

  async function load() {
    if (!profileId) return;
    const [rows, prof] = await Promise.all([
      db.measurements.where('profileId').equals(profileId).toArray(),
      db.profiles.get(profileId),
    ]);
    items = rows.sort((a, b) => b.date.localeCompare(a.date));
    heightM = prof?.heightM;
  }

  $effect(() => {
    void dataVersion;
    load();
  });

  function bmiFor(w?: number | null): number | undefined {
    if (w == null || !heightM) return undefined;
    return +(w / (heightM * heightM)).toFixed(1);
  }

  async function add() {
    if (fWeight == null && fVita == null && fFianchi == null) return;
    const circ: Record<string, number> = {};
    if (fVita != null) circ.vita = fVita;
    if (fFianchi != null) circ.fianchi = fFianchi;
    const m: Measurement = {
      id: `${profileId}:${fDate}`,
      profileId,
      date: fDate,
      weightKg: fWeight ?? undefined,
      bmi: bmiFor(fWeight),
      circumferences: Object.keys(circ).length ? circ : undefined,
    };
    await db.measurements.put(JSON.parse(JSON.stringify(m)));
    fWeight = null; fVita = null; fFianchi = null; fDate = todayStr();
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questa visita?')) return;
    await db.measurements.delete(id);
    await load();
  }

  // items are newest-first: delta vs the next (older) weighed visit.
  function delta(i: number): number | null {
    const cur = items[i].weightKg;
    if (cur == null) return null;
    for (let j = i + 1; j < items.length; j++) {
      const prev = items[j].weightKg;
      if (prev != null) return +(cur - prev).toFixed(1);
    }
    return null;
  }

  function fmtDate(s: string): string {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  }
</script>

<div class="card">
  <div class="hd clickable" role="button" tabindex="0"
    onclick={() => (open = !open)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open = !open; } }}>
    <span class="ic">📏</span>
    <div class="tt">Misurazioni · visite<small>Peso, BMI e circonferenze</small></div>
    {#if items.length}<span class="badge done">{items.length}</span>{/if}
    <span class="chev" class:open>›</span>
  </div>
  {#if open}
    <div class="bd">
      <div class="measform">
        <label>Data<input type="date" bind:value={fDate} /></label>
        <label>Peso (kg)<input type="number" inputmode="decimal" step="0.1" min="0" bind:value={fWeight} placeholder="82.5" /></label>
        <label>Vita (cm)<input type="number" inputmode="decimal" step="0.5" min="0" bind:value={fVita} placeholder="—" /></label>
        <label>Fianchi (cm)<input type="number" inputmode="decimal" step="0.5" min="0" bind:value={fFianchi} placeholder="—" /></label>
      </div>
      {#if fWeight != null && bmiFor(fWeight) != null}
        <div class="measbmi">BMI stimato: <b>{bmiFor(fWeight)}</b></div>
      {/if}
      <button class="measadd" onclick={add}>+ Salva visita</button>

      {#if items.length}
        <div class="measlist">
          {#each items as m, i (m.id)}
            <div class="measrow">
              <div class="md">{fmtDate(m.date)}</div>
              <div class="mvals">
                {#if m.weightKg != null}
                  <span class="mw">{m.weightKg} kg</span>
                  {#if delta(i) != null}
                    <span class="mdelta" class:up={delta(i)! > 0} class:down={delta(i)! < 0}>
                      {delta(i)! > 0 ? '▲' : delta(i)! < 0 ? '▼' : ''}{Math.abs(delta(i)!)}
                    </span>
                  {/if}
                {/if}
                {#if m.bmi != null}<span class="mchip">BMI {m.bmi}</span>{/if}
                {#if m.circumferences?.vita != null}<span class="mchip">Vita {m.circumferences.vita}</span>{/if}
                {#if m.circumferences?.fianchi != null}<span class="mchip">Fianchi {m.circumferences.fianchi}</span>{/if}
              </div>
              <button class="mdel" aria-label="Elimina visita" onclick={() => remove(m.id)}>✕</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="measempty">Nessuna visita registrata. Aggiungi peso e circonferenze per seguire l'andamento.</div>
      {/if}
    </div>
  {/if}
</div>
