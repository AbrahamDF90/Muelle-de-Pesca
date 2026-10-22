<?php

namespace Tests\Feature;

use App\Events\PezCapturado;
use App\Models\Lance;
use App\Models\User;
use App\Services\PescaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class PescaTest extends TestCase
{
    use RefreshDatabase;

    /** Punta del muelle, mirando al agua honda. */
    private const HONDO = ['x' => 10, 'y' => 13, 'dir' => 'abajo'];

    /** Playa, mirando al agua baja. */
    private const ORILLA = ['x' => 2, 'y' => 4, 'dir' => 'abajo'];

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([PezCapturado::class]);
    }

    /** Tira la línea y devuelve el lance creado. */
    private function lanzar(User $user, array $donde = self::HONDO): Lance
    {
        $id = $this->actingAs($user)->postJson('/lances', $donde)->assertCreated()->json('data.id');

        return Lance::findOrFail($id);
    }

    /** Viaja en el tiempo hasta el pique (+ un poquito). */
    private function alPique(Lance $lance, int $masMs = 200): void
    {
        $this->travelTo($lance->muerde_en->copy()->addMilliseconds($masMs));
    }

    public function test_tirar_la_linea_no_revela_el_pez(): void
    {
        $respuesta = $this->actingAs(User::factory()->create())->postJson('/lances', self::HONDO)
            ->assertCreated()
            ->assertJsonPath('data.zona', 'honda')
            ->assertJsonStructure(['data' => ['id', 'zona', 'muerde_en', 'ventana_ms', 'ahora']]);

        $this->assertArrayNotHasKey('pez', $respuesta->json('data'));
        $lance = Lance::firstOrFail();
        $this->assertContains($lance->pez, ['pirana', 'bagre', 'dorado', 'surubi']);
        // Pica entre 1,5 y 5 segundos después.
        $ms = $lance->lanzado_en->diffInMilliseconds($lance->muerde_en);
        $this->assertGreaterThanOrEqual(config('pesca.pique_min_ms'), $ms);
        $this->assertLessThanOrEqual(config('pesca.pique_max_ms'), $ms);
    }

    public function test_desde_la_playa_se_pesca_en_la_orilla(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/lances', self::ORILLA)
            ->assertCreated()
            ->assertJsonPath('data.zona', 'orilla');
    }

    public function test_no_se_puede_pescar_mirando_a_tierra_o_desde_el_agua(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/lances', ['x' => 2, 'y' => 4, 'dir' => 'arriba'])->assertUnprocessable();
        $this->actingAs($user)->postJson('/lances', ['x' => 2, 'y' => 9, 'dir' => 'abajo'])->assertUnprocessable();
        $this->actingAs($user)->postJson('/lances', ['x' => 10, 'y' => 13, 'dir' => 'volando'])->assertUnprocessable();
        $this->assertDatabaseCount('lances', 0);
    }

    public function test_recoger_a_tiempo_saca_el_pez_y_suma_puntos(): void
    {
        $user = User::factory()->create();
        $lance = $this->lanzar($user);
        $lance->update(['pez' => 'dorado']);
        $this->alPique($lance);

        $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")
            ->assertOk()
            ->assertJsonPath('data.capturado', true)
            ->assertJsonPath('data.pez.nombre', 'Dorado')
            ->assertJsonPath('data.puntos', 25)
            ->assertJsonPath('data.total', 25);

        $this->assertSame(25, $user->fresh()->puntos);
        $this->assertSame(Lance::CAPTURADO, $lance->fresh()->resultado);
        Event::assertDispatched(PezCapturado::class, fn ($e) => $e->lance->id === $lance->id && $e->ranking[0]['puntos'] === 25);
    }

    public function test_recoger_antes_del_pique_lo_asusta(): void
    {
        $user = User::factory()->create();
        $lance = $this->lanzar($user);

        $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")
            ->assertOk()
            ->assertJsonPath('data.capturado', false)
            ->assertJsonPath('data.motivo', Lance::TEMPRANO)
            ->assertJsonPath('data.pez', null);

        $this->assertSame(0, $user->fresh()->puntos);
        Event::assertNotDispatched(PezCapturado::class);
    }

    public function test_recoger_tarde_se_escapa(): void
    {
        $user = User::factory()->create();
        $lance = $this->lanzar($user);
        $this->alPique($lance, config('pesca.ventana_ms') + 100);

        $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")
            ->assertOk()
            ->assertJsonPath('data.motivo', Lance::ESCAPO)
            ->assertJsonPath('data.puntos', 0);
    }

    public function test_no_se_recoge_dos_veces(): void
    {
        $user = User::factory()->create();
        $lance = $this->lanzar($user);
        $this->alPique($lance);

        $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")->assertOk();
        $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")->assertConflict();
        $this->assertSame(1, Lance::where('resultado', Lance::CAPTURADO)->count());
    }

    public function test_no_se_puede_recoger_la_linea_de_otro(): void
    {
        $lance = $this->lanzar(User::factory()->create());
        $this->alPique($lance);

        $this->actingAs(User::factory()->create())->postJson("/lances/{$lance->id}/recoger")->assertForbidden();
    }

    public function test_una_sola_linea_a_la_vez(): void
    {
        $user = User::factory()->create();
        $this->lanzar($user);

        $this->actingAs($user)->postJson('/lances', self::HONDO)
            ->assertConflict()
            ->assertJsonPath('message', 'Ya tenés la línea en el agua.');
    }

    public function test_si_se_escapo_se_puede_volver_a_tirar(): void
    {
        $user = User::factory()->create();
        $lance = $this->lanzar($user);
        $this->alPique($lance, config('pesca.ventana_ms') + 100);

        $this->actingAs($user)->postJson('/lances', self::HONDO)->assertCreated();
        $this->assertSame(Lance::ESCAPO, $lance->fresh()->resultado);
    }

    public function test_hay_que_esperar_un_momento_entre_lances(): void
    {
        $user = User::factory()->create();
        $lance = $this->lanzar($user);
        // Recoge enseguida (se asusta) e intenta tirar de nuevo en el mismo instante.
        $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")->assertOk();

        $this->actingAs($user)->postJson('/lances', self::HONDO)->assertTooManyRequests();
    }

    public function test_el_ranking_ordena_por_puntos_y_cuenta_los_peces(): void
    {
        $ana = User::factory()->create(['name' => 'Ana']);
        $beto = User::factory()->create(['name' => 'Beto']);
        User::factory()->create(['name' => 'SinPeces']);

        foreach ([[$ana, 'surubi'], [$beto, 'pirana'], [$beto, 'bagre'], [$ana, 'pirana']] as [$user, $pez]) {
            $lance = $this->lanzar($user);
            $lance->update(['pez' => $pez]);
            $this->alPique($lance);
            $this->actingAs($user)->postJson("/lances/{$lance->id}/recoger")->assertJsonPath('data.capturado', true);
            $this->travel(2)->seconds();
        }

        $this->actingAs($beto)->getJson('/ranking')
            ->assertOk()
            ->assertJsonCount(2, 'data') // el que no pescó nada no aparece
            ->assertJsonPath('data.0.nombre', 'Ana')
            ->assertJsonPath('data.0.puntos', 55)
            ->assertJsonPath('data.0.peces.surubi', 1)
            ->assertJsonPath('data.0.peces.pirana', 1)
            ->assertJsonPath('data.1.nombre', 'Beto')
            ->assertJsonPath('data.1.puntos', 15)
            ->assertJsonPath('data.1.peces.bagre', 1);
    }

    public function test_en_lo_hondo_salen_peces_mas_grandes(): void
    {
        // Con 400 lances en cada zona, la diferencia de chances tiene que notarse.
        // (Directo al servicio: por HTTP el límite de 60 pedidos por minuto lo cortaría.)
        $user = User::factory()->create();
        $pesca = app(PescaService::class);
        $puntos = ['orilla' => 0, 'honda' => 0];
        foreach (['orilla' => self::ORILLA, 'honda' => self::HONDO] as $zona => $donde) {
            for ($i = 0; $i < 400; $i++) {
                Lance::query()->delete();
                $pesca->lanzar($user, $donde['x'], $donde['y'], $donde['dir']);
                $puntos[$zona] += config('pesca.peces.'.Lance::first()->pez.'.puntos');
            }
        }

        $this->assertGreaterThan($puntos['orilla'], $puntos['honda']);
    }

    public function test_requiere_login(): void
    {
        $this->postJson('/lances', self::HONDO)->assertUnauthorized();
        $this->getJson('/ranking')->assertUnauthorized();
    }
}
