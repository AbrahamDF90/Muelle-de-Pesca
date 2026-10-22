<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Completa en el .env las claves de Reverb (REVERB_APP_ID, REVERB_APP_KEY y REVERB_APP_SECRET)
 * si están vacías, con valores al azar. Las usa `composer run setup`.
 * Nunca pisa claves que ya estén puestas.
 */
#[Signature('muelle:claves-reverb')]
#[Description('Genera las claves de Reverb en el .env si están vacías')]
class GenerarClavesReverb extends Command
{
    public function handle(): int
    {
        $ruta = base_path('.env');
        if (! file_exists($ruta)) {
            $this->error('No hay .env: copiá .env.example a .env primero.');

            return self::FAILURE;
        }

        $env = file_get_contents($ruta);
        $claves = [
            'REVERB_APP_ID' => (string) random_int(100000, 999999),
            'REVERB_APP_KEY' => bin2hex(random_bytes(10)),
            'REVERB_APP_SECRET' => bin2hex(random_bytes(16)),
        ];

        foreach ($claves as $clave => $valor) {
            // Solo si la línea está vacía (REVERB_APP_KEY= o REVERB_APP_KEY="").
            $env = preg_replace("/^{$clave}=(\"\")?\s*$/m", "{$clave}={$valor}", $env, 1, $cambios);
            $this->line($cambios ? "  {$clave} generada" : "  {$clave} ya tenía valor: no la toco");
        }

        file_put_contents($ruta, $env);
        $this->info('Listo. Si npm run dev estaba abierto, reinicialo (lee las VITE_ al arrancar).');

        return self::SUCCESS;
    }
}
