@echo off
title PostFlow Background Queue Worker
echo [PostFlow] Starting queue worker...
:loop
php artisan queue:work --sleep=3 --tries=3 --timeout=120
echo [PostFlow] Worker restarted at %date% %time%
goto loop
