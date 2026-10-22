// Sonidos generados con WebAudio (sin archivos): osciladores cortos = sonidos retro.
// El volumen sale de Ajustes; M activa o silencia todo.

import { ajustes } from './ajustes.js';

const VOLUMEN_MAXIMO = 0.12; // los osciladores cuadrados son fuertes: con esto alcanza
const EVENTOS_DE_GESTO = ['touchend', 'pointerup', 'click', 'keydown'];

// Efectos: lista de notas [frecuencia Hz, duración s] que suenan una después de otra.
const EFECTOS = {
    entra: { tipo: 'square', notas: [[523, 0.07], [784, 0.1]] },
    sale: { tipo: 'square', notas: [[523, 0.07], [392, 0.1]] },
    mensaje: { tipo: 'sine', notas: [[988, 0.06]] },
    abrir: { tipo: 'triangle', notas: [[660, 0.04], [990, 0.05]] },
    pica: { tipo: 'square', notas: [[880, 0.06], [0, 0.03], [880, 0.06], [0, 0.03], [1175, 0.1]] },
    pez: { tipo: 'square', notas: [[659, 0.07], [784, 0.07], [988, 0.12]] },
    pezGrande: { tipo: 'square', notas: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.12], [784, 0.06], [1047, 0.28]] },
    pezAjeno: { tipo: 'triangle', notas: [[988, 0.05], [1319, 0.08]] },
    escapo: { tipo: 'square', notas: [[523, 0.1], [440, 0.1], [349, 0.2]] },
    error: { tipo: 'square', notas: [[180, 0.12]] },
};

class Audio {
    constructor() {
        this.ctx = null; // se crea recién con la primera interacción: el navegador no deja sonar antes

        // iOS solo habilita el audio si se crea Y se hace sonar algo DENTRO de un toque.
        // Con el primer toque (o tecla) creamos el contexto y tocamos un sonido mudo.
        const desbloquear = () => {
            const ctx = this.contexto();
            if (!ctx) return;
            const silencio = ctx.createBuffer(1, 1, 22050);
            const fuente = ctx.createBufferSource();
            fuente.buffer = silencio;
            fuente.connect(ctx.destination);
            fuente.start(0);
            if (ctx.state === 'running') {
                for (const ev of EVENTOS_DE_GESTO) window.removeEventListener(ev, desbloquear, true);
            }
        };
        for (const ev of EVENTOS_DE_GESTO) window.addEventListener(ev, desbloquear, true);
    }

    get silencio() {
        return ajustes.get('silencio') || ajustes.get('volumen') === 0;
    }

    contexto() {
        // Hasta el primer gesto real del usuario (tecla o toque), el navegador no deja sonar y
        // crear el AudioContext antes solo deja un warning en la consola. Ese sonido se saltea.
        if (!this.ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
        if (!this.ctx) {
            const Contexto = window.AudioContext ?? window.webkitAudioContext;
            if (!Contexto) return null;
            this.ctx = new Contexto();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    nota(ctx, tipo, frecuencia, inicio, duracion, volumen) {
        const osc = ctx.createOscillator();
        const gan = ctx.createGain();
        osc.type = tipo;
        osc.frequency.value = frecuencia;
        gan.gain.setValueAtTime(volumen, inicio);
        gan.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
        osc.connect(gan).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + duracion);
    }

    /** Un blip cortito (la "voz" de los NPCs al escribir). */
    blip(frecuencia = 520, duracion = 0.035) {
        if (this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const variacion = 0.97 + Math.random() * 0.06; // que no suene como una máquina
        this.nota(ctx, 'square', frecuencia * variacion, ctx.currentTime, duracion, VOLUMEN_MAXIMO * 0.5 * ajustes.get('volumen'));
    }

    efecto(nombre) {
        const efecto = EFECTOS[nombre];
        if (!efecto || this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const volumen = VOLUMEN_MAXIMO * ajustes.get('volumen');
        let t = ctx.currentTime;
        for (const [frecuencia, duracion] of efecto.notas) {
            if (frecuencia > 0) this.nota(ctx, efecto.tipo, frecuencia, t, duracion, volumen); // 0 = pausa
            t += duracion * 0.9;
        }
    }

    /** Ruido blanco filtrado y con caída (base de los pasos). */
    ruido({ duracion, frecuencia, q = 0.8, tipo = 'bandpass', volumen = 1 }) {
        if (this.silencio) return;
        const ctx = this.contexto();
        if (!ctx) return;
        const muestras = Math.floor(ctx.sampleRate * duracion);
        const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
        const datos = buffer.getChannelData(0);
        for (let i = 0; i < muestras; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / muestras) ** 2;
        const fuente = ctx.createBufferSource();
        fuente.buffer = buffer;
        const filtro = ctx.createBiquadFilter();
        filtro.type = tipo;
        filtro.frequency.value = frecuencia;
        filtro.Q.value = q;
        const gan = ctx.createGain();
        gan.gain.value = VOLUMEN_MAXIMO * 2 * volumen * ajustes.get('volumen');
        fuente.connect(filtro).connect(gan).connect(ctx.destination);
        fuente.start();
    }

    /** Paso suave: sobre pasto o arena suena más apagado; sobre las tablas del muelle, más seco. */
    paso(suelo) {
        if (!ajustes.get('pasos')) return;
        const duro = suelo === 'muelle';
        this.ruido({ duracion: duro ? 0.05 : 0.07, frecuencia: (duro ? 1400 : 700) * (0.9 + Math.random() * 0.2), q: duro ? 2 : 0.9, volumen: duro ? 0.35 : 0.22 });
    }

    /** Un pájaro: dos o tres silbidos cortos que suben y bajan (oscilador con barrido). */
    pajaro() {
        if (this.silencio || !ajustes.get('ambiente')) return;
        const ctx = this.contexto();
        if (!ctx || ctx.state !== 'running') return;
        const base = 2200 + Math.random() * 1600;
        const volumen = VOLUMEN_MAXIMO * 0.35 * ajustes.get('volumen');
        let t = ctx.currentTime;
        const silbidos = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < silbidos; i++) {
            const osc = ctx.createOscillator();
            const gan = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(base, t);
            osc.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.06);
            osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.12);
            gan.gain.setValueAtTime(0.0001, t);
            gan.gain.exponentialRampToValueAtTime(volumen, t + 0.02);
            gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            osc.connect(gan).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.13);
            t += 0.16 + Math.random() * 0.08;
        }
    }

    /** Cantan pájaros cada tanto (entre 6 y 18 s), mientras "Pájaros de fondo" esté activado. */
    empezarAmbiente() {
        const siguiente = () => setTimeout(() => {
            this.pajaro();
            siguiente();
        }, 6000 + Math.random() * 12000);
        siguiente();
    }

    /** La línea cortando el aire (ruido que baja) y el "plop" de la boya al caer. */
    lanzar() {
        this.ruido({ duracion: 0.25, frecuencia: 2500, q: 0.6, tipo: 'highpass', volumen: 0.18 });
        setTimeout(() => this.salpicar(0.25), 420);
    }

    /** Agua: ruido grave y corto. */
    salpicar(volumen = 0.4) {
        this.ruido({ duracion: 0.18, frecuencia: 500, q: 0.7, volumen });
    }

    /** M: devuelve true si quedó en silencio. */
    alternarSilencio() {
        const silencio = !ajustes.get('silencio');
        ajustes.set('silencio', silencio);
        return silencio;
    }
}

export const audio = new Audio();
