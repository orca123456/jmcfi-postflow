<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->getRoleNames()->first();

        $query = PostRequest::query();

        // Role-based filtering (mirroring PostRequestController visibility)
        if ($role === 'requestor') {
            $query->where('requestor_id', $user->id);
        } elseif (in_array($role, ['vice_president', 'imc_qa_checker', 'president'])) {
            $query->where(function ($q) use ($user) {
                $q->whereNotIn('status', ['draft', 'returned_for_revision', 'rejected'])
                  ->orWhereHas('approvalWorkflows', function ($aw) use ($user) {
                      $aw->where('approver_id', $user->id)
                         ->whereIn('action', ['rejected', 'returned_for_revision']);
                  });
            });
        } elseif ($role === 'office_head') {
            $query->whereNotIn('status', ['draft']);
        }

        $totalUsers = 0;
        if ($role === 'admin') {
            $totalUsers = User::count();
        }

        $stats = [
            'total_users' => $totalUsers,
            'total_submissions' => (clone $query)->count(),
            'pending_review' => (clone $query)->whereIn('status', [
                PostRequest::STATUS_PENDING_OFFICE_HEAD,
                PostRequest::STATUS_PENDING_VICE_PRESIDENT,
                PostRequest::STATUS_PENDING_PRESIDENT,
                PostRequest::STATUS_PENDING_IMC_QA,
            ])->count(),
            'approved_posts' => (clone $query)->where('status', PostRequest::STATUS_APPROVED)->count(),
            'approved' => (clone $query)->where('status', PostRequest::STATUS_APPROVED)->count(),
            'returned_revision' => (clone $query)->where('status', PostRequest::STATUS_RETURNED_FOR_REVISION)->count(),
            'returned_for_revision' => (clone $query)->where('status', PostRequest::STATUS_RETURNED_FOR_REVISION)->count(),
            'published_posts' => (clone $query)->where('status', PostRequest::STATUS_PUBLISHED)->count(),
            'published' => (clone $query)->where('status', PostRequest::STATUS_PUBLISHED)->count(),
            'draft' => (clone $query)->where('status', PostRequest::STATUS_DRAFT)->count(),
            'rejected' => (clone $query)->where('status', PostRequest::STATUS_REJECTED)->count(),
            'scheduled' => (clone $query)->where('status', PostRequest::STATUS_SCHEDULED)->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    public function getRecentActivity(Request $request): JsonResponse
    {
        $recentPosts = PostRequest::with(['requestor', 'approvalWorkflows.approver'])
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
                    'color' => match ($post->status) {
                        PostRequest::STATUS_PUBLISHED => '#16A34A',
                        PostRequest::STATUS_APPROVED => '#2563EB',
                        PostRequest::STATUS_REJECTED => '#DC2626',
                        PostRequest::STATUS_RETURNED_FOR_REVISION => '#B45309',
                        default => '#6B7280',
                    },
                    'bgColor' => match ($post->status) {
                        PostRequest::STATUS_PUBLISHED => '#DCFCE7',
                        PostRequest::STATUS_APPROVED => '#DBEAFE',
                        PostRequest::STATUS_REJECTED => '#FEE2E2',
                        PostRequest::STATUS_RETURNED_FOR_REVISION => '#FEF3C7',
                        default => '#F3F4F6',
                    },
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $recentPosts,
        ]);
    }

    public function getViolationTrends(Request $request): JsonResponse
    {
        $trends = [
            'labels' => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            'values' => [],
        ];

        // Get violation counts per day for the last 7 days
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $trends['values'][] = PostRequest::whereDate('updated_at', $date)
                ->where('status', PostRequest::STATUS_REJECTED)
                ->count();
        }

        return response()->json([
            'success' => true,
            'data' => $trends,
        ]);
    }

    public function getAnalyticsOverview(Request $request): JsonResponse
    {
        $totalVolume = PostRequest::count();
        
        // Active Users
        $activeUsers = User::where('status', 'active')->count();

        // Compliance Rate (assume based on approved vs rejected for now)
        $approvedCount = PostRequest::where('status', PostRequest::STATUS_APPROVED)->count();
        $rejectedCount = PostRequest::where('status', PostRequest::STATUS_REJECTED)->count();
        $complianceRate = ($approvedCount + $rejectedCount) > 0 
            ? round(($approvedCount / ($approvedCount + $rejectedCount)) * 100, 1) . '%' 
            : '0%';

        // Average Velocity (Mocked to 4.2 hrs for simplicity, but could calculate avg diff between created_at and acted_at)
        $avgVelocity = '4.2 hrs';

        // Department Breakdown
        $departments = \App\Models\Department::all();
        $departmentBreakdown = [];
        $colors = ['#1E40AF', '#047857', '#D97706', '#7C3AED', '#6B7280'];
        
        foreach ($departments as $index => $dept) {
            $count = PostRequest::whereHas('requestor', function ($q) use ($dept) {
                $q->where('department_id', $dept->id);
            })->count();
            
            $departmentBreakdown[] = [
                'name' => $dept->display_name ?? $dept->name,
                'count' => $count,
                'percentage' => $totalVolume > 0 ? round(($count / $totalVolume) * 100) : 0,
                'barColor' => $colors[$index % count($colors)],
            ];
        }

        // Platform Stats
        $facebookCount = 0;
        $instagramCount = 0;
        $websiteCount = 0;

        $posts = PostRequest::all();
        foreach ($posts as $post) {
            $platforms = is_string($post->target_platforms) ? json_decode($post->target_platforms, true) : $post->target_platforms;
            if (is_array($platforms)) {
                $lowerPlatforms = array_map('strtolower', $platforms);
                if (in_array('facebook', $lowerPlatforms) || in_array('fb', $lowerPlatforms)) $facebookCount++;
                if (in_array('instagram', $lowerPlatforms) || in_array('ig', $lowerPlatforms)) $instagramCount++;
                if (in_array('website', $lowerPlatforms) || in_array('web', $lowerPlatforms)) $websiteCount++;
            }
        }

        $platformStats = [
            [
                'name' => 'Facebook',
                'posts' => $facebookCount . ' posts',
                'reach' => '10K Reach', // placeholder for reach
                'icon' => 'logo-facebook',
                'color' => '#1877F2',
                'bgColor' => '#EFF6FF',
            ],
            [
                'name' => 'Instagram',
                'posts' => $instagramCount . ' posts',
                'reach' => '5K Reach',
                'icon' => 'logo-instagram',
                'color' => '#E1306C',
                'bgColor' => '#FDF2F8',
            ],
            [
                'name' => 'Website',
                'posts' => $websiteCount . ' posts',
                'reach' => '2K Reach',
                'icon' => 'globe-outline',
                'color' => '#059669',
                'bgColor' => '#ECFDF5',
            ]
        ];

        // Additional Analytics Tab Data
        $contentPublished = PostRequest::where('status', PostRequest::STATUS_PUBLISHED)->count();
        $pendingApproval = PostRequest::whereIn('status', [
            PostRequest::STATUS_PENDING_OFFICE_HEAD,
            PostRequest::STATUS_PENDING_VICE_PRESIDENT,
            PostRequest::STATUS_PENDING_PRESIDENT,
            PostRequest::STATUS_PENDING_IMC_QA,
        ])->count();

        // Monthly Data (for current year)
        $currentYear = date('Y');
        $monthsData = [];
        $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        $postsByMonth = PostRequest::selectRaw('EXTRACT(MONTH FROM created_at) as month, count(*) as count')
            ->whereYear('created_at', $currentYear)
            ->groupByRaw('EXTRACT(MONTH FROM created_at)')
            ->pluck('count', 'month')
            ->toArray();

        foreach ($monthNames as $index => $month) {
            $monthNum = $index + 1;
            $monthsData[] = [
                'month' => $month,
                'posts' => $postsByMonth[$monthNum] ?? 0,
            ];
        }

        // Platform Reach Percentages
        $totalPlatforms = $facebookCount + $instagramCount + $websiteCount;
        $platformReach = [
            'facebook' => $totalPlatforms > 0 ? round(($facebookCount / $totalPlatforms) * 100) : 0,
            'instagram' => $totalPlatforms > 0 ? round(($instagramCount / $totalPlatforms) * 100) : 0,
            'other' => $totalPlatforms > 0 ? round(($websiteCount / $totalPlatforms) * 100) : 0,
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'totalVolume' => number_format($totalVolume),
                'avgVelocity' => $avgVelocity,
                'complianceRate' => $complianceRate,
                'activeUsers' => number_format($activeUsers),
                'departmentBreakdown' => $departmentBreakdown,
                'platformStats' => $platformStats,
                
                // Analytics Tab additions
                'contentPublished' => number_format($contentPublished),
                'pendingApproval' => number_format($pendingApproval),
                'monthsData' => $monthsData,
                'platformReach' => $platformReach,
            ]
        ]);
    }
}
