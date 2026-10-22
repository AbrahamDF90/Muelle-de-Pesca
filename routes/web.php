<?php

use App\Http\Controllers\ChatController;
use App\Http\Controllers\InicioController;
use App\Http\Controllers\LanceController;
use App\Http\Controllers\MuelleController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/', [InicioController::class, 'mostrar'])->name('inicio');
    Route::post('/entrar', [InicioController::class, 'entrar'])->middleware('throttle:10,1')->name('entrar');
});

Route::middleware('auth')->group(function () {
    Route::post('/salir', [InicioController::class, 'salir'])->name('salir');
    Route::get('/muelle', [MuelleController::class, 'mostrar'])->name('muelle');
    Route::get('/chat', [ChatController::class, 'index'])->name('chat');
    Route::post('/chat', [ChatController::class, 'guardar'])->middleware('throttle:chat')->name('chat.guardar');

    // Pesca: el servidor es el árbitro (ver PescaService).
    Route::post('/lances', [LanceController::class, 'lanzar'])->middleware('throttle:60,1')->name('lances.lanzar');
    Route::post('/lances/{lance}/recoger', [LanceController::class, 'recoger'])->middleware('throttle:60,1')->name('lances.recoger');
    Route::get('/ranking', [LanceController::class, 'ranking'])->name('ranking');
});
