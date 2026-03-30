@echo off
title Horizon Launcher
echo Starting Horizon System...
echo.

:: Check for Python in PATH
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found in global PATH. Checking common locations...
    if exist "%USERPROFILE%\anaconda3\python.exe" (
        echo Found Anaconda Python.
        set "PYTHON_CMD=%USERPROFILE%\anaconda3\python.exe"
    ) else (
        echo [ERROR] Python not found! Please install Python or add it to your PATH.
        echo You can try verifying if Anaconda is installed in %USERPROFILE%\anaconda3
        pause
        exit /b 1
    )
) else (
    set "PYTHON_CMD=python"
)

echo Using Python: %PYTHON_CMD%

:: Reuse an existing Hyzync backend when one is already listening on 8000
set "REUSE_BACKEND="
powershell -NoProfile -Command "try { $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($resp.service -eq 'hyzync-api') { exit 0 } else { exit 3 } } catch { exit 2 }"
if %errorlevel% equ 0 (
    set "REUSE_BACKEND=1"
    echo Reusing existing Backend Server on http://127.0.0.1:8000...
) else (
    set "PORT_PID="
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
        set "PORT_PID=%%p"
    )
    if defined PORT_PID (
        echo [ERROR] Port 8000 is already in use by PID %PORT_PID%, but it is not the Hyzync backend.
        echo Stop that process or change the backend port before launching Horizon.
        pause
        exit /b 1
    )
    echo Starting Backend Server on 0.0.0.0:8000...
    start "Horizon Backend" cmd /c "cd /d %~dp0backend && .\venv\Scripts\python.exe dev_backend.py"
)

:: Wait a moment for backend to initialize
timeout /t 4 /nobreak >nul

:: Start Frontend in the current window
echo Starting Frontend...
cd /d "%~dp0"
npm run dev
