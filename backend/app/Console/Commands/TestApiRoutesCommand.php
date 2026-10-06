<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class TestApiRoutesCommand extends Command
{
    protected $signature = 'test:api-routes {--filter= : Filter specific tests}';
    protected $description = 'Run comprehensive tests for all API routes and display terminal results';

    public function handle(): int
    {
        $this->newLine();
        $this->line('<fg=blue;options=bold>===============================================================</>');
        $this->line('<fg=cyan;options=bold>   JMCFI PostFlow — Automated API Routes Test Runner          </>');
        $this->line('<fg=blue;options=bold>===============================================================</>');
        $this->newLine();

        $filter = $this->option('filter');
        $args = [PHP_BINARY, 'vendor/bin/phpunit', 'tests/ApiRoutesTest.php', '--colors=always'];

        if ($filter) {
            $args[] = '--filter=' . $filter;
            $this->info("Applying filter: {$filter}");
        }

        $process = new Process($args, base_path());
        $process->setTimeout(120);

        $process->run(function ($type, $buffer) {
            $this->output->write($buffer);
        });

        $this->newLine();
        if ($process->isSuccessful()) {
            $this->line('<bg=green;fg=black;options=bold> SUCCESS </> <fg=green;options=bold>All API Route test cases passed successfully!</>');
            return self::SUCCESS;
        } else {
            $this->line('<bg=red;fg=white;options=bold> FAILURE </> <fg=red;options=bold>One or more API Route test cases failed.</>');
            return self::FAILURE;
        }
    }
}
