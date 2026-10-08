<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 20px;
            color: #333333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .header {
            background-color: {{ $brandColor ?? '#800000' }};
            padding: 24px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        .content {
            padding: 32px 24px;
            line-height: 1.6;
        }
        .greeting {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
        }
        .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 20px;
            text-transform: uppercase;
        }
        .badge-rejected { background-color: #FEE2E2; color: #991B1B; }
        .badge-failed { background-color: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
        .badge-approved { background-color: #DCFCE7; color: #166534; }
        .badge-revision { background-color: #FEF3C7; color: #92400E; }
        .badge-pending { background-color: #E0F2FE; color: #075985; }
        .details-card {
            background-color: #F8FAFC;
            border-left: 4px solid {{ $brandColor ?? '#800000' }};
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .details-item {
            margin-bottom: 8px;
            font-size: 14px;
        }
        .details-item:last-child {
            margin-bottom: 0;
        }
        .button-wrapper {
            text-align: center;
            margin-top: 28px;
            margin-bottom: 12px;
        }
        .button {
            display: inline-block;
            background-color: {{ $brandColor ?? '#800000' }};
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
        }
        .footer {
            background-color: #F1F5F9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748B;
            border-top: 1px solid #E2E8F0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            @if(!empty($logoUrl))
                <img src="{{ $logoUrl }}" alt="Logo" style="max-height: 48px; margin-bottom: 8px;">
            @endif
            <h1>{{ $headerTitle ?? 'JMCFI PostFlow Notification' }}</h1>
        </div>
        <div class="content">
            @if(!empty($statusType))
                <span class="badge badge-{{ strtolower($statusType) }}">{{ strtoupper($statusLabel ?? $statusType) }}</span>
            @endif

            <div class="greeting">Hello {{ $userName ?? 'User' }},</div>
            <p>{{ $bodyMessage ?? 'You have an update regarding your post request in JMCFI PostFlow.' }}</p>

            <div class="details-card">
                @if(!empty($postTitle))
                    <div class="details-item"><strong>Post Title:</strong> {{ $postTitle }}</div>
                @endif
                @if(!empty($reason))
                    <div class="details-item"><strong>Reason / Notes:</strong> {{ $reason }}</div>
                @endif
                @if(!empty($errorMessage))
                    <div class="details-item" style="color: #DC2626;"><strong>Error Reason:</strong> {{ $errorMessage }}</div>
                    <div class="details-item" style="color: #475569; font-size: 13px; margin-top: 6px;">💡 If this is caused by expired or missing credentials, please check your <strong>Platform Tokens</strong> or <strong>Developer API Tokens</strong> in the Admin Dashboard.</div>
                @endif
                @if(!empty($failedAt))
                    <div class="details-item"><strong>Failed At:</strong> {{ $failedAt }}</div>
                @endif
                @if(!empty($targetPlatforms))
                    <div class="details-item"><strong>Target Platforms:</strong> {{ is_array($targetPlatforms) ? implode(', ', $targetPlatforms) : $targetPlatforms }}</div>
                @endif
            </div>

            @if(!empty($actionUrl))
                <div class="button-wrapper">
                    <a href="{{ $actionUrl }}" class="button" target="_blank">{{ $buttonText ?? 'View Request in Portal' }}</a>
                </div>
            @endif
        </div>
        <div class="footer">
            <p>{{ $footerText ?? '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.' }}</p>
        </div>
    </div>
</body>
</html>
