<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { syncEnabled, currentEmail, signOut, onAuthChange, sync } from '../sync/supabase';
  import { wipeLocalData } from '../db/db';

  let { onSynced, onSignedOut }: { onSynced?: () => void; onSignedOut?: () => void } = $props();

  let account = $state<string | null>(null);
  let busy = $state(false);
  let msg = $state('');
  let err = $state('');
  let unsub: () => void = () => {};

  const configured = syncEnabled();

  onMount(async () => {
    if (!configured) return;
    account = await currentEmail();
    unsub = onAuthChange((session) => {
      account = session?.user.email ?? null;
      if (account) runSync();
    });
    if (account) runSync();
  });
  onDestroy(() => unsub());

  async function runSync() {
    if (busy) return;
    busy = true; err = ''; msg = '';
    try {
      const res = await sync();
      if (res) {
        msg = `Sincronizzato: ${res.pulled} scaricati, ${res.pushed} inviati`;
        onSynced?.();
      }
    } catch (e) {
      err = 'Sync non riuscita: ' + (e instanceof Error ? e.message : 'errore');
    } finally {
      busy = false;
    }
  }

  async function logout(wipe: boolean) {
    if (wipe && !confirm('Uscire e cancellare i dati da questo dispositivo? Restano nel cloud e li ritrovi al prossimo accesso.')) return;
    busy = true;
    try {
      if (!wipe) await sync(); // push pending changes before leaving
    } catch { /* offline: local data stays and will sync at the next login */ }
    await signOut();
    if (wipe) await wipeLocalData();
    busy = false;
    account = null;
    onSignedOut?.();
  }
</script>

<div class="card">
  <div class="hd">
    <span class="ic">☁️</span>
    <div class="tt">Il tuo account<small>Dati sincronizzati tra i tuoi dispositivi</small></div>
    {#if configured}
      <span class="badge" class:done={!!account} class:todo={!account}>{account ? 'Attiva' : 'Off'}</span>
    {/if}
  </div>
  <div class="bd">
    {#if !configured}
      <div class="synchint">
        Sync non configurata su questa versione. Serve un progetto Supabase gratuito
        (URL + chiave anon) nel file <code>.env.local</code>.
      </div>
    {:else if account}
      <div class="syncon">
        <div class="syncwho">Connesso come <b>{account}</b></div>
        <div class="syncbtns">
          <button class="syncmain" onclick={runSync} disabled={busy}>{busy ? 'Sincronizzo…' : '🔄 Sincronizza ora'}</button>
          <button class="syncghost" onclick={() => logout(false)} disabled={busy}>Esci</button>
        </div>
        <button class="synclink" onclick={() => logout(true)} disabled={busy}>Esci e cancella i dati da questo dispositivo</button>
      </div>
    {/if}
    {#if msg}<div class="syncmsg ok">{msg}</div>{/if}
    {#if err}<div class="syncmsg err">{err}</div>{/if}
  </div>
</div>
