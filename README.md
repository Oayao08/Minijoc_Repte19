# Minijoc interactiu sobre atenció i seguretat en patinet

Joc 2D de desplaçament lateral orientat a conscienciar sobre seguretat vial en patinet.

## Mecànica principal

- Controls:
  - `←` / `→`: moviment lateral.
  - `Espai`: parar immediatament (idle).
  - `S`: salt.
  - `P`: pausa opcional.
- Objectiu: arribar a **100 punts**.
- Vides inicials: **3**.
- Col·lisions:
  - Mòbil (`costat1.png`): `-5 punts`.
  - Auriculars (`costat2.png`): `-5 punts`.
  - Peató (`personatge1.png`): `-1 vida`.

## Popups informatius

El joc mostra una finestra modal inicial de controls i una finestra informativa la primera vegada que es col·lisiona amb cada tipus de risc (mòbil, auriculars, peató). Les finestres pausen la partida fins prémer **ENTENDIDO**.

## Final de partida

- **Victòria**: en arribar a 100 punts.
- **Game Over**: en quedar-se sense vides.
