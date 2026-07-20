<script lang="ts">
  import type { Plan } from '../types';
  import { logsInRange, weekDays, shoppingList, type ShoppingItem } from '../stats';

  let { profileId, dateStr, plan, dataVersion }: {
    profileId: string; dateStr: string; plan: Plan; dataVersion: number;
  } = $props();

  let items = $state<ShoppingItem[]>([]);

  $effect(() => {
    void dataVersion;
    const days = weekDays(dateStr);
    logsInRange(profileId, days[0], days[6]).then(logs => {
      items = shoppingList(logs, plan);
    });
  });
</script>

<div class="card">
  <div class="hd">
    <span class="ic">🛒</span>
    <div class="tt">Lista della spesa<small>Dalle note della settimana</small></div>
  </div>
  <div class="bd">
    {#if items.length}
      <ul class="shoplist">
        {#each items as it (it.note)}
          <li>
            <span class="sname">
              {it.note}
              {#if it.foods.length}<small class="sfood">{it.foods.join(', ')}</small>{/if}
            </span>
            <span class="scount">{it.count}×</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">
        Nessuna nota questa settimana. Aggiungi marca, ricetta o tipo
        nel campo 📝 sotto un alimento selezionato.
      </p>
    {/if}
  </div>
</div>

<style>
  .shoplist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .shoplist li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    background: var(--soft, #f2f7f3);
    border-radius: 8px;
  }
  .sname { font-size: 14px; display: flex; flex-direction: column; }
  .sfood { font-size: 11px; color: var(--muted, #6b7d70); margin-top: 2px; }
  .scount {
    font-weight: 700;
    color: var(--green, #2e7d4f);
    font-size: 14px;
    flex: none;
  }
  .empty {
    color: var(--muted, #6b7d70);
    font-size: 14px;
    text-align: center;
    margin: 8px 0;
  }
</style>
