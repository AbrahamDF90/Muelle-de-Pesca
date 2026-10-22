// Los demás pescadores del muelle. Quién está lo dice el canal de presencia; dónde está, los whispers:
//   'mover' {id, x, y, dir}  cada paso (o giro) de alguien
//   'estoy' {id, x, y, dir}  "estoy acá": se lo mandamos al que acaba de entrar, porque
//                            los datos de here() son los de cuando cada uno se unió (posición vieja).
//   'linea' {estado, x, y, dir}  su caña: 'lanza' | 'pica' | 'recoge' | 'quita' (solo para dibujarla)

import { Personaje } from './personaje.js';
import { audio } from './audio.js';
import { celdaDeLaBoya } from './pesca.js';

const DIRECCIONES = ['arriba', 'abajo', 'izquierda', 'derecha'];

export class Multijugador {
    constructor({ red, yo, hud, cupo, mapa, iniciales }) {
        this.red = red;
        this.yo = yo;
        this.hud = hud;
        this.cupo = cupo;
        this.mapa = mapa;
        this.remotos = new Map(); // id → Personaje
        // Primero los que ya estaban (here()), DESPUÉS los oyentes: así los whispers que
        // llegaron durante la pantalla de carga encuentran a su personaje.
        this.sincronizar(iniciales, true);

        red.on('here', (jugadores) => this.sincronizar(jugadores));
        red.on('entra', (j) => this.entra(j));
        red.on('sale', (j) => this.sale(j));
        red.on('mover', (d, id) => {
            const r = this.remotos.get(id);
            if (!r || r.saliendo || !this.posicionValida(d)) return;
            r.moverRemoto(d.x, d.y, d.dir);
            r.linea = null; // si camina, ya no está pescando
        });
        red.on('linea', (d, id) => this.linea(this.remotos.get(id), d));
        red.on('estoy', (d, id) => {
            const r = this.remotos.get(id);
            if (!r || r.saliendo || !this.posicionValida(d)) return;
            r.teletransportar(d.x, d.y, d.dir);
            // Si estaba pescando cuando entramos, también vemos su caña.
            if (d.linea) {
                this.linea(r, { ...d, estado: 'lanza' });
                if (d.linea === 'pica') this.linea(r, { ...d, estado: 'pica' });
            }
        });
    }

    /** Los whispers no pasan por Laravel: cualquier cliente podría mandar basura. Validamos lo mínimo. */
    posicionValida(d) {
        return d
            && Number.isInteger(d.x) && Number.isInteger(d.y)
            && !this.mapa.fuera(d.x, d.y)
            && DIRECCIONES.includes(d.dir);
    }

    /** La caña de otro jugador (whisper 'linea'). Es solo decorado: no suma puntos. */
    linea(r, d) {
        if (!r || r.saliendo || !this.posicionValida(d)) return;
        if (d.estado === 'lanza') {
            r.teletransportar(d.x, d.y, d.dir);
            const boya = celdaDeLaBoya(this.mapa, d.x, d.y, d.dir);
            r.linea = { bx: boya.x, by: boya.y, estado: 'esperando', desde: performance.now() };
        } else if (d.estado === 'pica' && r.linea) {
            r.linea.estado = 'pica';
        } else if (d.estado === 'quita') {
            // Si sacó un pez, el evento PezCapturado ya lo hizo saltar: la línea se quita un poquito después.
            const linea = r.linea;
            setTimeout(() => { if (r.linea === linea) r.linea = null; }, 100);
        }
    }

    get cantidad() {
        let n = 1; // vos
        for (const r of this.remotos.values()) if (!r.saliendo) n++;
        return n;
    }

    actualizarContador() {
        this.hud.contador(this.cantidad, this.cupo);
    }

    /** Lista completa del canal (al entrar y después de cada reconexión). */
    sincronizar(jugadores, esInicial = false) {
        const presentes = new Set();
        for (const j of jugadores) {
            if (j.id === this.yo.id) continue;
            presentes.add(j.id);
            if (!this.remotos.has(j.id) || this.remotos.get(j.id).saliendo) {
                this.remotos.set(j.id, new Personaje(j));
            }
        }
        for (const id of [...this.remotos.keys()]) {
            if (!presentes.has(id)) this.remotos.delete(id);
        }
        this.actualizarContador();
        // Después de una reconexión los demás pueden tenernos en una posición vieja.
        if (!esInicial) this.avisarDondeEstoy();
    }

    entra(j) {
        if (j.id === this.yo.id) return; // la misma persona en otra pestaña
        this.remotos.set(j.id, new Personaje(j));
        this.hud.toast(`${j.nombre} entró a ${this.mapa.nombre}`);
        this.alEntrarOSalir?.(j, true);
        audio.efecto('entra');
        this.actualizarContador();
        // El que entra nos ve con la posición de la BD: le contamos dónde estamos ahora.
        this.avisarDondeEstoy();
    }

    sale(j) {
        const r = this.remotos.get(j.id);
        if (!r || r.saliendo) return;
        this.hud.toast(`${j.nombre} salió de ${this.mapa.nombre}`);
        this.alEntrarOSalir?.(j, false);
        audio.efecto('sale');
        r.desvanecer().then(() => {
            if (this.remotos.get(j.id) === r) this.remotos.delete(j.id);
        });
        this.actualizarContador();
    }

    datosPropios() {
        const { id, x, y, dir } = this.yo;
        return { id, x, y, dir };
    }

    avisarDondeEstoy() {
        this.red.susurrar('estoy', { ...this.datosPropios(), linea: this.yo.linea?.estado ?? null });
    }

    /** Cada paso o giro propio se avisa por whisper (directo a Reverb, sin Laravel). */
    avisarMovimiento() {
        this.red.susurrar('mover', this.datosPropios());
    }

    actualizar(dt) {
        for (const r of this.remotos.values()) r.actualizarRemoto(dt);
    }

    personajes() {
        return [...this.remotos.values()];
    }
}
