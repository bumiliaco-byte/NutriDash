# NutriDash

App mobile (PWA) per seguire il piano nutrizionale: pasti per tipo di giornata,
acqua, stima dei macronutrienti, storico. Local-first (funziona offline) con
sync cloud opzionale.

## Stack
- Svelte 5 + Vite + TypeScript
- Dexie (IndexedDB) per il salvataggio locale — i dati **non** si perdono chiudendo il browser
- vite-plugin-pwa per installazione su iPhone/Android e uso offline
- Supabase (opzionale) per il sync tra dispositivi

## Sviluppo
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build di produzione in dist/ (+ service worker PWA)
npm run preview  # anteprima della build
```

## Persistenza dei dati
I dati vivono in IndexedDB sul dispositivo. Alla prima apertura l'app **migra
automaticamente** i dati dal vecchio file HTML (localStorage `nutriBruno_V1`),
se presenti sullo stesso dominio.

> Importante: per non perdere i dati, apri sempre l'app dalla **stessa origine
> (https)**. Aprirla come file locale (`file://`) o da URL diversi crea storage
> separati.

## Sync cloud (opzionale)
1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. Esegui `supabase/schema.sql` nell'editor SQL di Supabase.
3. Copia `.env.example` in `.env.local` e inserisci `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`.

Senza queste variabili l'app resta 100% locale.

## Pubblicazione gratuita
Esegui `npm run build` e pubblica la cartella `dist/` su GitHub Pages, Netlify o
Vercel. Per GitHub Pages su sottocartella, builda con
`BASE_PATH=/nome-repo/ npm run build`.

## Struttura
- `src/lib/types.ts` — modello dati (profili, piani versionati, log, alimenti)
- `src/lib/data/foods.ts` — macro per 100 g degli alimenti del piano
- `src/lib/data/plan.ts` — struttura del piano e pasti per tipo di giornata
- `src/lib/db/db.ts` — database Dexie + migrazione da localStorage
- `src/lib/compute.ts` — calcolo macro giornalieri
- `src/lib/sync/supabase.ts` — sync local-first
- `src/lib/components/` — MacroSummary, WaterCard, MealCard
