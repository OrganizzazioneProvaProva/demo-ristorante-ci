---
version: alpha
name: Siti core
description: Livello 1 del design system (02): i ruoli e le regole che valgono per ogni sito. I valori stanno nel DESIGN.md di ogni sito; il preset propone insiemi già verificati.
---

## Overview

Il core non ha uno stile: ha dei **ruoli**. I componenti usano solo i ruoli (`bg-bg`, `text-ink`, `bg-accent`, `font-display`, `rounded-ui`...), mai un colore o un font scritto a mano. Il cliente cambia solo i valori, mai la struttura dei componenti.

Tre livelli, come il codice:

1. **Core** (questo file e `src/theme.css`): ruoli, scala, regole, stile del focus.
2. **Preset di nicchia** (`preset/<nicchia>/design/*.md`): 3-4 insiemi di valori già validati.
3. **Sito del cliente** (`clienti/<slug>/DESIGN.md`): i valori scelti. È l'unico posto dove stanno.

`siti-design build` legge il `DESIGN.md` del sito, lo convalida e scrive `src/styles/theme.generated.css` (variabili `--t-*`, non in git). Se il file non è valido o un contrasto non passa, la build si ferma.

## Colors

Ruoli fissi (nove): `bg`, `surface`, `ink`, `muted`, `line`, `accent`, `accent-ink`, `pop`, `pop-ink`. Solo `#rrggbb`.

- **ink** e **muted** si usano per il testo su **bg** e su **surface**: almeno 4,5:1.
- **accent** è l'unico colore delle azioni (pulsanti, link, focus) e si può usare come testo su **bg** e **surface**: almeno 4,5:1. Il testo sul pulsante è **accent-ink**, almeno 4,5:1 su **accent**.
- **pop** è l'evidenza (orario di oggi, "in evidenza"), mai un pulsante; il testo sopra è **pop-ink**, almeno 4,5:1.
- **line** è per i divisori decorativi: non porta informazione. I bordi dei campi dei moduli usano **ink**.

## Typography

Due famiglie al massimo: `display` (titoli) e `body` (testi), più `label` (stesso carattere del testo, peso maggiore). I font sono scaricati in build dalla Fonts API di Astro e serviti dal sito: mai da server di terzi.

## Shapes

Un solo raggio per tutti gli elementi dell'interfaccia: `rounded-ui`.

## Motion & Micro-interaction

Il sito è statico (nessun contenuto cambia da solo mentre lo si guarda) ma non è fermo: il movimento accompagna, non trattiene. Livello della Base: **leggero**.

- Si animano solo `transform`, `translate`, `scale` e `opacity`, con i token `--motion-*` e `--ease-*` di `core/src/motion.css`; mai durate scritte a mano.
- Ogni animazione, transizione di pagina (`@view-transition`) e animazione legata allo scroll sta dentro `@media (prefers-reduced-motion: no-preference)`. Con il movimento ridotto: nessuna animazione, intestazione e barra di azioni sempre visibili.
- Il contenuto è leggibile e visibile senza JavaScript e senza supporto del browser: un effetto può solo aggiungere, mai nascondere in attesa.
- L'elemento LCP dell'hero non parte mai trasparente e il titolo dell'hero non si anima.
- L'hover si usa solo con `(hover: hover) and (pointer: fine)`; la pressione di un pulsante vale per ogni puntatore.
- Si muovono: la foto dell'hero (si assesta), la rivelazione di foto, card e titoli allo scorrimento, il menu del telefono, il cambio di pagina, l'intestazione del telefono (si nasconde scorrendo in basso e ricompare risalendo), la barra di azioni (entra quando le azioni dell'hero escono dalla vista).
- Vietati: parallax sul testo, caroselli automatici, scorrimento simulato, `transition: all`.
- Il focus da tastiera è sempre visibile (anello di 3 px del colore **accent**) e non è mai coperto né animato: ciò che è fisso o si nasconde torna visibile con `:focus-within`, e `scroll-padding` copre intestazione e barra.
- I livelli di movimento delle personalità (nessuno, leggero, espressivo) cambiano i valori dei token e quali effetti sono attivi, non i componenti.

## Do's and Don'ts

- Fare: un solo pulsante pieno visibile per vista, contando anche gli elementi fissi (se la stessa azione compare in due punti, se ne vede uno alla volta); testo alternativo su ogni immagine non decorativa.
- Non fare: colori o font fuori dai ruoli; gradienti decorativi.
