#!/usr/bin/env node
/**
 * inject-shell.js
 * Post-build script: Injects the instant-loading skeleton UI into
 * Expo's generated dist/index.html AFTER `expo export --platform web`.
 *
 * Usage: node inject-shell.js
 * Or add to package.json scripts:
 *   "export:web": "expo export --platform web && node inject-shell.js"
 */

const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.error('❌ dist/index.html not found. Run `expo export --platform web` first.');
  process.exit(1);
}

let html = fs.readFileSync(distIndex, 'utf-8');

// ─── Skeleton CSS ────────────────────────────────────────────────────────────
const SKELETON_CSS = `
  <style id="postflow-shell-css">
    :root {
      --brand-navy: rgb(91, 15, 184);
      --brand-blue: #2563eb;
      --brand-gold: #f59e0b;
      --sidebar-w: 240px;
      --topbar-h: 60px;
    }
    #postflow-shell {
      position: fixed;
      inset: 0;
      display: flex;
      background: #f1f5f9;
      z-index: 9999;
      transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    html.pf-hide-shell #postflow-shell {
      display: none !important;
    }
    #postflow-shell.pf-hidden {
      opacity: 0;
      pointer-events: none;
    }
    .pf-sidebar {
      width: var(--sidebar-w);
      background: var(--brand-navy);
      display: flex;
      flex-direction: column;
      padding: 20px 0;
      flex-shrink: 0;
    }
    .pf-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 8px;
    }
    .pf-logo-icon {
      width: 36px;
      height: 36px;
      background: var(--brand-gold);
      border-radius: 8px;
      flex-shrink: 0;
    }
    .pf-logo-text {
      width: 110px;
      height: 16px;
      border-radius: 4px;
    }
    .pf-nav { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .pf-nav-item { height: 40px; border-radius: 8px; }
    .pf-nav-item.pf-active { background: var(--brand-blue) !important; animation: none !important; }
    .pf-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .pf-topbar {
      height: var(--topbar-h);
      background: white;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .pf-topbar-title { width: 180px; height: 20px; border-radius: 4px; }
    .pf-spacer { flex: 1; }
    .pf-avatar { width: 36px; height: 36px; border-radius: 50%; background: #c7d2fe; }
    .pf-content { flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow: hidden; }
    .pf-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
    .pf-stat-card {
      background: white;
      border-radius: 12px;
      height: 100px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pf-stat-label { width: 70%; height: 12px; border-radius: 3px; }
    .pf-stat-value { width: 40%; height: 28px; border-radius: 6px; }
    .pf-table-card {
      background: white;
      border-radius: 12px;
      flex: 1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow: hidden;
    }
    .pf-table-header { width: 200px; height: 18px; border-radius: 4px; margin-bottom: 4px; }
    .pf-table-row { height: 44px; border-radius: 8px; }
    .pf-spinner {
      position: absolute;
      bottom: 24px;
      right: 24px;
      width: 28px;
      height: 28px;
      border: 3px solid #e2e8f0;
      border-top-color: var(--brand-blue);
      border-radius: 50%;
      animation: pf-spin 0.8s linear infinite;
    }
    @keyframes pf-shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes pf-spin { to { transform: rotate(360deg); } }
    .pf-logo-text, .pf-nav-item:not(.pf-active), .pf-topbar-title,
    .pf-stat-label, .pf-stat-value, .pf-table-header, .pf-table-row {
      background-image: linear-gradient(90deg,#e2e8f0 0px,#f1f5f9 40px,#e2e8f0 80px);
      background-size: 600px;
      animation: pf-shimmer 1.5s infinite linear;
    }
    @media (max-width: 768px) {
      .pf-sidebar { display: none; }
      .pf-stats { grid-template-columns: repeat(2,1fr); }
    }
  </style>`;

// ─── Skeleton HTML ────────────────────────────────────────────────────────────
const SKELETON_HTML = `
  <!-- ===== POSTFLOW INSTANT LOADING SHELL ===== -->
  <!-- Check whether user is authenticated & visiting dashboard before rendering navy shell -->
  <script>
    (function() {
      try {
        var token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
        var path = (window.location && window.location.pathname) || '';
        var isAuthPage = path.indexOf('login') !== -1 || path.indexOf('auth') !== -1;
        var isDashboard = path.indexOf('dashboard') !== -1;
        if (!token || isAuthPage || (!isDashboard && path === '/')) {
          document.documentElement.classList.add('pf-hide-shell');
        }
      } catch(e) {}
    })();
  </script>
  <div id="postflow-shell" aria-hidden="true">
    <div class="pf-sidebar">
      <div class="pf-logo">
        <div class="pf-logo-icon"></div>
        <div class="pf-logo-text"></div>
      </div>
      <div class="pf-nav">
        <div class="pf-nav-item pf-active"></div>
        <div class="pf-nav-item"></div>
        <div class="pf-nav-item"></div>
        <div class="pf-nav-item"></div>
        <div class="pf-nav-item"></div>
      </div>
    </div>
    <div class="pf-main">
      <div class="pf-topbar">
        <div class="pf-topbar-title"></div>
        <div class="pf-spacer"></div>
        <div class="pf-avatar"></div>
      </div>
      <div class="pf-content">
        <div class="pf-stats">
          <div class="pf-stat-card"><div class="pf-stat-label"></div><div class="pf-stat-value"></div></div>
          <div class="pf-stat-card"><div class="pf-stat-label"></div><div class="pf-stat-value"></div></div>
          <div class="pf-stat-card"><div class="pf-stat-label"></div><div class="pf-stat-value"></div></div>
          <div class="pf-stat-card"><div class="pf-stat-label"></div><div class="pf-stat-value"></div></div>
        </div>
        <div class="pf-table-card">
          <div class="pf-table-header"></div>
          <div class="pf-table-row"></div>
          <div class="pf-table-row"></div>
          <div class="pf-table-row"></div>
          <div class="pf-table-row"></div>
          <div class="pf-table-row"></div>
        </div>
      </div>
    </div>
    <div class="pf-spinner"></div>
  </div>
  <!-- Hide shell ONLY when React signals real content is ready (not when skeleton mounts) -->
  <script>
    (function() {
      var s = document.getElementById('postflow-shell');
      var dismissed = false;
      function dismiss() {
        if (dismissed) return;
        dismissed = true;
        s.classList.add('pf-hidden');
        setTimeout(function() { if (s && s.parentNode) s.parentNode.removeChild(s); }, 180);
      }
      // If on login or auth paths, dismiss immediately
      var p = (window.location.pathname || '') + (window.location.hash || '');
      if (p.indexOf('login') !== -1 || p.indexOf('forgot') !== -1 || p.indexOf('reset') !== -1) {
        dismiss();
      }
      // PRIMARY: wait for React to fire 'postflow-ready' (dispatched when data loads or view mounts)
      window.addEventListener('postflow-ready', dismiss, { once: true });
      // FALLBACK: hide after 3 seconds max regardless
      setTimeout(dismiss, 3000);
    })();
  </script>`;

// ─── Inject ───────────────────────────────────────────────────────────────────

// 1. Inject CSS before </head>
if (!html.includes('postflow-shell-css')) {
  html = html.replace('</head>', SKELETON_CSS + '\n</head>');
  console.log('✅ Injected skeleton CSS into <head>');
} else {
  console.log('ℹ️  Skeleton CSS already present, skipping.');
}

// 2. Inject skeleton HTML before <div id="root">
if (!html.includes('POSTFLOW INSTANT LOADING SHELL')) {
  html = html.replace('<div id="root">', SKELETON_HTML + '\n  <div id="root">');
  console.log('✅ Injected skeleton HTML before #root');
} else {
  console.log('ℹ️  Skeleton HTML already present, skipping.');
}

fs.writeFileSync(distIndex, html, 'utf-8');
console.log('🚀 dist/index.html patched successfully!');
console.log('   File size:', fs.statSync(distIndex).size, 'bytes');
