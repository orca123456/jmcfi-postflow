<?php

use App\Http\Controllers\Api\TokenSettingController;
use App\Models\SystemSetting;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\TestCase;

final class TokenSettingsValidationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array']);
        app('db')->purge('sqlite');
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('type');
            $table->text('description')->nullable();
            $table->boolean('is_public');
            $table->timestamps();
        });
        Auth::shouldReceive('user')->andReturn(null);
        Log::spy();
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function credentials(): array
    {
        return ['wordpress_url' => 'https://93.184.216.34', 'wordpress_username' => 'publisher',
            'wordpress_app_password' => 'test-application-password'];
    }

    private function reject(array $values): void
    {
        try {
            (new TokenSettingController)->updateTokens(new Request($values));
            self::fail('Invalid credentials were accepted.');
        } catch (ValidationException $e) {
            self::assertNotEmpty($e->errors());
            self::assertSame(0, SystemSetting::count());
        }
    }

    public function testMalformedUrlIsRejectedWithoutNetworkRequest(): void
    {
        Http::fake();
        $this->reject(array_replace($this->credentials(), ['wordpress_url' => 'dsad']));
        Http::assertNothingSent();
    }

    public function testPrivateUrlIsRejected(): void
    {
        Http::fake();
        $this->reject(array_replace($this->credentials(), ['wordpress_url' => 'https://127.0.0.1']));
        Http::assertNothingSent();
    }

    public function testIncorrectPasswordIsRejected(): void
    {
        Http::fake(['*' => Http::response(['code' => 'incorrect_password'], 401)]);
        $this->reject($this->credentials());
    }

    public function testHtmlResponseIsNotProofOfConnection(): void
    {
        Http::fake(['*' => Http::response('<html>Login</html>')]);
        $this->reject($this->credentials());
    }

    public function testPublishingPermissionIsRequired(): void
    {
        Http::fake(['*' => Http::response(['id' => 1, 'capabilities' => ['read' => true]])]);
        $this->reject($this->credentials());
    }

    public function testConnectionFailureIsAValidationError(): void
    {
        Http::fake(fn () => throw new Illuminate\Http\Client\ConnectionException('Timeout'));
        $this->reject($this->credentials());
    }

    public function testVerifiedCredentialsAreSavedAndCanBeCleared(): void
    {
        Http::fake(['*' => Http::response(['id' => 1,
            'capabilities' => ['publish_posts' => true, 'upload_files' => true]])]);
        $controller = new TokenSettingController;
        $result = $controller->updateTokens(new Request($this->credentials()))->getData(true);
        self::assertTrue($result['connections']['wordpress']);
        self::assertTrue($controller->getTokens()->getData(true)['connections']['wordpress']);
        Http::assertSentCount(1);
        $result = $controller->updateTokens(new Request(array_fill_keys(array_keys($this->credentials()), '')))->getData(true);
        self::assertFalse($result['connections']['wordpress']);
        Http::assertSentCount(1);
    }

    public function testOldUnverifiedValuesAreNotConnected(): void
    {
        foreach ($this->credentials() as $key => $value) {
            SystemSetting::create(['key' => $key, 'value' => $value, 'type' => 'string', 'is_public' => false]);
        }
        self::assertFalse((new TokenSettingController)->getTokens()->getData(true)['connections']['wordpress']);
    }

    public function testInvalidInstagramCredentialsAreNotSaved(): void
    {
        Http::fake(['*' => Http::response(['error' => ['code' => 190, 'message' => 'Invalid token']], 400)]);
        $this->reject(['instagram_business_account_id' => '123', 'instagram_access_token' => 'wrong']);
    }

    public function testIncompleteCredentialsAreRejected(): void
    {
        Http::fake();
        $this->reject(array_replace($this->credentials(), ['wordpress_app_password' => '']));
        Http::assertNothingSent();
    }

    public function testFailedSavePreservesExistingCredentials(): void
    {
        SystemSetting::create(['key' => 'wordpress_username', 'value' => 'existing', 'type' => 'string', 'is_public' => false]);
        Http::fake(['*' => Http::response([], 401)]);
        try {
            (new TokenSettingController)->updateTokens(new Request($this->credentials()));
            self::fail('Invalid credentials were accepted.');
        } catch (ValidationException $e) {
            self::assertSame('existing', SystemSetting::where('key', 'wordpress_username')->value('value'));
            self::assertSame(1, SystemSetting::count());
        }
    }
}
