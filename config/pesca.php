<?php

/*
 * Reglas del muelle, en un solo lugar (las lee PHP; el JS recibe lo que necesita en window.MUELLE).
 */
return [

    // Máximo de pescadores a la vez en el muelle.
    'cupo' => 20,

    // Canal de presencia (en Echo se usa sin el prefijo "presence-").
    'canal' => 'muelle',

    // Después de tirar la línea, el pez pica entre estos milisegundos…
    'pique_min_ms' => 1500,
    'pique_max_ms' => 5000,
    // …y hay que recoger dentro de esta ventana. Antes, el pez se asusta; después, se escapa.
    'ventana_ms' => 1500,
    // Mínimo entre dos lances del mismo pescador (no se puede tirar la línea a lo loco).
    'espera_entre_lances_ms' => 800,

    /*
     * Los peces: puntos y chance (en %) según dónde cae la línea. En la orilla (agua baja)
     * pican más pirañas; en lo hondo (la punta del muelle) salen más dorados y surubíes.
     * Las chances de cada zona suman 100.
     */
    'peces' => [
        'pirana' => ['nombre' => 'Piraña', 'puntos' => 5, 'orilla' => 55, 'honda' => 35],
        'bagre' => ['nombre' => 'Bagre', 'puntos' => 10, 'orilla' => 35, 'honda' => 30],
        'dorado' => ['nombre' => 'Dorado', 'puntos' => 25, 'orilla' => 9, 'honda' => 23],
        'surubi' => ['nombre' => 'Surubí', 'puntos' => 50, 'orilla' => 1, 'honda' => 12],
    ],

    'generos' => [
        'hombre' => 'Pescador',
        'mujer' => 'Pescadora',
    ],

    // Color de la campera.
    'paleta' => [
        '#c0392b' => 'Rojo',
        '#e67e22' => 'Naranja',
        '#f1c40f' => 'Amarillo',
        '#7cb342' => 'Verde claro',
        '#1e8449' => 'Verde',
        '#16a085' => 'Turquesa',
        '#3498db' => 'Celeste',
        '#2c3e9e' => 'Azul',
        '#8e44ad' => 'Violeta',
        '#d35490' => 'Rosa',
        '#8b5a2b' => 'Marrón',
        '#5d6d7e' => 'Gris',
    ],

];
