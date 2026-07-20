<script lang="ts">
  import type { DayLog, Plan } from '../types';
  import { dayMacros, macroSplit, round } from '../compute';

  let { day, plan }: { day: DayLog; plan: Plan } = $props();

  const macros = $derived(round(dayMacros(day, plan)));
  const split = $derived(macroSplit(macros));
  const goal = $derived(plan.targetKcal ?? 0);
  const goalPct = $derived(goal ? Math.min(100, Math.round((macros.kcal / goal) * 100)) : 0);
</script>

<div class="card macro">
  <div class="hd">
    <span class="ic">🔥</span>
    <div class="tt">Macronutrienti<small>Stima dalle scelte del giorno</small></div>
  </div>
  <div class="bd">
    <div class="macrotot">
      <span class="kcal">{macros.kcal}</span>
      <span class="goal">kcal{goal ? ` / ${goal} (${goalPct}%)` : ''}</span>
    </div>
    <div class="mbars">
      <div class="mrow carbs">
        <span class="ml">Carboidrati</span>
        <div class="mtrack"><i style="width:{split.carbs}%"></i></div>
        <span class="mv">{macros.carbs}g <small>{split.carbs}%</small></span>
      </div>
      <div class="mrow protein">
        <span class="ml">Proteine</span>
        <div class="mtrack"><i style="width:{split.protein}%"></i></div>
        <span class="mv">{macros.protein}g <small>{split.protein}%</small></span>
      </div>
      <div class="mrow fat">
        <span class="ml">Grassi</span>
        <div class="mtrack"><i style="width:{split.fat}%"></i></div>
        <span class="mv">{macros.fat}g <small>{split.fat}%</small></span>
      </div>
    </div>
  </div>
</div>
