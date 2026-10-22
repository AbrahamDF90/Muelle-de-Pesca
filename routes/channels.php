<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * El canal de PRESENCIA del muelle (en Reverb se llama "presence-muelle").
 * Cuando Echo hace join('muelle'), el navegador le pide permiso a Laravel en
 * POST /broadcasting/auth. Si la función devuelve un array, entra, y ESE array es lo
 * que los demás reciben en here() / joining() / leaving(): nombre, género, color, posición y puntos.
 * Si no hay sesión iniciada, Laravel responde 403 y no entra.
 */
Broadcast::channel(config('pesca.canal'), fn (User $user) => $user->datosJugador());
