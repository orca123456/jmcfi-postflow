<?php

use App\Http\Controllers\Api\PostRequestController;
use App\Http\Requests\Api\PostRequest\UpdatePostRequest;
use App\Models\PostRequest;
use App\Models\User;
use App\Services\AIComplianceService;
use App\Services\ApprovalWorkflowService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\TestCase;

final class ImcDirectEditScopeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();
        restore_error_handler();
        restore_exception_handler();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function reviewer(): User
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 42;
        $user->shouldReceive('workflowRole')->andReturn('imc_qa_checker');
        return $user;
    }

    private function controller(): PostRequestController
    {
        return new PostRequestController(
            Mockery::mock(AIComplianceService::class),
            Mockery::mock(ApprovalWorkflowService::class),
        );
    }

    public function testImcCanEditOnlyPendingDirectRequests(): void
    {
        $post = new PostRequest(['status' => PostRequest::STATUS_PENDING_IMC_QA]);
        $reviewer = $this->reviewer();
        foreach ([PostRequest::ROUTING_STANDARD, null, ''] as $route) {
            $post->routing_type = $route;
            self::assertFalse($post->canBeEditedBy($reviewer));
        }
        $post->routing_type = PostRequest::ROUTING_DIRECT_IMC;
        self::assertTrue($post->canBeEditedBy($reviewer));
        $post->status = PostRequest::STATUS_APPROVED;
        self::assertFalse($post->canBeEditedBy($reviewer));
    }

    public function testRequestorCanStillEditOwnStandardDraft(): void
    {
        $post = new PostRequest(['status' => 'draft', 'routing_type' => 'standard', 'requestor_id' => 42]);
        self::assertTrue($post->canBeEditedBy($this->reviewer()));
    }

    public function testUpdateEndpointRejectsStandardImcEdits(): void
    {
        DB::shouldReceive('transaction')->never();
        $post = new PostRequest(['status' => PostRequest::STATUS_PENDING_IMC_QA, 'routing_type' => 'standard']);
        $request = UpdatePostRequest::create('/api/posts/1', 'PUT', ['caption_narrative' => 'Changed caption']);
        $request->setUserResolver(fn () => $this->reviewer());
        self::assertSame(403, $this->controller()->update($request, $post)->getStatusCode());
    }

    public function testApprovalEndpointRejectsStandardCaptionAndMediaEditsBeforeWriting(): void
    {
        DB::shouldReceive('transaction')->never();
        foreach (['standard', null] as $route) {
            foreach (['caption', 'media'] as $edit) {
                $post = Mockery::mock(PostRequest::class)->makePartial();
                $post->routing_type = $route;
                $post->shouldReceive('canBeApprovedBy')->once()->andReturn(true);
                $request = Request::create('/api/posts/1/approve', 'POST',
                    $edit === 'caption' ? ['caption_narrative' => 'Changed caption'] : [], [],
                    $edit === 'media' ? ['media' => UploadedFile::fake()->create('replacement.png', 1, 'image/png')] : []);
                $request->setUserResolver(fn () => $this->reviewer());
                $response = $this->controller()->approve($request, $post);
                self::assertSame(403, $response->getStatusCode());
            }
        }
    }

    public function testStandardReviewAndDirectEditingStillReachApproval(): void
    {
        // Replace the transaction to prove the permission boundary without any database writes.
        DB::shouldReceive('transaction')->twice()->andReturn(response()->json(['message' => 'Allowed']));
        foreach (['standard', 'direct_imc'] as $route) {
            $post = Mockery::mock(PostRequest::class)->makePartial();
            $post->routing_type = $route;
            $post->shouldReceive('canBeApprovedBy')->once()->andReturn(true);
            $request = Request::create('/api/posts/1/approve', 'POST',
                $route === 'direct_imc' ? ['caption_narrative' => 'Final caption'] : ['remarks' => 'Reviewed'], [],
                $route === 'direct_imc' ? ['media' => UploadedFile::fake()->create('final.png', 1, 'image/png')] : []);
            $request->setUserResolver(fn () => $this->reviewer());
            self::assertSame(200, $this->controller()->approve($request, $post)->getStatusCode());
        }
    }
}
