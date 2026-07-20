<script lang="ts">
  import type { DayLog, Meal, Plan, Slot, SlotOption } from '../types';
  import { optionMacros } from '../data/foods';
  import { mealMacros, slotMacros, PIATTO_UNICO } from '../compute';

  let { meal, day = $bindable(), dayType, plan, freqCounts, dense = false, save }: {
    meal: Meal; day: DayLog; dayType: string; plan: Plan; freqCounts: Record<string, number>; dense?: boolean; save: () => void;
  } = $props();

  // Collapsible body: in compact view cards start closed, expandable on tap.
  let open = $state(true);
  $effect(() => { open = !dense; });

  const showNote = $derived(!meal.noteOnlyTraining || dayType === 'allenamento');
  const piattoOn = $derived(!!day.piatto?.[meal.id]);
  const kcal = $derived(Math.round(mealMacros(meal, day).kcal));

  function key(slot: Slot) { return `${meal.id}.${slot.id}`; }

  function pick(slot: Slot, opt: SlotOption) {
    const k = key(slot);
    if (day.sel[k] === opt.id) delete day.sel[k];
    else day.sel[k] = opt.id;
    save();
  }
  function isSel(slot: Slot, opt: SlotOption) { return day.sel[key(slot)] === opt.id; }

  function toggleChk(slot: Slot) {
    const k = key(slot);
    if (day.chk[k]) delete day.chk[k];
    else day.chk[k] = true;
    save();
  }
  function isChk(slot: Slot) { return !!day.chk[key(slot)]; }

  function togglePiatto() {
    day.piatto = { ...day.piatto, [meal.id]: !piattoOn };
    save();
  }

  const freeSel = $derived(day.freeMeal === meal.id);
  const freeLocked = $derived(!!day.freeMeal && day.freeMeal !== meal.id);
  function toggleFree() {
    day.freeMeal = day.freeMeal === meal.id ? '' : meal.id;
    save();
  }

  function optKcal(opt: SlotOption): number | null {
    const m = optionMacros(opt);
    return m ? Math.round(m.kcal) : null;
  }

  function slotKcal(slot: Slot): number | null {
    const m = slotMacros(slot);
    return m ? Math.round(m.kcal) : null;
  }

  function optMac(opt: SlotOption): { c: number; p: number; f: number } | null {
    const m = optionMacros(opt);
    return m ? { c: Math.round(m.carbs), p: Math.round(m.protein), f: Math.round(m.fat) } : null;
  }

  function slotMac(slot: Slot): { c: number; p: number; f: number } | null {
    const m = slotMacros(slot);
    return m ? { c: Math.round(m.carbs), p: Math.round(m.protein), f: Math.round(m.fat) } : null;
  }

  function covered(slot: Slot) {
    return piattoOn && (slot.id === 'gluc' || slot.id === 'prot' || slot.id === 'verdura');
  }

  /** True when the option's weekly frequency cap is already reached. */
  function capReached(opt: SlotOption): boolean {
    if (!opt.freq) return false;
    const f = plan.frequencies.find((x) => x.key === opt.freq);
    if (f?.max == null) return false;
    return (freqCounts[opt.freq] ?? 0) >= f.max;
  }
  /** Disable an option when its cap is reached, unless it's the one already selected here. */
  function optDisabled(slot: Slot, opt: SlotOption): boolean {
    return capReached(opt) && !isSel(slot, opt);
  }

  function noteVal(k: string) { return day.notes[k] ?? ''; }
  function onNoteInput(k: string, e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    if (v) day.notes[k] = v;
    else delete day.notes[k];
  }
</script>

<div class="card mealcard">
  <div class="hd" class:clickable={dense} role="button" tabindex="0"
    onclick={() => { if (dense) open = !open; }}
    onkeydown={(e) => { if (dense && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open = !open; } }}>
    <span class="ic">{meal.icon}</span>
    <div class="tt">
      {meal.name}
      {#if showNote && meal.note}<span class="when">{meal.note}</span>{/if}
      {#if meal.waterNote}<small>💧 {meal.waterNote}</small>{/if}
    </div>
    {#if kcal > 0}<span class="badge done">{kcal} kcal</span>{/if}
    {#if dense}<span class="chev" class:open>›</span>{/if}
  </div>
  {#if open}
  <div class="bd">
    {#if meal.hasPiatto}
      <button class="piatto" class:sel={piattoOn} onclick={togglePiatto}>
        <span class="box">{piattoOn ? '✓' : ''}</span>
        <span class="txt">
          <b>Piatto unico</b>
          <span>80–100g pasta/riso/orzo/farro + 30g legumi secchi + verdure</span>
          <span class="macs"><b class="k">{Math.round(PIATTO_UNICO.kcal)} kcal</b> · C {Math.round(PIATTO_UNICO.carbs)} · P {Math.round(PIATTO_UNICO.protein)} · G {Math.round(PIATTO_UNICO.fat)}</span>
        </span>
      </button>
      {#if piattoOn}
        <input
          class="note"
          value={noteVal(`${meal.id}.piatto`)}
          placeholder="📝 Marca, ricetta o tipo"
          oninput={(e) => onNoteInput(`${meal.id}.piatto`, e)}
          onchange={save}
        />
      {/if}
    {/if}

    {#each meal.slots as slot}
      <div class="slot">
        <div class="lab">{slot.label}</div>

        {#if slot.kind === 'freeToggle'}
          <button
            class="opt check free"
            class:sel={freeSel}
            class:disabled={freeLocked}
            disabled={freeLocked}
            onclick={toggleFree}
          >
            <span class="box">{freeSel ? '✓' : ''}</span>
            <span class="txt">
              <b>🎉 {slot.label}</b>
              {#if slot.detail}<span>{slot.detail}</span>{/if}
              {#if freeLocked}<span class="lim over">già libero nell'altro pasto</span>{/if}
            </span>
          </button>
        {:else if covered(slot)}
          <div class="covered">Coperto dal <b>piatto unico</b></div>
        {:else if slot.kind === 'choice' && slot.options}
          <div class="opts">
            {#each slot.options as opt}
              <button
                class="opt"
                class:sel={isSel(slot, opt)}
                class:disabled={optDisabled(slot, opt)}
                disabled={optDisabled(slot, opt)}
                onclick={() => pick(slot, opt)}
              >
                <span class="box">{isSel(slot, opt) ? '✓' : ''}</span>
                <span class="txt">
                  <b>{opt.label}</b>
                  {#if opt.detail}<span>{opt.detail}</span>{/if}
                  {#if optMac(opt)}<span class="macs"><b class="k">{optKcal(opt)} kcal</b> · C {optMac(opt)!.c} · P {optMac(opt)!.p} · G {optMac(opt)!.f}</span>{/if}
                  {#if opt.lim}<span class="lim">{opt.lim}</span>{/if}
                  {#if optDisabled(slot, opt)}<span class="lim over">max settimanale raggiunto</span>{/if}
                </span>
              </button>
              {#if isSel(slot, opt)}
                <input
                  class="note"
                  value={noteVal(key(slot))}
                  placeholder="📝 Marca, ricetta o tipo"
                  oninput={(e) => onNoteInput(key(slot), e)}
                  onchange={save}
                />
              {/if}
            {/each}
          </div>
        {:else if slot.kind === 'check'}
          <button class="opt check" class:sel={isChk(slot)} onclick={() => toggleChk(slot)}>
            <span class="box">{isChk(slot) ? '✓' : ''}</span>
            <span class="txt">
              <b>{slot.label}</b>
              {#if slot.detail}<span>{slot.detail}</span>{/if}
              {#if slotMac(slot)}<span class="macs"><b class="k">{slotKcal(slot)} kcal</b> · C {slotMac(slot)!.c} · P {slotMac(slot)!.p} · G {slotMac(slot)!.f}</span>{/if}
            </span>
          </button>
          {#if isChk(slot)}
            <input
              class="note"
              value={noteVal(key(slot))}
              placeholder="📝 Marca, ricetta o tipo"
              oninput={(e) => onNoteInput(key(slot), e)}
              onchange={save}
            />
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  {/if}
</div>
