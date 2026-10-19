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
            padding: 24px 12px;
            color: #1e293b;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(76, 29, 149, 0.08);
            border: 1px solid #e2e8f0;
        }
        .header-hero {
            background-color: #4C1D95;
            background-image: linear-gradient(135deg, rgba(76, 29, 149, 0.90) 0%, rgba(109, 40, 217, 0.85) 100%), url('{{ $headerBg ?? "" }}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            padding: 32px 24px;
            text-align: center;
            color: #ffffff;
        }
        .logo-badge {
            display: inline-block;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #ffffff;
            padding: 4px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
            margin-bottom: 12px;
            vertical-align: middle;
        }
        .logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 50%;
            display: block;
        }
        .header-title {
            margin: 0 0 4px 0;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.3px;
            color: #ffffff;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
        }
        .header-subtitle {
            margin: 0;
            font-size: 12px;
            font-weight: 500;
            color: #e9d5ff;
            letter-spacing: 0.6px;
        }
        .content {
            padding: 32px 28px 24px 28px;
        }
        .status-badge {
            display: inline-block;
            background-color: #ede9fe;
            border-radius: 9999px;
            padding: 5px 12px;
            margin-bottom: 8px;
        }
        .status-badge table {
            border-collapse: collapse;
        }
        .badge-check {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: #4c1d95;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            line-height: 16px;
            text-align: center;
            display: inline-block;
        }
        .badge-text {
            font-size: 11px;
            font-weight: 800;
            color: #4c1d95;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            padding-left: 6px;
        }
        .accent-bar {
            width: 36px;
            height: 4px;
            background-color: #5b21b6;
            border-radius: 2px;
            margin-bottom: 16px;
        }
        .greeting {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 8px;
            letter-spacing: -0.3px;
        }
        .intro-text {
            font-size: 13.5px;
            line-height: 1.6;
            color: #475569;
            margin: 0 0 22px 0;
        }
        .credentials-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px 18px;
            margin-bottom: 22px;
        }
        .cred-table {
            width: 100%;
            border-collapse: collapse;
        }
        .cred-row {
            border-bottom: 1px solid #edf2f7;
        }
        .cred-row:last-child {
            border-bottom: none;
        }
        .icon-col {
            width: 42px;
            padding: 10px 0;
            vertical-align: middle;
        }
        .icon-circle {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background-color: #ede9fe;
            color: #5b21b6;
            text-align: center;
            line-height: 34px;
            font-size: 15px;
            display: inline-block;
        }
        .label-col {
            padding: 10px 0 10px 6px;
            font-size: 13px;
            font-weight: 500;
            color: #64748b;
            vertical-align: middle;
        }
        .val-col {
            padding: 10px 0;
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
            font-size: 13px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 6px;
            letter-spacing: 0.5px;
        }
        .security-card {
            background-color: #f5f3ff;
            border: 1px solid #ddd6fe;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 24px;
        }
        .shield-icon {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background-color: #4c1d95;
            color: #ffffff;
            text-align: center;
            line-height: 38px;
            font-size: 18px;
            display: inline-block;
        }
        .btn-cta {
            display: block;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            background-color: #4c1d95;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 700;
            text-align: center;
            letter-spacing: 0.3px;
            box-sizing: border-box;
            box-shadow: 0 4px 14px rgba(76, 29, 149, 0.25);
        }
        .footer-wrap {
            padding: 0 28px 24px 28px;
            text-align: center;
        }
        .footer-inst {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .motto-badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 9999px;
            background-color: #ede9fe;
            font-size: 11px;
            font-weight: 600;
            color: #4c1d95;
            margin-bottom: 12px;
        }
        .wave-container {
            line-height: 0;
            font-size: 0;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header Hero with Campus Background & Logo -->
        <div class="header-hero">
            @if(!empty($logoUrl))
                <div class="logo-badge">
                    <img src="{{ $logoUrl }}" alt="JMCFI Seal" class="logo-img">
                </div>
            @endif
            <h1 class="header-title">{{ $headerTitle ?? 'Jose Maria College Foundation, Inc.' }}</h1>
            <p class="header-subtitle">Assured • Consistent • Quality Education</p>
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

            <!-- Purple Accent Line -->
            <div class="accent-bar"></div>

            <!-- Greeting -->
            <div class="greeting">Welcome, {{ $userName }}!</div>
            <p class="intro-text">
                Your institutional account for <strong style="color: #0f172a;">JMCFI PostFlow</strong> has been successfully created. You can now log in to the portal and start managing institutional posts with the credentials below:
            </p>

            <!-- Credentials Card -->
            <div class="credentials-card">
                <table class="cred-table">
                    @if(!empty($employeeId))
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">&#128100;</div>
                        </td>
                        <td class="label-col">Employee ID:</td>
                        <td class="val-col">{{ $employeeId }}</td>
                    </tr>
                    @endif

                    @if(!empty($department))
                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">&#127963;</div>
                        </td>
                        <td class="label-col">Department:</td>
                        <td class="val-col">{{ $department }}</td>
                    </tr>
                    @endif

                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">&#128101;</div>
                        </td>
                        <td class="label-col">Designation:</td>
                        <td class="val-col">{{ $designation ?? $position ?? 'Requestor' }}</td>
                    </tr>

                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">&#9993;</div>
                        </td>
                        <td class="label-col">JMC Email:</td>
                        <td class="val-col">
                            <a href="mailto:{{ $email }}" style="color: #2563eb; text-decoration: underline;">{{ $email }}</a>
                        </td>
                    </tr>

                    <tr class="cred-row">
                        <td class="icon-col">
                            <div class="icon-circle">&#128274;</div>
                        </td>
                        <td class="label-col">Temporary Password:</td>
                        <td class="val-col">
                            <span class="password-badge">{{ $password }}</span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Security Tip Alert Card -->
            <div class="security-card">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 44px; vertical-align: middle; padding-right: 12px;">
                            <div class="shield-icon">&#128737;</div>
                        </td>
                        <td style="border-left: 2px solid #c4b5fd; padding-left: 14px; vertical-align: middle;">
                            <div style="font-size: 13px; font-weight: 800; color: #1e1b4b; margin-bottom: 3px;">Security Tip:</div>
                            <div style="font-size: 12px; line-height: 1.5; color: #4c1d95;">
                                Please sign in and update your temporary password under <strong style="color: #4c1d95;">Profile Settings</strong> upon your first login.
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Call to Action Button -->
            <div style="text-align: center; margin-bottom: 28px;">
                <a href="{{ $loginUrl }}" class="btn-cta" target="_blank">Sign In to PostFlow now</a>
            </div>
        </div>

        <!-- Footer Section -->
        <div class="footer-wrap">
            <div class="footer-inst">&mdash; JOSE MARIA COLLEGE FOUNDATION, INC &mdash;</div>
            <div style="margin-bottom: 6px;">
                <span class="motto-badge">Assured • Consistent • Quality Education</span>
            </div>
        </div>

        <!-- Bottom Purple Wave Decoration -->
        <div class="wave-container">
            <svg viewBox="0 0 600 45" preserveAspectRatio="none" style="display: block; width: 100%; height: 35px;">
                <path d="M0,18 C160,42 340,4 600,20 L600,45 L0,45 Z" fill="#4C1D95" opacity="0.85"/>
                <path d="M0,28 C200,8 380,38 600,24 L600,45 L0,45 Z" fill="#6D28D9"/>
            </svg>
        </div>
    </div>
</body>
</html>
