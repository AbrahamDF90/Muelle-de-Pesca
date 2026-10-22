<?php

namespace App\Services;

/**
 * El mapa del muelle, en el MISMO archivo que usa el JS para dibujar y para las colisiones:
 * resources/js/juego/data/muelle.json. PHP lo usa para saber dónde aparece cada uno y
 * si desde una celda, mirando hacia un lado, la línea cae al agua (y en qué zona).
 */
class MuelleService
{
    public const DIRECCIONES = ['arriba' => [0, -1], 'abajo' => [0, 1], 'izquierda' => [-1, 0], 'derecha' => [1, 0]];

    /** @var array{ancho: int, alto: int, filas: list<string>, leyenda: array<string, array<string, mixed>>}|null */
    private ?array $mapa = null;

    /**
     * @return array{ancho: int, alto: int, filas: list<string>, leyenda: array<string, array<string, mixed>>}
     */
    public function mapa(): array
    {
        return $this->mapa ??= json_decode(
            file_get_contents(resource_path('js/juego/data/muelle.json')),
            true,
            flags: JSON_THROW_ON_ERROR,
        );
    }

    /** @return array<string, mixed> lo que dice la leyenda de esa celda (o [] si está fuera) */
    public function celda(int $x, int $y): array
    {
        $mapa = $this->mapa();
        if ($x < 0 || $y < 0 || $x >= $mapa['ancho'] || $y >= $mapa['alto']) {
            return [];
        }

        return $mapa['leyenda'][$mapa['filas'][$y][$x]] ?? [];
    }

    public function esCaminable(int $x, int $y): bool
    {
        return ($this->celda($x, $y)['caminable'] ?? false) === true;
    }

    /**
     * Si alguien parado en (x, y) mirando hacia `dir` tira la línea, ¿dónde cae?
     * 'orilla' (agua baja), 'honda' (lo profundo) o null (no hay agua adelante).
     */
    public function zonaDePesca(int $x, int $y, string $dir): ?string
    {
        if (! $this->esCaminable($x, $y) || ! isset(self::DIRECCIONES[$dir])) {
            return null;
        }
        [$dx, $dy] = self::DIRECCIONES[$dir];

        return $this->celda($x + $dx, $y + $dy)['pesca'] ?? null;
    }

    /**
     * Todas las celdas caminables.
     *
     * @return list<array{int, int}>
     */
    public function celdasCaminables(): array
    {
        $mapa = $this->mapa();
        $celdas = [];
        for ($y = 0; $y < $mapa['alto']; $y++) {
            for ($x = 0; $x < $mapa['ancho']; $x++) {
                if ($this->esCaminable($x, $y)) {
                    $celdas[] = [$x, $y];
                }
            }
        }

        return $celdas;
    }

    /**
     * Dónde aparece alguien que acaba de entrar: en la playa, al azar.
     *
     * @return array{x: int, y: int, dir: string}
     */
    public function puntoDeAparicion(): array
    {
        $playa = collect($this->celdasCaminables())->filter(fn ($c) => ($this->celda($c[0], $c[1])['tipo'] ?? null) === 'playa');
        [$x, $y] = $playa->random();

        return ['x' => $x, 'y' => $y, 'dir' => 'abajo'];
    }
}
