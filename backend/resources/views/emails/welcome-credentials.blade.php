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
            padding: 28px 24px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #ffffff;
        }
        .content {
            padding: 32px 24px;
            line-height: 1.6;
        }
        .greeting {
            font-size: 17px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #1a202c;
        }
        .badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 20px;
            text-transform: uppercase;
            background-color: #DCFCE7;
            color: #166534;
        }
        .intro-text {
            font-size: 14px;
            color: #4a5568;
            margin-bottom: 20px;
        }
        .credentials-card {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-left: 4px solid {{ $brandColor ?? '#800000' }};
            border-radius: 6px;
            padding: 18px 20px;
            margin: 20px 0;
        }
        .credential-row {
            display: flex;
            justifyContent: space-between;
            padding: 7px 0;
            border-bottom: 1px solid #EDF2F7;
            font-size: 13px;
        }
        .credential-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
        .credential-label {
            font-weight: 600;
            color: #64748B;
            width: 38%;
        }
        .credential-value {
            font-weight: 600;
            color: #0F172A;
            width: 62%;
            text-align: right;
            word-break: break-all;
        }
        .password-badge {
            display: inline-block;
            background-color: #EDE9FE;
            color: #5B21B6;
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 4px;
            letter-spacing: 1px;
        }
        .security-notice {
            background-color: #FFFBEB;
            border: 1px solid #FDE68A;
            border-radius: 6px;
            padding: 12px 16px;
            margin-top: 18px;
            font-size: 12px;
            color: #92400E;
            line-height: 1.5;
        }
        .button-wrapper {
            text-align: center;
            margin-top: 28px;
            margin-bottom: 10px;
        }
        .button {
            display: inline-block;
            background-color: {{ $brandColor ?? '#800000' }};
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 32px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.3px;
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
                <div style="margin-bottom: 12px;">
                    <img src="{{ $logoUrl }}" alt="Logo" style="max-height: 52px; max-width: 180px; object-fit: contain;">
                </div>
            @endif
            <h1>{{ $headerTitle ?? 'Jose Maria College Foundation, Inc.' }}</h1>
        </div>

        <div class="content">
            <span class="badge">● Account Created</span>

            <div class="greeting">Welcome, {{ $userName }}!</div>
            <p class="intro-text">
                Your institutional account for <strong>JMCFI PostFlow</strong> has been successfully created. You can now log in to the portal and start managing institutional posts with the credentials below:
            </p>

            <div class="credentials-card">
                <table style="width: 100%; border-collapse: collapse;">
                    @if(!empty($employeeId))
                    <tr style="border-bottom: 1px solid #EDF2F7;">
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #64748B;">Employee ID:</td>
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #0F172A; text-align: right;">{{ $employeeId }}</td>
                    </tr>
                    @endif
                    @if(!empty($department))
                    <tr style="border-bottom: 1px solid #EDF2F7;">
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #64748B;">Department:</td>
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0F172A; text-align: right;">{{ $department }}</td>
                    </tr>
                    @endif
                    @if(!empty($position))
                    <tr style="border-bottom: 1px solid #EDF2F7;">
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #64748B;">Designation:</td>
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0F172A; text-align: right;">{{ $position }}</td>
                    </tr>
                    @endif
                    <tr style="border-bottom: 1px solid #EDF2F7;">
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #64748B;">Institutional Email:</td>
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #1E40AF; text-align: right;">{{ $email }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #64748B;">Temporary Password:</td>
                        <td style="padding: 8px 0; text-align: right;">
                            <span class="password-badge">{{ $password }}</span>
                        </td>
                    </tr>
                </table>
            </div>

            <div class="security-notice">
                🔒 <strong>Security Tip:</strong> Please sign in and update your temporary password under <strong>Profile Settings</strong> upon your first login.
            </div>

            <div class="button-wrapper">
                <a href="{{ $loginUrl }}" class="button" target="_blank">Sign In to PostFlow</a>
            </div>
        </div>

        <div class="footer">
            <p style="margin: 0;">{{ $footerText ?? '© ' . date('Y') . ' Jose Maria College Foundation, Inc. All rights reserved.' }}</p>
        </div>
    </div>
</body>
</html>
