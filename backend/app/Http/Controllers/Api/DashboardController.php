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
        $postController = app(\App\Http\Controllers\Api\PostRequestController::class);
        $stats = $postController->getDashboardStats($request)->getData(true)['data'] ?? [];
        $activities = $this->getRecentActivity($request)->getData(true) ?? [];
        $postsData = $postController->index($request)->getData(true);
        $departments = \App\Models\Department::where('is_active', true)
            ->where('display_name', 'LIKE', 'College%')
            ->pluck('display_name');
        
        return response()->json([
            'success' => true,
            'stats' => $stats,
            'activities' => $activities,
            'posts' => $postsData,
            'departments' => $departments,
        ]);
    }

    /**
     * Get dashboard stats — cached for 60 seconds.
     * Uses a single GROUP BY query instead of 8 separate COUNTs.
     */
    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $category = $user->roleCategory();
        $role = $user->getRoleNames()->first();

        // Cache key is role-specific (different roles see different counts)
        $cacheKey = 'dashboard_stats_' . $category . '_' . $user->id;

        $stats = Cache::remember($cacheKey, 60, function () use ($user, $category, $role) {
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
            $pendingReview    = $pendingOfficeHead + $pendingVP + $pendingPresident + $pendingImcQa;

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
        $role = $user->getRoleNames()->first();

        $cacheKey = 'dashboard_recent_activity_' . $category . '_' . $user->id;

        $activities = Cache::remember($cacheKey, 60, function () use ($user, $category, $role) {
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

        $data = Cache::remember($cacheKey, 120, function () {
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
            $departmentBreakdown = \App\Models\Department::leftJoin('users', 'departments.name', '=', 'users.department')
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
