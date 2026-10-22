<?php

namespace App\Services;

use App\Events\PezCapturado;
use App\Exceptions\JuegoException;
use App\Models\Lance;
use App\Models\User;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Las reglas de la pesca. El SERVIDOR es el árbitro:
 *  - al tirar la línea decide QUÉ pez va a picar y CUÁNDO (el navegador no lo sabe);
 *  - al recoger controla si fue a tiempo, suma los puntos y avisa a todos.
 */
class PescaService
{
    public function __construct(private MuelleService $muelle) {}

    /**
     * Tirar la línea desde (x, y) mirando hacia `dir`.
     *
     * @return array{id: int, zona: string, muerde_en: int, ventana_ms: int, ahora: int}
     */
    public function lanzar(User $user, int $x, int $y, string $dir): array
    {
        $zona = $this->muelle->zonaDePesca($x, $y, $dir);
        if ($zona === null) {
            throw new JuegoException('Desde ahí no llegás al agua: parate en el borde, mirando al río.');
        }

        $lance = DB::transaction(function () use ($user, $x, $y, $dir, $zona) {
            // lockForUpdate sobre el usuario: dos clics rápidos no tiran dos líneas a la vez.
            User::whereKey($user->id)->lockForUpdate()->first();

            $ultimo = Lance::where('user_id', $user->id)->latest('id')->first();
            if ($ultimo?->resultado === Lance::PENDIENTE && ! $ultimo->vencido()) {
                throw new JuegoException('Ya tenés la línea en el agua.', 409);
            }
            if ($ultimo?->resultado === Lance::PENDIENTE) {
                // Nadie la recogió a tiempo: el pez se fue.
                $ultimo->update(['resultado' => Lance::ESCAPO]);
            }
            if ($ultimo && $ultimo->lanzado_en->diffInMilliseconds(now()) < config('pesca.espera_entre_lances_ms')) {
                throw new JuegoException('Esperá un momento antes de volver a tirar.', 429);
            }

            $espera = random_int(config('pesca.pique_min_ms'), config('pesca.pique_max_ms'));

            return Lance::create([
                'user_id' => $user->id,
                'x' => $x,
                'y' => $y,
                'dir' => $dir,
                'zona' => $zona,
                'pez' => $this->sortearPez($zona),
                'lanzado_en' => now(),
                'muerde_en' => now()->addMilliseconds($espera),
            ]);
        });

        // Ojo: NO devolvemos el pez. Se sabe recién cuando lo sacás.
        return [
            'id' => $lance->id,
            'zona' => $zona,
            'muerde_en' => $lance->muerde_en->getTimestampMs(),
            'ventana_ms' => config('pesca.ventana_ms'),
            'ahora' => now()->getTimestampMs(),
        ];
    }

    /**
     * Recoger la línea. Antes de que pique: se asustó. Dentro de la ventana: ¡pescado!
     * Después: se escapó.
     *
     * @return array{capturado: bool, motivo: string, pez: ?array<string, mixed>, puntos: int, total: int}
     */
    public function recoger(User $user, Lance $lance): array
    {
        [$resultado, $total] = DB::transaction(function () use ($user, $lance) {
            // Dos "recoger" del mismo lance (doble clic) se procesan de a uno.
            $lance = Lance::lockForUpdate()->findOrFail($lance->id);

            if ($lance->user_id !== $user->id) {
                throw new JuegoException('Esa línea no es tuya.', 403);
            }
            if ($lance->resultado !== Lance::PENDIENTE) {
                throw new JuegoException('Esa línea ya la recogiste.', 409);
            }

            $ahora = now();
            $resultado = match (true) {
                $ahora->lt($lance->muerde_en) => Lance::TEMPRANO,
                $lance->vencido() => Lance::ESCAPO,
                default => Lance::CAPTURADO,
            };
            $puntos = $resultado === Lance::CAPTURADO ? config("pesca.peces.{$lance->pez}.puntos") : 0;
            $lance->update(['resultado' => $resultado, 'puntos' => $puntos, 'recogido_en' => $ahora]);

            if ($puntos > 0) {
                // increment() suma en la base (UPDATE ... SET puntos = puntos + 25): no pisa nada.
                User::whereKey($user->id)->increment('puntos', $puntos);
            }

            return [$lance, User::whereKey($user->id)->value('puntos')];
        });

        $capturado = $resultado->resultado === Lance::CAPTURADO;
        if ($capturado) {
            Log::info('Pez capturado', ['user' => $user->id, 'pez' => $resultado->pez, 'puntos' => $resultado->puntos]);
            $this->emitir(new PezCapturado($user->fresh(), $resultado, $this->ranking()));
        }

        return [
            'capturado' => $capturado,
            'motivo' => $resultado->resultado,
            'pez' => $capturado ? $this->pez($resultado->pez) : null,
            'puntos' => $resultado->puntos,
            'total' => $total,
        ];
    }

    /**
     * Top 10 por puntos, con cuántos peces de cada tipo sacó cada uno.
     *
     * @return list<array<string, mixed>>
     */
    public function ranking(int $cuantos = 10): array
    {
        $top = User::where('puntos', '>', 0)->orderByDesc('puntos')->orderBy('id')->take($cuantos)->get(['id', 'name', 'genero', 'color', 'puntos']);

        // Una sola consulta para contar los peces de todos (y no una por jugador).
        $conteos = Lance::where('resultado', Lance::CAPTURADO)->whereIn('user_id', $top->pluck('id'))
            ->selectRaw('user_id, pez, count(*) as cantidad')->groupBy('user_id', 'pez')->get()
            ->groupBy('user_id');

        return $top->values()->map(fn (User $u, int $i) => [
            'puesto' => $i + 1,
            'id' => $u->id,
            'nombre' => $u->name,
            'genero' => $u->genero,
            'color' => $u->color,
            'puntos' => $u->puntos,
            'peces' => collect(array_keys(config('pesca.peces')))
                ->mapWithKeys(fn ($pez) => [$pez => (int) ($conteos->get($u->id)?->firstWhere('pez', $pez)?->cantidad ?? 0)])
                ->all(),
        ])->all();
    }

    /** @return array{slug: string, nombre: string, puntos: int} */
    public function pez(string $slug): array
    {
        $datos = config("pesca.peces.$slug");

        return ['slug' => $slug, 'nombre' => $datos['nombre'], 'puntos' => $datos['puntos']];
    }

    /** Sortea el pez según las chances de la zona (config/pesca.php). */
    private function sortearPez(string $zona): string
    {
        $tirada = random_int(1, 100);
        foreach (config('pesca.peces') as $slug => $datos) {
            $tirada -= $datos[$zona];
            if ($tirada <= 0) {
                return $slug;
            }
        }

        return array_key_first(config('pesca.peces'));
    }

    /** Emite por Reverb; si Reverb está caído, los puntos igual quedan guardados. */
    private function emitir(object $evento): void
    {
        try {
            event($evento);
        } catch (BroadcastException $e) {
            Log::error('No se pudo emitir '.class_basename($evento), ['error' => $e->getMessage()]);
        }
    }
}
