<?php

namespace Tests\Feature;

use App\Services\MuelleService;
use Tests\TestCase;

/**
 * El mapa del muelle (resources/js/juego/data/muelle.json) lo usan el JS (dibujo y
 * colisiones) y PHP (dónde aparecés y si la línea cae al agua).
 */
class MapaTest extends TestCase
{
    public function test_el_mapa_tiene_el_tamano_declarado_y_todo_tiene_leyenda(): void
    {
        $mapa = (new MuelleService)->mapa();

        $this->assertCount($mapa['alto'], $mapa['filas']);
        foreach ($mapa['filas'] as $y => $fila) {
            $this->assertSame($mapa['ancho'], strlen($fila), "La fila $y no mide {$mapa['ancho']}");
            foreach (str_split($fila) as $caracter) {
                $this->assertArrayHasKey($caracter, $mapa['leyenda'], "'$caracter' no está en la leyenda");
            }
        }
    }

    public function test_desde_la_punta_del_muelle_se_pesca_en_lo_hondo(): void
    {
        $muelle = new MuelleService;

        // Fila 13, punta del muelle en T, mirando hacia abajo: agua honda.
        $this->assertSame('honda', $muelle->zonaDePesca(10, 13, 'abajo'));
        // Desde la playa mirando al río: agua baja.
        $this->assertSame('orilla', $muelle->zonaDePesca(2, 4, 'abajo'));
        // Mirando al pasto no hay agua.
        $this->assertNull($muelle->zonaDePesca(2, 4, 'arriba'));
        // Parado en el agua (no caminable) no se pesca.
        $this->assertNull($muelle->zonaDePesca(2, 8, 'abajo'));
    }

    public function test_la_posicion_por_defecto_de_la_migracion_es_caminable(): void
    {
        $this->assertTrue((new MuelleService)->esCaminable(12, 4));
    }

    public function test_hay_lugares_para_pescar_en_las_dos_zonas(): void
    {
        $muelle = new MuelleService;
        $zonas = [];
        foreach ($muelle->celdasCaminables() as [$x, $y]) {
            foreach (array_keys(MuelleService::DIRECCIONES) as $dir) {
                $zonas[] = $muelle->zonaDePesca($x, $y, $dir);
            }
        }

        $this->assertGreaterThan(20, count(array_keys($zonas, 'honda')));
        $this->assertGreaterThan(20, count(array_keys($zonas, 'orilla')));
    }

    public function test_se_llega_a_todo_el_muelle_desde_la_playa(): void
    {
        $muelle = new MuelleService;
        $inicio = [12, 4];
        $visto = [implode(',', $inicio) => true];
        $cola = [$inicio];
        while ($cola) {
            [$x, $y] = array_shift($cola);
            foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
                $clave = ($x + $dx).','.($y + $dy);
                if (! isset($visto[$clave]) && $muelle->esCaminable($x + $dx, $y + $dy)) {
                    $visto[$clave] = true;
                    $cola[] = [$x + $dx, $y + $dy];
                }
            }
        }

        $this->assertSame(count($muelle->celdasCaminables()), count($visto));
    }
}
