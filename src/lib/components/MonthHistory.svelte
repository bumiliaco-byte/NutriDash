<script lang="ts">
  import { untrack } from 'svelte';
  import type { Plan } from '../types';
  import { fmt, todayStr } from '../state';
  import { dayCompletion, logsInRange } from '../stats';

  let { profileId, dateStr, plan, dataVersion, onPick }: {
    profileId: string; dateStr: string; plan: Plan; dataVersion: number;
    onPick: (date: string) => void;
  } = $props();

  const MON = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const DOW_S = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  let viewMonth = $state(untrack(() => dateStr).slice(0, 7)); // YYYY-MM
  let completion = $state<Record<string, number>>({});

  const monthLabel = $derived.by(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    return `${MON[m - 1]} ${y}`;
  });

  const cells = $derived.by(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-based blanks
    const days = new Date(y, m, 0).getDate();
    const out: ({ date: string; day: number } | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push({ date: fmt(new Date(y, m - 1, d)), day: d });
    return out;
  });

  $effect(() => {
    void dataVersion;
    const [y, m] = viewMonth.split('-').map(Number);
    const start = fmt(new Date(y, m - 1, 1));
    const end = fmt(new Date(y, m, 0));
    logsInRange(profileId, start, end).then(logs => {
      const map: Record<string, number> = {};
      for (const l of logs) map[l.date] = dayCompletion(l, plan);
      completion = map;
    });
  });

  function level(date: string): string {
    const c = completion[date] ?? 0;
    if (c <= 0) return '';
    if (c < 0.34) return 'l1';
    if (c < 0.67) return 'l2';
    if (c < 1) return 'l3';
    return 'l4';
  }
  function shiftMonth(delta: number) {
    const [y, m] = viewMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    viewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
</script>

<div class="card">
  <div class="hd">
    <span class="ic">🗓️</span>
    <div class="tt">Storico mensile<small>Tocca un giorno per aprirlo</small></div>
  </div>
  <div class="bd">
    <div class="monthhd">
      <button class="mnav" onclick={() => shiftMonth(-1)} aria-label="Mese precedente">‹</button>
      <b>{monthLabel}</b>
      <button class="mnav" onclick={() => shiftMonth(1)} aria-label="Mese successivo">›</button>
    </div>
    <div class="monthgrid">
      {#each DOW_S as d}<div class="mh">{d}</div>{/each}
      {#each cells as cell}
        {#if cell}
          <button
            class="mc {level(cell.date)}"
            class:today={cell.date === todayStr()}
            class:cur={cell.date === dateStr}
            onclick={() => onPick(cell.date)}
          >
            <span class="mn">{cell.day}</span>
          </button>
        {:else}
          <span class="mc empty"></span>
        {/if}
      {/each}
    </div>
    <div class="monthlegend">Intensità = completamento della giornata</div>
  </div>
</div>
