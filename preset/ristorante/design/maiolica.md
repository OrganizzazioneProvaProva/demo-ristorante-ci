---
version: alpha
name: Maiolica
description: "Direzione A del preset ristorante: chiaro, grafico, ispirato alle ceramiche siciliane."
motion: light-animation
colors:
  bg: "#F4F7F5"
  surface: "#FFFFFF"
  ink: "#0E2A47"
  muted: "#4B6076"
  line: "#C5D0DA"
  accent: "#1D5FBF"
  accent-ink: "#FFFFFF"
  pop: "#F2C230"
  pop-ink: "#0E2A47"
typography:
  display:
    fontFamily: Familjen Grotesk
    fontWeight: 700
    fontFallback: sans
  body:
    fontFamily: Source Sans 3
    fontWeight: 400
    fontFallback: sans
  label:
    fontFamily: Source Sans 3
    fontWeight: 600
    fontFallback: sans
rounded:
  ui: 2px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
  highlight:
    backgroundColor: "{colors.pop}"
    textColor: "{colors.pop-ink}"
---

## Overview

Chiaro e grafico. Cobalto e limone come nelle maioliche siciliane, su un fondo bianco ghiaccio. Il locale parla con frasi brevi e un titolo deciso; le foto vere fanno il resto.

## Colors

- **bg (#F4F7F5)** e **surface (#FFFFFF)**: fondo e carte.
- **ink (#0E2A47)**: testo e bordi forti; **muted (#4B6076)**: testo secondario.
- **accent (#1D5FBF)**: l'unico colore delle azioni (pulsanti, link, focus).
- **pop (#F2C230)**: evidenza (orario di oggi, "in evidenza"), mai per i pulsanti.

## Typography

Titoli in Familjen Grotesk 700, testi in Source Sans 3 400, etichette 600. Una scala sola per tutto il sito.

## Shapes

Angoli quasi netti (2 px) su pulsanti, carte ed evidenze.

## Do's and Don'ts

- Fare: un solo pulsante pieno per vista.
- Non fare: gradienti, ombre morbide.
