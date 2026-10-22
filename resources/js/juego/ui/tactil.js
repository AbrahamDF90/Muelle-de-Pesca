// Controles en pantalla para celulares y tablets: d-pad + botón 🎣 (pescar) + botón 💬 (chat). El d-pad simula
// las mismas teclas que el teclado, así caminar funciona sin código especial para táctil.
// Para cerrar cualquier ventana está su ✕ (por eso no hace falta un botón "atrás").

import { el } from './modales.js';

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

function tecla(tipo, code) {
    const key = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' }[code];
    window.dispatchEvent(new KeyboardEvent(tipo, { code, key, bubbles: true }));
}

/** Con `code` (d-pad), la tecla queda apretada mientras el dedo está apoyado. */
function boton(clase, texto, etiqueta, code) {
    const b = el('button', `tactil-boton ${clase}`, texto);
    b.type = 'button';
    b.setAttribute('aria-label', etiqueta);
    if (code) {
        // pointerdown/up y no click: mantener apretada una flecha tiene que seguir caminando.
        b.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            b.setPointerCapture(e.pointerId);
            tecla('keydown', code);
        });
        const soltar = () => tecla('keyup', code);
        b.addEventListener('pointerup', soltar);
        b.addEventListener('pointercancel', soltar);
    }
    b.addEventListener('contextmenu', (e) => e.preventDefault()); // sin menú al mantener apretado
    return b;
}

/** Devuelve una función para mostrar en el 💬 cuántos mensajes llegaron sin leer (o nada). */
export function crearControlesTactiles({ raiz, alChat }) {
    if (!esTactil()) return () => {};

    const pad = el('div', 'tactil-pad');
    pad.append(
        boton('tactil-arriba', '▲', 'Arriba', 'ArrowUp'),
        boton('tactil-izquierda', '◀', 'Izquierda', 'ArrowLeft'),
        boton('tactil-derecha', '▶', 'Derecha', 'ArrowRight'),
        boton('tactil-abajo', '▼', 'Abajo', 'ArrowDown'),
    );

    const acciones = el('div', 'tactil-acciones');
    // 🎣 simula la tecla E (tirar / recoger la línea).
    const pescar = boton('tactil-pescar', '🎣', 'Pescar');
    pescar.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
    });
    const chat = boton('tactil-chat', '💬', 'Chat');
    // El teclado del celular solo se abre si el foco va al input dentro del toque.
    chat.addEventListener('click', alChat);
    acciones.append(pescar, chat);

    raiz.append(pad, acciones);
    raiz.hidden = false;
    document.body.classList.add('es-tactil');
    // En el celular no hay Enter ni Esc a la vista: el texto de ayuda habla de los botones.
    const input = document.querySelector('[data-input]');
    if (input) input.placeholder = 'Escribí un mensaje…';

    const globito = el('span', 'tactil-globito');
    globito.hidden = true;
    chat.append(globito);
    return (cantidad) => {
        globito.hidden = cantidad === 0;
        globito.textContent = cantidad > 9 ? '9+' : String(cantidad);
        chat.setAttribute('aria-label', cantidad ? `Chat (${cantidad} sin leer)` : 'Chat');
    };
}
