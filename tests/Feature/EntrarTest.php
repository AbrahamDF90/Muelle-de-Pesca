<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\MuelleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EntrarTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_pantalla_de_inicio_se_ve(): void
    {
        $this->get('/')->assertOk()
            ->assertSee('MUELLE DE PESCA')
            ->assertSee('Pescador')->assertSee('Pescadora');
    }

    public function test_no_se_puede_ver_el_muelle_sin_login(): void
    {
        $this->get('/muelle')->assertRedirect('/');
    }

    public function test_entrar_crea_el_pescador_en_la_playa(): void
    {
        $this->post('/entrar', ['nombre' => '  Ñandú Pérez ', 'genero' => 'mujer', 'color' => '#d35490'])
            ->assertRedirect('/muelle');

        $user = User::firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('Ñandú Pérez', $user->name);
        $this->assertSame('mujer', $user->genero);
        $this->assertSame(0, $user->fresh()->puntos);
        $this->assertSame('playa', app(MuelleService::class)->celda($user->x, $user->y)['tipo']);
    }

    /**
     * @return array<string, array{array<string, string>, string}>
     */
    public static function datosInvalidos(): array
    {
        $ok = ['nombre' => 'Ana', 'genero' => 'hombre', 'color' => '#3498db'];

        return [
            'nombre vacío' => [[...$ok, 'nombre' => ''], 'nombre'],
            'nombre de 1 letra' => [[...$ok, 'nombre' => 'A'], 'nombre'],
            'nombre de 21 letras' => [[...$ok, 'nombre' => str_repeat('a', 21)], 'nombre'],
            'nombre con símbolos' => [[...$ok, 'nombre' => '<script>'], 'nombre'],
            'sin género' => [[...$ok, 'genero' => ''], 'genero'],
            'género inventado' => [[...$ok, 'genero' => 'robot'], 'genero'],
            'color fuera de la paleta' => [[...$ok, 'color' => '#000000'], 'color'],
        ];
    }

    /**
     * @param  array<string, string>  $datos
     */
    #[DataProvider('datosInvalidos')]
    public function test_entrar_valida_los_datos(array $datos, string $campo): void
    {
        $this->from('/')->post('/entrar', $datos)
            ->assertRedirect('/')
            ->assertSessionHasErrors($campo);

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_el_muelle_recibe_los_datos_publicos_del_pescador(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'genero' => 'mujer', 'email' => 'secreto@example.com']);

        $this->actingAs($user)->get('/muelle')
            ->assertOk()
            ->assertSee('"nombre":"Ana"', false)
            ->assertSee('"genero":"mujer"', false)
            ->assertDontSee('secreto@example.com');
    }

    public function test_si_ya_entraste_el_inicio_te_lleva_al_muelle(): void
    {
        $this->actingAs(User::factory()->create())->get('/')->assertRedirect('/muelle');
    }

    public function test_salir_cierra_la_sesion(): void
    {
        $this->actingAs(User::factory()->create())->post('/salir')->assertRedirect('/');

        $this->assertGuest();
    }
}
