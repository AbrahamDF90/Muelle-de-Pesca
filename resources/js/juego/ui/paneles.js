// Botones del HUD (arriba a la izquierda) y sus paneles: Ajustes, Info y Jugadores.
// Cada panel es una "ventana" de la pila de Modales: Esc lo cierra.

import { ajustes, aplicarTamanoTexto } from '../ajustes.js';
import { crearCanvas, dibujarGrilla } from '../pixel.js';
import { el } from './modales.js';

const VIOLETA = '#4a2f1a'; // los íconos van en marrón oscuro sobre los botones de pergamino
const NOMBRE_GENERO = { hombre: 'Pescador', mujer: 'Pescadora' };

const ICONOS = {
    ajustes: [
        '....XXX....',
        '.X..XXX..X.',
        '.XXXXXXXXX.',
        '..XXX.XXX..',
        'XXXX...XXXX',
        'XXX.....XXX',
        'XXXX...XXXX',
        '..XXX.XXX..',
        '.XXXXXXXXX.',
        '.X..XXX..X.',
        '....XXX....',
    ],
    info: [
        '....XXX....',
        '....XXX....',
        '...........',
        '...XXXX....',
        '....XXX....',
        '....XXX....',
        '....XXX....',
        '....XXX....',
        '...XXXXX...',
    ],
    jugadores: [
        '...XX.......',
        '..XXXX..XX..',
        '..XXXX.XXXX.',
        '...XX..XXXX.',
        '........XX..',
        '.XXXXXX.....',
        'XXXXXXXX.XX.',
        'XXXXXXXXXXXX',
        'XXXXXXXXXXXX',
    ],
};

function icono(nombre) {
    const grilla = ICONOS[nombre];
    const canvas = crearCanvas(grilla[0].length * 2, grilla.length * 2);
    dibujarGrilla(canvas.getContext('2d'), grilla, { X: VIOLETA }, 0, 0, 2);
    canvas.className = 'icono-pixel';
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
}

/** Ventana genérica con título, botón ✕ y contenido. */
class Panel {
    constructor(titulo, alCerrar) {
        this.alCerrar = alCerrar;
        this.elemento = el('div', 'modal');
        this.elemento.tabIndex = -1;
        this.elemento.setAttribute('role', 'dialog');
        this.elemento.setAttribute('aria-modal', 'true');
        this.elemento.setAttribute('aria-label', titulo);
        this.elemento.addEventListener('click', (e) => { if (e.target === this.elemento) this.alCerrar(); });

        const caja = el('section', 'panel');
        const cabecera = el('header', 'panel-cabecera');
        const cerrar = el('button', 'panel-cerrar', '✕');
        cerrar.type = 'button';
        cerrar.setAttribute('aria-label', 'Cerrar');
        cerrar.addEventListener('click', () => this.alCerrar());
        cabecera.append(el('h2', 'panel-titulo', titulo), cerrar);
        this.cuerpo = el('div', 'panel-cuerpo');
        caja.append(cabecera, this.cuerpo, el('p', 'modal-ayuda', 'Esc cerrar'));
        this.elemento.append(caja);
    }

    tecla(e) {
        if (e.code !== 'Escape') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.alCerrar();
    }
}

function grupoOpciones(titulo, clave, opciones) {
    const fieldset = el('fieldset', 'panel-grupo');
    fieldset.append(el('legend', null, titulo));
    for (const [valor, texto] of opciones) {
        const label = el('label', 'panel-opcion');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = clave;
        radio.value = valor;
        radio.checked = ajustes.get(clave) === valor;
        radio.addEventListener('change', () => ajustes.set(clave, valor));
        label.append(radio, ` ${texto}`);
        fieldset.append(label);
    }
    return fieldset;
}

/** Casilla de verificación atada a un ajuste (true/false). */
function casilla(clave, texto) {
    const label = el('label', 'panel-opcion');
    const check = el('input');
    check.type = 'checkbox';
    check.checked = ajustes.get(clave);
    check.addEventListener('change', () => ajustes.set(clave, check.checked));
    label.append(check, ` ${texto}`);
    return label;
}

function panelAjustes(alCerrar, urlSalir) {
    const panel = new Panel('Ajustes', alCerrar);

    // Volumen
    const volumen = el('fieldset', 'panel-grupo');
    volumen.append(el('legend', null, 'Volumen'));
    const fila = el('div', 'panel-volumen');
    const rango = el('input');
    rango.type = 'range';
    rango.min = '0';
    rango.max = '100';
    rango.value = String(Math.round(ajustes.get('volumen') * 100));
    rango.setAttribute('aria-label', 'Volumen');
    const valor = el('span', 'panel-valor', `${rango.value}%`);
    rango.addEventListener('input', () => {
        valor.textContent = `${rango.value}%`;
        ajustes.set('volumen', Number(rango.value) / 100);
    });
    fila.append(rango, valor);
    const silencio = el('label', 'panel-opcion');
    const check = el('input');
    check.type = 'checkbox';
    check.checked = ajustes.get('silencio');
    check.addEventListener('change', () => ajustes.set('silencio', check.checked));
    ajustes.alCambiar((clave, v) => { if (clave === 'silencio') check.checked = v; });
    silencio.append(check, ' Silenciar (tecla M)');
    volumen.append(fila, silencio, casilla('ambiente', 'Pájaros de fondo'), casilla('pasos', 'Sonido de tus pasos'));

    const nombres = grupoOpciones('Nombres sobre los personajes', 'nombres', [
        ['auto', 'Automático (con más de 25 jugadores, solo los cercanos)'],
        ['todos', 'Todos'],
        ['cercanos', 'Solo los que están a 4 celdas o menos'],
    ]);

    const texto = grupoOpciones('Tamaño del texto', 'texto', [
        ['normal', 'Normal'],
        ['grande', 'Grande'],
        ['muy-grande', 'Muy grande'],
    ]);
    texto.addEventListener('change', aplicarTamanoTexto);

    // Salir del muelle (POST /salir con el token CSRF, como cualquier formulario de Laravel).
    const form = el('form', 'panel-salir');
    form.method = 'POST';
    form.action = urlSalir;
    const token = el('input');
    token.type = 'hidden';
    token.name = '_token';
    token.value = document.querySelector('meta[name="csrf-token"]').content;
    const salir = el('button', 'boton boton--secundario', 'Salir del muelle');
    salir.type = 'submit';
    form.append(token, salir);

    panel.cuerpo.append(volumen, nombres, texto, form);
    return panel;
}

const CONTROLES = [
    ['WASD / flechas', 'Caminar y girar'],
    ['E / Espacio', 'Tirar la línea (mirando al agua) y recoger cuando pica'],
    ['Enter', 'Abrir el chat y enviar'],
    ['Esc', 'Cerrar el chat o una ventana'],
    ['M', 'Sonido sí / no'],
];

function panelInfo(alCerrar) {
    const panel = new Panel('Info', alCerrar);
    const tabla = el('dl', 'panel-controles');
    for (const [teclas, accion] of CONTROLES) tabla.append(el('dt', null, teclas), el('dd', null, accion));

    const creditos = el('div', 'panel-creditos');
    creditos.append(
        el('p', 'panel-destacado', 'Trabajo práctico de Programación IV — TUP UTN'),
        el('p', null, 'Laravel 13 + Reverb + Echo · Canvas 2D y JavaScript sin frameworks.'),
        el('p', null, 'Reglas: parate en el borde del muelle o de la playa mirando al agua y tirá la línea. Cuando la boya se hunde y aparece "¡PICA!", recogé enseguida: si te apurás el pez se asusta y si tardás se escapa. Piraña 5, Bagre 10, Dorado 25 y Surubí 50 puntos. En lo hondo (la punta del muelle) salen más dorados y surubíes. El servidor decide qué pez pica y cuándo.'),
        el('p', null, 'El muelle y los personajes están dibujados por código (pixel art desde matrices). Sonidos generados con WebAudio. Fuentes: Poppins, Press Start 2P y MedievalSharp (licencia OFL).'),
    );
    panel.cuerpo.append(el('h3', 'panel-subtitulo', 'Controles'), tabla, el('h3', 'panel-subtitulo', 'Créditos'), creditos);
    return panel;
}

function panelJugadores(alCerrar, obtenerJugadores, red) {
    const panel = new Panel('Jugadores', alCerrar);
    const contador = el('p', 'panel-valor');
    const lista = el('ul', 'panel-jugadores');
    const pintar = () => {
        const jugadores = obtenerJugadores();
        contador.textContent = `${jugadores.length} conectados`;
        lista.replaceChildren(...jugadores.map((j) => {
            const li = el('li');
            const punto = el('span', 'muelle-punto');
            punto.style.background = j.color;
            li.append(punto, el('span', null, j.esPropio ? `${j.nombre} (vos)` : j.nombre), el('span', 'panel-clase', NOMBRE_GENERO[j.genero] ?? ''));
            return li;
        }));
    };
    pintar();
    // Mientras está abierto, se actualiza solo cuando alguien entra o sale.
    const refrescar = () => { if (panel.elemento.isConnected) pintar(); };
    red.on('entra', refrescar).on('sale', refrescar).on('here', refrescar);
    panel.cuerpo.append(contador, lista);
    return panel;
}

/**
 * Arma la botonera del HUD.
 * @param obtenerJugadores () => [{ nombre, genero, color, esPropio }]
 */
export function crearBotonera({ raiz, modales, obtenerJugadores, red, urlSalir }) {
    const fabricas = {
        ajustes: (cerrar) => panelAjustes(cerrar, urlSalir),
        info: (cerrar) => panelInfo(cerrar),
        jugadores: (cerrar) => panelJugadores(cerrar, obtenerJugadores, red),
    };
    const titulos = { ajustes: 'Ajustes', info: 'Info', jugadores: 'Jugadores' };

    for (const nombre of Object.keys(fabricas)) {
        const boton = el('button', 'hud-boton');
        boton.type = 'button';
        boton.title = titulos[nombre];
        boton.setAttribute('aria-label', titulos[nombre]);
        boton.append(icono(nombre));
        boton.addEventListener('click', () => {
            if (modales.abierto) return;
            const panel = fabricas[nombre](() => modales.cerrar(panel));
            modales.abrir(panel);
        });
        raiz.append(boton);
    }
}
