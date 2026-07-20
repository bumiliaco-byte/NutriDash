<script lang="ts">
  import type { DayLog, Plan } from '../types';
  import { dayCompletion } from '../stats';

  let { day, plan }: { day: DayLog; plan: Plan } = $props();

  const pct = $derived(Math.round(dayCompletion(day, plan) * 100));
  // SVG ring geometry.
  const R = 20;
  const C = 2 * Math.PI * R;
  const dash = $derived((pct / 100) * C);
  const done = $derived(pct >= 100);
</script>

<div class="card dayprog">
  <div class="dp">
    <svg class="ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle class="track" cx="24" cy="24" r={R} />
      <circle
        class="fill"
        class:done
        cx="24" cy="24" r={R}
        stroke-dasharray="{dash} {C}"
        transform="rotate(-90 24 24)"
      />
      <text class="pct" x="24" y="24" text-anchor="middle" dominant-baseline="central">{pct}%</text>
    </svg>
    <div class="tt">
      <b>{done ? 'Giornata completata' : 'Giornata da comporre'}</b>
      <small>{done ? 'Hai spuntato tutti gli alimenti' : 'Spunta gli alimenti dei tuoi pasti'}</small>
    </div>
  </div>
  <div class="bar"><i style="width:{pct}%" class:done></i></div>
</div>

<style>
  .dayprog { padding: 14px 16px; }
  .dp { display: flex; align-items: center; gap: 14px; }
  .ring .track { fill: none; stroke: var(--line, #e2e8e3); stroke-width: 4; }
  .ring .fill {
    fill: none; stroke: var(--green, #2e7d4f); stroke-width: 4; stroke-linecap: round;
    transition: stroke-dasharray .35s ease;
  }
  .ring .fill.done { stroke: var(--gold, #c9a227); }
  .ring .pct { font-size: 12px; font-weight: 800; fill: var(--green-d, #1f5b39); }
  .tt { display: flex; flex-direction: column; gap: 2px; }
  .tt b { font-size: 15px; font-weight: 800; color: var(--ink, #16281c); }
  .tt small { font-size: 12.5px; color: var(--muted, #6b7d70); }
  .bar { margin-top: 12px; height: 8px; border-radius: 6px; background: var(--line, #e2e8e3); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 6px; background: var(--green, #2e7d4f); transition: width .35s ease; }
  .bar i.done { background: var(--gold, #c9a227); }
</style>
