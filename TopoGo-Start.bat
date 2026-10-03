@echo off
rem ============================================================
rem  TopoGo one-click launcher
rem  - If the dev server is already running, just open the game.
rem  - Otherwise start it minimized, wait until ready, then open.
rem  Keep this file ASCII-only to avoid console encoding issues.
rem ============================================================
setlocal

set "PORT=5173"
set "URL=http://localhost:%PORT%/"

rem --- resolve npx: system Node first, WorkBuddy-managed Node as fallback ---
set "NPX=npx"
where npx >NUL 2>NUL
if errorlevel 1 (
  set "NPX=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\npx.cmd"
)

cd /d "%~dp0"

rem --- server already up? then just open the game ---
curl -s --max-time 2 -o NUL "%URL%" && goto OPEN

rem --- node runtime check ---
if not exist "%NPX%" (
  where npx >NUL 2>NUL
  if errorlevel 1 (
    echo [ERROR] Node.js runtime not found.
    echo Install Node.js ^>= 20 from https://nodejs.org/ then try again.
    pause
    exit /b 1
  )
)

rem --- first run: install dependencies if missing ---
if not exist node_modules (
  echo [INFO] First run, installing dependencies...
  call "%NPX%" install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERROR] Dependency install failed. Check your network and retry.
    pause
    exit /b 1
  )
)

rem --- start the dev server in a minimized window ---
start "TopoGo Server" /min cmd /c %NPX% vite --port %PORT% --strictPort

rem --- wait until ready (max 40 seconds) ---
set /a N=0
:WAIT
set /a N+=1
if %N% GEQ 40 goto TIMEOUT
"%SystemRoot%\System32\ping.exe" -n 2 127.0.0.1 >NUL
curl -s --max-time 2 -o NUL "%URL%" || goto WAIT

:OPEN
start "" "%URL%"
exit /b 0

:TIMEOUT
echo [ERROR] Server did not become ready within 40 seconds.
echo Open the minimized "TopoGo Server" window to see what went wrong.
pause
exit /b 1
