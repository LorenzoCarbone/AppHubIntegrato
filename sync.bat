@echo off
title Sincronizzazione AppHub su GitHub
echo ============================================
echo   Sincronizzazione ProgettoAppHub su GitHub
echo ============================================
echo.
git add .
set timestamp=%date% %time:~0,8%
git commit -m "Auto-sync: %timestamp%"
git push origin main
echo.
echo ============================================
echo   Modifiche caricate su GitHub con successo!
echo ============================================
timeout /t 3
