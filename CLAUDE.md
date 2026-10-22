# Muelle de Pesca — TUP UTN · Programación IV

> **Para Claude Code:** este archivo describe el proyecto completo. Leelo entero antes de tocar código.
> El usuario es estudiante y lo tiene que defender: explicá brevemente lo que hacés y por qué, en español rioplatense.
> Trabajá **de a un cambio por vez**: hacelo, probalo, decile al usuario cómo verificarlo y frená hasta que confirme.
> **No ejecutes `php artisan boost:install`**: sobrescribe este archivo.
> **Procesos del usuario:** para tus pruebas usá otros puertos (ej. 8001 y 8090) y **nunca cierres** los `serve`, `reverb:start` o `vite` del usuario, ni procesos de VS Code.
> **MySQL de XAMPP:** no lo prendas ni lo apagues. Si necesitás la base y está apagada, pedile al usuario que la prenda.
> **Datos del usuario:** nunca borres, truncates ni vacíes tablas de `muelle_pesca` (ni corras `migrate:fresh` sobre ella) sin preguntar. Para pruebas usá `muelle_pesca_test`.
> **Antes de cerrar cada cambio:** `php artisan test` (SQLite), `composer test:mysql` (MySQL) y `php artisan pint`.
> **No agregues funcionalidades que no se pidieron** (tienda, cañas mejorables, inventario, combate…): el proyecto es chico a propósito para poder defenderlo.

---

## 1. Qué es

Un juego multijugador en tiempo real, en pixel art. Hasta **20 pescadores** entran con su nombre, eligen **pescador o pescadora** y el **color de la campera**, caminan por una playa y un muelle (26×16 celdas) y pescan en el río.

- **Piraña 5 · Bagre 10 · Dorado 25 · Surubí 50** puntos. En la **orilla** (agua clara, desde la playa o el comienzo del muelle) salen sobre todo pirañas y bagres; en lo **hondo** (agua oscura, la punta del muelle) hay más dorados y surubíes.
- Pescar: mirando al agua, **E / Espacio** tira la línea → la boya flota → cuando se hunde aparece **¡PICA!** → **E** otra vez dentro de 1,5 s. Antes: se asusta. Después: se escapa.
- **Ranking** en vivo (top 10, con cuántos peces de cada tipo sacó cada uno) y tus puntos.
- Chat con globos sobre la cabeza. Se ven las cañas y los peces de los demás.

## 2. Entorno

- **Windows + XAMPP** (MySQL/MariaDB, PHP **8.4 o más**) + Git Bash + VS Code. Proyecto en `C:\xampp\htdocs\muelle-pesca`.
- **Laravel 13**, `laravel/reverb ^1`, `laravel-echo ^2`, `pusher-js ^8`, **Vite 8**, **Tailwind 4**, PHPUnit 12. Fuentes por npm (`@fontsource/*`).
- Base: **MySQL** `muelle_pesca`. Tests: SQLite en memoria y MySQL `muelle_pesca_test`.
- Para desarrollar: `php artisan serve`, `php artisan reverb:start` y `npm run dev`.

## 3. Arquitectura

```
Navegador ──HTTP: entrar, tirar la línea, recogerla, ranking, chat──► Laravel (el ÁRBITRO)
    ▲                                                                    │ eventos ShouldBroadcast
    │ WebSocket (Echo)                                                   ▼
    └───────────────────────────────────────────────────── Reverb :8080 ◄┘
          canal de PRESENCIA "muelle"
          • here / joining / leaving     → quién está (cupo 20)
          • whisper 'mover' / 'estoy'    → los pasos (directo, sin Laravel)
          • whisper 'linea'              → la caña de los demás: lanza / pica / quita (solo decorado)
          • .PezCapturado                → quién sacó qué pez, su total y el ranking nuevo (va a TODOS)
          • .MensajeEnviado              → chat
```

**Decisión clave (para la defensa):** el movimiento y la caña de los demás van por whisper (rápido, sin validar), pero **los puntos los decide el servidor**:
- `POST /lances` (`PescaService::lanzar`): valida que estés en un lugar caminable **mirando a agua** (`MuelleService::zonaDePesca`), **sortea el pez** según las chances de la zona y el **momento del pique** (1,5 a 5 s). Guarda todo en `lances` y al navegador le devuelve solo `muerde_en` (nunca el pez).
- `POST /lances/{id}/recoger` (`PescaService::recoger`): con la hora del servidor decide **temprano / capturado / escapó** (ventana de 1,5 s). Si capturó, `increment('puntos')` y emite `PezCapturado` con el ranking.
- **Concurrencia:** `DB::transaction` + `lockForUpdate()` sobre el usuario al tirar (una línea a la vez → 409) y sobre el lance al recoger (doble clic → 409). Línea ajena → 403. Menos de 0,8 s entre lances → 429.
- **El tiempo es el del servidor:** cada respuesta trae `ahora` (ms) y el navegador corrige la diferencia (`pesca.js`).
- **Milisegundos:** columnas `timestamp(3)` y `$dateFormat = 'Y-m-d H:i:s.v'` en `Lance` (si no, Laravel guarda segundos enteros y la ventana no se puede controlar).

## 4. Backend

| Método | URL | Qué hace |
|---|---|---|
| GET | `/` | Inicio: nombre + pescador/pescadora + color (guest). |
| POST | `/entrar` | Crea el `User` en un lugar al azar de la playa y lo loguea. |
| GET | `/muelle` | Vista del juego (`window.MUELLE`: jugador, cupo, canal, peces, URLs). |
| POST | `/lances` | `{x, y, dir}` → 201 `{id, zona, muerde_en, ventana_ms, ahora}` · 422 (no mira al agua) · 409 · 429. |
| POST | `/lances/{lance}/recoger` | 200 `{capturado, motivo, pez, puntos, total}` · 403 · 409. |
| GET | `/ranking` | Top 10 con puntos > 0 y cuántos peces de cada tipo. |
| GET/POST | `/chat` | Historial y envío (10 por minuto). |

- **Capas:** controladores flacos (`LanceController`) → `PescaService` (reglas) → modelos (`Lance`, `User`). `MuelleService` lee el mapa.
- **Errores del juego:** `JuegoException` (mensaje + código HTTP) se convierte sola en JSON.
- **Tablas:** `users` (genero string(10), color, x, y, dir string(9), puntos), `lances` (user_id, x, y, dir, zona, pez, lanzado_en / muerde_en / recogido_en `timestamp(3)`, resultado, puntos), `mensajes`.
- `config/pesca.php`: cupo, canal, tiempos del pique, ventana, espera entre lances, **peces (puntos y chances por zona)**, géneros y paleta.

## 5. Frontend (`resources/js/juego/`)

| Archivo | Qué hace |
|---|---|
| `main.js` | Carga, bucle, pantalla (el muelle entero a ×1, ×1,5, ×2… o cámara en celulares), y une todo: caminar, E para pescar, ranking, `PezCapturado`. |
| `pesca.js` | `Pesca`: tu caña (libre → lanzando → esperando → pica → recogiendo) y los dos POST. `dibujarCana`: caña, línea y boya de cualquiera. `Efectos`: pez saltando, "+25", salpicaduras. |
| `peces.js` | Los 4 peces en pixel art (matrices). |
| `ui/ranking.js` | Panel del ranking, tus puntos y la tabla de puntos por pez. |
| `red.js` | Echo: canal de presencia, whispers (`mover`, `estoy`, `linea`), `.listen('.PezCapturado')`, `.MensajeEnviado`. Guarda lo que llega durante la pantalla de carga. |
| `mapa.js`, `data/muelle.json` | Mapa, colisiones y `zonaDePesca` (el mismo JSON lo lee PHP). |
| `mapa-dibujo.js` | Pasto, playa, río (orilla y hondo), tablas del muelle, juncos, bote, cartel, árboles… todo por código. |
| `sprites.js`, `personaje.js`, `multijugador.js` | Pescador / pescadora y los demás jugadores. |
| `ui/*` | HUD, chat, paneles, controles táctiles (d-pad + 🎣 + 💬). |

### Mapa (`data/muelle.json`, 26×16)
`.` pasto · `,` flores · `a` playa · `=` muelle (caminables) — `~` agua de orilla (`pesca: orilla`) · `%` agua honda (`pesca: honda`) · `J` juncos · `B` bote · `T` árbol · `A` arbusto · `R` roca · `C` cartel (no caminables). Se pesca parado en algo caminable mirando a una celda con `pesca`. Si lo editás: filas del mismo largo, todo con leyenda, la posición por defecto (12, 4) caminable, las dos zonas pescables y todo alcanzable desde la playa (`MapaTest`).

## 6. Calidad

- `php artisan test`: entrar y validar, canal de presencia, chat, mapa, config y **pesca** (`PescaTest`: el pez no se revela al tirar, desde dónde se puede pescar, temprano / a tiempo / tarde, no recoger dos veces ni la línea de otro, una línea a la vez, espera entre lances, ranking y chances de lo hondo).
- `composer test:mysql` y `php artisan pint` antes de cerrar cada cambio.
- Probar con **2 o 3 ventanas** (una normal y las otras de incógnito).

## 7. Errores que ya sabemos que aparecen

1. Columnas cortas o sin milisegundos: solo fallan en MySQL (por eso `test:mysql`).
2. `REVERB_HOST=127.0.0.1`, no `localhost`.
3. Con `broadcastAs()`, en Echo se escucha con punto: `.listen('.PezCapturado')`.
4. Después de tocar el `.env`: reiniciar `npm run dev` y `php artisan config:clear`.
5. *"Composer detected issues in your platform… PHP >= 8.4.1"*: el PHP de XAMPP es viejo (README, sección 1).
6. Para jugar con otros desde sus casas: Apache (puerto 8084) + Cloudflare Tunnel (`PUBLICAR.md`, `./publicar.sh`).
