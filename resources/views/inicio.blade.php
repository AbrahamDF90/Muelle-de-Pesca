<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Muelle de Pesca — Programación IV</title>
    @fonts
    @vite(['resources/css/app.css', 'resources/js/inicio.js'])
</head>
<body class="fondo-rio min-h-screen font-sans text-[#3b2614] antialiased">
    <main class="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 py-8">
        <header class="text-center">
            <h1 class="font-medieval text-4xl tracking-wider text-[#d4a54a] drop-shadow-[0_3px_0_#000] sm:text-5xl">MUELLE DE PESCA</h1>
            <p class="mt-3 text-sm text-[#e6f3f5]/80">Surubí, dorado, bagre y piraña · cada pez suma puntos · ¿quién llega primero en el ranking?</p>
        </header>

        <form method="POST" action="{{ route('entrar') }}" id="form-entrar"
              class="pergamino w-full space-y-5 rounded-md border-4 border-double border-[#4a2f1a] p-6">
            @csrf

            @if ($errors->any())
                <div class="rounded-md border border-red-700/50 bg-red-100 px-3 py-2 text-sm text-red-900" role="alert">
                    <ul class="list-inside list-disc">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <div>
                <label for="nombre" class="mb-1 block font-medieval text-lg">Tu nombre, pescador</label>
                <input id="nombre" name="nombre" type="text" value="{{ old('nombre') }}" maxlength="20" required autofocus
                       autocomplete="off" placeholder="Ej: Ana"
                       class="w-full rounded-md border-2 border-[#4a2f1a]/40 bg-[#fff8e6] px-3 py-2 text-[#3b2614] placeholder:text-[#3b2614]/35 focus:border-[#4a2f1a] focus:outline-none @error('nombre') border-red-700 @enderror">
            </div>

            <div class="flex items-center gap-5">
                {{-- Unas tablas del muelle para que la sombra del personaje se vea --}}
                <div class="shrink-0 rounded-md border-2 border-[#4a2f1a] bg-[#b07d48] px-2 pt-1 pb-2">
                    <canvas id="preview" class="pixelado block h-[232px] w-[128px]"
                            aria-label="Vista previa de tu personaje"></canvas>
                </div>

                <fieldset class="flex-1">
                    <legend class="mb-2 font-medieval text-lg">¿Quién pesca?</legend>
                    <div class="grid gap-2">
                        @foreach ($generos as $valor => $texto)
                            <label class="cursor-pointer rounded-md border-2 border-[#4a2f1a]/30 px-3 py-2 font-semibold transition has-checked:border-[#4a2f1a] has-checked:bg-[#4a2f1a] has-checked:text-[#efe0bd] has-focus-visible:ring-2 has-focus-visible:ring-[#d4a54a]">
                                <input type="radio" name="genero" value="{{ $valor }}" class="sr-only"
                                       @checked(old('genero', 'hombre') === $valor)>
                                {{ $texto }}
                            </label>
                        @endforeach
                    </div>
                    <p class="mt-3 text-xs text-[#3b2614]/60">El color de pelo y el tono de piel se sortean al entrar.</p>
                </fieldset>
            </div>

            <fieldset>
                <legend class="mb-2 font-medieval text-lg">Color de tu campera</legend>
                <div class="grid grid-cols-6 gap-2">
                    @foreach ($paleta as $hex => $nombreColor)
                        <label title="{{ $nombreColor }}"
                               class="aspect-square cursor-pointer rounded-full border-2 border-[#3b2614]/60 transition hover:scale-110 has-checked:scale-110 has-checked:ring-4 has-checked:ring-[#4a2f1a] has-focus-visible:ring-4 has-focus-visible:ring-[#d4a54a]"
                               style="background: {{ $hex }}">
                            <input type="radio" name="color" value="{{ $hex }}" class="sr-only"
                                   @checked(old('color', '#3498db') === $hex)>
                            <span class="sr-only">{{ $nombreColor }}</span>
                        </label>
                    @endforeach
                </div>
            </fieldset>

            <button type="submit"
                    class="w-full rounded-md border-2 border-[#d4a54a] bg-[#4a2f1a] py-3 font-medieval text-xl tracking-widest text-[#efe0bd] transition hover:bg-[#5e3d23] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d4a54a]/60">
                Ir al muelle
            </button>
        </form>
    </main>
</body>
</html>
