<?php

namespace App\Events;

use App\Http\Resources\MensajeResource;
use App\Models\Mensaje;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Un mensaje nuevo del chat. Laravel lo manda a Reverb (firmado con el SECRET) y Reverb
 * lo reparte a todos los del canal. En JS se escucha con .listen('.MensajeEnviado').
 *
 * Es el mismo patrón del apunte (emisor → evento ShouldBroadcast → receptor con Echo),
 * pero sobre un canal de PRESENCIA en vez de uno público: solo lo reciben los que
 * entraron al muelle (con sesión iniciada) y además sabemos quién está.
 * Como QUEUE_CONNECTION=sync, se emite en el momento, sin cola ni worker.
 */
class MensajeEnviado implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Mensaje $mensaje) {}

    /**
     * @return list<PresenceChannel>
     */
    public function broadcastOn(): array
    {
        return [new PresenceChannel(config('pesca.canal'))];
    }

    /** Nombre corto del evento (sin el namespace App\Events\...). */
    public function broadcastAs(): string
    {
        return 'MensajeEnviado';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return (new MensajeResource($this->mensaje->loadMissing('user')))->resolve();
    }
}
