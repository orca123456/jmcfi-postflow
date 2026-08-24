<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_media_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_media_id')->unique()->constrained('post_media')->onDelete('cascade');
            $table->binary('content');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_media_files');
    }
};
