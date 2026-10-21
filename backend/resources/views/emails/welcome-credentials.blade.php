<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to JMCFI PostFlow</title>
    <style>
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
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(76, 29, 149, 0.08);
            border: 1px solid #e2e8f0;
        }
        .header-banner-wrap {
            line-height: 0;
            font-size: 0;
            border-top-left-radius: 16px;
            border-top-right-radius: 16px;
            overflow: hidden;
            background-color: #4c1d95;
        }
        .header-banner-img {
            display: block;
            width: 100%;
            height: auto;
            border: 0;
        }
        .content {
            padding: 24px 22px 14px 22px;
        }
        .status-badge {
            display: inline-block;
            background-color: #ede9fe;
            border-radius: 9999px;
            padding: 4px 12px;
            margin-bottom: 8px;
        }
        .status-badge table {
            border-collapse: collapse;
        }
        .badge-check {
            width: 15px;
            height: 15px;
            border-radius: 50%;
            background-color: #4c1d95;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            line-height: 15px;
            text-align: center;
            display: inline-block;
        }
        .badge-text {
            font-size: 10.5px;
            font-weight: 800;
            color: #4c1d95;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            padding-left: 6px;
        }
        .accent-bar-wrap {
            margin-bottom: 14px;
            line-height: 0;
            font-size: 0;
        }
        .accent-bar-main {
            display: inline-block;
            width: 26px;
            height: 4px;
            background-color: #4c1d95;
            border-radius: 2px;
            vertical-align: middle;
        }
        .accent-bar-sub {
            display: inline-block;
            width: 12px;
            height: 4px;
            background-color: #ddd6fe;
            border-radius: 2px;
            margin-left: 4px;
            vertical-align: middle;
        }
        .greeting {
            font-size: 21px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 6px;
            letter-spacing: -0.3px;
        }
        .intro-text {
            font-size: 13px;
            line-height: 1.55;
            color: #475569;
            margin: 0 0 18px 0;
        }
        .credentials-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 6px 14px;
            margin-bottom: 18px;
        }
        .cred-table {
            width: 100%;
            border-collapse: collapse;
        }
        .cred-row {
            border-bottom: 1px solid #f1f5f9;
        }
        .cred-row:last-child {
            border-bottom: none;
        }
        .icon-col {
            width: 36px;
            padding: 9px 0;
            vertical-align: middle;
        }
        .icon-circle {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background-color: #ede9fe;
            text-align: center;
            line-height: 30px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .label-col {
            padding: 9px 0 9px 6px;
            font-size: 12.5px;
            font-weight: 500;
            color: #475569;
            vertical-align: middle;
        }
        .val-col {
            padding: 9px 0;
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            text-align: right;
            vertical-align: middle;
            word-break: break-word;
        }
        .password-badge {
            display: inline-block;
            background-color: #ede9fe;
            color: #4c1d95;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12.5px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 6px;
            letter-spacing: 0.4px;
        }
        .security-card {
            background-color: #f5f3ff;
            border: 1px solid #ddd6fe;
            border-radius: 12px;
            padding: 12px 14px;
            margin-bottom: 20px;
        }
        .btn-cta {
            display: block;
            width: 100%;
            box-sizing: border-box;
            background-color: #4c1d95;
            color: #ffffff !important;
            text-decoration: none;
            padding: 13px 20px;
            border-radius: 8px;
            font-size: 13.5px;
            font-weight: 700;
            text-align: center;
            letter-spacing: 0.2px;
            box-shadow: 0 4px 12px rgba(76, 29, 149, 0.25);
        }
        .footer-lines-table {
            width: 100%;
            margin-bottom: 8px;
            border-collapse: collapse;
        }
        .footer-line-td {
            border-bottom: 1.5px solid #c4b5fd;
            width: 18%;
        }
        .footer-title-td {
            text-align: center;
            padding: 0 10px;
            font-size: 10.5px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            white-space: nowrap;
        }
        .footer-badge-wrap {
            margin-bottom: 14px;
        }
        .footer-pill-badge {
            display: inline-block;
            padding: 4px 16px;
            border-radius: 9999px;
            background-color: #ede9fe;
            font-size: 10.5px;
            font-weight: 600;
            color: #5b21b6;
            letter-spacing: 0.2px;
        }
        .footer-wave-wrap {
            line-height: 0;
            font-size: 0;
            overflow: hidden;
            border-bottom-left-radius: 16px;
            border-bottom-right-radius: 16px;
            background-color: #ffffff;
            margin: 0;
        }
        .footer-wave-svg {
            display: block;
            width: 100%;
            height: 52px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Exact Header Banner (Photo 3: Campus background, diagonal ribbons, transparent JMC logo on left, title & motto on right) -->
        <div class="header-banner-wrap">
            <img src="{{ !empty($headerBannerUrl) ? $headerBannerUrl : asset('images/email_header_banner.png') }}" alt="{{ $headerTitle ?? 'Jose Maria College Foundation, Inc.' }}" class="header-banner-img">
        </div>

        <div class="content">
            <!-- Account Created Pill Badge -->
            <div class="status-badge">
                <table>
                    <tr>
                        <td style="vertical-align: middle;">
                            <span class="badge-check">&#10003;</span>
                        </td>
                        <td style="vertical-align: middle;">
                            <span class="badge-text">ACCOUNT CREATED</span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Two-segment Accent Bar matching template -->
            <div class="accent-bar-wrap">
                <span class="accent-bar-main"></span><span class="accent-bar-sub"></span>
            </div>

            <!-- Greeting -->
            <div class="greeting">Welcome, {{ $userName ?? $fullName ?? 'Den Mark' }}!</div>
            <p class="intro-text">
                Your institutional account for <strong style="color: #0f172a;">JMCFI PostFlow</strong> has been successfully created. You can now log in to the portal and start managing institutional posts with the credentials below:
            </p>

            <!-- Credentials Card matching exact template with purple vector SVG icons -->
            <div class="credentials-card">
                <table class="cred-table">
                    @if(!empty($employeeId))
                    <!-- Row 1: Employee ID -->
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                        </td>
                        <td class="label-col">Employee ID:</td>
                        <td class="val-col">{{ $employeeId }}</td>
                    </tr>
                    @endif

                    @if(!empty($department))
                    <!-- Row 2: Department -->
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="3" y1="21" x2="21" y2="21"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                    <polyline points="12 3 2 10 22 10"></polyline>
                                    <line x1="6" y1="10" x2="6" y2="21"></line>
                                    <line x1="10" y1="10" x2="10" y2="21"></line>
                                    <line x1="14" y1="10" x2="14" y2="21"></line>
                                    <line x1="18" y1="10" x2="18" y2="21"></line>
                                </svg>
                            </div>
                        </td>
                        <td class="label-col">Department:</td>
                        <td class="val-col">{{ $department }}</td>
                    </tr>
                    @endif

                    <!-- Row 3: Designation (Requestor or Approver) -->
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                        </td>
                        <td class="label-col">Designation:</td>
                        <td class="val-col">{{ $designation ?? $position ?? 'Requestor' }}</td>
                    </tr>

                    <!-- Row 4: JMC Email -->
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                                </svg>
                            </div>
                        </td>
                        <td class="label-col">JMC Email:</td>
                        <td class="val-col">
                            <a href="mailto:{{ $email }}" style="color: #2563eb; text-decoration: underline;">{{ $email }}</a>
                        </td>
                    </tr>

                    <!-- Row 5: Temporary Password -->
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                        </td>
                        <td class="label-col">Temporary Password:</td>
                        <td class="val-col">
                            <span class="password-badge">{{ $password }}</span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Security Tip Alert Card matching exact template (Solid purple shield with white lock) -->
            <div class="security-card">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 38px; vertical-align: middle; padding-right: 12px;">
                            <svg width="34" height="38" viewBox="0 0 24 26" fill="#4c1d95">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                                <rect x="8.5" y="12" width="7" height="5.5" rx="1" fill="#ffffff"/>
                                <path d="M10 12V9.5a2 2 0 1 1 4 0V12" stroke="#ffffff" stroke-width="1.3" fill="none"/>
                            </svg>
                        </td>
                        <td style="border-left: 1.5px solid #c4b5fd; padding-left: 12px; vertical-align: middle;">
                            <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">Security Tip:</div>
                            <div style="font-size: 11.5px; line-height: 1.45; color: #4c1d95;">
                                Please sign in and update your temporary password under <strong style="color: #4c1d95;">Profile Settings</strong> upon your first login.
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Call to Action Button -->
            <div style="text-align: center; margin-bottom: 20px;">
                <a href="{{ $loginUrl }}" class="btn-cta" target="_blank">Sign In to PostFlow now</a>
            </div>
        </div>

        <!-- Footer Section matching Photo 4 / Template (Divider lines, Pill badge, Dual sweeping purple waves) -->
        <div style="padding: 0 22px 0 22px; text-align: center;">
            <table class="footer-lines-table">
                <tr>
                    <td class="footer-line-td"></td>
                    <td class="footer-title-td">
                        JOSE MARIA COLLEGE FOUNDATION, INC
                    </td>
                    <td class="footer-line-td"></td>
                </tr>
            </table>
            <div class="footer-badge-wrap">
                <span class="footer-pill-badge">
                    Assured &bull; Consistent &bull; Quality Education
                </span>
            </div>
        </div>

        <!-- Sweeping Dual-Layer Purple Wave matching exact template curve -->
        <div class="footer-wave-wrap">
            <svg viewBox="0 0 500 56" preserveAspectRatio="none" class="footer-wave-svg">
                <!-- Back lighter violet wave layer -->
                <path d="M0,22 C80,32 160,42 250,38 C340,34 420,18 500,20 L500,56 L0,56 Z" fill="#6d28d9"/>
                <!-- Front dark purple wave layer -->
                <path d="M0,30 C70,38 150,48 240,46 C330,44 410,26 500,28 L500,56 L0,56 Z" fill="#4c1d95"/>
            </svg>
        </div>
    </div>
</body>
</html>
