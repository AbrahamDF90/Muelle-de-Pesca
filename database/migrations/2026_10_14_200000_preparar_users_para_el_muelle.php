<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Login solo con nombre: email y password opcionales, y los datos del pescador.
 *
 * Largos pensados para MySQL (SQLite, que usan los tests, NO controla el largo):
 *  - genero: "hombre" tiene 6 letras → string(10) para no quedar justos.
 *  - dir: "izquierda" tiene 9 letras → string(9).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();

            $table->string('genero', 10)->default('hombre')->after('name');
            $table->char('color', 7)->default('#3498db')->after('genero');
            $table->unsignedTinyInteger('x')->default(12)->after('color');
            $table->unsignedTinyInteger('y')->default(4)->after('x');
            $table->string('dir', 9)->default('abajo')->after('y');
            // Puntos acumulados: de acá sale el ranking.
            $table->unsignedInteger('puntos')->default(0)->index()->after('dir');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['genero', 'color', 'x', 'y', 'dir', 'puntos']);
            $table->string('email')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};
