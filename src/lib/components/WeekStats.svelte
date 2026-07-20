<script lang="ts">
  import type { Plan } from '../types';
  import { logsInRange, weekDays, weekSummary, type WeekSummary } from '../stats';

  let { profileId, dateStr, plan, dataVersion }: {
    profileId: string; dateStr: string; plan: Plan; dataVersion: number;
  } = $props();

  let sum = $state<WeekSummary | null>(null);

  $effect(() => {
    void dataVersion;
    const days = weekDays(dateStr);
    logsInRange(profileId, days[0], days[6]).then(logs => {
      sum = weekSummary(logs, plan);
    });
  });
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
    {/if}
  </div>
</div>
