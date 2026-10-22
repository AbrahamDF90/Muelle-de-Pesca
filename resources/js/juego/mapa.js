// Mapa del muelle y colisiones. El MISMO JSON (data/muelle.json) lo usa PHP para
// elegir dónde aparece cada pescador y para validar desde dónde se puede pescar.

import DATOS from './data/muelle.json';

export class Mapa {
    constructor(datos) {
        this.nombre = datos.nombre; // "el muelle" (para los avisos)
        this.ancho = datos.ancho;
        this.alto = datos.alto;
        this.salidas = datos.salidas;
        this.filas = datos.filas;
        this.leyenda = datos.leyenda;
    }

    fuera(x, y) {
        return x < 0 || y < 0 || x >= this.ancho || y >= this.alto;
    }

    /** Carácter del mapa en una celda (o 'T', un árbol, si está fuera). */
    celda(x, y) {
        return this.fuera(x, y) ? 'T' : this.filas[y][x];
    }

    /** Qué hay en una celda: { caminable, tipo } según la leyenda. */
    infoCelda(x, y) {
        return this.leyenda[this.celda(x, y)];
    }

    tipo(x, y) {
        return this.infoCelda(x, y).tipo;
    }

    esCaminable(x, y) {
        return !this.fuera(x, y) && this.infoCelda(x, y).caminable === true;
    }

    /**
     * ¿Se puede pescar parado en (x, y) mirando hacia `dir`? Devuelve la zona del agua de
     * enfrente ('orilla' | 'honda') o null. Es la MISMA regla que MuelleService::zonaDePesca
     * en PHP (el servidor la vuelve a revisar: esta es solo para no mandar pedidos inútiles).
     */
    zonaDePesca(x, y, dir) {
        const d = { arriba: [0, -1], abajo: [0, 1], izquierda: [-1, 0], derecha: [1, 0] }[dir];
        if (!d || !this.esCaminable(x, y)) return null;
        return this.infoCelda(x + d[0], y + d[1]).pesca ?? null;
    }

    /** Recorre todas las celdas: fn(x, y, tipo). */
    paraCada(fn) {
        for (let y = 0; y < this.alto; y++) {
            for (let x = 0; x < this.ancho; x++) fn(x, y, this.tipo(x, y));
        }
    }
}

export const MUELLE = new Mapa(DATOS);
