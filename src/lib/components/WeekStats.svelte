<script lang="ts">
  import type { Plan } from '../types';
  import { logsInRange, weekDays, weekSummary, weeklyBreakdown, type WeekSummary, type DayBar } from '../stats';

  let { profileId, dateStr, plan, dataVersion }: {
    profileId: string; dateStr: string; plan: Plan; dataVersion: number;
  } = $props();

  let sum = $state<WeekSummary | null>(null);
  let bars = $state<DayBar[]>([]);

  $effect(() => {
    void dataVersion;
    const days = weekDays(dateStr);
    logsInRange(profileId, days[0], days[6]).then(logs => {
      sum = weekSummary(logs, plan);
      bars = weeklyBreakdown(logs, plan, days);
    });
  });

  const maxKcal = $derived(Math.max(plan.targetKcal ?? 0, ...bars.map(b => b.kcal), 1));
  const goal = $derived(plan.targetKcal ?? 0);
  const todayStr = $derived(dateStr);
</script>

<div class="card">
  <div class="hd">
    <span class="ic">📈</span>
    <div class="tt">Statistiche settimana<small>Media dei giorni con dati</small></div>
  </div>
  <div class="bd">
    {#if sum}
      <div class="statgrid">
        <div class="stat"><div class="sv">{sum.avgKcal}</div><div class="sl">kcal / g</div></div>
        <div class="stat"><div class="sv">{sum.avgMacros.carbs}g</div><div class="sl">Carbo / g</div></div>
        <div class="stat"><div class="sv">{sum.avgMacros.protein}g</div><div class="sl">Proteine / g</div></div>
        <div class="stat"><div class="sv">{sum.avgMacros.fat}g</div><div class="sl">Grassi / g</div></div>
        <div class="stat"><div class="sv">{sum.avgWater} L</div><div class="sl">Acqua / g</div></div>
        <div class="stat"><div class="sv">{sum.loggedDays}/7</div><div class="sl">Giorni</div></div>
      </div>

      <div class="chart">
        {#each bars as b (b.date)}
          <div class="bar" class:today={b.date === todayStr} class:empty={!b.hasData} title="{b.label}: {b.kcal} kcal · C {b.macros.carbs} · P {b.macros.protein} · G {b.macros.fat}">
            <div class="track">
              <div class="fill" style="height:{Math.round((b.kcal / maxKcal) * 100)}%"></div>
            </div>
            <div class="kc">{b.hasData ? b.kcal : '·'}</div>
            <div class="dl">{b.label}</div>
          </div>
        {/each}
      </div>
      <div class="chartcap">kcal per giorno{goal ? ` · obiettivo ${goal}` : ''}</div>
    {/if}
  </div>
</div>

<style>
  .chart { position: relative; display: flex; align-items: flex-end; justify-content: space-between;
    gap: 6px; height: 150px; margin-top: 16px; padding-top: 4px; }
  .chart .bar { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
  .chart .track { flex: 1; width: 100%; display: flex; align-items: flex-end;
    border-radius: 7px 7px 0 0; overflow: hidden; }
  .chart .fill { width: 100%; border-radius: 7px 7px 0 0; min-height: 2px;
    background: linear-gradient(180deg, var(--green) 0%, var(--green-d) 100%); transition: height .35s ease; }
  .chart .bar.today .fill { background: linear-gradient(180deg, var(--gold) 0%, #b8860b 100%); }
  .chart .bar.empty .track { background: repeating-linear-gradient(45deg, var(--line) 0 6px, transparent 6px 12px); opacity: .5; }
  .chart .kc { font-size: .62rem; font-weight: 800; color: var(--muted); margin-top: 3px; }
  .chart .dl { font-size: .66rem; font-weight: 700; color: var(--ink); }
  .chartcap { text-align: center; font-size: .68rem; color: var(--muted); margin-top: 8px; }
</style>
