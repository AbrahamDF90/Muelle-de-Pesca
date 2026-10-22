<?php

namespace App\Events;

use App\Models\Lance;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Alguien sacó un pez (el servidor ya lo validó): quién, qué pez, cuántos puntos y el ranking
 * actualizado. Va a TODOS (también al que pescó, así su ranking se actualiza igual que el de
 * los demás). En JS: .listen('.PezCapturado').
 */
class PezCapturado implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param  list<array<string, mixed>>  $ranking
     */
    public function __construct(public User $user, public Lance $lance, public array $ranking) {}

    /**
     * @return list<PresenceChannel>
     */
    public function broadcastOn(): array
    {
        return [new PresenceChannel(config('pesca.canal'))];
    }

    public function broadcastAs(): string
    {
        return 'PezCapturado';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $pez = config("pesca.peces.{$this->lance->pez}");

        return [
            'user_id' => $this->user->id,
            'nombre' => $this->user->name,
            'color' => $this->user->color,
            'pez' => ['slug' => $this->lance->pez, 'nombre' => $pez['nombre'], 'puntos' => $pez['puntos']],
            'total' => $this->user->puntos,
            'ranking' => $this->ranking,
        ];
    }
}
