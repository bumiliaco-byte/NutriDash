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
  // Gradual hue: 0% red → 50% yellow → 100% green.
  const hue = $derived(Math.round((pct / 100) * 130));
  const color = $derived(`hsl(${hue} 68% 42%)`);
</script>

<div class="card dayprog">
  <div class="dp">
    <svg class="ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle class="track" cx="24" cy="24" r={R} />
      <circle
        class="fill"
        cx="24" cy="24" r={R}
        stroke={color}
        stroke-dasharray="{dash} {C}"
        transform="rotate(-90 24 24)"
      />
      <text class="pct" x="24" y="24" text-anchor="middle" dominant-baseline="central" fill={color}>{pct}%</text>
    </svg>
    <div class="tt">
      <b>{done ? 'Giornata completata' : 'Giornata da comporre'}</b>
      <small>{done ? 'Hai spuntato tutti gli alimenti' : 'Spunta gli alimenti dei tuoi pasti'}</small>
    </div>
  </div>
  <div class="bar"><i style="width:{pct}%; background:{color}"></i></div>
</div>

<style>
  .dayprog { padding: 14px 16px; }
  .dp { display: flex; align-items: center; gap: 14px; }
  .ring .track { fill: none; stroke: var(--line, #e2e8e3); stroke-width: 4; }
  .ring .fill {
    fill: none; stroke-width: 4; stroke-linecap: round;
    transition: stroke-dasharray .35s ease, stroke .35s ease;
  }
  .ring .pct { font-size: 12px; font-weight: 800; }
  .tt { display: flex; flex-direction: column; gap: 2px; }
  .tt b { font-size: 15px; font-weight: 800; color: var(--ink, #16281c); }
  .tt small { font-size: 12.5px; color: var(--muted, #6b7d70); }
  .bar { margin-top: 12px; height: 8px; border-radius: 6px; background: var(--line, #e2e8e3); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 6px; transition: width .35s ease, background .35s ease; }
</style>
