<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    /**
     * Dashboard Initial Data
     * Consolidates stats, recent activity, and posts into one endpoint to bypass single-threaded bottleneck.
     */
    public function getInitData(Request $request): JsonResponse
    {
        try {
            return $this->getFastInitData($request);
        } catch (\Throwable $e) {
            logger()->warning('Fast dashboard init failed; using stable fallback. ' . $e->getMessage());

            $stats = $this->getStats($request)->getData(true)['data'] ?? [];
            $activities = $this->getRecentActivity($request)->getData(true) ?? [];
            $postController = app(\App\Http\Controllers\Api\PostRequestController::class);

            $request->merge(['per_page' => 15]);
            $postsData = $postController->index($request)->getData(true);

            $departments = \App\Models\Department::where('is_active', true)
                ->where('display_name', 'LIKE', 'College%')
                ->pluck('display_name');

            $payload = [
                'success' => true,
                'init_mode' => 'fallback',
                'stats' => $stats,
                'activities' => $activities,
                'posts' => $postsData,
                'departments' => $departments,
            ];

            if ($request->boolean('debug_dashboard')) {
                $payload['fallback_error'] = $e->getMessage();
            }

            return response()->json($payload);
        }
    }

    private function getFastInitData(Request $request): JsonResponse
    {
        $user = $request->user();
        $category = $user->roleCategory();
        $role = $user->workflowRole();
        $baseQuery = $this->scopedPostQuery($user, $category, $role);

        $posts = (clone $baseQuery)
            ->select([
                'id',
                'title',
                'slug',
                'caption_narrative',
                'category_id',
                'requestor_id',
                'status',
                'target_platforms',
                'preferred_schedule_at',
                'published_at',
                'rejection_reason',
                'revision_notes',
                'revision_count',
                'created_at',
                'updated_at',
            ])
            ->with([
                'category:id,name,slug,color,icon',
                'requestor:id,first_name,middle_name,last_name,email,department',
                'media:id,post_request_id,type,original_name,file_path,mime_type,file_size,is_featured,sort_order',
                'approvalWorkflows:id,post_request_id,stage,approver_id,action,remarks,acted_at,stage_order',
                'approvalWorkflows.approver:id,first_name,middle_name,last_name,email',
            ])
            ->orderByDesc('updated_at')
            ->limit(15)
            ->get();

        $stats = [];
        if ($category === 'admin') {
            $stats = Cache::remember("dashboard_init_stats_{$category}_{$role}_{$user->id}", 1, function () use ($baseQuery, $category, $role) {
                return $this->buildStats($baseQuery, $category, $role);
            });
        }

        $departments = collect();
        if ($category === 'admin' || in_array($role, ['vice_president', 'imc_qa_checker'], true)) {
            $departments = Cache::remember('dashboard_college_departments', 60, function () {
                return \App\Models\Department::where('is_active', true)
                    ->where('display_name', 'LIKE', 'College%')
                    ->orderBy('display_name')
                    ->pluck('display_name');
            });
        }

        return response()->json([
            'success' => true,
            'init_mode' => 'fast',
            'stats' => $stats,
            'activities' => $category === 'admin' ? $this->buildActivities($posts) : [],
            'posts' => [
                'data' => $posts->map(fn (PostRequest $post) => $this->postSummary($post, $request)),
                'meta' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => 15,
                    'total' => $posts->count(),
                ],
            ],
            'departments' => $departments,
        ]);
    }

    private function scopedPostQuery(User $user, string $category, ?string $role): \Illuminate\Database\Eloquent\Builder
    {
        $query = PostRequest::query();

        if ($category === 'requestor') {
            return $query->where('requestor_id', $user->id);
        }

        if ($category !== 'approver') {
            return $query;
        }

        if ($role === 'vice_president') {
            return $query->whereNotIn('status', [
                PostRequest::STATUS_DRAFT,
                PostRequest::STATUS_PENDING_OFFICE_HEAD,
            ])->where(function ($q) {
                $q->whereNotIn('status', [
                    PostRequest::STATUS_REJECTED,
                    PostRequest::STATUS_RETURNED_FOR_REVISION,
                ])->orWhereHas('approvalWorkflows', function ($w) {
                    $w->whereIn('action', ['rejected', 'returned_for_revision'])
                        ->whereIn('stage', ['vice_president', 'imc_qa']);
                });
            });
        }

        if ($role === 'imc_qa_checker') {
            return $query->whereIn('status', [
                PostRequest::STATUS_PENDING_IMC_QA,
                PostRequest::STATUS_APPROVED,
                PostRequest::STATUS_SCHEDULED,
                PostRequest::STATUS_PUBLISHED,
                PostRequest::STATUS_PUBLISH_FAILED,
                PostRequest::STATUS_REJECTED,
                PostRequest::STATUS_RETURNED_FOR_REVISION,
            ])->where(function ($q) {
                $q->whereNotIn('status', [
                    PostRequest::STATUS_REJECTED,
                    PostRequest::STATUS_RETURNED_FOR_REVISION,
                ])->orWhereHas('approvalWorkflows', function ($w) {
                    $w->whereIn('action', ['rejected', 'returned_for_revision'])
                        ->where('stage', 'imc_qa');
                });
            });
        }

        return $query->whereHas('requestor', function ($q) use ($user) {
            $q->where('department', $user->department);
        })->where('status', '!=', PostRequest::STATUS_DRAFT);
    }

    private function buildStats(\Illuminate\Database\Eloquent\Builder $query, string $category, ?string $role): array
    {
        $counts = (clone $query)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $pendingOfficeHead = $counts[PostRequest::STATUS_PENDING_OFFICE_HEAD] ?? 0;
        $pendingVP = $counts[PostRequest::STATUS_PENDING_VICE_PRESIDENT] ?? 0;
        $pendingImcQa = $counts[PostRequest::STATUS_PENDING_IMC_QA] ?? 0;
        $pendingPresident = $counts[PostRequest::STATUS_PENDING_PRESIDENT] ?? 0;

        $pendingReview = $pendingOfficeHead + $pendingVP + $pendingPresident + $pendingImcQa;
        if ($category === 'approver') {
            $pendingReview = match ($role) {
                'vice_president' => $pendingVP,
                'imc_qa_checker' => $pendingImcQa,
                default => $pendingOfficeHead,
            };
        }

        return [
            'total_users' => $category === 'admin' ? User::count() : 0,
            'total_submissions' => array_sum($counts),
            'total' => array_sum($counts),
            'draft' => $counts[PostRequest::STATUS_DRAFT] ?? 0,
            'pending_review' => $pendingReview,
            'pending' => $pendingReview,
            'approved_posts' => $counts[PostRequest::STATUS_APPROVED] ?? 0,
            'approved' => $counts[PostRequest::STATUS_APPROVED] ?? 0,
            'rejected' => $counts[PostRequest::STATUS_REJECTED] ?? 0,
            'returned_revision' => $counts[PostRequest::STATUS_RETURNED_FOR_REVISION] ?? 0,
            'returned_for_revision' => $counts[PostRequest::STATUS_RETURNED_FOR_REVISION] ?? 0,
            'scheduled' => $counts[PostRequest::STATUS_SCHEDULED] ?? 0,
            'published_posts' => $counts[PostRequest::STATUS_PUBLISHED] ?? 0,
            'published' => $counts[PostRequest::STATUS_PUBLISHED] ?? 0,
        ];
    }

    private function buildActivities(\Illuminate\Support\Collection $posts): \Illuminate\Support\Collection
    {
        return $posts->take(10)->map(function (PostRequest $post) {
            $requestorName = $post->requestor
                ? trim(($post->requestor->first_name ?? '') . ' ' . ($post->requestor->last_name ?? ''))
                : 'Unknown User';
            $initials = $post->requestor
                ? strtoupper(substr($post->requestor->first_name ?? 'U', 0, 1) . substr($post->requestor->last_name ?? 'N', 0, 1))
                : 'UN';

            return [
                'id' => $post->id,
                'userInitials' => $initials,
                'userName' => $requestorName,
                'action' => match ($post->status) {
                    PostRequest::STATUS_PUBLISHED => 'published a post',
                    PostRequest::STATUS_APPROVED => 'approved a submission for',
                    PostRequest::STATUS_PENDING_OFFICE_HEAD => 'submitted for office head review',
                    PostRequest::STATUS_PENDING_VICE_PRESIDENT => 'forwarded to vice president for',
                    PostRequest::STATUS_PENDING_IMC_QA => 'submitted for IMC/QA review for',
                    PostRequest::STATUS_REJECTED => 'rejected a submission for',
                    PostRequest::STATUS_RETURNED_FOR_REVISION => 'requested revision for',
                    default => 'updated',
                },
                'target' => $post->title,
                'time' => $post->updated_at?->diffForHumans() ?? 'recently',
                'platform' => 'Status: ' . (PostRequest::statuses()[$post->status] ?? $post->status),
            ];
        });
    }

    private function postSummary(PostRequest $post, Request $request): array
    {
        $statusLabels = PostRequest::statuses();
        $currentStage = $post->approvalWorkflows
            ->where('action', 'pending')
            ->sortBy('stage_order')
            ->first();

        return [
            'id' => $post->id,
            'title' => $post->title,
            'slug' => $post->slug,
            'caption_narrative' => $post->caption_narrative,
            'category' => $post->category ? [
                'id' => $post->category->id,
                'name' => $post->category->name,
                'slug' => $post->category->slug,
                'color' => $post->category->color,
                'icon' => $post->category->icon,
            ] : null,
            'requestor' => $post->requestor ? [
                'id' => $post->requestor->id,
                'full_name' => $post->requestor->full_name,
                'email' => $post->requestor->email,
                'department' => $post->requestor->department,
            ] : null,
            'status' => $post->status,
            'status_label' => $statusLabels[$post->status] ?? $post->status,
            'target_platforms' => $post->target_platforms ?? [],
            'preferred_schedule_at' => $post->preferred_schedule_at?->toISOString(),
            'published_at' => $post->published_at?->toISOString(),
            'rejection_reason' => $post->rejection_reason,
            'revision_notes' => $post->revision_notes ?? [],
            'revision_count' => $post->revision_count,
            'media' => $post->media->map(fn ($media) => [
                'id' => $media->id,
                'type' => $media->type,
                'original_filename' => $media->original_name,
                'url' => $this->mediaUrl($media->file_path, $request),
                'mime_type' => $media->mime_type,
                'size' => $media->file_size,
                'formatted_size' => $media->formatted_size,
                'is_featured' => $media->is_featured,
                'sort_order' => $media->sort_order,
            ]),
            'approval_workflows' => $post->approvalWorkflows->map(fn ($workflow) => [
                'id' => $workflow->id,
                'stage' => $workflow->stage,
                'stage_label' => $workflow->stage_label,
                'action' => $workflow->action,
                'action_label' => $workflow->action_label,
                'approver' => $workflow->approver ? [
                    'id' => $workflow->approver->id,
                    'full_name' => $workflow->approver->full_name,
                    'email' => $workflow->approver->email,
                ] : null,
                'remarks' => $workflow->remarks,
                'acted_at' => $workflow->acted_at?->toISOString(),
                'stage_order' => $workflow->stage_order,
            ]),
            'current_approval_stage' => $currentStage?->stage,
            'current_stage_label' => $currentStage ? (PostRequest::approvalStages()[$currentStage->stage] ?? $currentStage->stage) : null,
            'can_edit' => false,
            'can_approve' => $currentStage !== null,
            'created_at' => $post->created_at?->toISOString(),
            'updated_at' => $post->updated_at?->toISOString(),
        ];
    }

    private function mediaUrl(?string $path, Request $request): ?string
    {
        if (!$path) {
            return null;
        }

        return asset('storage/' . str_replace('\\', '/', $path));
    }

    /**
     * Get dashboard stats — cached for 60 seconds.
     * Uses a single GROUP BY query instead of 8 separate COUNTs.
     */
    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $category = $user->roleCategory();
        $role = $user->workflowRole();

        // Cache key is role-specific (different roles see different counts)
        $cacheKey = 'dashboard_stats_' . $category . '_' . $user->id;

        $stats = Cache::remember($cacheKey, 1, function () use ($user, $category, $role) {
            $query = PostRequest::query();

            // Role-based filtering (mirroring PostRequestController visibility)
            if ($category === 'requestor') {
                $query->where('requestor_id', $user->id);
            } elseif ($category === 'approver') {
                if ($role === 'vice_president') {
                    $query->whereNotIn('status', ['draft']);
                } elseif ($role === 'imc_qa_checker') {
                    $query->whereIn('status', [
                        PostRequest::STATUS_PENDING_IMC_QA,
                        PostRequest::STATUS_APPROVED,
                        PostRequest::STATUS_SCHEDULED,
                        PostRequest::STATUS_PUBLISHED,
                        PostRequest::STATUS_PUBLISH_FAILED,
                        PostRequest::STATUS_REJECTED,
                        PostRequest::STATUS_RETURNED_FOR_REVISION,
                    ]);
                } else { // office_head
                    $query->whereHas('requestor', function ($q) use ($user) {
                        $q->where('department', $user->department);
                    })->whereNotIn('status', ['draft']);
                }
            }

            // ── Single GROUP BY query: one DB round-trip ──
            $counts = (clone $query)
                ->selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status')
                ->toArray();

            // ── Total user count (admin only) ──
            $totalUsers = 0;
            if ($category === 'admin') {
                $totalUsers = User::count();
            }

            // ── Derive all stats from the single grouped result ──
            $draft               = $counts[PostRequest::STATUS_DRAFT] ?? 0;
            $pendingOfficeHead   = $counts[PostRequest::STATUS_PENDING_OFFICE_HEAD] ?? 0;
            $pendingVP           = $counts[PostRequest::STATUS_PENDING_VICE_PRESIDENT] ?? 0;
            $pendingPresident    = $counts[PostRequest::STATUS_PENDING_PRESIDENT] ?? 0;
            $pendingImcQa        = $counts[PostRequest::STATUS_PENDING_IMC_QA] ?? 0;
            $approved            = $counts[PostRequest::STATUS_APPROVED] ?? 0;
            $rejected            = $counts[PostRequest::STATUS_REJECTED] ?? 0;
            $returned            = $counts[PostRequest::STATUS_RETURNED_FOR_REVISION] ?? 0;
            $scheduled           = $counts[PostRequest::STATUS_SCHEDULED] ?? 0;
            $published           = $counts[PostRequest::STATUS_PUBLISHED] ?? 0;

            $totalSubmissions = array_sum($counts);
            
            $pendingReview = 0;
            if ($category === 'approver') {
                if ($role === 'vice_president') {
                    $pendingReview = $pendingVP;
                } elseif ($role === 'imc_qa_checker') {
                    $pendingReview = $pendingImcQa;
                } else { // office_head
                    $pendingReview = $pendingOfficeHead;
                }
            } else {
                $pendingReview = $pendingOfficeHead + $pendingVP + $pendingPresident + $pendingImcQa;
            }

            return [
                'total_users'        => $totalUsers,
                'total_submissions'  => $totalSubmissions,
                'total'              => $totalSubmissions,
                'draft'              => $draft,
                'pending_review'     => $pendingReview,
                'pending'            => $pendingReview,
                'approved_posts'     => $approved,
                'approved'           => $approved,
                'rejected'           => $rejected,
                'returned_revision'  => $returned,
                'returned_for_revision' => $returned,
                'scheduled'          => $scheduled,
                'published_posts'    => $published,
                'published'          => $published,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * Recent activity — cached 60 seconds.
     */
    public function getRecentActivity(Request $request): JsonResponse
    {
        $user = $request->user();
        $category = $user->roleCategory();
        $role = $user->workflowRole();

        $cacheKey = 'dashboard_recent_activity_' . $category . '_' . $user->id;

        $activities = Cache::remember($cacheKey, 1, function () use ($user, $category, $role) {
            $query = PostRequest::with(['requestor', 'approvalWorkflows.approver']);

            // Scope activity to the user's role so it doesn't leak across roles
            if ($category === 'requestor') {
                $query->where('requestor_id', $user->id);
            } elseif ($category === 'approver') {
                if ($role === 'vice_president') {
                    $query->whereNotIn('status', ['draft']);
                } elseif ($role === 'imc_qa_checker') {
                    $query->whereIn('status', [
                        PostRequest::STATUS_PENDING_IMC_QA,
                        PostRequest::STATUS_APPROVED,
                        PostRequest::STATUS_SCHEDULED,
                        PostRequest::STATUS_PUBLISHED,
                        PostRequest::STATUS_PUBLISH_FAILED,
                        PostRequest::STATUS_REJECTED,
                        PostRequest::STATUS_RETURNED_FOR_REVISION,
                    ]);
                } else { // office_head
                    $query->whereHas('requestor', function ($q) use ($user) {
                        $q->where('department', $user->department);
                    })->whereNotIn('status', ['draft']);
                }
            }

            $recentPosts = $query
                ->orderBy('updated_at', 'desc')
                ->take(15)
                ->get()
                ->map(function ($post) {
                    $currentStage = $post->currentApprovalStage();
                    $requestorName = $post->requestor
                        ? trim(($post->requestor->first_name ?? '') . ' ' . ($post->requestor->last_name ?? ''))
                        : 'Unknown User';
                    $initials = $post->requestor
                        ? strtoupper(
                            substr($post->requestor->first_name ?? 'U', 0, 1) .
                            substr($post->requestor->last_name ?? 'N', 0, 1)
                        )
                        : 'UN';

                    $action = match ($post->status) {
                        PostRequest::STATUS_PUBLISHED => 'published a post',
                        PostRequest::STATUS_APPROVED => 'approved a submission for',
                        PostRequest::STATUS_PENDING_OFFICE_HEAD => 'submitted for office head review',
                        PostRequest::STATUS_PENDING_VICE_PRESIDENT => 'forwarded to vice president for',
                        PostRequest::STATUS_PENDING_PRESIDENT => 'forwarded to president for',
                        PostRequest::STATUS_PENDING_IMC_QA => 'submitted for IMC/QA review for',
                        PostRequest::STATUS_REJECTED => 'rejected a submission for',
                        PostRequest::STATUS_RETURNED_FOR_REVISION => 'requested revision for',
                        PostRequest::STATUS_SCHEDULED => 'scheduled a post for',
                        PostRequest::STATUS_DRAFT => 'created a draft for',
                        default => 'updated',
                    };

                    return [
                        'id' => $post->id,
                        'userInitials' => $initials,
                        'userName' => $requestorName,
                        'action' => $action,
                        'target' => $post->title,
                        'time' => $post->updated_at?->diffForHumans() ?? 'recently',
                        'platform' => $currentStage
                            ? 'Stage: ' . ($currentStage->stage_label ?? $currentStage->stage)
                            : 'Status: ' . ($post->status_label ?? $post->status),
                    ];
                });

            return $recentPosts;
        });

        return response()->json($activities);
    }

    /**
     * Analytics overview — cached for 120 seconds (heavier computation).
     * Aggregates in the DB instead of loading all rows into PHP memory.
     */
    public function getAnalyticsOverview(Request $request): JsonResponse
    {
        $cacheKey = 'dashboard_analytics';

        $data = Cache::remember($cacheKey, 1, function () {
            // ── Total Volume: single count ──
            $totalVolume = PostRequest::count();

            // ── Active Users: count users with at least one post ──
            $activeUsers = User::whereHas('postRequests')->count();

            // ── Compliance Rate ──
            $approvedCount = PostRequest::where('status', PostRequest::STATUS_APPROVED)->count();
            $rejectedCount = PostRequest::where('status', PostRequest::STATUS_REJECTED)->count();
            $complianceRate = ($approvedCount + $rejectedCount) > 0
                ? round(($approvedCount / ($approvedCount + $rejectedCount)) * 100, 1) . '%'
                : '0%';

            $avgVelocity = '4.2 hrs';

            // ── Department Breakdown: single query with join, no N+1 ──
            // Note: users.department is a string column (not a FK), so we join on the name match
            $departmentBreakdown = \App\Models\Department::leftJoin('users', function ($join) {
                    $join->on('departments.name', '=', 'users.department')
                         ->orOn('departments.display_name', '=', 'users.department');
                })
                ->leftJoin('post_requests', 'users.id', '=', 'post_requests.requestor_id')
                ->selectRaw('departments.id, departments.name, departments.display_name, COUNT(post_requests.id) as count')
                ->groupBy('departments.id', 'departments.name', 'departments.display_name')
                ->get()
                ->map(function ($dept, $index) use ($totalVolume) {
                    $colors = ['#1E40AF', '#047857', '#D97706', '#7C3AED', '#6B7280'];
                    return [
                        'name'       => $dept->display_name ?? $dept->name,
                        'count'      => (int) $dept->count,
                        'percentage' => $totalVolume > 0 ? round(((int) $dept->count / $totalVolume) * 100) : 0,
                        'barColor'   => $colors[$index % count($colors)],
                    ];
                });

            // ── Platform Stats: single query using JSON extraction ──
            $platformRaw = PostRequest::selectRaw("
                    COUNT(CASE WHEN target_platforms::text ILIKE '%facebook%' THEN 1 END) as facebook_count,
                    COUNT(CASE WHEN target_platforms::text ILIKE '%instagram%' THEN 1 END) as instagram_count,
                    COUNT(CASE WHEN target_platforms::text ILIKE '%website%' OR target_platforms::text ILIKE '%web%' THEN 1 END) as website_count
                ")->first();

            $facebookCount  = (int) ($platformRaw->facebook_count ?? 0);
            $instagramCount = (int) ($platformRaw->instagram_count ?? 0);
            $websiteCount   = (int) ($platformRaw->website_count ?? 0);

            $platformStats = [
                [
                    'name'    => 'Facebook',
                    'posts'   => $facebookCount . ' posts',
                    'reach'   => '10K Reach',
                    'icon'    => 'logo-facebook',
                    'color'   => '#1877F2',
                    'bgColor' => '#EFF6FF',
                ],
                [
                    'name'    => 'Instagram',
                    'posts'   => $instagramCount . ' posts',
                    'reach'   => '5K Reach',
                    'icon'    => 'logo-instagram',
                    'color'   => '#E1306C',
                    'bgColor' => '#FDF2F8',
                ],
                [
                    'name'    => 'Website',
                    'posts'   => $websiteCount . ' posts',
                    'reach'   => '2K Reach',
                    'icon'    => 'globe-outline',
                    'color'   => '#059669',
                    'bgColor' => '#ECFDF5',
                ],
            ];

            // ── Content Published & Pending ──
            $contentPublished = PostRequest::where('status', PostRequest::STATUS_PUBLISHED)->count();
            $pendingApproval  = PostRequest::whereIn('status', [
                PostRequest::STATUS_PENDING_OFFICE_HEAD,
                PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                PostRequest::STATUS_PENDING_PRESIDENT,
                PostRequest::STATUS_PENDING_IMC_QA,
            ])->count();

            // ── Monthly Data: single GROUP BY on month ──
            $currentYear = date('Y');
            $monthNames  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

            $postsByMonth = PostRequest::selectRaw('EXTRACT(MONTH FROM created_at) as month, COUNT(*) as count')
                ->whereYear('created_at', $currentYear)
                ->groupByRaw('EXTRACT(MONTH FROM created_at)')
                ->pluck('count', 'month')
                ->toArray();

            $monthsData = [];
            foreach ($monthNames as $index => $month) {
                $monthNum = $index + 1;
                $monthsData[] = [
                    'month' => $month,
                    'posts' => (int) ($postsByMonth[$monthNum] ?? 0),
                ];
            }

            // ── Platform Reach Percentages ──
            $totalPlatforms = $facebookCount + $instagramCount + $websiteCount;
            $platformReach = [
                'facebook'  => $totalPlatforms > 0 ? round(($facebookCount / $totalPlatforms) * 100) : 0,
                'instagram' => $totalPlatforms > 0 ? round(($instagramCount / $totalPlatforms) * 100) : 0,
                'other'     => $totalPlatforms > 0 ? round(($websiteCount / $totalPlatforms) * 100) : 0,
            ];

            return [
                'totalVolume'         => number_format($totalVolume),
                'avgVelocity'         => $avgVelocity,
                'complianceRate'      => $complianceRate,
                'activeUsers'         => number_format($activeUsers),
                'departmentBreakdown' => $departmentBreakdown,
                'platformStats'       => $platformStats,
                'contentPublished'    => number_format($contentPublished),
                'pendingApproval'     => number_format($pendingApproval),
                'monthsData'          => $monthsData,
                'platformReach'       => $platformReach,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
