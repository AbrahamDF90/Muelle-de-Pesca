<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Una regla del juego que no se cumple ("ya la agarró otro", "se terminó el tiempo"…).
 * Laravel la convierte sola en una respuesta JSON con su código HTTP (render()).
 */
class JuegoException extends RuntimeException
{
    public function __construct(string $mensaje, public readonly int $estado = 422)
    {
        parent::__construct($mensaje);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->estado);
    }
}
