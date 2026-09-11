<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  let ready = $state(false);
  let busy = $state(false);
  let apply: (reload?: boolean) => Promise<void> = async () => {};

  onMount(() => {
    apply = registerSW({
      immediate: true,
      onNeedRefresh: () => (ready = true),
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        // Look for a new build when the app comes back to the foreground.
        const check = () => { if (!document.hidden) registration.update(); };
        document.addEventListener('visibilitychange', check);
        setInterval(check, 60 * 60 * 1000);
      },
    });
  });

  async function update() {
    busy = true;
    await apply(true);
  }
</script>

{#if ready}
  <div class="updbar" role="status">
    <span class="updtx">È disponibile una nuova versione</span>
    <button class="updbtn" onclick={update} disabled={busy}>{busy ? 'Aggiorno…' : 'Aggiorna'}</button>
    <button class="updx" onclick={() => (ready = false)} aria-label="Chiudi">×</button>
  </div>
{/if}
