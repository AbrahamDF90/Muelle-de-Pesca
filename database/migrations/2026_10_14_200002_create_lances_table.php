<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cada vez que alguien tira la línea. El SERVIDOR decide al tirar qué pez va a picar y
 * cuándo (muerde_en); el navegador recién se entera del pez si lo saca a tiempo.
 *
 * Horarios con milisegundos (precisión 3): la ventana para recoger es de 1,5 s y en
 * segundos enteros no se podría controlar. Todos nullable(): si la primera columna
 * TIMESTAMP de una tabla es NOT NULL, MySQL le agrega solo ON UPDATE CURRENT_TIMESTAMP.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('x');
            $table->unsignedTinyInteger('y');
            $table->string('dir', 9);
            $table->string('zona', 6); // orilla | honda
            $table->string('pez', 10); // pirana | bagre | dorado | surubi
            $table->timestamp('lanzado_en', 3)->nullable();
            $table->timestamp('muerde_en', 3)->nullable();
            // pendiente → capturado | escapo (tarde) | temprano (se asustó)
            $table->string('resultado', 10)->default('pendiente')->index();
            $table->unsignedSmallInteger('puntos')->default(0);
            $table->timestamp('recogido_en', 3)->nullable();
            $table->index(['user_id', 'resultado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lances');
    }
};
