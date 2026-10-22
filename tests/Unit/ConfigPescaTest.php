<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * config/pesca.php sin levantar Laravel: es un archivo PHP que devuelve un array.
 */
class ConfigPescaTest extends TestCase
{
    /** @return array<string, mixed> */
    private function config(): array
    {
        return require __DIR__.'/../../config/pesca.php';
    }

    public function test_las_chances_de_cada_zona_suman_100(): void
    {
        foreach (['orilla', 'honda'] as $zona) {
            $this->assertSame(100, array_sum(array_column($this->config()['peces'], $zona)), "Las chances de '$zona' no suman 100");
        }
    }

    public function test_los_peces_mas_raros_valen_mas(): void
    {
        $peces = $this->config()['peces'];

        $this->assertSame(['pirana', 'bagre', 'dorado', 'surubi'], array_keys($peces));
        $this->assertLessThan($peces['surubi']['puntos'], $peces['dorado']['puntos']);
        $this->assertLessThan($peces['dorado']['puntos'], $peces['bagre']['puntos']);
        $this->assertLessThan($peces['bagre']['puntos'], $peces['pirana']['puntos']);
        // En lo hondo, el surubí sale más que en la orilla.
        $this->assertGreaterThan($peces['surubi']['orilla'], $peces['surubi']['honda']);
    }

    public function test_los_slugs_y_generos_entran_en_sus_columnas(): void
    {
        // lances.pez es string(10) y users.genero string(10).
        foreach (array_keys($this->config()['peces']) as $pez) {
            $this->assertLessThanOrEqual(10, mb_strlen($pez));
        }
        foreach (array_keys($this->config()['generos']) as $genero) {
            $this->assertLessThanOrEqual(10, mb_strlen($genero));
        }
    }

    public function test_la_paleta_son_colores_hex_de_7_caracteres(): void
    {
        foreach (array_keys($this->config()['paleta']) as $color) {
            $this->assertMatchesRegularExpression('/^#[0-9a-f]{6}$/', $color);
        }
    }
}
