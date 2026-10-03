@echo off
title PostFlow Background Scheduler
echo [PostFlow] Starting scheduler daemon (runs every 60 seconds)...
:loop
php artisan schedule:run
timeout /t 60 /nobreak >nul
goto loop
