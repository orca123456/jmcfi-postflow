<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $subject ?? $headerTitle ?? 'JMCFI PostFlow Notification' }}</title>
    <style type="text/css">
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f1f5f9;
            margin: 0;
            padding: 28px 12px;
            color: #1e293b;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 480px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }
        .header-banner-wrap {
            line-height: 0;
            font-size: 0;
            border-top-left-radius: 14px;
            border-top-right-radius: 14px;
            overflow: hidden;
            background-color: #430c7b;
        }
        .header-banner-img {
            display: block;
            width: 100%;
            height: auto;
            border: 0;
        }
        .content {
            padding: 24px 22px 18px 22px;
        }
        .greeting {
            font-size: 17px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 14px;
            margin-bottom: 8px;
            letter-spacing: -0.2px;
        }
        .body-message {
            font-size: 13.5px;
            line-height: 1.55;
            color: #334155;
            margin: 0 0 18px 0;
        }
        .details-card {
            background-color: #f8fafc;
            border: 1px solid #eef2f6;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 22px;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .details-table td {
            padding: 10px 14px;
            vertical-align: top;
            border-bottom: 1px solid #eef2f6;
        }
        .details-table tr:last-child td {
            border-bottom: none;
        }
        .label-col {
            width: 36%;
            font-weight: 700;
            color: #0f172a;
        }
        .val-col {
            color: #334155;
            word-break: break-word;
        }
        .button-wrapper {
            text-align: center;
            margin: 22px 0 16px 0;
        }
        .button {
            display: inline-block;
            background-color: #430c7b;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 32px;
            border-radius: 6px;
            font-size: 13.5px;
            font-weight: 700;
            letter-spacing: 0.2px;
            box-shadow: 0 2px 8px rgba(67, 12, 123, 0.25);
        }
        .footer {
            padding: 18px 20px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            background-color: #f8fafc;
            border-top: 1px solid #eef2f6;
        }
    </style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 28px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
    <div class="container" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
        <!-- Header Banner Image -->
        <div class="header-banner-wrap" style="line-height: 0; font-size: 0; border-top-left-radius: 14px; border-top-right-radius: 14px; overflow: hidden; background-color: #430c7b;">
            <img src="{{ !empty($headerBannerUrl) ? $headerBannerUrl : asset('images/email_header_banner.png') }}" alt="{{ $headerTitle ?? 'Jose Maria College Foundation, Inc.' }}" class="header-banner-img" style="display: block; width: 100%; height: auto; border: 0;" />
        </div>

        <div class="content" style="padding: 24px 22px 18px 22px;">
            @php
                $type = strtolower($statusType ?? 'pending');
                $badgeBg = $badgeBgColor ?? match($type) {
                    'rejected', 'failed'   => '#fee2e2',
                    'revision'             => '#fef3c7',
                    'published', 'success' => '#ede9fe',
                    default                => '#ede9fe',
                };
                $badgeText = $badgeTextColor ?? match($type) {
                    'rejected', 'failed'   => '#991b1b',
                    'revision'             => '#92400e',
                    'published', 'success' => '#581c87',
                    default                => '#581c87',
                };
                $badgeLabel = $statusBadge ?? $statusLabel ?? match($type) {
                    'rejected'  => 'REJECTED — POST REQUEST',
                    'revision'  => 'ACTION REQUIRED — REVISION',
                    'approved'  => 'APPROVED',
                    'published' => 'PUBLISHED',
                    default     => 'ACTION REQUIRED — POST APPROVAL',
                };
            @endphp

            <!-- Status Pill Badge -->
            <div style="margin-bottom: 4px;">
                <span style="display: inline-block; background-color: {{ $badgeBg }}; color: {{ $badgeText }}; border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;">
                    {{ $badgeLabel }}
                </span>
            </div>

            <!-- Greeting -->
            <div class="greeting" style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 14px; margin-bottom: 8px; letter-spacing: -0.2px;">
                {{ $greeting ?? ('Hello ' . ($userName ?? 'User') . ',') }}
            </div>

            <!-- Body Message -->
            <p class="body-message" style="font-size: 13.5px; line-height: 1.55; color: #334155; margin: 0 0 18px 0;">
                {{ $bodyMessage ?? 'You have an institutional update regarding your post request in JMCFI PostFlow.' }}
            </p>

            <!-- Details Card Table -->
            <div class="details-card" style="background-color: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; overflow: hidden; margin-bottom: 22px;">
                <table class="details-table" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    @if(!empty($tableDetails) && is_array($tableDetails))
                        @php $totalRows = count($tableDetails); $currentRow = 0; @endphp
                        @foreach($tableDetails as $label => $val)
                            @if(!is_null($val) && $val !== '')
                                @php $currentRow++; $isLast = ($currentRow === $totalRows); @endphp
                                <tr>
                                    <td class="label-col" style="padding: 10px 14px; width: 36%; font-weight: 700; color: #0f172a; vertical-align: top; {{ !$isLast ? 'border-bottom: 1px solid #eef2f6;' : '' }}">{{ $label }}</td>
                                    <td class="val-col" style="padding: 10px 14px; color: #334155; vertical-align: top; {{ !$isLast ? 'border-bottom: 1px solid #eef2f6;' : '' }}">
                                        @if(is_array($val))
                                            {{ implode(', ', $val) }}
                                        @elseif(str_starts_with((string)$val, 'http'))
                                            <a href="{{ $val }}" target="_blank" style="color: #430c7b; text-decoration: underline;">{{ $val }}</a>
                                        @else
                                            {{ $val }}
                                        @endif
                                    </td>
                                </tr>
                            @endif
                        @endforeach
                    @else
                        {{-- Fallback for legacy / generic notifications --}}
                        @php
                            $fallbackRows = [];
                            if (!empty($postTitle)) $fallbackRows['Title'] = $postTitle;
                            if (!empty($approvedBy)) $fallbackRows['Approved by'] = $approvedBy;
                            if (!empty($category)) $fallbackRows['Category'] = $category;
                            if (!empty($submittedBy)) $fallbackRows['Submitted by'] = $submittedBy;
                            if (!empty($department)) $fallbackRows['Department'] = $department;
                            if (!empty($reason)) $fallbackRows['Reason / Notes'] = $reason;
                            if (!empty($publishedPlatforms)) $fallbackRows['Published To'] = is_array($publishedPlatforms) ? implode(', ', $publishedPlatforms) : $publishedPlatforms;
                            if (!empty($publishedAt)) $fallbackRows['Published At'] = $publishedAt;
                            if (!empty($errorMessage)) $fallbackRows['Error Reason'] = $errorMessage;
                            if (!empty($targetPlatforms)) {
                                $platformsList = is_array($targetPlatforms) ? array_map('ucfirst', $targetPlatforms) : explode(',', (string)$targetPlatforms);
                                $fallbackRows['Target Platforms'] = implode(', ', $platformsList);
                            }
                            if (!empty($extraDetails) && is_array($extraDetails)) {
                                foreach ($extraDetails as $k => $v) {
                                    $fallbackRows[$k] = $v;
                                }
                            }
                            $totalRows = count($fallbackRows);
                            $currentRow = 0;
                        @endphp
                        @foreach($fallbackRows as $label => $val)
                            @php $currentRow++; $isLast = ($currentRow === $totalRows); @endphp
                            <tr>
                                <td class="label-col" style="padding: 10px 14px; width: 36%; font-weight: 700; color: #0f172a; vertical-align: top; {{ !$isLast ? 'border-bottom: 1px solid #eef2f6;' : '' }}">{{ $label }}</td>
                                <td class="val-col" style="padding: 10px 14px; color: #334155; vertical-align: top; {{ !$isLast ? 'border-bottom: 1px solid #eef2f6;' : '' }}">
                                    @if(is_array($val))
                                        {{ implode(', ', $val) }}
                                    @elseif(str_starts_with((string)$val, 'http'))
                                        <a href="{{ $val }}" target="_blank" style="color: #430c7b; text-decoration: underline;">{{ $val }}</a>
                                    @else
                                        {{ $val }}
                                    @endif
                                </td>
                            </tr>
                        @endforeach
                    @endif
                </table>
            </div>

            <!-- Action Button -->
            @if(!empty($actionUrl))
                <div class="button-wrapper" style="text-align: center; margin: 22px 0 16px 0;">
                    <a href="{{ $actionUrl }}" class="button" style="display: inline-block; background-color: {{ $buttonColor ?? '#430c7b' }}; color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 13.5px; font-weight: 700; letter-spacing: 0.2px; box-shadow: 0 2px 8px rgba(67, 12, 123, 0.25);" target="_blank">
                        {{ $buttonText ?? 'View Your Request' }}
                    </a>
                </div>
            @endif
        </div>

        <!-- Footer -->
        <div class="footer" style="padding: 18px 20px; text-align: center; font-size: 11px; color: #64748b; background-color: #f8fafc; border-top: 1px solid #eef2f6;">
            {{ $footerText ?? ('© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.') }}
        </div>
    </div>
</body>
</html>
