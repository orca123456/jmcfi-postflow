@php
    $savedSettings = [];
    try {
        $savedSettings = \App\Models\SystemSetting::whereIn('key', [
            'email_template_header_title',
            'email_template_header_subtitle',
            'email_template_brand_color',
            'email_template_status_badge',
            'email_template_greeting',
            'email_template_body_message',
            'email_template_button_text',
            'email_template_footer_text',
            'email_template_logo_url',
            'email_template_banner_url',
            'email_template_banner_mode',
            'email_template_content_image_url',
            'email_template_details_json',
        ])->pluck('value', 'key')->toArray();
    } catch (\Throwable) {
        $savedSettings = [];
    }

    $resolvedHeaderTitle    = !empty($headerTitle) ? $headerTitle : ($savedSettings['email_template_header_title'] ?? 'Jose Maria College Foundation, Inc.');
    $resolvedHeaderSubtitle = !empty($headerSubtitle) ? $headerSubtitle : ($savedSettings['email_template_header_subtitle'] ?? 'Assured • Consistent • Quality Education');
    $resolvedBrandColor     = !empty($brandColor) ? $brandColor : ($savedSettings['email_template_brand_color'] ?? '#2e0854');
    $resolvedButtonColor    = !empty($buttonColor) ? $buttonColor : $resolvedBrandColor;
    $savedBtnText    = trim((string)($savedSettings['email_template_button_text'] ?? ''));
    $savedFooterText = trim((string)($savedSettings['email_template_footer_text'] ?? ''));
    $defaultFooter   = '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.';

    $resolvedButtonText = !empty($isTemplatePreviewTest)
        ? (!empty($buttonText) ? $buttonText : 'View in Dashboard')
        : (($savedBtnText !== '' && $savedBtnText !== 'View in Dashboard')
            ? $savedBtnText
            : (!empty($buttonText) ? $buttonText : ($savedBtnText !== '' ? $savedBtnText : 'View Your Request')));

    $resolvedFooterText = !empty($isTemplatePreviewTest)
        ? (!empty($footerText) ? $footerText : $defaultFooter)
        : (($savedFooterText !== '' && $savedFooterText !== $defaultFooter)
            ? $savedFooterText
            : (!empty($footerText) ? $footerText : ($savedFooterText !== '' ? $savedFooterText : $defaultFooter)));
    $resolvedLogoUrl         = !empty($headerBannerUrl) ? $headerBannerUrl : ($savedSettings['email_template_logo_url'] ?? '');
    $resolvedBannerBgUrl     = !empty($headerBannerBgUrl) ? $headerBannerBgUrl : ($savedSettings['email_template_banner_url'] ?? '');
    $resolvedBannerMode      = !empty($bannerMode) ? $bannerMode : ($savedSettings['email_template_banner_mode'] ?? 'overlay');
    $resolvedContentImageUrl = !empty($contentImageUrl) ? $contentImageUrl : ($savedSettings['email_template_content_image_url'] ?? '');

    $hasCustomHeader = !empty($headerSubtitle)
        || (!empty($savedSettings['email_template_header_title']) && $savedSettings['email_template_header_title'] !== 'Jose Maria College Foundation, Inc.')
        || (!empty($savedSettings['email_template_header_subtitle']) && $savedSettings['email_template_header_subtitle'] !== 'Assured • Consistent • Quality Education')
        || !empty($resolvedLogoUrl)
        || !empty($resolvedBannerBgUrl)
        || $resolvedBannerMode === 'full_image'
        || (!empty($savedSettings['email_template_brand_color']) && strtolower($savedSettings['email_template_brand_color']) !== '#2e0854');

    $customLabelOverrides = [];
    if (!empty($savedSettings['email_template_details_json'])) {
        $decodedCustomRows = json_decode((string)$savedSettings['email_template_details_json'], true);
        $defaultRowKeys = ['Title', 'Category', 'Published Platforms', 'Published At', 'Facebook Post ID'];
        if (is_array($decodedCustomRows)) {
            foreach ($decodedCustomRows as $idx => $row) {
                $customLabel = trim((string)($row['label'] ?? ''));
                if ($customLabel !== '' && isset($defaultRowKeys[$idx])) {
                    $customLabelOverrides[$defaultRowKeys[$idx]] = $customLabel;
                }
            }
        }
    }
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $subject ?? $resolvedHeaderTitle }}</title>
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
            background-color: #2e0854;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 34px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.2px;
            box-shadow: 0 2px 8px rgba(46, 8, 84, 0.25);
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
        <div class="header-banner-wrap" style="border-top-left-radius: 14px; border-top-right-radius: 14px; overflow: hidden; background-color: {{ $resolvedBrandColor }};">
            @if($resolvedBannerMode === 'full_image' && !empty($resolvedBannerBgUrl))
                <img src="{{ $resolvedBannerBgUrl }}" alt="{{ $resolvedHeaderTitle }}" class="header-banner-img" style="display: block; width: 100%; height: auto; border: 0;" />
            @elseif($hasCustomHeader)
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: {{ $resolvedBrandColor }}; background-image: linear-gradient(135deg, {{ $resolvedBrandColor }}B8 0%, {{ $resolvedBrandColor }}8F 100%), url('{{ !empty($resolvedBannerBgUrl) ? $resolvedBannerBgUrl : asset('images/email_header_campus.jpg') }}'); background-size: cover; background-position: center;">
                    <tr>
                        <td style="padding: 22px 24px; text-align: center;">
                            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                                <tr>
                                    <td style="padding-right: 14px; vertical-align: middle;">
                                        <img src="{{ !empty($resolvedLogoUrl) ? $resolvedLogoUrl : asset('images/jmc_logo.png') }}" alt="Logo" width="52" height="52" style="display: block; width: 52px; height: 52px; object-fit: contain; border-radius: 8px; border: 0;" />
                                    </td>
                                    <td style="text-align: left; vertical-align: middle;">
                                        <div style="color: #ffffff; font-size: 16px; font-weight: 800; line-height: 1.25;">{{ $resolvedHeaderTitle }}</div>
                                        @if(!empty($resolvedHeaderSubtitle))
                                            <div style="color: #e2e8f0; font-size: 11px; font-weight: 500; margin-top: 3px; letter-spacing: 0.3px;">{{ $resolvedHeaderSubtitle }}</div>
                                        @endif
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            @else
                <img src="{{ asset('images/email_header_banner.png') }}" alt="{{ $resolvedHeaderTitle }}" class="header-banner-img" style="display: block; width: 100%; height: auto; border: 0;" />
            @endif
        </div>

        <div class="content" style="padding: 24px 22px 18px 22px;">
            @php
                $type = strtolower($statusType ?? 'pending');
                $badgeBg = $badgeBgColor ?? match($type) {
                    'rejected', 'failed'   => '#ede9fe',
                    'reminder'             => '#ede9fe',
                    'revision'             => '#fef3c7',
                    'published', 'success' => '#ede9fe',
                    default                => '#ede9fe',
                };
                $badgeText = $badgeTextColor ?? match($type) {
                    'rejected', 'failed'   => '#4338ca',
                    'reminder'             => '#4338ca',
                    'revision'             => '#92400e',
                    'published', 'success' => '#581c87',
                    default                => '#581c87',
                };
                $badgeLabel = $statusBadge ?? $statusLabel ?? ($savedSettings['email_template_status_badge'] ?? match($type) {
                    'rejected'  => 'POST REQUEST REJECTED',
                    'reminder'  => 'REMINDER — ACTION REQUIRED',
                    'revision'  => 'ACTION REQUIRED — REVISION',
                    'approved'  => 'APPROVED',
                    'published' => 'PUBLISHED',
                    default     => 'ACTION REQUIRED — POST APPROVAL',
                });
                $displayGreeting = $greeting ?? (!empty($savedSettings['email_template_greeting']) ? $savedSettings['email_template_greeting'] : ('Hello ' . ($userName ?? 'User') . ','));
                $displayBodyMessage = $bodyMessage ?? (!empty($savedSettings['email_template_body_message']) ? $savedSettings['email_template_body_message'] : 'You have an institutional update regarding your post request in JMCFI PostFlow.');
            @endphp

            <!-- Status Pill Badge -->
            <div style="margin-bottom: 4px;">
                <span style="display: inline-block; background-color: {{ $badgeBg }}; color: {{ $badgeText }}; border-radius: 9999px; padding: 4px 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;">
                    {{ $badgeLabel }}
                </span>
            </div>

            <!-- Greeting -->
            <div class="greeting" style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 14px; margin-bottom: 8px; letter-spacing: -0.2px;">
                {{ $displayGreeting }}
            </div>

            <!-- Body Message -->
            <p class="body-message" style="font-size: 13.5px; line-height: 1.55; color: #334155; margin: 0 0 18px 0;">
                {{ $displayBodyMessage }}
            </p>

            @if(!empty($resolvedContentImageUrl))
                <div style="margin: 0 0 18px 0; border-radius: 8px; overflow: hidden; border: 1px solid #eef2f6;">
                    <img src="{{ $resolvedContentImageUrl }}" alt="Template Attachment" style="display: block; width: 100%; height: auto; border: 0; border-radius: 8px;" />
                </div>
            @endif

            <!-- Details Card Table -->
            <div class="details-card" style="background-color: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; overflow: hidden; margin-bottom: 22px;">
                <table class="details-table" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    @if(!empty($tableDetails) && is_array($tableDetails))
                        @php $totalRows = count($tableDetails); $currentRow = 0; @endphp
                        @foreach($tableDetails as $label => $val)
                            @if(!is_null($val) && $val !== '')
                                @php
                                    $currentRow++;
                                    $isLast = ($currentRow === $totalRows);
                                    $displayLabel = $customLabelOverrides[$label] ?? $label;
                                @endphp
                                <tr>
                                    <td class="label-col" style="padding: 10px 14px; width: 36%; font-weight: 700; color: #0f172a; vertical-align: top; {{ !$isLast ? 'border-bottom: 1px solid #eef2f6;' : '' }}">{{ $displayLabel }}</td>
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
                            @php
                                $currentRow++;
                                $isLast = ($currentRow === $totalRows);
                                $displayFallbackLabel = $customLabelOverrides[$label] ?? $label;
                            @endphp
                            <tr>
                                <td class="label-col" style="padding: 10px 14px; width: 36%; font-weight: 700; color: #0f172a; vertical-align: top; {{ !$isLast ? 'border-bottom: 1px solid #eef2f6;' : '' }}">{{ $displayFallbackLabel }}</td>
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
                    <a href="{{ $actionUrl }}" class="button" style="display: inline-block; background-color: {{ $resolvedButtonColor }}; color: #ffffff !important; text-decoration: none; padding: 12px 34px; border-radius: 6px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; box-shadow: 0 2px 8px rgba(46, 8, 84, 0.25);" target="_blank">
                        {{ $resolvedButtonText }}
                    </a>
                </div>
            @endif
        </div>

        <!-- Footer -->
        <div class="footer" style="padding: 18px 20px; text-align: center; font-size: 11px; color: #64748b; background-color: #f8fafc; border-top: 1px solid #eef2f6;">
            {{ $resolvedFooterText }}
        </div>
    </div>
</body>
</html>
