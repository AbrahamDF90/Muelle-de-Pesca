<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'genero', 'color', 'x', 'y', 'dir', 'puntos'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'x' => 'integer',
            'y' => 'integer',
            'puntos' => 'integer',
        ];
    }

    /**
     * @return HasMany<Mensaje, $this>
     */
    public function mensajes(): HasMany
    {
        return $this->hasMany(Mensaje::class);
    }

    /**
     * @return HasMany<Lance, $this>
     */
    public function lances(): HasMany
    {
        return $this->hasMany(Lance::class);
    }

    /**
     * Datos públicos del jugador: los que se mandan al canal de presencia
     * y a la vista del muelle. Nunca incluir email ni nada privado.
     *
     * @return array{id: int, nombre: string, genero: string, color: string, x: int, y: int, dir: string, puntos: int}
     */
    public function datosJugador(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->name,
            'genero' => $this->genero,
            'color' => $this->color,
            'x' => $this->x,
            'y' => $this->y,
            'dir' => $this->dir,
            'puntos' => $this->puntos,
        ];
    }
}
