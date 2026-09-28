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
    public function meHandle(): int
    {
        $this->info('====================================');
        $this->info('    JMCFI PostFlow Auth Status      ');
        $this->info('====================================');

        if (!Schema::hasTable('users')) {
            $this->error('Users table does not exist. Please run migrations.');
            return Command::FAILURE;
        }

        $totalUsers = User::count();
        $this->line("<fg=cyan>Total Registered Users:</fg=cyan> {$totalUsers}");

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
            $tokenCount = PersonalAccessToken::count();
            $this->line("<fg=cyan>Active Sanctum Tokens:</fg=cyan> {$tokenCount}");
        }

        $this->info("\n[OK] Auth system is configured and ready.");
        return Command::SUCCESS;
    }

    public function handle(): int
    {
        return $this->meHandle();
    }
}
