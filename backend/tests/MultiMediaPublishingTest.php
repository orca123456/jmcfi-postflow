<?php

use App\Jobs\AutoPublishJob;
use App\Models\PostMedia;
use App\Models\PostRequest;
use App\Models\PublishingRecord;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\PostPublishedRequestorNotification;
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

final class MultiMediaPublishingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array',
            'filesystems.default' => 'local',
        ]);
        app('db')->purge('sqlite');

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key');
            $table->text('value');
            $table->timestamps();
        });

        Schema::create('post_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('Announcement');
            $table->string('slug')->default('announcement');
            $table->string('color')->nullable();
            $table->string('icon')->nullable();
            $table->timestamps();
        });

        foreach ([
            'facebook_page_id' => '123456789',
            'facebook_access_token' => 'fb-valid-token',
            'instagram_business_account_id' => '987654321',
            'instagram_access_token' => 'ig-valid-token',
            'wordpress_url' => 'https://93.184.216.34',
            'wordpress_username' => 'publisher',
            'wordpress_app_password' => 'test-password',
        ] as $key => $value) {
            SystemSetting::create(compact('key', 'value'));
        }

        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('caption_narrative');
            $table->string('status');
            $table->text('target_platforms');
            $table->integer('requestor_id')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->integer('post_request_id');
            $table->string('type')->default('image');
            $table->string('mime_type')->default('image/jpeg');
            $table->string('file_path')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('publishing_records', function (Blueprint $table) {
            $table->id();
            $table->integer('post_request_id');
            $table->integer('published_by');
            foreach (['platform', 'status', 'external_post_id', 'external_url', 'error_message', 'platform_response'] as $field) {
                $table->text($field)->nullable();
            }
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status');
            $table->timestamps();
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
        DB::table('users')->insert(['id' => 1, 'first_name' => 'IT', 'last_name' => 'Admin', 'email' => 'admin@jmc.edu.ph', 'status' => 'active']);
        DB::table('users')->insert(['id' => 2, 'first_name' => 'Den', 'last_name' => 'Requestor', 'email' => 'den@jmc.edu.ph', 'status' => 'active']);
        DB::table('roles')->insert(['id' => 1, 'name' => 'it_admin']);
        DB::table('roles')->insert(['id' => 2, 'name' => 'requestor']);
        DB::table('model_has_roles')->insert(['role_id' => 1, 'model_id' => 1, 'model_type' => User::class]);
        DB::table('model_has_roles')->insert(['role_id' => 2, 'model_id' => 2, 'model_type' => User::class]);

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

    public function testFacebookPublishesMultipleImagesAsFeedAlbum(): void
    {
        Http::fake([
            'https://graph.facebook.com/*/123456789/photos' => Http::sequence()
                ->push(['id' => 'photo_101'], 200)
                ->push(['id' => 'photo_102'], 200)
                ->push(['id' => 'photo_103'], 200),
            'https://graph.facebook.com/*/123456789/feed' => Http::response([
                'id' => '123456789_post999',
            ], 200),
        ]);

        $service = new FacebookPublishingService();
        $mediaUrls = [
            'https://example.com/img1.jpg',
            'https://example.com/img2.jpg',
            'https://example.com/img3.jpg',
        ];

        $res = $service->publishPost('Event highlights!', $mediaUrls);

        self::assertSame('123456789_post999', $res['id']);

        // Check that photos were uploaded with published=false
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/123456789/photos')
                && $request['published'] === 'false'
                && $request['url'] === 'https://example.com/img1.jpg';
        });

        // Check that feed post has attached_media with all 3 photo IDs
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), '/123456789/feed')) {
                return false;
            }
            $attached = json_decode($request['attached_media'], true);
            return count($attached) === 3
                && $attached[0]['media_fbid'] === 'photo_101'
                && $attached[1]['media_fbid'] === 'photo_102'
                && $attached[2]['media_fbid'] === 'photo_103';
        });
    }

    public function testInstagramPublishesMultipleImagesAsCarousel(): void
    {
        Http::fake([
            // Container items creation
            'https://graph.facebook.com/*/987654321/media' => Http::sequence()
                ->push(['id' => 'item_container_1'], 200)
                ->push(['id' => 'item_container_2'], 200)
                ->push(['id' => 'carousel_container_99'], 200),
            // Container polling status checks
            'https://graph.facebook.com/*/item_container_1*' => Http::response(['status_code' => 'FINISHED'], 200),
            'https://graph.facebook.com/*/item_container_2*' => Http::response(['status_code' => 'FINISHED'], 200),
            'https://graph.facebook.com/*/carousel_container_99*' => Http::response(['status_code' => 'FINISHED'], 200),
            // Publish media call
            'https://graph.facebook.com/*/987654321/media_publish' => Http::response(['id' => 'ig_post_888'], 200),
        ]);

        $service = new InstagramPublishingService();
        $mediaUrls = [
            'https://example.com/slide1.jpg',
            'https://example.com/slide2.jpg',
        ];

        $res = $service->publishPost('Carousel caption', $mediaUrls);

        self::assertSame('ig_post_888', $res['id']);

        // Verify carousel items were created with is_carousel_item=true
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/987654321/media')
                && ($request['is_carousel_item'] ?? null) === 'true'
                && ($request['image_url'] ?? null) === 'https://example.com/slide1.jpg';
        });

        // Verify parent CAROUSEL was created with children
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/987654321/media')
                && ($request['media_type'] ?? null) === 'CAROUSEL'
                && ($request['children'] ?? null) === 'item_container_1,item_container_2';
        });

        // Verify media_publish was called with carousel container id
        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/987654321/media_publish')
                && ($request['creation_id'] ?? null) === 'carousel_container_99';
        });
    }

    public function testWordPressPublishesMultipleImagesWithFeaturedAndGallery(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('photos/pic1.jpg', 'img-data-1');
        Storage::disk('public')->put('photos/pic2.jpg', 'img-data-2');

        Http::fake([
            '*check existing articles*' => Http::response([]),
            '*rest_route=/wp/v2/posts*' => Http::sequence()
                ->push([], 200) // check existing slug
                ->push(['id' => 77, 'status' => 'publish', 'link' => 'https://example.org/multi-pic-news'], 201),
            '*rest_route=/wp/v2/media*' => Http::sequence()
                ->push(['id' => 11, 'source_url' => 'https://example.org/pic1.jpg'], 201)
                ->push(['id' => 12, 'source_url' => 'https://example.org/pic2.jpg'], 201),
        ]);

        $post = PostRequest::create([
            'title' => 'Campus Festivities',
            'caption_narrative' => '<p>Fun at campus</p>',
            'status' => 'approved',
            'target_platforms' => ['website'],
        ]);

        $media1 = (new PostMedia())->forceFill(['id' => 1, 'file_path' => 'photos/pic1.jpg', 'is_featured' => true]);
        $media2 = (new PostMedia())->forceFill(['id' => 2, 'file_path' => 'photos/pic2.jpg', 'is_featured' => false]);

        $service = new WordPressPublishingService();
        $res = $service->publishPost($post, $media1, [$media1, $media2]);

        self::assertSame(77, $res['id']);
        self::assertSame('https://example.org/multi-pic-news', $res['link']);

        // Verify featured_media is media1 ID (11) and post content has media2 embedded
        Http::assertSent(function ($request) {
            if ($request->method() !== 'POST' || !str_contains($request->url(), '/wp/v2/posts')) {
                return false;
            }
            return $request['featured_media'] === 11
                && str_contains($request['content'], 'https://example.org/pic2.jpg');
        });
    }

    public function testPartialPublishingAndIntelligentRetryWithoutDuplicates(): void
    {
        // 1. Setup a post with 3 platforms: facebook, instagram, website
        $post = PostRequest::create([
            'title' => 'Important College Announcement',
            'caption_narrative' => 'Please join us for commencement exercises.',
            'status' => 'approved',
            'target_platforms' => ['facebook', 'instagram', 'website'],
            'requestor_id' => 2,
        ]);

        // WordPress credentials are deleted so Website fails configuration check
        SystemSetting::where('key', 'wordpress_app_password')->delete();

        $fbService = Mockery::mock(FacebookPublishingService::class);
        $fbService->shouldReceive('publishPost')->once()->andReturn(['id' => 'fb_post_100']);

        $igService = Mockery::mock(InstagramPublishingService::class);
        $igService->shouldReceive('publishPost')->once()->andReturn(['id' => 'ig_post_200']);

        $wpService = new WordPressPublishingService(); // Not configured!

        // Run the publish job (First run: FB and IG succeed, Website fails)
        try {
            (new AutoPublishJob($post, 1))->handle($fbService, $igService, $wpService);
        } catch (\Exception $e) {
            // Expected in unit test mode
        }

        $freshPost = $post->fresh();

        // Check 1: Post status is partially_published (NOT publish_failed!)
        self::assertSame('partially_published', $freshPost->status);

        // Check 2: Facebook and Instagram records are marked 'published' with their IDs
        $fbRecord = PublishingRecord::where('post_request_id', $post->id)->where('platform', 'facebook')->first();
        self::assertNotNull($fbRecord);
        self::assertSame('published', $fbRecord->status);
        self::assertSame('fb_post_100', $fbRecord->external_post_id);

        $igRecord = PublishingRecord::where('post_request_id', $post->id)->where('platform', 'instagram')->first();
        self::assertNotNull($igRecord);
        self::assertSame('published', $igRecord->status);
        self::assertSame('ig_post_200', $igRecord->external_post_id);

        // Check 3: Website record is marked 'failed'
        $wpRecord = PublishingRecord::where('post_request_id', $post->id)->where('platform', 'wordpress')->first();
        self::assertNotNull($wpRecord);
        self::assertSame('failed', $wpRecord->status);

        // Check 4: Requestor notification sent with both successes and failures
        Notification::assertSentTo(
            User::find(2),
            PostPublishedRequestorNotification::class,
            function ($notification) {
                return isset($notification->publishResults['facebook'])
                    && isset($notification->publishResults['instagram'])
                    && isset($notification->publishErrors['wordpress']);
            }
        );

        // -------------------------------------------------------------
        // SECOND RUN (RETRY):
        // Now configure WordPress credentials and retry publishing.
        // FB and IG MUST BE SKIPPED (no second calls / no duplicates)!
        // -------------------------------------------------------------
        SystemSetting::create(['key' => 'wordpress_app_password', 'value' => 'configured-pass']);

        // Mocks for FB and IG should receive NO calls!
        $fbRetryService = Mockery::mock(FacebookPublishingService::class);
        $fbRetryService->shouldReceive('publishPost')->never();

        $igRetryService = Mockery::mock(InstagramPublishingService::class);
        $igRetryService->shouldReceive('publishPost')->never();

        Http::fake([
            '*check existing articles*' => Http::response([]),
            '*rest_route=/wp/v2/posts*' => Http::sequence()
                ->push([], 200) // slug check
                ->push(['id' => 999, 'status' => 'publish', 'link' => 'https://example.org/article-999'], 201),
        ]);

        (new AutoPublishJob($freshPost, 1))->handle($fbRetryService, $igRetryService, new WordPressPublishingService());

        $finalPost = $freshPost->fresh();

        // Check 5: Status transitioned to 'published'
        self::assertSame('published', $finalPost->status);

        // Check 6: Website record is now published!
        $wpFinalRecord = PublishingRecord::where('post_request_id', $post->id)->where('platform', 'wordpress')->first();
        self::assertSame('published', $wpFinalRecord->status);
        self::assertSame('999', $wpFinalRecord->external_post_id);

        // Check 7: Original FB and IG records remain intact with 1 record each (NO duplicates)
        self::assertSame(1, PublishingRecord::where('post_request_id', $post->id)->where('platform', 'facebook')->count());
        self::assertSame(1, PublishingRecord::where('post_request_id', $post->id)->where('platform', 'instagram')->count());
        self::assertSame('fb_post_100', PublishingRecord::where('post_request_id', $post->id)->where('platform', 'facebook')->value('external_post_id'));
        self::assertSame('ig_post_200', PublishingRecord::where('post_request_id', $post->id)->where('platform', 'instagram')->value('external_post_id'));
    }
}
