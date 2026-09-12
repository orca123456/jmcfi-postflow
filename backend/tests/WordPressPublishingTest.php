<?php

use App\Jobs\AutoPublishJob;
use App\Models\PostMedia;
use App\Models\PostRequest;
use App\Models\PublishingRecord;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\PostPublishingFailedNotification;
use App\Services\FacebookPublishingService;
use App\Services\InstagramPublishingService;
use App\Services\WordPressPublishingService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\TestCase;

final class WordPressPublishingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array', 'filesystems.default' => 'local']);
        app('db')->purge('sqlite');
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key');
            $table->text('value');
            $table->timestamps();
        });
        foreach (['wordpress_url' => 'https://93.184.216.34', 'wordpress_username' => 'publisher', 'wordpress_app_password' => 'test-password'] as $key => $value) {
            SystemSetting::create(compact('key', 'value'));
        }
        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('caption_narrative');
            $table->string('status');
            $table->text('target_platforms');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->integer('post_request_id');
            $table->string('type');
            $table->string('mime_type');
            $table->integer('sort_order');
        });
        Schema::create('publishing_records', function (Blueprint $table) {
            $table->id();
            $table->integer('post_request_id');
            $table->integer('published_by');
            foreach (['platform', 'status', 'external_post_id', 'external_url', 'error_message', 'platform_response'] as $field) {
                $table->text($field)->nullable();
            }
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('status');
        });
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });
        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->integer('role_id');
            $table->integer('model_id');
            $table->string('model_type');
        });
        DB::table('users')->insert(['id' => 1, 'status' => 'active']);
        DB::table('roles')->insert(['id' => 1, 'name' => 'it_admin']);
        DB::table('model_has_roles')->insert(['role_id' => 1, 'model_id' => 1, 'model_type' => User::class]);
        Auth::shouldReceive('user')->andReturn(null);
        Log::spy();
        Notification::fake();
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function post(array $platforms = ['website']): PostRequest
    {
        return PostRequest::create(['title' => 'School news', 'caption_narrative' => '<p>Approved article</p>',
            'status' => 'approved', 'target_platforms' => $platforms]);
    }

    private function article(): array
    {
        return ['id' => 42, 'status' => 'publish', 'link' => 'https://example.org/school-news'];
    }

    public function testWebsiteJobPublishesAndRecordsArticleLink(): void
    {
        Http::fake(['*' => Http::sequence()->push([])->push($this->article(), 201)]);
        $post = $this->post();
        $this->runJob($post);
        self::assertSame('published', $post->fresh()->status);
        self::assertSame('42', PublishingRecord::first()->external_post_id);
        self::assertSame($this->article()['link'], PublishingRecord::first()->external_url);
        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request['title'] === 'School news' && $request['content'] === '<p>Approved article</p>'
            && $request['status'] === 'publish' && $request->hasHeader('Authorization', 'Basic ' . base64_encode('publisher:test-password')));
    }

    public function testImageIsUploadedBeforePublishing(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('photos/logo.png', 'image-test-bytes');
        Http::fake(['*' => Http::sequence()->push([])->push(['id' => 9], 201)->push($this->article(), 201)]);
        (new WordPressPublishingService)->publishPost($this->post(), new PostMedia(['file_path' => 'photos/logo.png']));
        Http::assertSent(fn ($request) => str_contains($request->url(), '/wp/v2/media') && $request->isMultipart());
        Http::assertSent(fn ($request) => $request->method() === 'POST' && str_contains($request->url(), '/wp/v2/posts') && $request['featured_media'] === 9);
    }

    public function testImageCanBeUploadedFromMediaUrlWhenStoragePathIsMissing(): void
    {
        config(['filesystems.default' => 'b2']);
        Http::fake(['*' => Http::sequence()
            ->push([])
            ->push('remote-image-bytes', 200)
            ->push(['id' => 9], 201)
            ->push($this->article(), 201)]);
        $media = new class extends PostMedia {
            public function getUrlAttribute(): string
            {
                return 'https://media.example.org/uploads/news-photo.jpg';
            }
        };
        $media->forceFill(['file_path' => 'post-media/remote-news-photo.jpg']);
        (new WordPressPublishingService)->publishPost($this->post(), $media);
        Http::assertSent(fn ($request) => $request->method() === 'GET'
            && $request->url() === 'https://media.example.org/uploads/news-photo.jpg');
        Http::assertSent(fn ($request) => str_contains($request->url(), '/wp/v2/media') && $request->isMultipart());
        Http::assertSent(fn ($request) => $request->method() === 'POST' && str_contains($request->url(), '/wp/v2/posts') && $request['featured_media'] === 9);
    }

    public function testMissingImageDoesNotPublishTextOnly(): void
    {
        Storage::fake('public');
        Http::fake(['*' => Http::response([])]);
        $this->expectExceptionMessage('image is missing');
        (new WordPressPublishingService)->publishPost($this->post(), new PostMedia(['file_path' => 'missing.png']));
    }

    public function testWrongCredentialsNotifyAdminAndFailJob(): void
    {
        Http::fake(['*' => Http::response(['code' => 'incorrect_password'], 401)]);
        $post = $this->post();
        try {
            $this->runJob($post);
            self::fail('Publishing should fail.');
        } catch (Exception $e) {
            self::assertStringContainsString('HTTP 401', $e->getMessage());
        }
        self::assertSame('publish_failed', $post->fresh()->status);
        self::assertSame('failed', PublishingRecord::first()->status);
        Notification::assertSentTo(User::find(1), PostPublishingFailedNotification::class,
            fn ($notification, $channels) => $channels === ['database', 'mail']);
    }

    public function testRetrySkipsWordPressAfterAnotherPlatformFails(): void
    {
        Http::fake(['*' => Http::sequence()->push([])->push($this->article(), 201)]);
        $post = $this->post(['website', 'facebook']);
        $facebook = Mockery::mock(FacebookPublishingService::class);
        $facebook->shouldReceive('publishPost')->once()->andThrow(new RuntimeException('Facebook unavailable'));
        try {
            $this->runJob($post, $facebook);
            self::fail('Partial failure should fail the job.');
        } catch (Exception $e) {
            self::assertStringContainsString('Facebook unavailable', $e->getMessage());
        }
        Notification::assertSentTo(User::find(1), PostPublishingFailedNotification::class);
        $facebook = Mockery::mock(FacebookPublishingService::class);
        $facebook->shouldReceive('publishPost')->once()->andReturn(['id' => 'fb-42']);
        $this->runJob($post, $facebook);
        Http::assertSentCount(2);
        self::assertSame('published', $post->fresh()->status);
        self::assertSame(1, PublishingRecord::where('platform', 'wordpress')->count());
    }

    public function testRemoteArticleIsRecoveredWithoutDuplicatePost(): void
    {
        Http::fake(function ($request) {
            parse_str(parse_url($request->url(), PHP_URL_QUERY), $query);
            return Http::response([array_merge($this->article(), ['slug' => $query['slug']])]);
        });
        self::assertSame(42, (new WordPressPublishingService)->publishPost($this->post())['id']);
        Http::assertSentCount(1);
    }

    public function testDraftResponseIsNotReportedAsPublished(): void
    {
        Http::fake(['*' => Http::sequence()->push([])->push(array_replace($this->article(), ['status' => 'draft']), 201)]);
        $this->expectExceptionMessage('did not confirm a published article');
        (new WordPressPublishingService)->publishPost($this->post());
    }

    public function testPrivateHostIsRejectedWithoutSendingCredentials(): void
    {
        SystemSetting::where('key', 'wordpress_url')->update(['value' => 'https://127.0.0.1']);
        Http::fake();
        try {
            (new WordPressPublishingService)->publishPost($this->post());
            self::fail('Private host should be rejected.');
        } catch (RuntimeException $e) {
            self::assertStringContainsString('publicly accessible', $e->getMessage());
        }
        Http::assertNothingSent();
    }

    public function testRejectedImageUploadDoesNotCreateArticle(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('photos/logo.png', 'image-test-bytes');
        Http::fake(['*' => Http::sequence()->push([])->push(['code' => 'rest_upload_unknown_error'], 500)]);
        try {
            (new WordPressPublishingService)->publishPost($this->post(), new PostMedia(['file_path' => 'photos/logo.png']));
            self::fail('Upload failure should stop publication.');
        } catch (RuntimeException $e) {
            self::assertStringContainsString('upload image', $e->getMessage());
        }
        Http::assertSentCount(2);
        Http::assertNotSent(fn ($request) => $request->method() === 'POST' && str_contains($request->url(), '/wp/v2/posts'));
    }

    public function testMissingCredentialsNeverProduceMockSuccess(): void
    {
        SystemSetting::where('key', 'wordpress_app_password')->delete();
        Http::fake();
        try {
            (new WordPressPublishingService)->publishPost($this->post());
            self::fail('Missing password should fail.');
        } catch (RuntimeException $e) {
            self::assertStringContainsString('valid WordPress credentials', $e->getMessage());
        }
        Http::assertNothingSent();
    }

    private function runJob(PostRequest $post, ?FacebookPublishingService $facebook = null): void
    {
        (new AutoPublishJob($post, 1))->handle($facebook ?? Mockery::mock(FacebookPublishingService::class),
            Mockery::mock(InstagramPublishingService::class), new WordPressPublishingService);
    }
}
