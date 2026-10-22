<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * No hay contenido fijo que cargar: los jugadores se crean al entrar al muelle
     * y los mensajes al chatear.
     */
    public function run(): void
    {
        //
    }
}
