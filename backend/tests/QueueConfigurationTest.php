<?php

use App\Jobs\AutoPublishJob;
use App\Models\PostRequest;
use Illuminate\Contracts\Console\Kernel;
use PHPUnit\Framework\TestCase;

final class QueueConfigurationTest extends TestCase
{
    public function testQueueRetryWindowsExceedPublishingTimeout(): void
    {
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();

        $job = new AutoPublishJob(new PostRequest());
        foreach (['database', 'redis'] as $connection) {
            self::assertGreaterThan($job->timeout, config("queue.connections.$connection.retry_after"));
        }
    }

    public function testSupervisorRestartsWorkerAfterNormalExitAndAllowsJobShutdown(): void
    {
        $config = parse_ini_file(__DIR__ . '/../docker/supervisord.conf', true, INI_SCANNER_RAW);
        $worker = $config['program:queue'];
        self::assertSame('true', $worker['autorestart']);
        self::assertSame('true', $worker['stopasgroup']);
        self::assertSame('true', $worker['killasgroup']);
        self::assertGreaterThan(120, (int) $worker['stopwaitsecs']);
        self::assertStringContainsString('--timeout=120', $worker['command']);
        self::assertStringContainsString('%(ENV_QUEUE_NAMES)s', $worker['command']);
        self::assertSame('true', $config['program:web']['autorestart']);
    }
}
