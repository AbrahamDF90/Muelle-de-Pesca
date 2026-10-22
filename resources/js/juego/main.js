// Arranque del juego: pantalla de carga con progreso real → muelle.
//   fuentes 10 % → sprites 30 % → muelle dibujado 55 % → Echo conectado 80 % → here() 100 %

import { TILE, TIMEOUT_REVERB_MS } from './config.js';
import { apariencia, obtenerSprites } from './sprites.js';
import { MUELLE } from './mapa.js';
import { crearObjetos, dibujarAnimacionesDelSuelo, dibujarSuelo } from './mapa-dibujo.js';
import { Personaje, delta } from './personaje.js';
import { Entrada } from './entrada.js';
import { Red } from './red.js';
import { Multijugador } from './multijugador.js';
import { dibujarCana, Efectos, Pesca } from './pesca.js';
import { Ranking } from './ui/ranking.js';
import { PantallaCarga } from './ui/carga.js';
import { Hud } from './ui/hud.js';
import { Chat } from './ui/chat.js';
import { Modales } from './ui/modales.js';
import { audio } from './audio.js';
import { aplicarTamanoTexto } from './ajustes.js';
import { crearBotonera } from './ui/paneles.js';
import { crearControlesTactiles } from './ui/tactil.js';
import { fijarZonaVisible } from './ui/globo.js';

const { jugador, cupo, canal, peces, urlLances, urlRanking, urlChat, urlSalir } = window.MUELLE;

const ANCHO = MUELLE.ancho * TILE; // 832 px
const ALTO = MUELLE.alto * TILE; // 512 px

const recursos = { suelo: null, objetos: [] };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const siguienteFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function cargarFuentes() {
    const fuentes = Promise.all([
        document.fonts.load('16px "Press Start 2P"'),
        document.fonts.load('16px "Poppins"'),
        document.fonts.load('16px "MedievalSharp"'),
    ]);
    // Si una fuente tarda demasiado seguimos igual: el juego funciona con la de respaldo.
    await Promise.race([fuentes, esperar(3000)]);
}

const red = new Red();

async function conectar(carga) {
    carga.ocultarError();
    carga.retroceder(55);

    try {
        await red.conectar({ timeoutMs: TIMEOUT_REVERB_MS });
        carga.progreso(80);
        const jugadores = await red.unirse(canal, { timeoutMs: TIMEOUT_REVERB_MS });

        // here() incluye a uno mismo: si además de vos ya hay `cupo` personas, está llena.
        if (jugadores.length > cupo) {
            red.desconectar();
            carga.mostrarError(`El muelle está lleno (${cupo}/${cupo}). Probá de nuevo en un rato.`, () => conectar(carga));
            return;
        }

        carga.progreso(100);
        await carga.terminar();
        iniciarJuego(jugadores);
    } catch (error) {
        carga.mostrarError(error.message, () => conectar(carga));
    }
}

// ───────────── Pantalla y cámara ─────────────

/**
 * Si el muelle entra en la ventana, se ve entero, agrandada de a medios (×1, ×1,5, ×2…):
 * con escalas "redondas" el pixel art se sigue viendo nítido. Si no entra ni a ×1
 * (celulares), se ve una parte a ×1 y la cámara sigue al jugador.
 */
function ajustarPantalla(canvas, ctx) {
    const s = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
    const escala = Math.max(1, Math.floor(s * 2) / 2);
    const w = Math.ceil(window.innerWidth / escala);
    const h = Math.ceil(window.innerHeight / escala);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = false; // cambiar el tamaño del canvas resetea el contexto
    }
    canvas.style.width = `${w * escala}px`;
    canvas.style.height = `${h * escala}px`;
    return { w, h, escala };
}

/** Si el muelle entra, queda centrado; si no, la cámara sigue al jugador sin salirse del mapa. */
function posicionCamara(vista, yo) {
    const eje = (centro, tamVista, tamMapa) => (tamVista >= tamMapa
        ? Math.round((tamMapa - tamVista) / 2)
        : Math.round(Math.min(Math.max(centro - tamVista / 2, 0), tamMapa - tamVista)));
    const compensar = document.body.classList.contains('es-tactil') ? Math.round(vista.h * 0.12) : 0;
    return {
        x: eje(yo.px * TILE + TILE / 2, vista.w, ANCHO),
        y: eje(yo.py * TILE + TILE / 2 + compensar, vista.h, ALTO),
    };
}

// ───────────── El juego ─────────────

function iniciarJuego(jugadoresIniciales) {
    const pantallaJuego = document.getElementById('muelle');
    const canvas = document.getElementById('pantalla');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    pantallaJuego.hidden = false;

    const token = document.querySelector('meta[name="csrf-token"]').content;
    const entrada = new Entrada();
    const yo = new Personaje(jugador);

    const hud = new Hud(document.getElementById('hud'));
    hud.mostrar();
    audio.empezarAmbiente();
    red.on('estado', (estado) => hud.wifi(estado));

    const multi = new Multijugador({ red, yo, hud, cupo, mapa: MUELLE, iniciales: jugadoresIniciales });
    const personajeDe = (id) => (id === yo.id ? yo : multi.remotos.get(id));

    const chat = new Chat({
        raiz: document.getElementById('chat'),
        entrada,
        hud,
        red,
        url: urlChat,
        alMensaje: (m) => {
            personajeDe(m.user_id)?.decir(m.texto);
            if (m.user_id !== yo.id) audio.efecto('mensaje');
        },
    });
    chat.cargarHistorial();
    multi.alEntrarOSalir = (j, entra) => chat.agregarAviso(`${j.nombre} ${entra ? 'entró al' : 'salió del'} muelle`);

    let vista;
    const acomodar = () => {
        vista = ajustarPantalla(canvas, ctx);
        chat.acomodar(window.innerWidth >= 900 && window.innerHeight >= 560);
    };
    acomodar();
    window.addEventListener('resize', acomodar);

    const modales = new Modales(entrada, document.getElementById('modales'));

    window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyM' || e.repeat || e.target instanceof HTMLInputElement) return;
        hud.toast(audio.alternarSilencio() ? 'Sonido desactivado' : 'Sonido activado');
    });

    crearBotonera({
        raiz: document.querySelector('[data-botones]'),
        modales,
        red,
        urlSalir,
        obtenerJugadores: () => [
            { nombre: yo.nombre, genero: yo.genero, color: yo.color, esPropio: true },
            ...multi.personajes().filter((r) => !r.saliendo).map((r) => ({ nombre: r.nombre, genero: r.genero, color: r.color })),
        ],
    });
    chat.alCambiarNoLeidos = crearControlesTactiles({
        raiz: document.getElementById('tactil'),
        alChat: () => { if (!entrada.bloqueada) chat.abrir(); },
    });

    // ─── La pesca ───
    const efectos = new Efectos();
    const ranking = new Ranking({
        raiz: document.getElementById('ranking'), url: urlRanking, yoId: yo.id, peces, puntos: jugador.puntos,
    });
    ranking.cargar().catch(() => hud.toast('No se pudo cargar el ranking.', 'error'));

    const pesca = new Pesca({
        url: urlLances,
        token,
        red,
        mapa: MUELLE,
        yo,
        efectos,
        alAvisar: (texto, tipo) => hud.toast(texto, tipo),
        alPescar: (datos) => ranking.misPuntos(datos.total),
    });

    // Alguien sacó un pez (lo avisa Laravel, el árbitro). Va a todos, también a mí: así el
    // ranking se actualiza igual en todas las pantallas.
    red.on('pez', (d) => {
        const antes = ranking.puestoDe(d.user_id);
        ranking.pintar(d.ranking);
        if (d.user_id === yo.id) {
            ranking.misPuntos(d.total);
            const ahora = ranking.puestoDe(yo.id);
            if (ahora === 1 && antes !== 1) hud.toast('¡Estás primero en el ranking!');
            return; // el salto del pez y el aviso ya los hizo pesca.js con la respuesta del POST
        }
        const r = multi.remotos.get(d.user_id);
        if (r) efectos.pezSaltando(r, d.pez.slug, `+${d.pez.puntos}`, '#ffffff');
        audio.efecto('pezAjeno');
        if (d.pez.puntos >= 25) chat.agregarAviso(`${d.nombre} sacó ${d.pez.slug === 'pirana' ? 'una' : 'un'} ${d.pez.nombre} (+${d.pez.puntos})`);
    });

    window.addEventListener('keydown', (e) => {
        if (!['KeyE', 'Space'].includes(e.code) || e.repeat || entrada.bloqueada || e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        pesca.accion();
    });

    // Cartelito de ayuda abajo al centro: "E: tirar la línea", "¡PICA!"…
    const pista = document.getElementById('pesca-pista');
    let ultimaPista = '';
    function actualizarPista() {
        const p = pesca.pista(document.body.classList.contains('es-tactil'));
        const texto = p?.texto ?? '';
        if (texto === ultimaPista) return;
        ultimaPista = texto;
        pista.hidden = !p;
        pista.textContent = texto;
        pista.classList.toggle('pesca-pista--urgente', Boolean(p?.urgente));
    }

    function moverJugador(dt) {
        const sobra = yo.actualizar(dt);
        if (yo.moviendo) return;

        const dir = entrada.direccion();
        if (!dir) return;
        // Con la línea en el agua no se camina (primero recogé).
        if (pesca.ocupado) return;
        const [dx, dy] = delta(dir);
        if (MUELLE.esCaminable(yo.x + dx, yo.y + dy)) {
            yo.pasoA(yo.x + dx, yo.y + dy, dir);
            if (sobra > 0) yo.actualizar(sobra);
            audio.paso(MUELLE.tipo(yo.x, yo.y));
            multi.avisarMovimiento();
        } else if (yo.dir !== dir) {
            yo.dir = dir;
            multi.avisarMovimiento();
        }
    }

    function quedoTapado() {
        return recursos.objetos.some((o) => o.alto && o.y > yo.y && o.y <= yo.y + 2 && Math.abs(o.x - yo.x) <= 1);
    }

    let anterior = performance.now();
    function bucle(t) {
        const dt = Math.min(100, t - anterior);
        anterior = t;

        moverJugador(dt);
        multi.actualizar(dt);
        pesca.actualizar();
        actualizarPista();

        const cam = posicionCamara(vista, yo);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1f5a80';
        ctx.fillRect(0, 0, vista.w, vista.h);
        ctx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
        fijarZonaVisible(Math.max(0, cam.x), Math.min(ANCHO, cam.x + vista.w));

        ctx.drawImage(recursos.suelo, 0, 0);
        dibujarAnimacionesDelSuelo(ctx, MUELLE, t, { x: 0, y: 0 }, { x: MUELLE.ancho - 1, y: MUELLE.alto - 1 });

        // Objetos altos y jugadores, ordenados por fila: el que está más abajo tapa al de arriba.
        const remotos = multi.personajes();
        const entidades = [
            ...recursos.objetos.map((o) => ({ orden: o.y, dibujar: () => o.dibujar(ctx, t) })),
            ...[...remotos, yo].map((p) => ({ orden: p.py + 0.01, dibujar: () => p.dibujar(ctx) })),
        ].sort((a, b) => a.orden - b.orden);
        entidades.forEach((e) => e.dibujar());
        if (quedoTapado()) yo.dibujar(ctx, 0.45, false);

        // Cañas, líneas y boyas encima de todo (la línea cruza por delante de los personajes).
        [...remotos, yo].forEach((p) => dibujarCana(ctx, p, t));
        efectos.dibujar(ctx, t);
        const ocupados = [];
        yo.dibujarNombre(ctx, t, true, ocupados);
        remotos.forEach((r) => {
            r.baseEtiqueta = null;
            r.dibujarNombre(ctx, t, false, ocupados);
        });
        yo.dibujarGlobo(ctx, true, ocupados);
        remotos.forEach((r) => r.dibujarGlobo(ctx, false, ocupados));
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);
}

async function arrancar() {
    aplicarTamanoTexto();
    const carga = new PantallaCarga(document.getElementById('carga'));

    await cargarFuentes();
    carga.progreso(10);

    const hoja = obtenerSprites({ genero: jugador.genero, color: jugador.color, ...apariencia(jugador.id) });
    carga.ponerPersonaje(hoja);
    await siguienteFrame();
    carga.progreso(30);

    recursos.suelo = dibujarSuelo(MUELLE);
    recursos.objetos = crearObjetos(MUELLE);
    await siguienteFrame();
    carga.progreso(55);

    await conectar(carga);
}

arrancar();
