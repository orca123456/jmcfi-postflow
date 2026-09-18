<?php

use App\Http\Controllers\Api\AISettingController;
use App\Http\Controllers\Api\ChatbotController;
use App\Models\SystemSetting;
use App\Services\AIClient;
use App\Services\AIComplianceService;
use App\Services\AIProviderSettings;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\TestCase;

final class AIProviderSettingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array', 'app.key' => 'base64:' . base64_encode(str_repeat('a', 32)),
            'ai.legacy_key' => 'legacy-key', 'ai.legacy_model' => 'deepseek-chat']);
        app('db')->purge('sqlite');
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id(); $table->string('key')->unique(); $table->text('value')->nullable();
            $table->string('type'); $table->text('description')->nullable();
            $table->boolean('is_public'); $table->timestamps();
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

    private function response(string $content = '{"ok":true}'): array
    {
        return ['choices' => [['message' => ['content' => $content], 'finish_reason' => 'stop']],
            'usage' => ['total_tokens' => 20]];
    }

    private function save(string $provider = 'groq', string $model = 'test-model', ?string $key = 'new-secret'): array
    {
        return app(AISettingController::class)->update(new Request([
            'provider' => $provider, 'model' => $model, 'api_key' => $key,
        ]))->getData(true);
    }

    public function testEncryptedConfigurationAndPublicMetadata(): void
    {
        Http::fake(['*' => Http::response($this->response())]);
        $result = $this->save();
        self::assertTrue($result['configured']);
        self::assertNotNull($result['verified_at']);
        self::assertArrayNotHasKey('api_key', $result);
        $stored = SystemSetting::where('key', 'ai_provider_settings')->first();
        self::assertStringNotContainsString('new-secret', $stored->value);
        self::assertFalse($stored->is_public);
        self::assertSame('new-secret', app(AIProviderSettings::class)->current()['api_key']);
    }

    public function testEachProviderUsesItsOwnEndpointAndPayload(): void
    {
        foreach (AIProviderSettings::PROVIDERS as $id => $provider) {
            Http::fake(['*' => Http::response($this->response())]);
            $this->save($id);
            Http::assertSent(fn ($request) => $request->url() === $provider['url'] . '/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer new-secret')
                && $request['model'] === 'test-model'
                && $request['response_format']['type'] === 'json_object'
                && $request[$id === 'openai' ? 'max_completion_tokens' : 'max_tokens'] === 4096);
        }
    }

    public function testInvalidKeyKeepsPreviousSettingsAndRedactsProviderError(): void
    {
        Http::fake(['*' => Http::response(['error' => ['message' => 'rejected new-secret']], 401)]);
        try { $this->save(); self::fail('Expected invalid credentials.'); }
        catch (ValidationException $e) {
            self::assertStringNotContainsString('new-secret', json_encode($e->errors()));
            self::assertSame('legacy-key', app(AIProviderSettings::class)->current()['api_key']);
            self::assertSame(0, SystemSetting::count());
        }
    }

    public function testProviderChangeRequiresNewKey(): void
    {
        Http::fake();
        try { $this->save(key: null); self::fail('Expected missing provider key.'); }
        catch (ValidationException $e) { self::assertArrayHasKey('api_key', $e->errors()); }
        Http::assertNothingSent();
    }

    public function testModelChangeCanKeepKeyAndClientSeesReplacement(): void
    {
        Http::fake(['*' => Http::response($this->response())]);
        $client = app(AIClient::class);
        $this->save();
        $this->save(model: 'another-model', key: null);
        self::assertSame('new-secret', app(AIProviderSettings::class)->current()['api_key']);
        $this->save('gemini', 'gemini-test', 'gemini-secret');
        $client->complete([['role' => 'user', 'content' => 'Hi']]);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'googleapis.com')
            && $request->hasHeader('Authorization', 'Bearer gemini-secret') && $request['model'] === 'gemini-test');
    }

    public function testClearDisablesEnvironmentFallbackAndNetworkCalls(): void
    {
        Http::fake();
        $result = app(AISettingController::class)->clear(new Request())->getData(true);
        self::assertFalse($result['configured']);
        self::assertSame('', app(AIProviderSettings::class)->current()['api_key']);
        try { app(AIClient::class)->complete([]); self::fail('Expected disabled AI.'); }
        catch (RuntimeException $e) { self::assertStringContainsString('not configured', $e->getMessage()); }
        Http::assertNothingSent();
    }

    public function testLegacyEncryptedKeyRemainsSupported(): void
    {
        SystemSetting::create(['key' => 'deepseek_api_key', 'value' => Crypt::encryptString('old-ui-key'),
            'type' => 'string', 'is_public' => false]);
        self::assertSame('old-ui-key', app(AIProviderSettings::class)->current()['api_key']);
    }

    public function testMalformedConnectionResponseIsRejected(): void
    {
        Http::fake(['*' => Http::response($this->response('Not JSON'))]);
        $this->expectException(ValidationException::class);
        $this->save();
    }

    public function testUnsupportedProviderIsRejectedWithoutSendingKey(): void
    {
        Http::fake();
        try { $this->save('http://localhost'); self::fail('Expected unsupported provider.'); }
        catch (ValidationException $e) { self::assertArrayHasKey('provider', $e->errors()); }
        Http::assertNothingSent();
    }

    public function testMalformedPolicyOutputDoesNotInventPassingChecks(): void
    {
        Http::fake(['*' => Http::response($this->response('{"overall_status":"compliant"}'))]);
        $result = app(AIComplianceService::class)->checkDraftCompliance('Example', 'A draft caption');
        self::assertSame('error', $result['overall_status']);
        self::assertSame([], $result['checks']);
    }

    public function testPolicyResultNormalizesScoreAndSuggestedCaption(): void
    {
        $check = ['passed' => true, 'score' => 90, 'issues' => [], 'suggestions' => []];
        $analysis = ['overall_status' => 'compliant', 'overall_compliance_score' => 90,
            'policy_alignment' => 'aligned', 'analysis_logic' => 'No text issues found.',
            'suggested_improved_caption' => 'Improved caption',
            'checks' => array_fill_keys(['accuracy', 'completeness', 'branding', 'privacy', 'compliance'], $check)];
        Http::fake(['*' => Http::response($this->response(json_encode($analysis)))]);
        $result = app(AIComplianceService::class)->checkDraftCompliance('Example', 'A draft caption');
        self::assertSame(90, $result['compliance_score']);
        self::assertSame('Improved caption', $result['suggested_caption']);
        self::assertCount(5, $result['checks']);
    }

    public function testChatbotUsesSelectedProvider(): void
    {
        Http::fake(['*' => Http::sequence()->push($this->response())->push($this->response('Hello'))]);
        $this->save('openrouter', 'vendor/model');
        $result = app(ChatbotController::class)->handleMessage(new Request([
            'messages' => [['role' => 'user', 'content' => 'Hi']],
        ]))->getData(true);
        self::assertSame('Hello', $result['reply']);
        Http::assertSent(fn ($request) => $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
            && $request['model'] === 'vendor/model');
    }

    public function testSettingsRoutesRequireAuthenticationAndAdministratorRole(): void
    {
        $routes = collect(app('router')->getRoutes())->filter(fn ($route) => $route->uri() === 'api/ai-settings');
        self::assertCount(3, $routes);
        foreach ($routes as $route) {
            self::assertContains('auth:sanctum', $route->gatherMiddleware());
            self::assertContains('role:it_publisher,it_admin', $route->gatherMiddleware());
        }
    }
}
