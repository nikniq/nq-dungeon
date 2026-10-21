<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class GrantAdmin extends Command
{
    protected $signature = 'admin:grant {email} {--revoke : take the flag away instead}';
    protected $description = 'Make a user an admin of the game (or revoke it with --revoke)';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();
        if (! $user) {
            $this->error('No user with that email.');

            return self::FAILURE;
        }
        $user->update(['is_admin' => ! $this->option('revoke')]);
        $this->info(($user->is_admin ? 'Granted admin to ' : 'Revoked admin from ').$user->email);

        return self::SUCCESS;
    }
}
