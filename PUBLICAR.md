# Publicar el muelle para jugar con amigos

Cómo abrir el Muelle de Pesca para que tus amigos entren **desde sus casas** (o desde el celular), usando la compu de quien la publica como servidor y **Cloudflare Tunnel** para darle una dirección pública con https, sin abrir puertos del router ni crear cuentas.

```
Compañeros ──https──► Cloudflare ──túnel──► tu compu
                                            ├─ Apache de XAMPP :8084  (la app Laravel)
                                            └─ Reverb :8080           (el WebSocket)
```

> **Puerto 8084:** si en la misma compu ya tenés otro proyecto en el 8081, 8082 u 8083 (por ejemplo el Bosque Medieval o la Arena de Monedas), así no chocan. Si no, podés usar el que quieras: cambialo también en `publicar.sh` (`PUERTO_APP`).
>
> **¿Por qué Apache y no `php artisan serve`?** En Windows, el servidor de `artisan serve` atiende **una petición por vez**. Con varios pescadores tirando y recogiendo la línea a la vez se forma una fila y el juego se siente lento. Apache atiende muchas en paralelo.

---

## Paso 1 — Configurar Apache (se hace una sola vez)

Se le agrega a Apache un sitio en el puerto **8084** que apunta a la carpeta `public` del proyecto.

1. Abrí `C:\xampp\apache\conf\httpd.conf` (desde el panel de XAMPP: Apache → **Config** → `httpd.conf`). Buscá la línea `Listen 80` y agregá debajo:

   ```apache
   Listen 8084
   ```

2. Abrí `C:\xampp\apache\conf\extra\httpd-vhosts.conf` (Apache → Config → … o directo desde el Explorador) y agregá al final:

   ```apache
   <VirtualHost *:8084>
       DocumentRoot "C:/xampp/htdocs/muelle-pesca/public"
       <Directory "C:/xampp/htdocs/muelle-pesca/public">
           AllowOverride All
           Require all granted
       </Directory>
   </VirtualHost>
   ```

   `AllowOverride All` permite que funcione el `.htaccess` de Laravel, que manda todas las URLs (`/muelle`, `/lances`…) a `index.php`.

3. En el panel de XAMPP: **Stop** y **Start** de Apache.

4. Probalo: abrí `http://localhost:8084` en el navegador. Tenés que ver la pantalla de inicio del muelle.

## Paso 2 — Tener cloudflared (una sola vez)

Si no lo tenés, se instala desde PowerShell con:

```powershell
winget install --id Cloudflare.cloudflared
```

## Paso 3 — El día de la clase

1. En el panel de XAMPP: **Apache** y **MySQL** prendidos.
2. **Cerrá `npm run dev`** si lo tenías abierto (Ctrl+C en su terminal): con el túnel se usan los archivos compilados.
3. Abrí Git Bash en la carpeta del proyecto y ejecutá:

   ```bash
   ./publicar.sh
   ```

   El script:
   - revisa que esté todo listo (Apache en 8084, cloudflared, que `npm run dev` esté cerrado);
   - abre **dos túneles**: uno para la app y otro para Reverb;
   - guarda tu `.env` en `.env.desarrollo` y prepara el `.env` para publicar (te lo devuelve al final);
   - compila los assets con `npm run build`;
   - prende Reverb si no estaba corriendo.

4. Cuando termina muestra algo así:

   ```
   ═══════════════════════════════════════════════════════════════
     ¡El muelle está publicado! Compartí esta dirección:

         https://palabras-al-azar.trycloudflare.com
   ═══════════════════════════════════════════════════════════════
   ```

   Esa es la dirección que compartís. Funciona en compus y celulares.

5. Para terminar: **Ctrl+C** en esa terminal. Se cierran los túneles y vuelve tu `.env` de desarrollo.

### Mientras está publicada

- **Dejá la terminal abierta**: si la cerrás, se caen los túneles.
- **Compu enchufada y sin suspensión.** En Windows: Configuración → Sistema → Energía → "Suspender" en **Nunca** mientras dura la clase.
- Apache y MySQL siguen prendidos en XAMPP.
- **Las direcciones cambian cada vez** que corrés `publicar.sh`: son túneles rápidos, sin cuenta. Compartí la nueva cada vez.

---

## Qué cambia en el `.env` (y por qué)

`publicar.sh` hace estos cambios solo y los deshace al cerrar. Si alguna vez lo tenés que hacer a mano:

```env
APP_URL=https://<app>.trycloudflare.com
APP_ENV=production
APP_DEBUG=false

# Laravel le habla a Reverb por adentro de la compu…
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http

# …y el navegador de cada compañero, por el túnel.
VITE_REVERB_HOST=<reverb>.trycloudflare.com
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

Después: `php artisan config:clear` y `npm run build`. Las `VITE_` se "hornean" en el JavaScript al compilar, por eso hay que recompilar cada vez que cambian.

- **`APP_DEBUG=false`**: con `true`, cualquier error le mostraría al visitante rutas, versiones y datos internos. En producción, los errores se leen en `storage/logs/laravel.log`, no en pantalla.
- **`REVERB_*` contra `VITE_REVERB_*`**: Laravel y Reverb están en la misma compu, así que se hablan por `127.0.0.1`, sin túnel. Los navegadores de afuera llegan a Reverb por el segundo túnel, con https en el puerto 443.
- **¿Por qué `127.0.0.1` y no `localhost`?** En Windows, `localhost` prueba primero IPv6 (`::1`). Reverb escucha solo en IPv4, así que cada aviso de Laravel a Reverb (cada mensaje del chat) perdía unos 0,2 s antes de conectarse. Con `127.0.0.1` tarda milésimas.
- **`trustProxies`** (en `bootstrap/app.php`): Cloudflare le pasa los pedidos a Apache por http. Con esta línea, Laravel confía en los encabezados `X-Forwarded-*` y sabe que el pedido original era https; si no, armaría links `http://` que el navegador bloquea.

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `✘ Apache no responde en http://localhost:8084` | Paso 1. Que Apache esté prendido en XAMPP y que `http://localhost:8084` abra el muelle. Si en vez del juego aparece un error de Composer que pide **PHP 8.4**, el PHP de XAMPP es viejo: ver README, sección 1. |
| `✘ Está corriendo 'npm run dev'` | Cerrá esa terminal con Ctrl+C y volvé a correr el script. |
| `✘ Ya existe .env.desarrollo` | Una publicación anterior no se cerró bien. Si `.env.desarrollo` es tu `.env` de siempre: `mv .env.desarrollo .env`. |
| La pantalla de carga dice "No se pudo conectar al servidor de tiempo real" | ¿Sigue abierta la terminal de `publicar.sh`? Mirá `storage/logs/tunel-reverb.log` y `storage/logs/reverb-publicar.log`. |
| Error 500 en la página | Con `APP_DEBUG=false` no se ve el detalle: está en `storage/logs/laravel.log`. |
| Un compañero no puede entrar: "El muelle está lleno (20/20)" | El cupo es de 20 pescadores (`config/pesca.php`). |

## Límites para tener en cuenta

- Los túneles rápidos de Cloudflare son para pruebas y demos: no tienen garantía de disponibilidad y aceptan un número limitado de pedidos simultáneos (unos 200). Para una clase alcanzan de sobra.
- Todo corre en **tu** compu: si se apaga, se suspende o se queda sin internet, el muelle se cae para todos.
