<script lang="ts">
  import type { DayLog } from '../types';

  let { day = $bindable(), save }: { day: DayLog; save: () => void } = $props();

  const GOAL = 12; // 12 glasses = 3.0 L
  const litres = $derived((day.water * 0.25).toFixed(2));

  function setGlass(i: number) {
    day.water = i + 1 === day.water ? i : i + 1;
    save();
  }
  function inc() { if (day.water < 20) { day.water++; save(); } }
  function dec() { if (day.water > 0) { day.water--; save(); } }
</script>

<div class="card water">
  <div class="hd">
    <span class="ic">💧</span>
    <div class="tt">Acqua<small>Obiettivo 3,0 L · {GOAL} bicchieri</small></div>
  </div>
  <div class="bd">
    <div class="glasses">
      {#each Array(GOAL) as _, i}
        <button
          class="glass"
          class:on={i < day.water}
          onclick={() => setGlass(i)}
          aria-label={`Bicchiere ${i + 1}`}
        >💧</button>
      {/each}
    </div>
    <div class="waterctl">
      <button onclick={dec} aria-label="Meno">−</button>
      <div class="amt">{litres} L <small>/ 3,00 L</small></div>
      <button onclick={inc} aria-label="Più">+</button>
    </div>
  </div>
</div>
