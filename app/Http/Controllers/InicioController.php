<?php

namespace App\Http\Controllers;

use App\Http\Requests\EntrarRequest;
use App\Models\User;
use App\Services\MuelleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

class InicioController extends Controller
{
    public function mostrar(): View
    {
        return view('inicio', [
            'generos' => config('pesca.generos'),
            'paleta' => config('pesca.paleta'),
        ]);
    }

    public function entrar(EntrarRequest $request, MuelleService $muelle): RedirectResponse
    {
        $datos = $request->validated();

        $user = User::create([
            'name' => $datos['nombre'],
            'genero' => $datos['genero'],
            'color' => $datos['color'],
            ...$muelle->puntoDeAparicion(), // x, y, dir: un lugar al azar de la playa
        ]);

        Auth::login($user);
        $request->session()->regenerate(); // evita "session fixation"

        Log::info('Entró al muelle', ['id' => $user->id, 'nombre' => $user->name, 'genero' => $user->genero, 'ip' => $request->ip()]);

        return redirect()->route('muelle');
    }

    public function salir(Request $request): RedirectResponse
    {
        Log::info('Salió del muelle', ['id' => $request->user()->id]);

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('inicio');
    }
}
