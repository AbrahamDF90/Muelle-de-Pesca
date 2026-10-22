<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class MuelleController extends Controller
{
    public function mostrar(Request $request): View
    {
        return view('muelle', [
            // Lo que el JS del juego necesita para arrancar (queda en window.MUELLE).
            'config' => [
                'jugador' => $request->user()->datosJugador(),
                'cupo' => config('pesca.cupo'),
                'canal' => config('pesca.canal'),
                // Nombre y puntos de cada pez (para la tabla de la pantalla). Las chances no hacen falta.
                'peces' => collect(config('pesca.peces'))->map(fn ($p) => ['nombre' => $p['nombre'], 'puntos' => $p['puntos']]),
                'urlLances' => url('lances'),
                'urlRanking' => route('ranking'),
                'urlChat' => route('chat'),
                'urlSalir' => route('salir'),
            ],
        ]);
    }
}
