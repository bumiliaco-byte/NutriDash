<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { syncEnabled, currentEmail, signIn, signUp, signOut, onAuthChange, sync } from '../sync/supabase';

  let { onSynced }: { onSynced?: () => void } = $props();

  let email = $state('');
  let password = $state('');
  let account = $state<string | null>(null);
  let busy = $state(false);
  let msg = $state('');
  let err = $state('');
  let mode = $state<'in' | 'up'>('in');
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

  async function submit() {
    busy = true; err = ''; msg = '';
    try {
      if (mode === 'up') {
        const { needsConfirm } = await signUp(email.trim(), password);
        msg = needsConfirm ? 'Registrato. Controlla la mail per confermare, poi accedi.' : 'Registrato e connesso.';
      } else {
        await signIn(email.trim(), password);
      }
      password = '';
    } catch (e) {
      err = messageFor(e);
    } finally {
      busy = false;
    }
  }

  function messageFor(e: unknown): string {
    const m = e instanceof Error ? e.message : String(e);
    if (/Invalid login/i.test(m)) return 'Email o password non corretti.';
    if (/already registered/i.test(m)) return 'Email già registrata: accedi.';
    if (/at least 6/i.test(m)) return 'La password deve avere almeno 6 caratteri.';
    return m;
  }

  async function logout() {
    await signOut();
    account = null;
    msg = 'Disconnesso (i dati restano sul dispositivo).';
  }
</script>

<div class="card">
  <div class="hd">
    <span class="ic">☁️</span>
    <div class="tt">Sync cloud<small>Dati sincronizzati tra i tuoi dispositivi</small></div>
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
          <button class="syncghost" onclick={logout} disabled={busy}>Esci</button>
        </div>
      </div>
    {:else}
      <div class="syncform">
        <input class="syncinput" type="email" autocomplete="username" placeholder="Email" bind:value={email} />
        <input class="syncinput" type="password" autocomplete="current-password" placeholder="Password (min 6)" bind:value={password} />
        <button class="syncmain" onclick={submit} disabled={busy || !email || !password}>
          {busy ? '…' : mode === 'up' ? 'Registrati' : 'Accedi'}
        </button>
        <button class="synclink" onclick={() => { mode = mode === 'up' ? 'in' : 'up'; err = ''; msg = ''; }}>
          {mode === 'up' ? 'Hai già un account? Accedi' : 'Primo accesso? Registrati'}
        </button>
      </div>
    {/if}
    {#if msg}<div class="syncmsg ok">{msg}</div>{/if}
    {#if err}<div class="syncmsg err">{err}</div>{/if}
  </div>
</div>
