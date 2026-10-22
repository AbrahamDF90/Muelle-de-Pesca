<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El canal de presencia "muelle": Laravel firma los datos públicos del jugador
 * (con el SECRET de Reverb) para que Reverb lo deje entrar.
 */
class CanalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Firmar no necesita que Reverb esté corriendo: es un HMAC que se calcula en Laravel.
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'clave-de-prueba',
            'broadcasting.connections.reverb.secret' => 'secreto-de-prueba',
            'broadcasting.connections.reverb.app_id' => '1',
        ]);
        // Los canales se registraron al arrancar sobre el broadcaster "null" de phpunit.xml:
        // los volvemos a registrar sobre el de Reverb que acabamos de configurar.
        require base_path('routes/channels.php');
    }

    public function test_un_jugador_logueado_entra_con_sus_datos_publicos(): void
    {
        $user = User::factory()->create([
            'name' => 'Ana', 'email' => 'privado@example.com', 'genero' => 'mujer', 'color' => '#d35490', 'x' => 12, 'y' => 4, 'puntos' => 35,
        ]);

        // fresh(): como en la app real, el usuario se lee de la BD.
        $respuesta = $this->actingAs($user->fresh())
            ->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-muelle'])
            ->assertOk()
            ->assertJsonStructure(['auth', 'channel_data']);

        $datos = json_decode($respuesta->json('channel_data'), true);
        $this->assertSame((string) $user->id, (string) $datos['user_id']);
        $this->assertSame(
            ['id' => $user->id, 'nombre' => 'Ana', 'genero' => 'mujer', 'color' => '#d35490', 'x' => 12, 'y' => 4, 'dir' => 'abajo', 'puntos' => 35],
            $datos['user_info'],
        );
        $this->assertStringNotContainsString('privado@example.com', $respuesta->getContent());
        $this->assertStringStartsWith('clave-de-prueba:', $respuesta->json('auth'));
    }

    public function test_sin_login_no_se_entra_al_canal(): void
    {
        $this->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-muelle'])
            ->assertForbidden();
    }

    public function test_no_existe_otro_canal(): void
    {
        $this->actingAs(User::factory()->create()->fresh())
            ->postJson('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'presence-sala.1'])
            ->assertForbidden();
    }
}
