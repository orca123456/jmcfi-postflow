<?php

use App\Http\Controllers\Api\PostRequestController;
use App\Models\PostRequest;
use App\Models\User;
use App\Services\AIComplianceService;
use App\Services\ApprovalWorkflowService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\TestCase;

final class ImcSubmittedMaterialsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'filesystems.default' => 'local', 'cache.default' => 'array']);
        app('db')->purge('sqlite');
        Storage::fake('public');
        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title')->default('Student achievement');
            $table->text('caption_narrative');
            $table->string('routing_type');
            $table->string('status')->default('pending_imc_qa');
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('requestor_id')->nullable();
            $table->timestamps();
        });
        (require __DIR__ . '/../database/migrations/2026_11_18_000001_add_submitted_materials_to_post_requests_table.php')->up();
        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            foreach (['type', 'original_name', 'file_path', 'mime_type'] as $field) $table->string($field);
            $table->unsignedInteger('file_size')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });
        (require __DIR__ . '/../database/migrations/2026_11_18_000002_preserve_submitted_original_media.php')->up();
        Schema::create('post_media_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_media_id')->constrained('post_media')->cascadeOnDelete();
            $table->binary('content');
            $table->timestamps();
        });
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('post_request_id');
            $table->string('stage');
            $table->string('action')->default('pending');
            $table->unsignedBigInteger('approver_id')->nullable();
            $table->unsignedInteger('stage_order')->default(1);
            $table->text('remarks')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();
        });
        Schema::create('users', fn (Blueprint $table) => $table->id());
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function post(string $route = 'direct_imc'): PostRequest
    {
        $post = PostRequest::create(['caption_narrative' => 'Original caption', 'routing_type' => $route]);
        $post->status = 'pending_imc_qa';
        $media = $post->media()->create(['type' => 'image', 'original_name' => 'submitted.png', 'file_path' => 'post-media/submitted.png', 'mime_type' => 'image/png']);
        $media->file()->create(['content' => 'original image bytes']);
        Storage::disk('public')->put('post-media/submitted.png', 'original image bytes');
        return $post;
    }

    public function testSnapshotKeepsOriginalCaptionAndPhotoOnce(): void
    {
        $post = $this->post();
        $post->captureSubmittedMaterials();
        $post->update(['caption_narrative' => 'Refined caption']);
        $post->captureSubmittedMaterials();
        $post->refresh();
        self::assertSame('Original caption', $post->submitted_materials['caption_narrative']);
        self::assertSame('submitted.png', $post->submitted_materials['media'][0]['original_filename']);
        $display = $post->submittedMaterialsForDisplay();
        self::assertStringContainsString('/storage/post-media/submitted.png', $display['media'][0]['url']);
        self::assertArrayNotHasKey('file_path', $display['media'][0]);
    }

    public function testStandardAndLegacyFinalRequestsDoNotInventOriginals(): void
    {
        $post = $this->post('standard');
        $post->captureSubmittedMaterials();
        self::assertNull($post->submitted_materials);
        $post->routing_type = 'direct_imc';
        $post->status = 'published';
        $post->captureSubmittedMaterials();
        self::assertNull($post->submitted_materials);
    }

    public function testDirectApprovalKeepsAllFinalImagesAndSubmittedMaterials(): void
    {
        $post = $this->post();
        $post->approvalWorkflows()->create(['stage' => 'imc_qa', 'approver_id' => 42, 'action' => 'pending', 'stage_order' => 1]);
        $reviewer = Mockery::mock(User::class)->makePartial();
        $reviewer->id = 42;
        $reviewer->shouldReceive('workflowRole')->andReturn('imc_qa_checker');
        $request = Request::create('/api/posts/1/approve', 'POST', ['caption_narrative' => 'Final refined caption'], [], [
            'media' => array_map(fn ($i) => UploadedFile::fake()->create("final-$i.png", 1, 'image/png'), range(1, 6)),
        ]);
        $request->setUserResolver(fn () => $reviewer);
        $controller = new PostRequestController(Mockery::mock(AIComplianceService::class), Mockery::mock(ApprovalWorkflowService::class));
        self::assertSame(200, $controller->approve($request, $post)->getStatusCode());
        $post->refresh();
        self::assertSame('Original caption', $post->submitted_materials['caption_narrative']);
        self::assertSame('Final refined caption', $post->caption_narrative);
        self::assertSame(6, $post->media()->count());
        self::assertSame(range(0, 5), $post->media()->orderBy('sort_order')->pluck('sort_order')->all());
        self::assertSame(1, $post->media()->where('is_featured', true)->count());
        self::assertSame(7, $post->mediaIncludingOriginals()->count());
        self::assertTrue((bool) $post->mediaIncludingOriginals()->where('original_name', 'submitted.png')->first()->is_submission_original);
        Storage::disk('public')->assertExists('post-media/submitted.png');
        Storage::disk('public')->delete('post-media/submitted.png');
        $fallback = App\Models\PostMedia::where('file_path', 'post-media/submitted.png')->with('file')->first();
        self::assertNotNull($fallback);
        self::assertSame('original image bytes', $fallback->file->content);
    }
}
