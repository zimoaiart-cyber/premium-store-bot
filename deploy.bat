@echo off
echo ============================================
echo   Deno Deploy - Upload Script
echo ============================================
echo.

:: Check Deno installation
deno --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Deno not found!
    echo Install Deno: winget install Deno.Deno
    echo.
    pause
    exit /b 1
)

echo Deno version:
deno --version
echo.

:: Login to Deno Deploy
echo [1/3] Login to Deno Deploy...
echo If not logged in, run: deno login
echo.

:: Deploy
echo [2/3] Deploying to Deno Deploy...
echo.
echo Run this command manually:
echo   deno deploy --project=YOUR_PROJECT_NAME bot.ts
echo.
echo Or with automatic project creation:
echo   deno deploy bot.ts
echo.

:: Set webhook
echo [3/3] After deployment, set webhook:
echo.
echo curl "https://api.telegram.org/bot8669157155:AAEuIJDfcsKj2acc3vCI57SUU-kZ2_9seh4/setWebhook?url=https://YOUR-PROJECT.deno.dev/webhook/8669157155:AAEuIJDfcsKj2acc3vCI57SUU-kZ2_9seh4"
echo.

pause
