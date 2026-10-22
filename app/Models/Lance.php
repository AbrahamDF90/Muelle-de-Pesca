<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'x', 'y', 'dir', 'zona', 'pez', 'lanzado_en', 'muerde_en', 'resultado', 'puntos', 'recogido_en'])]
class Lance extends Model
{
    public const PENDIENTE = 'pendiente';

    public const CAPTURADO = 'capturado';

    public const ESCAPO = 'escapo';

    public const TEMPRANO = 'temprano';

    public $timestamps = false;

    /**
     * Con milisegundos: sin esto Laravel guarda "Y-m-d H:i:s" y la ventana de 1,5 s para
     * recoger se mediría en segundos enteros.
     */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'integer',
            'y' => 'integer',
            'puntos' => 'integer',
            'lanzado_en' => 'datetime',
            'muerde_en' => 'datetime',
            'recogido_en' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** ¿Ya terminó la ventana para recoger? (el pez se fue) */
    public function vencido(): bool
    {
        return now()->gt($this->muerde_en->copy()->addMilliseconds(config('pesca.ventana_ms')));
    }
}
