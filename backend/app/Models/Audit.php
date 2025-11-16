<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Audit extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'domain',
        'email',
        'status',
        'lighthouse_result',
        'pdf_path',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'lighthouse_result' => 'array',
        ];
    }

    /**
     * Get the user that owns the audit.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
