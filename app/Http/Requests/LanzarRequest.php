<?php

namespace App\Http\Requests;

use App\Services\MuelleService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Desde dónde tira la línea el pescador y hacia qué lado mira. */
class LanzarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'x' => ['required', 'integer', 'min:0', 'max:255'],
            'y' => ['required', 'integer', 'min:0', 'max:255'],
            'dir' => ['required', Rule::in(array_keys(MuelleService::DIRECCIONES))],
        ];
    }
}
