<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('employee_id')->unique();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('phone')->nullable();
            $table->string('department')->nullable();
            $table->string('position')->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // requestor, office_head, vice_president, president, imc_qa_checker, it_publisher, admin
            $table->string('guard_name')->default('web');
            $table->string('display_name');
            $table->text('description')->nullable();
            $table->json('permissions')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->timestamps();
            $table->unique(['name', 'guard_name']);
        });

        Schema::create('model_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type'], 'model_has_permissions_model_id_model_type_index');
            $table->foreign('permission_id')
                ->references('id')
                ->on('permissions')
                ->onDelete('cascade');
            $table->primary(['permission_id', 'model_id', 'model_type'], 'model_has_permissions_permission_model_type_primary');
        });

        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type'], 'model_has_roles_model_id_model_type_index');
            $table->foreign('role_id')
                ->references('id')
                ->on('roles')
                ->onDelete('cascade');
            $table->primary(['role_id', 'model_id', 'model_type'], 'model_has_roles_role_model_type_primary');
        });

        Schema::create('role_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->unsignedBigInteger('role_id');
            $table->foreign('permission_id')
                ->references('id')
                ->on('permissions')
                ->onDelete('cascade');
            $table->foreign('role_id')
                ->references('id')
                ->on('roles')
                ->onDelete('cascade');
            $table->primary(['permission_id', 'role_id'], 'role_has_permissions_permission_id_role_id_primary');
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('role_id')->constrained()->onDelete('cascade');
            $table->unique(['user_id', 'role_id']);
            $table->timestamps();
        });

        Schema::create('post_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // announcement, news, event, advisory, blog
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('icon')->nullable();
            $table->string('color')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('target_platforms', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // wordpress, facebook, instagram
            $table->string('slug')->unique();
            $table->string('icon')->nullable();
            $table->string('color')->nullable();
            $table->json('config_schema')->nullable(); // API endpoints, required fields
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('post_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->longText('caption_narrative');
            $table->foreignId('category_id')->constrained('post_categories');
            $table->foreignId('department_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('requestor_id')->constrained('users');
            $table->enum('status', [
                'draft',
                'pending_office_head',
                'pending_vice_president',
                'pending_president',
                'pending_imc_qa',
                'approved',
                'rejected',
                'returned_for_revision',
                'scheduled',
                'published',
                'archived'
            ])->default('draft');
            $table->json('target_platforms')->nullable();
            $table->timestamp('preferred_schedule_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('revision_notes')->nullable();
            $table->integer('revision_count')->default(0);
            $table->json('ai_compliance_result')->nullable();
            $table->json('ai_suggested_caption')->nullable();
            $table->json('imc_branding_checklist')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id')->constrained()->onDelete('cascade');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->unsignedBigInteger('file_size');
            $table->enum('type', ['image', 'video', 'document'])->default('image');
            $table->boolean('is_featured')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id')->constrained()->onDelete('cascade');
            $table->foreignId('approver_id')->constrained('users');
            $table->enum('stage', [
                'office_head',
                'vice_president',
                'president',
                'imc_qa',
                'it_publisher'
            ]);
            $table->enum('action', [
                'pending',
                'approved',
                'rejected',
                'returned_for_revision'
            ])->default('pending');
            $table->text('remarks')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_compliance_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id')->constrained()->onDelete('cascade');
            $table->foreignId('checked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('check_results')->nullable();
            $table->json('violations_found')->nullable();
            $table->text('suggested_rejection_reason')->nullable();
            $table->text('suggested_revision_guidance')->nullable();
            $table->string('suggested_improved_caption')->nullable();
            $table->enum('overall_status', ['pass', 'fail', 'review_required'])->default('review_required');
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->string('model_used')->default('deepseek-chat');
            $table->text('prompt_used')->nullable();
            $table->timestamps();
        });

        Schema::create('policy_violations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('flagged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('violation_type'); // accuracy, completeness, branding, privacy, compliance
            $table->text('description');
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->json('ai_analysis')->nullable();
            $table->boolean('is_resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('publishing_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_request_id')->constrained()->onDelete('cascade');
            $table->foreignId('published_by')->constrained('users');
            $table->string('platform'); // wordpress, facebook, instagram
            $table->string('external_post_id')->nullable();
            $table->string('external_url')->nullable();
            $table->enum('status', ['scheduled', 'publishing', 'published', 'failed', 'deleted'])->default('scheduled');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->text('error_message')->nullable();
            $table->json('platform_response')->nullable();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('publishing_records');
        Schema::dropIfExists('policy_violations');
        Schema::dropIfExists('ai_compliance_checks');
        Schema::dropIfExists('approval_workflows');
        Schema::dropIfExists('post_media');
        Schema::dropIfExists('post_requests');
        Schema::dropIfExists('target_platforms');
        Schema::dropIfExists('post_categories');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('model_has_roles');
        Schema::dropIfExists('model_has_permissions');
        Schema::dropIfExists('role_has_permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('users');
    }
};