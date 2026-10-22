// La pesca del lado del navegador.
//
// Pesca: TU caña, con estas fases:
//   libre ──E──► lanzando (POST /lances) ──► esperando ──(llega muerde_en)──► pica ──E──► recogiendo (POST /lances/{id}/recoger)
//                                                  └──────────────E (antes de tiempo)──────────┘        └─ si no apretás, se recoge sola (se escapó)
// El SERVIDOR decide qué pez pica y cuándo: el navegador solo sabe el "cuándo" (para mover la
// boya) y se entera del pez recién al recogerla. Si apretás E fuera de la ventana, el servidor
// dice "temprano" o "escapó" y no suma nada (aunque alguien toque este código).
//
// Además dibuja lo que se ve de la pesca de todos: cañas, líneas, boyas, peces saltando y "+50".
// Las cañas de los demás llegan por whisper 'linea' (es solo decorado: los puntos los da el servidor).

import { TILE } from './config.js';
import { delta, dibujarEtiqueta, SOBRESALE } from './personaje.js';
import { dibujarPez } from './peces.js';
import { audio } from './audio.js';

const VUELO_MS = 450; // lo que tarda la boya en caer al agua
const SALTO_MS = 750; // lo que tarda el pez en volar hasta el pescador
const TEXTO_MS = 1400; // "+25" flotando
const AGUA_PARA_BOYA = new Set(['agua', 'honda']);

/** Celda donde cae la boya: hasta 3 celdas adelante, mientras siga habiendo agua. */
export function celdaDeLaBoya(mapa, x, y, dir) {
    const [dx, dy] = delta(dir);
    let boya = { x: x + dx, y: y + dy };
    for (let paso = 2; paso <= 3; paso++) {
        const cx = x + dx * paso, cy = y + dy * paso;
        if (!AGUA_PARA_BOYA.has(mapa.tipo(cx, cy))) break;
        boya = { x: cx, y: cy };
    }
    return boya;
}

/** Punta de la caña (en px) según hacia dónde mira el pescador. */
function puntaDeLaCana(p) {
    const cx = Math.round(p.px * TILE + TILE / 2);
    const sy = Math.round(p.py * TILE);
    const mano = { abajo: [8, 6], arriba: [-8, 6], derecha: [6, 8], izquierda: [-6, 8] }[p.dir];
    const punta = { abajo: [22, 44], arriba: [-12, -30], derecha: [32, -16], izquierda: [-32, -16] }[p.dir];
    return { mano: { x: cx + mano[0], y: sy + mano[1] }, punta: { x: cx + punta[0], y: sy + punta[1] } };
}

/** Línea "pixelada": cuadraditos de 2×2 a lo largo de una curva (bezier cuadrática). */
function curvaPixelada(ctx, a, control, b, color, grosor = 2) {
    const largo = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(control.x - a.x, control.y - a.y);
    const pasos = Math.max(4, Math.ceil(largo / Math.max(1, grosor)));
    ctx.fillStyle = color;
    for (let i = 0; i <= pasos; i++) {
        const t = i / pasos;
        const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t ** 2 * b.x;
        const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t ** 2 * b.y;
        ctx.fillRect(Math.round(x - grosor / 2), Math.round(y - grosor / 2), grosor, grosor);
    }
}

/**
 * Dibuja la caña de un personaje (si la tiene en el agua): caña, línea y boya.
 * p.linea = { bx, by (celda), estado: 'esperando' | 'pica', desde (performance.now del lance) }
 */
export function dibujarCana(ctx, p, t) {
    const linea = p.linea;
    if (!linea) return;
    const { mano, punta } = puntaDeLaCana(p);
    ctx.globalAlpha = p.opacidad;

    // La caña: marrón, más finita en la punta.
    curvaPixelada(ctx, mano, { x: (mano.x + punta.x) / 2, y: (mano.y + punta.y) / 2 - (linea.estado === 'pica' ? 6 : 2) }, punta, '#5e3d22', 2);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(punta.x - 1, punta.y - 1, 2, 2);

    // La boya: vuela desde la punta hasta el agua y después flota.
    const destino = { x: linea.bx * TILE + TILE / 2, y: linea.by * TILE + TILE / 2 + 4 };
    const vuelo = Math.min(1, (t - linea.desde) / VUELO_MS);
    let boya;
    if (vuelo < 1) {
        boya = {
            x: punta.x + (destino.x - punta.x) * vuelo,
            y: punta.y + (destino.y - punta.y) * vuelo - Math.sin(vuelo * Math.PI) * 30,
        };
    } else {
        const pica = linea.estado === 'pica';
        // Flotando sube y baja suave; cuando pica, se hunde a los tirones.
        const meneo = pica ? 3 + Math.round(Math.abs(Math.sin(t / 60)) * 3) : Math.round(Math.sin(t / 400) * 1.5);
        boya = { x: destino.x, y: destino.y + meneo };
        if (!linea.salpico) {
            linea.salpico = true;
            linea.ondaDesde = t;
        }
        // Ondas que se abren alrededor de la boya (al caer y mientras pica).
        const desdeOnda = pica ? t - ((t - linea.desde) % 500) : linea.ondaDesde;
        const onda = (t - desdeOnda) / 600;
        if (onda < 1) {
            ctx.fillStyle = `rgba(215, 240, 242, ${1 - onda})`;
            const r = 4 + onda * 12;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                ctx.fillRect(Math.round(destino.x + Math.cos(a) * r), Math.round(destino.y + 6 + Math.sin(a) * r * 0.45), 2, 2);
            }
        }
    }

    // La línea: cuelga floja mientras espera, tensa cuando pica.
    const tensa = linea.estado === 'pica' || vuelo < 1;
    const control = { x: (punta.x + boya.x) / 2, y: Math.max(punta.y, boya.y) + (tensa ? 0 : 14) };
    curvaPixelada(ctx, punta, control, boya, 'rgba(240, 240, 240, 0.75)', 1);

    // Boya roja y blanca (cuando pica, se ve solo la mitad de arriba: está hundida).
    const hundida = linea.estado === 'pica' && vuelo >= 1;
    ctx.fillStyle = '#21170f';
    ctx.fillRect(Math.round(boya.x) - 4, Math.round(boya.y) - 6, 8, hundida ? 5 : 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(boya.x) - 3, Math.round(boya.y) - 5, 6, 3);
    if (!hundida) {
        ctx.fillStyle = '#e0412b';
        ctx.fillRect(Math.round(boya.x) - 3, Math.round(boya.y) - 2, 6, 5);
    }
    ctx.globalAlpha = 1;
}

/** Peces saltando del agua al pescador y textos "+25" flotando. */
export class Efectos {
    constructor() {
        this.lista = [];
    }

    /** Un pez sale del agua (desde la boya de `p`) y vuela hasta `p`. */
    pezSaltando(p, slug, texto, color) {
        const desde = p.linea
            ? { x: p.linea.bx * TILE + TILE / 2, y: p.linea.by * TILE + TILE / 2 }
            : { x: p.px * TILE + TILE / 2, y: p.py * TILE + TILE * 1.5 };
        this.lista.push({ tipo: 'pez', slug, desde, p, inicio: performance.now(), texto, color });
    }

    /** Salpicadura (un pez que se escapó o una línea que se recoge vacía). */
    salpicadura(x, y) {
        this.lista.push({ tipo: 'gotas', x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, inicio: performance.now() });
    }

    texto(p, texto, color) {
        this.lista.push({ tipo: 'texto', p, texto, color, inicio: performance.now() });
    }

    dibujar(ctx, t) {
        this.lista = this.lista.filter((e) => {
            const pasado = t - e.inicio;
            if (e.tipo === 'pez') {
                const k = Math.min(1, pasado / SALTO_MS);
                const hasta = { x: e.p.px * TILE + TILE / 2, y: e.p.py * TILE - SOBRESALE / 2 };
                const x = e.desde.x + (hasta.x - e.desde.x) * k;
                const y = e.desde.y + (hasta.y - e.desde.y) * k - Math.sin(k * Math.PI) * 48;
                // Gira mientras vuela, como si coleteara.
                dibujarPez(ctx, e.slug, x, y, { angulo: Math.sin(pasado / 60) * 0.5, espejado: hasta.x < e.desde.x });
                if (k < 0.3) this.dibujarGotas(ctx, e.desde.x, e.desde.y, pasado);
                if (k >= 1) {
                    this.texto(e.p, e.texto, e.color);
                    return false;
                }
                return true;
            }
            if (e.tipo === 'gotas') {
                this.dibujarGotas(ctx, e.x, e.y, pasado);
                return pasado < 500;
            }
            // Texto que sube y se desvanece sobre la cabeza.
            const k = pasado / TEXTO_MS;
            ctx.globalAlpha = Math.max(0, 1 - k * k);
            dibujarEtiqueta(ctx, e.texto, Math.round(e.p.px * TILE + TILE / 2), Math.round(e.p.py * TILE - SOBRESALE - 14 - k * 22), e.color);
            ctx.globalAlpha = 1;
            return k < 1;
        });
    }

    dibujarGotas(ctx, x, y, pasado) {
        const k = pasado / 500;
        if (k >= 1) return;
        ctx.fillStyle = `rgba(215, 240, 242, ${1 - k})`;
        for (let i = 0; i < 8; i++) {
            const a = -Math.PI * (0.1 + 0.8 * (i / 7));
            const v = 18 + (i % 3) * 6;
            ctx.fillRect(Math.round(x + Math.cos(a) * v * k), Math.round(y + Math.sin(a) * v * k + 40 * k * k), 2, 2);
        }
    }
}

/** Error de un pedido HTTP con el mensaje que mandó Laravel. */
class ErrorPedido extends Error {
    constructor(mensaje, estado) {
        super(mensaje);
        this.estado = estado;
    }
}

async function pedir(url, token, socketId, cuerpo) {
    const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': token,
            ...(socketId ? { 'X-Socket-ID': socketId } : {}),
        },
        body: JSON.stringify(cuerpo ?? {}),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        const mensaje = respuesta.status === 429 && !datos.message?.includes('Esperá')
            ? 'Demasiados intentos: esperá un ratito.'
            : (datos.message ?? `Error ${respuesta.status}`);
        throw new ErrorPedido(mensaje, respuesta.status);
    }
    return datos.data;
}

/** Tu caña: las fases de arriba y los dos pedidos al servidor. */
export class Pesca {
    constructor({ url, token, red, mapa, yo, efectos, alAvisar, alPescar }) {
        this.url = url; // .../lances
        this.token = token;
        this.red = red;
        this.mapa = mapa;
        this.yo = yo;
        this.efectos = efectos;
        this.alAvisar = alAvisar; // (texto, tipo) → toast
        this.alPescar = alPescar; // (datos de recoger) → actualizar puntos
        this.estado = 'libre';
        this.lance = null; // { id, muerde, hasta } en hora LOCAL (Date.now)
    }

    get ocupado() {
        return this.estado !== 'libre';
    }

    /** E / Espacio / 🎣: tira la línea o la recoge, según la fase. */
    accion() {
        if (this.estado === 'libre') this.lanzar();
        else if (this.estado === 'esperando' || this.estado === 'pica') this.recoger();
    }

    /** ¿Estoy mirando al agua desde un lugar donde se puede pescar? */
    puedeLanzar() {
        return !this.yo.moviendo && this.mapa.zonaDePesca(this.yo.x, this.yo.y, this.yo.dir) !== null;
    }

    async lanzar() {
        const { x, y, dir } = this.yo;
        if (this.yo.moviendo) return;
        if (!this.mapa.zonaDePesca(x, y, dir)) {
            this.alAvisar('Parate en el borde, mirando al agua, para tirar la línea.');
            return;
        }
        this.estado = 'lanzando';
        const boya = celdaDeLaBoya(this.mapa, x, y, dir);
        this.yo.linea = { bx: boya.x, by: boya.y, estado: 'esperando', desde: performance.now() };
        this.red.susurrar('linea', { estado: 'lanza', x, y, dir });
        audio.lanzar();

        try {
            const datos = await pedir(this.url, this.token, this.red.socketId(), { x, y, dir });
            // El reloj de esta compu puede no coincidir con el del servidor: convertimos su hora a la nuestra.
            const diferencia = datos.ahora - Date.now();
            this.lance = { id: datos.id, muerde: datos.muerde_en - diferencia, hasta: datos.muerde_en - diferencia + datos.ventana_ms };
            this.estado = 'esperando';
        } catch (error) {
            this.soltar();
            this.alAvisar(error.message, 'error');
        }
    }

    async recoger() {
        if (!this.lance) return;
        const lance = this.lance;
        this.estado = 'recogiendo';
        this.red.susurrar('linea', { estado: 'recoge', ...this.posicion() });
        try {
            const datos = await pedir(`${this.url}/${lance.id}/recoger`, this.token, this.red.socketId());
            if (datos.capturado) {
                const grande = datos.pez.puntos >= 25;
                this.efectos.pezSaltando(this.yo, datos.pez.slug, `+${datos.puntos}`, '#ffe9a8');
                audio.efecto(grande ? 'pezGrande' : 'pez');
                this.alAvisar(`¡Sacaste ${datos.pez.slug === 'pirana' ? 'una' : 'un'} ${datos.pez.nombre}! +${datos.puntos} puntos`);
                this.alPescar(datos);
            } else {
                if (this.yo.linea) this.efectos.salpicadura(this.yo.linea.bx, this.yo.linea.by);
                audio.efecto('escapo');
                this.alAvisar(datos.motivo === 'temprano'
                    ? 'Recogiste antes de tiempo: el pez se asustó. Esperá a que se hunda la boya.'
                    : '¡Se escapó! Cuando aparece "¡PICA!", apretá enseguida.');
            }
        } catch (error) {
            this.alAvisar(error.message, 'error');
        }
        this.soltar();
    }

    posicion() {
        const { x, y, dir } = this.yo;
        return { x, y, dir };
    }

    /** Vuelve a "libre" y les avisa a los demás que ya no hay caña. */
    soltar() {
        this.estado = 'libre';
        this.lance = null;
        this.yo.linea = null;
        this.red.susurrar('linea', { estado: 'quita', ...this.posicion() });
    }

    /** En cada frame: ¿ya picó? ¿se pasó la ventana? */
    actualizar() {
        if (!this.lance) return;
        const ahora = Date.now();
        if (this.estado === 'esperando' && ahora >= this.lance.muerde) {
            this.estado = 'pica';
            if (this.yo.linea) this.yo.linea.estado = 'pica';
            audio.efecto('pica');
            this.red.susurrar('linea', { estado: 'pica', ...this.posicion() });
        } else if (this.estado === 'pica' && ahora > this.lance.hasta + 150) {
            // No apretaste a tiempo: se la pedimos igual al servidor para que la cierre (dice "escapó").
            this.recoger();
        }
    }

    /** Texto de ayuda de abajo según la fase (null = nada). */
    pista(tactil) {
        const tecla = tactil ? '🎣' : 'E';
        if (this.estado === 'pica') return { texto: `¡PICA! Apretá ${tecla}`, urgente: true };
        if (this.estado === 'esperando') return { texto: `Esperá que se hunda la boya… (${tecla} recoge)` };
        if (this.estado === 'libre' && this.puedeLanzar()) {
            const zona = this.mapa.zonaDePesca(this.yo.x, this.yo.y, this.yo.dir);
            return { texto: `${tecla}: tirar la línea ${zona === 'honda' ? '(agua honda: peces grandes)' : '(orilla)'}` };
        }
        return null;
    }
}
