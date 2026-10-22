<?php

namespace App\Http\Controllers;

use App\Http\Requests\LanzarRequest;
use App\Models\Lance;
use App\Services\PescaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controlador flaco: recibe el pedido, llama a PescaService (donde están las reglas) y responde.
 * Si una regla no se cumple, el servicio lanza JuegoException y Laravel responde el JSON.
 */
class LanceController extends Controller
{
    public function __construct(private PescaService $pesca) {}

    public function lanzar(LanzarRequest $request): JsonResponse
    {
        $datos = $this->pesca->lanzar($request->user(), $request->integer('x'), $request->integer('y'), $request->string('dir')->toString());

        return response()->json(['data' => $datos], 201);
    }

    public function recoger(Request $request, Lance $lance): JsonResponse
    {
        return response()->json(['data' => $this->pesca->recoger($request->user(), $lance)]);
    }

    public function ranking(): JsonResponse
    {
        return response()->json(['data' => $this->pesca->ranking()]);
    }
}
