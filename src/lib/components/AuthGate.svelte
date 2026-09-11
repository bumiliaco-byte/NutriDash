<script lang="ts">
  import { untrack } from 'svelte';
  import { signIn, signUp, resetPassword, updatePassword } from '../sync/supabase';

  let { recovery = false, onDone }: { recovery?: boolean; onDone: () => void } = $props();

  type Mode = 'in' | 'up' | 'forgot' | 'reset';
  let mode = $state<Mode>(untrack(() => recovery) ? 'reset' : 'in');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let msg = $state('');
  let err = $state('');

  $effect(() => { if (recovery) mode = 'reset'; });

  const canSubmit = $derived(
    mode === 'forgot' ? !!email.trim()
      : mode === 'reset' ? password.length >= 6
        : !!email.trim() && password.length >= 6,
  );

  function go(next: Mode) {
    mode = next; err = ''; msg = '';
  }

  async function submit(e?: Event) {
    e?.preventDefault();
    if (!canSubmit || busy) return;
    busy = true; err = ''; msg = '';
    try {
      if (mode === 'up') {
        const { needsConfirm } = await signUp(email.trim(), password);
        if (needsConfirm) {
          msg = 'Ti abbiamo inviato una mail di conferma: aprila, poi torna qui e accedi.';
          mode = 'in';
        } else {
          onDone();
        }
      } else if (mode === 'in') {
        await signIn(email.trim(), password);
        onDone();
      } else if (mode === 'forgot') {
        await resetPassword(email.trim());
        msg = 'Se l’indirizzo è registrato riceverai una mail per reimpostare la password.';
        mode = 'in';
      } else {
        await updatePassword(password);
        onDone();
      }
      password = '';
    } catch (e2) {
      err = messageFor(e2);
    } finally {
      busy = false;
    }
  }

  function messageFor(e: unknown): string {
    const m = e instanceof Error ? e.message : String(e);
    if (/Invalid login/i.test(m)) return 'Email o password non corretti.';
    if (/already registered/i.test(m)) return 'Email già registrata: accedi.';
    if (/at least 6/i.test(m)) return 'La password deve avere almeno 6 caratteri.';
    if (/rate limit|too many/i.test(m)) return 'Troppi tentativi: riprova tra qualche minuto.';
    if (/fetch|network/i.test(m)) return 'Nessuna connessione: il primo accesso richiede internet.';
    return m;
  }
</script>

<div class="gate">
  <div class="gatecard">
    <div class="gatelogo">🥗</div>
    <h1>NutriDash</h1>
    <p class="gatesub">
      {#if mode === 'up'}Crea il tuo account: il piano e il diario saranno solo tuoi.
      {:else if mode === 'forgot'}Inserisci la tua email: ti mandiamo un link per reimpostare la password.
      {:else if mode === 'reset'}Scegli una nuova password per il tuo account.
      {:else}Accedi per vedere il tuo piano e i tuoi dati.
      {/if}
    </p>

    <form onsubmit={submit}>
      {#if mode !== 'reset'}
        <input class="syncinput" type="email" autocomplete="username" placeholder="Email" bind:value={email} />
      {/if}
      {#if mode !== 'forgot'}
        <input class="syncinput" type="password" placeholder={mode === 'reset' ? 'Nuova password (min 6)' : 'Password (min 6)'}
          autocomplete={mode === 'in' ? 'current-password' : 'new-password'} bind:value={password} />
      {/if}
      <button class="syncmain" type="submit" disabled={busy || !canSubmit}>
        {#if busy}…
        {:else if mode === 'up'}Crea account
        {:else if mode === 'forgot'}Invia link
        {:else if mode === 'reset'}Salva password
        {:else}Accedi{/if}
      </button>
    </form>

    {#if msg}<div class="syncmsg ok">{msg}</div>{/if}
    {#if err}<div class="syncmsg err">{err}</div>{/if}

    {#if mode === 'in'}
      <button class="synclink" onclick={() => go('up')}>Primo accesso? Crea il tuo account</button>
      <button class="synclink" onclick={() => go('forgot')}>Password dimenticata</button>
    {:else if mode === 'up'}
      <button class="synclink" onclick={() => go('in')}>Hai già un account? Accedi</button>
    {:else if mode === 'forgot'}
      <button class="synclink" onclick={() => go('in')}>Torna all’accesso</button>
    {/if}

    <div class="gatefoot">
      I tuoi dati restano visibili solo a te: ogni account vede il proprio piano e il proprio diario.<br />
      <a href={import.meta.env.BASE_URL + 'guida.html'} target="_blank" rel="noopener">📖 Leggi la guida</a>
    </div>
  </div>
</div>
