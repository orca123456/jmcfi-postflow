<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\PersonalAccessToken;

class AuthCheckCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auth:check';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check user authentication status, registered users, and active Sanctum tokens';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('====================================');
        $this->info('    JMCFI PostFlow Auth Status      ');
        $this->info('====================================');

        if (!Schema::hasTable('users')) {
            $this->error('Users table does not exist. Please run migrations.');
            return Command::FAILURE;
        }

        $totalUsers = User::count();
        $this->line("\n<fg=cyan;options=bold>Total Registered Users:</fg=cyan;options=bold> {$totalUsers}");

        if ($totalUsers > 0) {
            $users = User::all();
            $headers = ['ID', 'Name', 'Email', 'Role / Department'];
            $rows = $users->map(function ($u) {
                return [
                    $u->id,
                    $u->full_name ?? ($u->first_name . ' ' . $u->last_name),
                    $u->email,
                    $u->department ?? 'N/A',
                ];
            });

            $this->table($headers, $rows);
        } else {
            $this->warn('No users found in database.');
        }

        if (Schema::hasTable('personal_access_tokens')) {
            $tokens = PersonalAccessToken::with('tokenable')->orderBy('created_at', 'desc')->get();
            $tokenCount = $tokens->count();

            $this->line("\n<fg=cyan;options=bold>Active Sanctum Tokens:</fg=cyan;options=bold> {$tokenCount}");

            if ($tokenCount > 0) {
                $tokenHeaders = ['Token ID', 'User Name', 'Token Name', 'Last Used At', 'Created At'];
                $tokenRows = $tokens->map(function ($t) {
                    $user = $t->tokenable;
                    $userName = $user ? ($user->full_name ?? ($user->first_name . ' ' . $user->last_name)) . " (#{$user->id})" : 'Unknown User';
                    $lastUsed = $t->last_used_at ? $t->last_used_at->diffForHumans() : 'Never';
                    $createdAt = $t->created_at ? $t->created_at->diffForHumans() : 'N/A';

                    return [
                        $t->id,
                        $userName,
                        $t->name,
                        $lastUsed,
                        $createdAt,
                    ];
                });

                $this->table($tokenHeaders, $tokenRows);
            } else {
                $this->comment('No active Sanctum tokens in database.');
            }
        }

        $this->info("\n[OK] Auth system is configured and ready.");
        return Command::SUCCESS;
    }
}
