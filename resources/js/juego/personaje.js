// Un personaje en el mapa: el propio y los remotos (los demás jugadores).
// Se mueve de a una celda: (x, y) es la celda destino y durante PASO_MS se interpola
// desde la celda anterior para que el movimiento se vea suave.

import { ESCALA_SPRITE, PASO_MS, SPRITE_H, TILE } from './config.js';
import { apariencia, dibujarSombra, dibujarSprite, obtenerSprites } from './sprites.js';
import { Globo } from './ui/globo.js';

const ALTO_SPRITE = SPRITE_H * ESCALA_SPRITE; // 56
export const SOBRESALE = ALTO_SPRITE - TILE; // la cabeza sobresale 24 px hacia la celda de arriba

const DELTAS = {
    arriba: [0, -1],
    abajo: [0, 1],
    izquierda: [-1, 0],
    derecha: [1, 0],
};

export function delta(dir) {
    return DELTAS[dir];
}

const ALTO_ETIQUETA = 11;

/**
 * Nombre con contorno negro en fuente pixel, centrado en cx, apoyado sobre `abajo`.
 * `ocupados`: rectángulos de los nombres (y globos) ya dibujados en este frame. Si este
 * choca con alguno (dos jugadores pegados), sube hasta quedar libre: "Beto" queda arriba de
 * "Fede" en vez de "FedeBeto". `extraArriba`: lugar que reserva arriba (ej. el triangulito).
 * Devuelve dónde quedó apoyado, para dibujar lo que va encima del nombre.
 */
export function dibujarEtiqueta(ctx, texto, cx, abajo, color = '#ffffff', ocupados = [], extraArriba = 0) {
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const w = Math.ceil(ctx.measureText(texto).width) + 4;
    const x = cx - w / 2;
    const choca = (r, base) => x < r.x + r.w && x + w > r.x && base - ALTO_ETIQUETA - extraArriba < r.y + r.h && base > r.y;
    for (let intento = 0; intento < 12; intento++) {
        const otro = ocupados.find((r) => choca(r, abajo));
        if (!otro) break;
        abajo = otro.y - 1;
    }
    ocupados.push({ x, y: abajo - ALTO_ETIQUETA - extraArriba, w, h: ALTO_ETIQUETA + extraArriba });
    const y = Math.round(abajo - 2);
    ctx.fillStyle = '#000000';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) {
        ctx.fillText(texto, cx + dx, y + dy);
    }
    ctx.fillStyle = color;
    ctx.fillText(texto, cx, y);
    return abajo;
}

export class Personaje {
    constructor({ id, nombre, genero, color, x, y, dir }) {
        this.id = id;
        this.nombre = nombre;
        this.genero = genero;
        this.color = color;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.desdeX = x;
        this.desdeY = y;
        this.progreso = 1; // 1 = quieto en la celda
        this.pasos = 0;
        this.cola = []; // pasos pendientes de un jugador remoto (llegan por whisper)
        this.opacidad = 1;
        this.saliendo = false;
        this.globo = null;
        this.hoja = obtenerSprites({ genero, color, ...apariencia(id) });
        this.linea = null; // la caña: { bx, by, estado: 'esperando' | 'pica' } (ver pesca.js)
    }

    get moviendo() {
        return this.progreso < 1;
    }

    // Posición dibujada (en celdas, con decimales mientras camina).
    get px() { return this.desdeX + (this.x - this.desdeX) * this.progreso; }
    get py() { return this.desdeY + (this.y - this.desdeY) * this.progreso; }

    /** Empieza un paso hacia la celda (nx, ny). */
    pasoA(nx, ny, dir) {
        this.desdeX = this.x;
        this.desdeY = this.y;
        this.x = nx;
        this.y = ny;
        this.dir = dir;
        this.progreso = 0;
        this.pasos++;
    }

    /** Muestra un globo de texto sobre la cabeza (reemplaza al anterior). */
    decir(texto) {
        this.globo = new Globo(texto);
    }

    /** El globo va arriba del nombre (y del triangulito si es el propio), donde haya quedado. */
    dibujarGlobo(ctx, esPropio = false, ocupados = []) {
        if (!this.globo?.vivo) {
            this.globo = null;
            return;
        }
        const cx = Math.round(this.px * TILE + TILE / 2);
        const arriba = this.baseEtiqueta ?? Math.round(this.py * TILE - SOBRESALE);
        this.globo.dibujar(ctx, cx, arriba - (esPropio ? 18 : 12), ocupados);
    }

    /** Lo pone directo en una celda, sin animar (posición inicial, reconexión o lag). */
    teletransportar(x, y, dir) {
        this.x = this.desdeX = x;
        this.y = this.desdeY = y;
        this.dir = dir;
        this.progreso = 1;
        this.cola = [];
    }

    /**
     * Para jugadores remotos: llegó un whisper "mover". Si está a más de 2 celdas de donde
     * lo tenemos (lag o reconexión), lo teletransportamos; si no, encolamos el paso.
     */
    moverRemoto(x, y, dir) {
        const ultimo = this.cola.at(-1) ?? this;
        const distancia = Math.abs(x - ultimo.x) + Math.abs(y - ultimo.y);
        if (distancia > 2) {
            this.teletransportar(x, y, dir);
        } else {
            this.cola.push({ x, y, dir });
        }
    }

    /** Fade out al salir del muelle. Devuelve una promesa que termina cuando ya no se ve. */
    desvanecer(ms = 400) {
        this.saliendo = true;
        return new Promise((resolve) => {
            const inicio = performance.now();
            const paso = (t) => {
                this.opacidad = Math.max(0, 1 - (t - inicio) / ms);
                if (this.opacidad > 0) requestAnimationFrame(paso);
                else resolve();
            };
            requestAnimationFrame(paso);
        });
    }

    /** Avance de un remoto: consume la cola de pasos (más rápido si se acumularon). */
    actualizarRemoto(dt) {
        const velocidad = 1 + Math.max(0, this.cola.length - 1) * 0.5;
        let sobra = this.actualizar(dt * velocidad);
        while (!this.moviendo && this.cola.length) {
            const { x, y, dir } = this.cola.shift();
            if (x === this.x && y === this.y) {
                this.dir = dir; // solo giró
                continue;
            }
            this.pasoA(x, y, dir);
            sobra = this.actualizar(sobra);
        }
    }

    /**
     * Avanza la animación `dt` ms. Devuelve los ms que "sobraron" al terminar el paso,
     * para encadenar el siguiente sin un frame de pausa (si no, caminar se ve a los saltos).
     */
    actualizar(dt) {
        if (!this.moviendo) return 0;
        this.progreso += dt / PASO_MS;
        if (this.progreso < 1) return 0;
        const sobra = (this.progreso - 1) * PASO_MS;
        this.progreso = 1;
        return sobra;
    }

    frame() {
        if (!this.moviendo) return 0;
        // Primera mitad del paso: pie adelantado (alterna A/B en cada paso). Segunda mitad: quieto.
        if (this.progreso < 0.5) return this.pasos % 2 ? 1 : 2;
        return 0;
    }

    /** `alfa`: para dibujarte "fantasma" cuando quedás detrás de un árbol. */
    dibujar(ctx, alfa = 1, conSombra = true) {
        ctx.globalAlpha = this.opacidad * alfa;
        const sx = Math.round(this.px * TILE);
        const sy = Math.round(this.py * TILE);
        if (conSombra) dibujarSombra(ctx, sx + TILE / 2, sy + TILE, ESCALA_SPRITE);
        dibujarSprite(ctx, this.hoja, this.dir, this.frame(), sx, sy - SOBRESALE);
        ctx.globalAlpha = 1;
    }

    /** Devuelve dónde quedó el nombre (si chocaba con otro, más arriba). */
    dibujarNombre(ctx, t, esPropio = false, ocupados = []) {
        const cx = Math.round(this.px * TILE + TILE / 2);
        ctx.globalAlpha = this.opacidad;
        const arriba = dibujarEtiqueta(ctx, this.nombre, cx, Math.round(this.py * TILE - SOBRESALE),
            esPropio ? '#ffe9a8' : '#ffffff', ocupados, esPropio ? 7 : 0);
        this.baseEtiqueta = arriba;

        if (esPropio) {
            // Triangulito que flota arriba del nombre para ubicarte entre la gente.
            const y = arriba - 16 + Math.round(Math.sin(t / 250) * 1.5);
            ctx.fillStyle = '#000000';
            ctx.fillRect(cx - 4, y - 1, 9, 2);
            ctx.fillStyle = '#ffe9a8';
            for (let i = 0; i < 4; i++) ctx.fillRect(cx - 3 + i, y + i, 7 - 2 * i, 1);
        }
        ctx.globalAlpha = 1;
    }
}
