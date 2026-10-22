// Panel de la derecha: tus puntos, el RANKING (top 10) y la tabla de cuánto vale cada pez.
// El ranking viene armado por el servidor: al entrar (GET /ranking) y cada vez que alguien
// saca un pez (evento PezCapturado, que trae el ranking nuevo). Todo con textContent (anti-XSS).

import { iconoPez } from '../peces.js';
import { el } from './modales.js';

export class Ranking {
    constructor({ raiz, url, yoId, peces, puntos }) {
        this.url = url;
        this.yoId = yoId;
        this.peces = peces; // { pirana: { nombre, puntos }, ... }
        this.misPuntosEl = raiz.querySelector('[data-mis-puntos]');
        this.lista = raiz.querySelector('[data-lista]');
        this.vacio = raiz.querySelector('[data-vacio]');
        this.boton = raiz.querySelector('[data-plegar]');
        this.raiz = raiz;
        this.ultimo = [];

        this.misPuntos(puntos);
        this.pintarTabla(raiz.querySelector('[data-tabla]'));
        this.boton.addEventListener('click', () => this.plegar(!raiz.classList.contains('ranking--plegado')));
        // En pantallas chicas arranca plegado (se ve solo el título y tus puntos).
        if (window.innerWidth < 700 || window.innerHeight < 500) this.plegar(true);
    }

    plegar(plegado) {
        this.raiz.classList.toggle('ranking--plegado', plegado);
        this.boton.setAttribute('aria-expanded', String(!plegado));
    }

    misPuntos(total) {
        this.misPuntosEl.textContent = String(total);
    }

    async cargar() {
        const respuesta = await fetch(this.url, { headers: { Accept: 'application/json' } });
        if (!respuesta.ok) throw new Error('No se pudo cargar el ranking.');
        this.pintar((await respuesta.json()).data);
    }

    /** Puesto de un jugador en el último ranking (o null si no está en el top). */
    puestoDe(id) {
        return this.ultimo.find((f) => f.id === id)?.puesto ?? null;
    }

    pintar(filas) {
        this.ultimo = filas;
        this.vacio.hidden = filas.length > 0;
        this.lista.replaceChildren(...filas.map((f) => {
            const li = el('li', f.id === this.yoId ? 'ranking-yo' : null);
            const punto = el('span', 'muelle-punto');
            punto.style.background = f.color;
            // Al pasar el mouse: cuántos sacó de cada uno.
            li.title = Object.entries(f.peces).map(([slug, n]) => `${this.peces[slug]?.nombre ?? slug}: ${n}`).join(' · ');
            li.append(
                el('span', f.puesto <= 3 ? 'ranking-puesto ranking-medalla' : 'ranking-puesto', f.puesto <= 3 ? ['🥇', '🥈', '🥉'][f.puesto - 1] : `${f.puesto}.`),
                punto,
                el('span', 'ranking-nombre', f.nombre),
                el('span', 'ranking-puntos', String(f.puntos)),
            );
            return li;
        }));
    }

    pintarTabla(tabla) {
        tabla.replaceChildren(...Object.entries(this.peces).map(([slug, pez]) => {
            const li = el('li');
            li.append(iconoPez(slug), el('span', 'tabla-nombre', pez.nombre), el('span', 'tabla-puntos', `${pez.puntos}`));
            return li;
        }));
    }
}
