@echo off
rem TopoGo 本地启动脚本（Windows）
rem 首次运行安装依赖，之后启动开发服务。失败时给出错误提示，不静默安装全局软件。
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm。请先安装 Node.js ^>= 20 并重新打开本窗口。
  pause
  exit /b 1
)

if not exist node_modules (
  echo [信息] 首次运行，正在安装依赖（需要网络）...
  call npm ci
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo [信息] 启动 TopoGo 开发服务，浏览器访问 http://localhost:5173
call npm run dev
if errorlevel 1 (
  echo [错误] 启动失败。若端口被占用，可执行: npm run dev -- --port 5174
  pause
  exit /b 1
)
