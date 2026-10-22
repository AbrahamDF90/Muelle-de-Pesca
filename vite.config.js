import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { fontsource } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                // Pantalla de inicio (Tailwind + vista previa del personaje)
                'resources/css/app.css',
                'resources/js/inicio.js',
                // El juego (canvas, sin Tailwind)
                'resources/css/juego.css',
                'resources/js/juego/main.js',
            ],
            refresh: true,
            // Las fuentes vienen de paquetes npm (@fontsource/...): se instalan con npm install y
            // se sirven desde nuestro servidor. Así el build no depende de internet.
            fonts: [
                fontsource('Poppins', { weights: [400, 600, 700] }),
                fontsource('Press Start 2P', { alias: 'press-start' }),
                fontsource('MedievalSharp', { alias: 'medieval-sharp' }),
            ],
        }),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
