// Los cuatro peces del río en pixel art (mirando a la derecha). Se usan en la tabla de
// puntos, en el ranking y cuando un pez sale saltando del agua.
//   G/g lomo y su sombra   V vientre   R rojo (piraña)   W dientes / brillo   E ojo
//   A aleta   N manchas (surubí)   B bigotes (bagre y surubí)   O contorno (se agrega solo)

import { conContorno, crearCanvas, dibujarGrilla } from './pixel.js';

const DIBUJOS = {
    // Piraña: chata y alta, plateada con la panza roja y los dientes afuera.
    pirana: {
        filas: [
            '.....GGGG.......',
            'A...GGGGGGG.....',
            'AA.GGGgGGGGGG...',
            'AAGGGgGGGGGGEG..',
            'AAAgGGGGGGGGGGW.',
            'AAARRRRRRRRRRW..',
            'AA.RRRRRRRRRRRW.',
            'A...RRRRRRRRR...',
            '.....AA.RRR.....',
        ],
        paleta: { G: '#9aa6ad', g: '#7a868d', R: '#d8452f', W: '#ffffff', E: '#1b1b1b', A: '#7a868d' },
    },
    // Bagre: largo, marrón grisáceo, cabeza ancha y bigotes.
    bagre: {
        filas: [
            '.......A..........',
            '......AAA.........',
            'A...GGGGGGGGGGG...',
            'AA.GGgGGGGGGGGEGG.',
            'AAAGGGGGGGGGGGGGGB',
            'AA.VVVVVVVVVVVVVV.',
            'A....VVVVVVVVV..B.',
            '.......AA.......B.',
        ],
        paleta: { G: '#7d6b55', g: '#64543f', V: '#d9cdb4', E: '#1b1b1b', A: '#64543f', B: '#3b3024' },
    },
    // Dorado: el "tigre del río", dorado brillante con aletas naranjas.
    dorado: {
        filas: [
            '........AAA.........',
            'AA....GGGGGGG.......',
            'AAA.GGGgGGGGGGGG....',
            '.AAGGGGGgGGGGGGEGG..',
            '..GGGgGGGGgGGGGGGGW.',
            '.AAVVVVVVVVVVVVVVV..',
            'AAA..VVVVVVVVVVVV...',
            'AA.......AAA........',
        ],
        paleta: { G: '#f2b62b', g: '#d98c1f', V: '#ffe48a', E: '#1b1b1b', W: '#fff4c4', A: '#e0662a' },
    },
    // Surubí: el más grande, largo, gris con manchas negras y bigotes largos.
    surubi: {
        filas: [
            '..........AA............',
            'A.......GGGGGGGGGG......',
            'AA..GGGNGGGGNGGGGGGG....',
            'AAAGGNGGGGNGGGGNGGGGEGG.',
            'AAGGGGGGNGGGGNGGGGGGGGGB',
            'AA.VVVVVVVVVVVVVVVVVVVV.',
            'A......VVVVVVVVVVVVV..BB',
            '..........AA.......A..B.',
        ],
        paleta: { G: '#8c959b', N: '#2c2f33', V: '#e6e9ea', E: '#1b1b1b', A: '#6b747a', B: '#2c2f33' },
    },
};

const GRILLAS = Object.fromEntries(Object.entries(DIBUJOS).map(([slug, d]) => [slug, conContorno(d.filas)]));
const cache = new Map();

/** Canvas con el pez dibujado a `escala` px por píxel (cacheado). */
export function lienzoPez(slug, escala = 2) {
    const clave = `${slug}|${escala}`;
    if (cache.has(clave)) return cache.get(clave);
    const grilla = GRILLAS[slug] ?? GRILLAS.pirana;
    const canvas = crearCanvas(grilla[0].length * escala, grilla.length * escala);
    dibujarGrilla(canvas.getContext('2d'), grilla, (DIBUJOS[slug] ?? DIBUJOS.pirana).paleta, 0, 0, escala);
    cache.set(clave, canvas);
    return canvas;
}

/** Dibuja el pez centrado en (cx, cy), opcionalmente rotado (radianes) o mirando a la izquierda. */
export function dibujarPez(ctx, slug, cx, cy, { escala = 2, angulo = 0, espejado = false } = {}) {
    const lienzo = lienzoPez(slug, escala);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (angulo) ctx.rotate(angulo);
    if (espejado) ctx.scale(-1, 1);
    ctx.drawImage(lienzo, -lienzo.width / 2, -lienzo.height / 2);
    ctx.restore();
}

/** <canvas> chiquito para usar como ícono en el HTML (tabla de puntos, ranking). */
export function iconoPez(slug, escala = 2) {
    const original = lienzoPez(slug, escala);
    const canvas = crearCanvas(original.width, original.height);
    canvas.getContext('2d').drawImage(original, 0, 0);
    canvas.className = 'icono-pez';
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
}
