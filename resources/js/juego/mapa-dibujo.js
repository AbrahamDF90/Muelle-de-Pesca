// El muelle dibujado por código, en pixel art (cada píxel "lógico" mide 2×2 px, igual que los
// personajes). Hay dos cosas:
//   1) el SUELO: un canvas grande con pasto, arena, el río y las tablas del muelle. Se dibuja UNA vez.
//   2) los OBJETOS (árboles, arbustos, rocas, juncos, el bote y el cartel): cada uno es un sprite
//      chico que se dibuja en cada frame ORDENADO POR FILA junto con los jugadores.
//      Así, si caminás por detrás de un árbol, la copa te tapa; si pasás por delante, no.

import { TILE } from './config.js';
import { aleatorio, crearCanvas, mezclar, Pincel } from './pixel.js';

const E = 2; // escala: px reales por píxel lógico
const L = TILE / E; // 16 píxeles lógicos por celda

/** Semilla estable por celda: el mismo muelle en todas las computadoras. */
const semilla = (x, y, sal = 0) => (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(sal + 1, 83492791)) >>> 0;

const PASTO = { a: '#5c9e3e', b: '#579638', oscuro: '#467f2e', claro: '#6fb24c', hoja: '#3d7428', punta: '#80c25a' };
const COLOR_ARENA = { base: '#e6d29a', b: '#dcc48a', oscuro: '#c9ad70', claro: '#f3e4b8', mojada: '#b39a63', concha: '#fff6e8' };
// El río: verde agua cerca de la costa, más oscuro y azul en lo hondo.
const AGUA = { base: '#3f93a8', b: '#3a8a9f', ola: '#73bfcf', espuma: '#d7f0f2' };
const HONDA = { base: '#22628a', b: '#1f5a80', ola: '#4f8fb8' };
const MADERA = { a: '#b07d48', b: '#a2703f', junta: '#5e3f22', viga: '#6b4426', clavo: '#3a2614', poste: '#4a2f1a' };

const ES_AGUA = new Set(['agua', 'honda', 'junco', 'bote']);
const esAgua = (tipo) => ES_AGUA.has(tipo);

// ───────────── Suelo, celda por celda ─────────────

/** Ruido suave (sin bordes de celda) para que el pasto tenga manchas grandes y naturales. */
const manchas = (x, y) => Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2) + Math.sin(y * 0.13 + Math.sin(x * 0.05) * 2);

function pasto(p, ox, oy, r) {
    // De a bloques de 4×4 píxeles: el color sale del ruido en coordenadas del MAPA, no de la celda.
    for (let by = 0; by < L; by += 4) {
        for (let bx = 0; bx < L; bx += 4) {
            p.rect(ox + bx, oy + by, 4, 4, manchas(ox + bx, oy + by) > 0.4 ? PASTO.b : PASTO.a);
        }
    }
    for (let i = 0; i < 12; i++) {
        p.rect(ox + Math.floor(r() * L), oy + Math.floor(r() * L), 1, 1, r() < 0.5 ? PASTO.oscuro : PASTO.claro);
    }
    // Matitas: dos pixeles oscuros con la punta clara.
    for (let i = 0; i < 3; i++) {
        const x = ox + 1 + Math.floor(r() * (L - 2)), y = oy + 2 + Math.floor(r() * (L - 3));
        p.rect(x, y, 1, 2, PASTO.hoja);
        p.rect(x + 1, y + 1, 1, 1, PASTO.hoja);
        p.rect(x, y - 1, 1, 1, PASTO.punta);
    }
}

const COLORES_FLOR = ['#f4f1e6', '#f29bc1', '#8fb8f0', '#e05a4f', '#c39bf0'];

function flores(p, ox, oy, r) {
    pasto(p, ox, oy, r);
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
        const x = ox + 2 + Math.floor(r() * (L - 4)), y = oy + 2 + Math.floor(r() * (L - 4));
        const color = COLORES_FLOR[Math.floor(r() * COLORES_FLOR.length)];
        p.rect(x, y + 2, 1, 1, PASTO.hoja);
        p.rect(x - 1, y, 1, 1, color); p.rect(x + 1, y, 1, 1, color);
        p.rect(x, y - 1, 1, 1, color); p.rect(x, y + 1, 1, 1, color);
        p.rect(x, y, 1, 1, '#f7d64a');
    }
}

/** Bordes irregulares de pasto sobre un suelo de tierra o piedra (los lados donde hay pasto). */
function bordesDePasto(p, ox, oy, r, lados) {
    for (let i = 0; i < L; i++) {
        const prof = () => 1 + Math.floor(r() * 3);
        if (lados.arriba) p.rect(ox + i, oy, 1, prof(), PASTO.a);
        if (lados.abajo) { const d = prof(); p.rect(ox + i, oy + L - d, 1, d, PASTO.b); }
        if (lados.izquierda) p.rect(ox, oy + i, prof(), 1, PASTO.a);
        if (lados.derecha) { const d = prof(); p.rect(ox + L - d, oy + i, d, 1, PASTO.b); }
    }
}

function playa(p, ox, oy, r, lados) {
    for (let by = 0; by < L; by += 4) {
        for (let bx = 0; bx < L; bx += 4) {
            p.rect(ox + bx, oy + by, 4, 4, manchas(ox + bx, oy + by) > 0.6 ? COLOR_ARENA.b : COLOR_ARENA.base);
        }
    }
    for (let i = 0; i < 14; i++) {
        p.rect(ox + Math.floor(r() * L), oy + Math.floor(r() * L), 1, 1, r() < 0.55 ? COLOR_ARENA.oscuro : COLOR_ARENA.claro);
    }
    if (r() < 0.2) {
        // Un caracolito.
        const x = ox + 3 + Math.floor(r() * (L - 6)), y = oy + 3 + Math.floor(r() * (L - 6));
        p.rect(x, y, 2, 1, COLOR_ARENA.concha);
        p.rect(x, y + 1, 1, 1, COLOR_ARENA.oscuro);
    }
    bordesDePasto(p, ox, oy, r, lados);
}

/** Agua (orilla u honda). `costa`: lados donde hay tierra; `sombra…` y `postes`: el muelle encima. */
function agua(p, ox, oy, r, colores, { costa, honda, sombraArriba, sombraIzquierda, postes }) {
    for (let by = 0; by < L; by += 4) {
        for (let bx = 0; bx < L; bx += 4) {
            p.rect(ox + bx, oy + by, 4, 4, manchas(ox + bx + 50, oy + by) > 0.5 ? colores.b : colores.base);
        }
    }
    for (let i = 0; i < 2; i++) {
        const x = ox + Math.floor(r() * (L - 4)), y = oy + 2 + Math.floor(r() * (L - 4));
        p.rect(x, y, 3, 1, colores.ola);
        p.rect(x + 1, y - 1, 2, 1, colores.ola);
    }
    // Donde la orilla se junta con lo hondo, el borde se mezcla (pixeles salteados).
    if (honda.abajo) {
        for (let i = 0; i < L; i += 2) p.rect(ox + i + (r() < 0.5 ? 1 : 0), oy + L - 1 - Math.floor(r() * 3), 1, 1, HONDA.base);
    }
    // Costa: arena mojada y espuma.
    for (let i = 0; i < L; i++) {
        const espuma = r() < 0.75;
        if (costa.arriba) {
            p.rect(ox + i, oy, 1, 2, COLOR_ARENA.mojada);
            if (espuma) p.rect(ox + i, oy + 2, 1, 1, AGUA.espuma);
        }
        if (costa.izquierda) { p.rect(ox, oy + i, 1, 1, COLOR_ARENA.mojada); if (espuma) p.rect(ox + 1, oy + i, 1, 1, AGUA.espuma); }
        if (costa.derecha) { p.rect(ox + L - 1, oy + i, 1, 1, COLOR_ARENA.mojada); if (espuma) p.rect(ox + L - 2, oy + i, 1, 1, AGUA.espuma); }
    }
    // Sombra del muelle sobre el agua (la luz viene de arriba a la izquierda) y los postes.
    const oscura = mezclar(colores.base, '#000000', 0.35);
    if (sombraArriba) p.rect(ox, oy, L, 3, oscura);
    if (sombraIzquierda) p.rect(ox, oy, 3, L, oscura);
    for (const px of postes) {
        p.rect(ox + px, oy, 3, 4, MADERA.poste);
        p.rect(ox + px, oy + 4, 3, 1, AGUA.espuma);
    }
}

/**
 * Tablas del muelle. En el tramo que entra al río las tablas van atravesadas (horizontales);
 * en la "T" del final, verticales. Con vigas en los bordes que dan al agua.
 */
function muelle(p, ox, oy, r, { tablasVerticales, bordes }) {
    p.rect(ox, oy, L, L, MADERA.junta);
    for (let i = 0; i < 4; i++) {
        const color = (i + Math.floor(r() * 2)) % 2 ? MADERA.a : MADERA.b;
        if (tablasVerticales) p.rect(ox + i * 4 + 1, oy, 3, L, color);
        else p.rect(ox, oy + i * 4 + 1, L, 3, color);
        // Vetas y clavos.
        if (r() < 0.5) {
            const k = Math.floor(r() * 10) + 2;
            if (tablasVerticales) p.rect(ox + i * 4 + 2, oy + k, 1, 3, mezclar(color, '#000000', 0.15));
            else p.rect(ox + k, oy + i * 4 + 2, 3, 1, mezclar(color, '#000000', 0.15));
        }
        if (tablasVerticales) { p.rect(ox + i * 4 + 2, oy + 1, 1, 1, MADERA.clavo); p.rect(ox + i * 4 + 2, oy + L - 2, 1, 1, MADERA.clavo); }
        else { p.rect(ox + 1, oy + i * 4 + 2, 1, 1, MADERA.clavo); p.rect(ox + L - 2, oy + i * 4 + 2, 1, 1, MADERA.clavo); }
    }
    if (bordes.izquierda) p.rect(ox, oy, 2, L, MADERA.viga);
    if (bordes.derecha) p.rect(ox + L - 2, oy, 2, L, MADERA.viga);
    if (bordes.arriba) p.rect(ox, oy, L, 2, MADERA.viga);
    if (bordes.abajo) p.rect(ox, oy + L - 2, L, 2, MADERA.viga);
}

/** Sombra suave (ovalada y pixelada) que tira un objeto alto sobre el suelo. */
function sombra(ctx, cx, cy, ancho, alto, alfa) {
    ctx.fillStyle = `rgba(16, 32, 12, ${alfa})`;
    for (let y = -alto; y <= alto; y += 2) {
        const w = Math.round(ancho * Math.sqrt(1 - (y / (alto + 1)) ** 2) / 2) * 2;
        ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 2);
    }
}

/**
 * Dibuja todo el suelo del muelle en un canvas (se hace una sola vez al cargar).
 */
export function dibujarSuelo(mapa) {
    const canvas = crearCanvas(mapa.ancho * TILE, mapa.alto * TILE);
    const ctx = canvas.getContext('2d');
    const p = new Pincel(ctx, E);
    // Las celdas del tramo horizontal del muelle (la "T"): filas con más de 2 tablas.
    const filaHorizontal = (y) => [...mapa.filas[y]].filter((c) => mapa.leyenda[c].tipo === 'muelle').length > 2;

    mapa.paraCada((x, y, tipo) => {
        const r = aleatorio(semilla(x, y));
        const ox = x * L, oy = y * L;
        // Fuera del mapa "sigue" lo mismo que hay en el borde (así el río no tiene costa en los costados).
        const vecino = (dx, dy) => (mapa.fuera(x + dx, y + dy) ? tipo : mapa.tipo(x + dx, y + dy));
        const lados = (cond) => ({ arriba: cond(vecino(0, -1)), abajo: cond(vecino(0, 1)), izquierda: cond(vecino(-1, 0)), derecha: cond(vecino(1, 0)) });
        const enLaPlaya = vecino(-1, 0) === 'playa' || vecino(1, 0) === 'playa';

        if (esAgua(tipo)) {
            const honda = tipo === 'honda';
            const tierra = (t) => !esAgua(t) && t !== 'muelle';
            const postes = [];
            if (vecino(0, -1) === 'muelle') {
                if (vecino(-1, -1) !== 'muelle') postes.push(1);
                if (vecino(1, -1) !== 'muelle') postes.push(L - 4);
            }
            agua(p, ox, oy, r, honda ? HONDA : AGUA, {
                costa: lados(tierra),
                honda: { abajo: !honda && vecino(0, 1) === 'honda' },
                sombraArriba: vecino(0, -1) === 'muelle',
                sombraIzquierda: vecino(-1, 0) === 'muelle',
                postes,
            });
        } else if (tipo === 'muelle') {
            muelle(p, ox, oy, r, { tablasVerticales: filaHorizontal(y), bordes: lados((t) => t !== 'muelle' && t !== 'playa') });
        } else if (tipo === 'playa' || (tipo === 'roca' && enLaPlaya)) {
            playa(p, ox, oy, r, lados((t) => ['pasto', 'flores', 'arbol', 'arbusto', 'cartel'].includes(t)));
        } else if (tipo === 'flores') flores(p, ox, oy, r);
        else pasto(p, ox, oy, r);
    });

    // Sombras de los objetos (van en el suelo: los personajes caminan por encima).
    mapa.paraCada((x, y, tipo) => {
        const cx = x * TILE + TILE / 2 + 6, cy = y * TILE + TILE - 4;
        if (tipo === 'arbol') sombra(ctx, cx, cy, 40, 12, 0.22);
        else if (tipo === 'arbusto' || tipo === 'roca') sombra(ctx, cx - 4, cy, 16, 5, 0.18);
        else if (tipo === 'cartel') sombra(ctx, cx - 4, cy, 30, 5, 0.2);
    });
    return canvas;
}

// ───────────── Objetos (sprites que se ordenan con los jugadores) ─────────────

/** Rellena una "mancha" de píxeles lógicos con sombreado desde arriba a la izquierda. */
function mancha(ctx, ancho, alto, dentro, colores, r, { luzX = -1, luzY = -1, cx, cy, radio }) {
    const esta = (x, y) => x >= 0 && y >= 0 && x < ancho && y < alto && dentro(x, y);
    for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ancho; x++) {
            if (!esta(x, y)) continue;
            const borde = !esta(x - 1, y) || !esta(x + 1, y) || !esta(x, y - 1) || !esta(x, y + 1);
            let color;
            if (borde) color = colores.o;
            else {
                // Cuánto "mira" este píxel hacia la luz (-1 a 1) + un poco de ruido para que parezcan hojas.
                const luz = ((x - cx) * luzX + (y - cy) * luzY) / radio + (r() - 0.5) * 0.5;
                color = luz > 0.75 ? colores.h : luz > 0.25 ? colores.l : luz > -0.35 ? colores.m : colores.d;
            }
            ctx.fillStyle = color;
            ctx.fillRect(x * E, y * E, E, E);
        }
    }
}

const COPAS = [
    { o: '#1e3f1a', d: '#2c5e26', m: '#3b7b31', l: '#4f9a3f', h: '#6cb553' },
    { o: '#1b3a1f', d: '#285a2f', m: '#34733b', l: '#468f4b', h: '#62ab61' },
    { o: '#2b3d14', d: '#41621f', m: '#567f27', l: '#6d9a31', h: '#8cb83c' },
];
const CORTEZA = { o: '#2e1c0f', d: '#4a2e19', m: '#6b4426', l: '#86593a' };

/** Árbol frondoso: 3 celdas de ancho × 3 de alto (el tronco en la celda de abajo al medio). */
function spriteArbol(variante) {
    const W = 48, H = 48;
    const canvas = crearCanvas(W * E, H * E);
    const ctx = canvas.getContext('2d');
    const r = aleatorio(1000 + variante);
    // Tronco con raíces.
    mancha(ctx, W, H, (x, y) => (y >= 30 && y <= 46 && x >= 21 && x <= 27) || (y >= 43 && y <= 46 && x >= 18 && x <= 30 && (y - 43) * 2 >= Math.abs(x - 24) - 3),
        CORTEZA, r, { cx: 24, cy: 38, radio: 6, luzX: -1, luzY: 0 });
    // Copa: varios círculos superpuestos.
    const j = () => Math.round((r() - 0.5) * 4);
    const bolas = [[24, 17, 15], [13 + j(), 21, 9], [35 + j(), 21, 9], [24 + j(), 8, 9], [17, 28, 8], [31, 28, 8], [24, 30, 7]];
    mancha(ctx, W, H, (x, y) => bolas.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br),
        COPAS[variante % COPAS.length], r, { cx: 24, cy: 19, radio: 16 });
    return { canvas, dx: -TILE, dy: -2 * TILE };
}

const ROCA = { o: '#3d3f44', d: '#5f6166', m: '#8d8f93', l: '#a9abaf', h: '#c9cbce' };

function spriteRoca(variante) {
    const W = 16, H = 16;
    const canvas = crearCanvas(W * E, H * E);
    const ctx = canvas.getContext('2d');
    const r = aleatorio(3000 + variante);
    const ancho = variante % 2 ? 6 : 7;
    mancha(ctx, W, H, (x, y) => ((x - 8) / ancho) ** 2 + ((y - 10) / 5) ** 2 <= 1, ROCA, r, { cx: 8, cy: 10, radio: 6 });
    // Un poco de musgo arriba.
    ctx.fillStyle = '#5f8a3a';
    for (let i = 0; i < 4; i++) ctx.fillRect((5 + Math.floor(r() * 6)) * E, (6 + Math.floor(r() * 2)) * E, E, E);
    return { canvas, dx: 0, dy: 0 };
}

const ARBUSTO = { o: '#1e3f1a', d: '#2f6327', m: '#3f7f33', l: '#539a44', h: '#6db556' };

function spriteArbusto(variante) {
    const W = 20, H = 18;
    const canvas = crearCanvas(W * E, H * E);
    const ctx = canvas.getContext('2d');
    const r = aleatorio(4000 + variante);
    const bolas = [[10, 10, 7], [5, 12, 5], [15, 12, 5], [10, 6, 5]];
    mancha(ctx, W, H, (x, y) => y <= 16 && bolas.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br), ARBUSTO, r, { cx: 10, cy: 10, radio: 8 });
    if (variante % 2 === 0) {
        // Con frutitas rojas.
        for (let i = 0; i < 5; i++) {
            const x = 4 + Math.floor(r() * 12), y = 6 + Math.floor(r() * 8);
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(x * E, y * E, E, E);
        }
    }
    return { canvas, dx: -2 * E, dy: -2 * E };
}

/** Juncos con espigas (totoras) asomando del agua. */
function spriteJunco(variante) {
    const W = 16, H = 28;
    const canvas = crearCanvas(W * E, H * E);
    const ctx = canvas.getContext('2d');
    const r = aleatorio(5000 + variante);
    const p = new Pincel(ctx, E);
    for (let i = 0; i < 7; i++) {
        const x = 1 + i * 2 + Math.floor(r() * 2);
        const alto = 12 + Math.floor(r() * 12);
        const inclina = r() < 0.5 ? -1 : 1;
        for (let y = 0; y < alto; y++) {
            const dx = y > alto * 0.6 ? inclina : 0;
            p.rect(x + dx, H - 2 - y, 1, 1, y % 5 === 0 ? '#3d6b2a' : '#5b8f3a');
        }
        if (i % 2 === 0) {
            // Espiga marrón (el "chorizo" de la totora).
            p.rect(x + inclina, H - 2 - alto - 3, 2, 4, '#6b4426');
            p.rect(x + inclina, H - 2 - alto - 3, 1, 1, '#8a5a3b');
        }
    }
    // Onditas en la base.
    p.rect(0, H - 2, W, 1, '#73bfcf');
    return { canvas, dx: 0, dy: -(H - L) * E };
}

/** Bote de madera amarrado. */
function spriteBote() {
    const W = 30, H = 14;
    const canvas = crearCanvas(W * E, H * E);
    const ctx = canvas.getContext('2d');
    const p = new Pincel(ctx, E);
    // Casco visto de costado-arriba: borde, interior y bancos.
    for (let y = 0; y < 10; y++) {
        const m = y < 2 ? 4 - y * 2 : y > 7 ? (y - 7) * 3 : 0;
        p.rect(m, 2 + y, W - 2 * m, 1, y === 0 || y === 9 ? '#3a2614' : y < 3 ? '#8a5a3b' : y > 6 ? '#6b4426' : '#5a3b22');
    }
    p.rect(3, 4, W - 6, 4, '#7a5230');
    p.rect(9, 4, 2, 4, '#a0703f');
    p.rect(19, 4, 2, 4, '#a0703f');
    // Remo.
    p.rect(12, 1, 10, 1, '#c8a26c');
    p.rect(22, 0, 3, 3, '#c8a26c');
    // Agua alrededor.
    p.rect(1, 12, W - 2, 1, '#73bfcf');
    return { canvas, dx: 0, dy: 0 };
}

/** Cartel "CLUB DE PESCA" sobre dos postes. */
function spriteCartel() {
    const W = 40, H = 30;
    const canvas = crearCanvas(W * E, H * E);
    const ctx = canvas.getContext('2d');
    const p = new Pincel(ctx, E);
    p.rect(6, 14, 3, 16, '#4a2f1a');
    p.rect(31, 14, 3, 16, '#4a2f1a');
    p.rect(1, 1, W - 2, 20, '#3a2614');
    p.rect(2, 2, W - 4, 18, '#b98450');
    p.rect(2, 2, W - 4, 1, '#d39d63');
    p.rect(2, 10, W - 4, 1, '#a0703f');
    p.texto('CLUB DE', W / 2, 9, { tam: 7, color: '#3a2614' });
    p.texto('PESCA', W / 2, 18, { tam: 8, color: '#7a2e14' });
    return { canvas, dx: -12 * E, dy: -14 * E };
}

const FABRICAS = {
    arbol: [spriteArbol, 3], roca: [spriteRoca, 2], arbusto: [spriteArbusto, 2],
    junco: [spriteJunco, 3], bote: [spriteBote, 1], cartel: [spriteCartel, 1],
};

/**
 * Lista de objetos del mapa. Cada uno tiene su fila (y) para ordenarlo con los
 * jugadores, y sabe dibujarse.
 */
export function crearObjetos(mapa) {
    const sprites = {};
    const spriteDe = (tipo, variante) => {
        const [fabrica, cantidad] = FABRICAS[tipo];
        const v = variante % cantidad;
        return (sprites[`${tipo}${v}`] ??= fabrica(v));
    };

    const objetos = [];
    mapa.paraCada((x, y, tipo) => {
        if (!FABRICAS[tipo]) return;
        const { canvas, dx, dy } = spriteDe(tipo, semilla(x, y, 9) % 7);
        // ¿Puede tapar a alguien que está detrás? (los arbustos, rocas y juncos son bajos)
        const alto = tipo === 'arbol' || tipo === 'cartel';
        const flota = tipo === 'bote';
        objetos.push({
            x, y, tipo, alto,
            dibujar: (ctx, t) => {
                // El bote se mece con el agua.
                const meneo = flota ? Math.round(Math.sin(t / 700) * 1.5) * E / 2 : 0;
                ctx.drawImage(canvas, x * TILE + dx, y * TILE + dy + meneo);
            },
        });
    });
    return objetos;
}

/** Brillitos en el agua (solo lo que está en pantalla). */
export function dibujarAnimacionesDelSuelo(ctx, mapa, t, desde, hasta) {
    for (let y = desde.y; y <= hasta.y; y++) {
        for (let x = desde.x; x <= hasta.x; x++) {
            const tipo = mapa.tipo(x, y);
            if (tipo !== 'agua' && tipo !== 'honda') continue;
            const h = semilla(x, y, 3);
            for (let i = 0; i < 2; i++) {
                const fase = Math.sin(t / 520 + ((h >> (i * 5)) & 31));
                if (fase < 0.82) continue;
                ctx.fillStyle = fase > 0.96 ? '#ffffff' : tipo === 'honda' ? '#6fa6cc' : '#a9e0ea';
                ctx.fillRect(x * TILE + 4 + ((h >> (i * 3)) % 22), y * TILE + 4 + ((h >> (i * 4 + 2)) % 22), 4, 2);
            }
        }
    }
}
