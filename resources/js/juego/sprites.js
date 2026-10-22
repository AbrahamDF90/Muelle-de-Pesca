// Sprites de los pescadores generados por código: hombre / mujer × color × 4 direcciones
// × 3 frames. Se arman por capas a partir de matrices de 16×28 y se cachean en una
// "hoja" (canvas) por combinación de género + color + pelo + piel.
//
// Códigos de las matrices (un carácter = un píxel):
//   T/t campera del color elegido (y su sombra)   D cinta del sombrero   H/h pelo   S/s piel
//   E ojo   W brillo   M boca   b rubor   Y/y paja del sombrero   K/k chaleco de pesca
//   P pantalón   L cinturón   B botas de goma   O contorno (se agrega solo)   . transparente
//
// Filas: 0-16 cabeza (con el sombrero arriba), 17-21 torso, 22-26 piernas,
// 27 libre para el contorno de los pies.

import {
    COLOR_CONTORNO, DIRECCIONES, ESCALA_SPRITE, PELOS, PIELES, SPRITE_H, SPRITE_W,
} from './config.js';
import { componer, contornear, crearCanvas, dibujarGrilla, espejar, mezclar, oscurecer } from './pixel.js';

const FILA_TORSO = 17;
const FILA_PIERNAS = 22;

// ───────────── PESCADOR / PESCADORA: sombrero de paja, chaleco de pesca y botas ─────────────

const SOMBRERO = [
    '................',
    '................',
    '................',
    '.....YYYYYY.....',
    '....YYYYYYYY....',
    '....YDDDDDDY....',
    '.YYYYYYYYYYYYYY.',
    '..yYYYYYYYYYYy..',
];
const SOMBRERO_PERFIL = [
    '................',
    '................',
    '................',
    '....YYYYYY......',
    '...YYYYYYYY.....',
    '...YDDDDDDY.....',
    '.YYYYYYYYYYYYY..',
    '..yYYYYYYYYYYy..',
];

const CARA_HOMBRE = [
    '...HHSSSSSSHH...',
    '...HSSSSSSSSH...',
    '...HSEWSSEWSH...',
    '...HSEESSEESH...',
    '...SbSSSSSSbS...',
    '....SSSMMSSS....',
    '.....SSSSSS.....',
];
const CARA_MUJER = [
    '..HHHSSSSSSHHH..',
    '..HHSSSSSSSSHH..',
    '..HHSEWSSEWSHH..',
    '..HHSEESSEESHH..',
    '..HHbSSSSSSbHH..',
    '..HH.SSMMSS.HH..',
    '..HH..SSSS..HH..',
    '..hH........Hh..',
    '...h........h...',
];

const TORSO = {
    frente: ['....KKTTTTKK....', '...KKKTTTTKKK...', '..TKkKTTTTKkKT..', '..SSKKTTTTKKSS..', '....LLLLLLLL....'],
    espalda: ['....KKKKKKKK....', '...KKKKKKKKKK...', '..TKKKKKKKKKKT..', '..SSKKKKKKKKSS..', '....LLLLLLLL....'],
    perfil: [
        ['.....KKKKKK.....', '....KKKTTKK.....', '....KKTTTKKK....', '....KKTSTKKK....', '.....LLLLLL.....'],
        ['.....KKKKKK.....', '....KKKTTKK.....', '....KKTTTTKK....', '....KKKTTTTKS...', '.....LLLLLL.....'],
        ['.....KKKKKK.....', '....KKKTTKK.....', '....KKTTTTKK....', '...STKKTTTKK....', '.....LLLLLL.....'],
    ],
};

// Pantalón y botas de goma (iguales para los dos).
const PIERNAS = {
    frente: [
        ['....PPPPPPPP....', '....PPPPPPPP....', '....PPP..PPP....', '....BBB..BBB....', '....BBB..BBB....'],
        ['....PPPPPPPP....', '....PPPPPPPP....', '....PPP..PPP....', '....BBB..BBB....', '.........BBB....'],
        ['....PPPPPPPP....', '....PPPPPPPP....', '....PPP..PPP....', '....BBB..BBB....', '....BBB.........'],
    ],
    perfil: [
        ['.....PPPPPP.....', '.....PPPPPP.....', '......PPPP......', '......BBBB......', '......BBBBB.....'],
        ['.....PPPPPP.....', '.....PPPPPP.....', '.....PP..PP.....', '....BB....BB....', '...BBB....BBB...'],
        ['.....PPPPPP.....', '.....PPPPPP.....', '.....PP..PP.....', '....BB....BB....', '...BBB....BBB...'],
    ],
};
PIERNAS.espalda = PIERNAS.frente;

const HOMBRE = {
    cabeza: {
        abajo: [...SOMBRERO, ...CARA_HOMBRE],
        arriba: [...SOMBRERO, '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...hHHHHHHHHh...', '....hhhhhhhh....', '.....SSSSSS.....'],
        derecha: [
            ...SOMBRERO_PERFIL,
            '...HHHHSSSSS....',
            '...HHHSSSSSSS...',
            '...HHHSSSSSEW...',
            '...HHSSSSSSEE...',
            '...hHSSSSSbSSS..',
            '....hSSSSSSMS...',
            '.....SSSSSSS....',
        ],
    },
    torso: TORSO,
    piernas: PIERNAS,
    adelante: {},
    atras: {},
};

const MUJER = {
    cabeza: {
        abajo: [...SOMBRERO, ...CARA_MUJER],
        arriba: [
            ...SOMBRERO,
            '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..', '..HHHHHHHHHHHH..',
            '..HHHHHHHHHHHH..', '..hHHHHHHHHHHh..', '...HHHHHHHHHH...', '....hHHHHHHh....', '......hHHh......',
        ],
        derecha: [
            ...SOMBRERO_PERFIL,
            '..HHHHHSSSSS....',
            '..HHHHSSSSSSS...',
            '..HHHHSSSSSEW...',
            '..HHHHSSSSSEE...',
            '..HHHHSSSSbSSS..',
            '..HHHHSSSSSMS...',
            '..HHHH.SSSSS....',
            '..hHHh..........',
            '...hh...........',
        ],
    },
    torso: TORSO,
    piernas: PIERNAS,
    adelante: {},
    atras: {},
};

export const DISENOS = { hombre: HOMBRE, mujer: MUJER };

// ───────────── Armado de las capas ─────────────

/** Capas (en orden de dibujo) de un personaje para una dirección y un frame. */
function capas(genero, dir, frame) {
    const d = DISENOS[genero] ?? HOMBRE;
    const perfil = dir === 'derecha' || dir === 'izquierda';
    const base = perfil ? 'derecha' : dir; // izquierda = derecha espejada
    const lado = perfil ? 'perfil' : (dir === 'arriba' ? 'espalda' : 'frente');
    const torso = perfil ? d.torso.perfil[frame] : d.torso[lado];

    let lista = [
        ...(d.atras[base] ?? []),
        { filas: torso, desde: FILA_TORSO },
        { filas: d.piernas[lado][frame], desde: FILA_PIERNAS },
        { filas: d.cabeza[base], desde: 0 },
        ...(d.adelante[base] ?? []),
    ];

    if (dir === 'izquierda') {
        lista = lista.map((c) => ({ ...c, filas: espejar(c.filas) }));
    }
    return lista;
}

export function paletaDe({ color, pelo, piel }) {
    return {
        T: color, // la campera / remera del color elegido
        t: oscurecer(color, 0.25),
        D: oscurecer(color, 0.15), // cinta del sombrero, del mismo color
        K: '#a89060', // chaleco de pesca
        k: '#7d6a44',
        P: '#3a4a6b', // pantalón
        Y: '#e8c872', // paja del sombrero
        y: '#b8964a',
        H: pelo,
        h: oscurecer(pelo, 0.3),
        S: piel,
        s: oscurecer(piel, 0.15),
        E: COLOR_CONTORNO,
        W: '#ffffff',
        M: '#9c3b34',
        b: mezclar(piel, '#ff6f6f', 0.35),
        L: '#5e3d22',
        B: '#2f4a2a', // botas de goma
    };
}

/** Hash entero simple y estable (Knuth) para derivar la apariencia del id. */
function hash(n) {
    return Math.imul(n, 2654435761) >>> 0;
}

/** Pelo (y barba del mago) y piel del jugador, derivados de su id. */
export function apariencia(id) {
    const h = hash(id);
    return {
        pelo: PELOS[h % PELOS.length],
        piel: PIELES[(h >>> 8) % PIELES.length],
    };
}

const cache = new Map();

/**
 * Hoja de sprites (canvas) de un personaje: 4 filas (DIRECCIONES) × 3 columnas (frames),
 * cada celda de 32×56. Se genera una sola vez por combinación y después se reutiliza.
 */
export function obtenerSprites({ genero, color, pelo, piel }) {
    const clave = `${genero}|${color}|${pelo}|${piel}`;
    if (cache.has(clave)) return cache.get(clave);

    const ancho = SPRITE_W * ESCALA_SPRITE;
    const alto = SPRITE_H * ESCALA_SPRITE;
    const hoja = crearCanvas(ancho * 3, alto * DIRECCIONES.length);
    const ctx = hoja.getContext('2d');
    const paleta = paletaDe({ color, pelo, piel });

    DIRECCIONES.forEach((dir, fila) => {
        for (let frame = 0; frame < 3; frame++) {
            dibujarGrilla(ctx, grillaSprite(genero, dir, frame), paleta, frame * ancho, fila * alto, ESCALA_SPRITE);
        }
    });

    cache.set(clave, hoja);
    return hoja;
}

// Ciclo de la animación de caminar: paso A, quieto, paso B, quieto.
export const CICLO_CAMINAR = [1, 0, 2, 0];

/** Dibuja un frame de la hoja con la esquina superior izquierda en (x, y). */
export function dibujarSprite(ctx, hoja, dir, frame, x, y, escala = 1) {
    const ancho = SPRITE_W * ESCALA_SPRITE;
    const alto = SPRITE_H * ESCALA_SPRITE;
    const fila = DIRECCIONES.indexOf(dir);
    ctx.drawImage(hoja, frame * ancho, fila * alto, ancho, alto, x, y, ancho * escala, alto * escala);
}

/** Grilla (con contorno) de un frame; útil para depurar el arte. */
export function grillaSprite(genero, dir, frame) {
    return contornear(componer(SPRITE_W, SPRITE_H, capas(genero, dir, frame)));
}

/**
 * Sombra ovalada pixelada bajo los pies. `cx` es el centro horizontal, `piesY` el borde inferior
 * del sprite y `escala` cuántos px de pantalla mide un píxel lógico del sprite.
 */
export function dibujarSombra(ctx, cx, piesY, escala, color = 'rgba(0, 0, 0, 0.3)') {
    const anchos = [10, 14, 14, 10]; // en píxeles lógicos, de arriba hacia abajo
    ctx.fillStyle = color;
    anchos.forEach((ancho, i) => {
        const y = piesY + (i - 3) * escala;
        ctx.fillRect(cx - (ancho / 2) * escala, y, ancho * escala, escala);
    });
}
