<script lang="ts">
  import type { Plan } from '../types';
  import { logsInRange, tallyFrequencies, weekDays } from '../stats';

  let { profileId, dateStr, plan, dataVersion }: {
    profileId: string; dateStr: string; plan: Plan; dataVersion: number;
  } = $props();

  let counts = $state<Record<string, number>>({});

  $effect(() => {
    // re-run when the week or data changes
    void dataVersion;
    const days = weekDays(dateStr);
    logsInRange(profileId, days[0], days[6]).then(logs => {
      counts = tallyFrequencies(logs, plan);
    });
  });

  function status(key: string, n: number): 'ok' | 'low' | 'over' {
    const f = plan.frequencies.find(x => x.key === key);
    if (!f) return 'ok';
    if (f.max != null && n > f.max) return 'over';
    return 'ok';
  }
  function pct(key: string, n: number): number {
    const f = plan.frequencies.find(x => x.key === key);
    const max = f?.max;
    if (!max) return 0;
    return Math.min(100, Math.round((n / max) * 100));
  }
  function hasCap(key: string): boolean {
    const f = plan.frequencies.find(x => x.key === key);
    return f?.max != null;
  }
  function target(key: string): string {
    const f = plan.frequencies.find(x => x.key === key);
    if (!f || f.max == null) return 'questa settimana';
    return `max ${f.max}× / sett`;
  }
</script>

<div class="card">
  <div class="hd">
    <span class="ic">📊</span>
    <div class="tt">Frequenze settimanali<small>Lun–Dom della settimana corrente</small></div>
  </div>
  <div class="bd">
    <div class="freq">
      {#each plan.frequencies as f}
        {@const n = counts[f.key] ?? 0}
        {@const st = status(f.key, n)}
        <div class="fq {st}">
          <div class="fqh">
            <b>{f.label}</b>
            <span class="cnt">{n} <span class="tgt">/ {target(f.key)}</span></span>
          </div>
          {#if hasCap(f.key)}
            <div class="fqbar"><i style="width:{pct(f.key, n)}%"></i></div>
          {:else if n > 0}
            <div class="pips">
              {#each Array.from({ length: Math.min(n, 10) }) as _, i (i)}<span class="pip"></span>{/each}
              {#if n > 10}<span class="pipmore">+{n - 10}</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
