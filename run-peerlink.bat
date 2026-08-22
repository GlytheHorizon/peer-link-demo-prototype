@echo off
chcp 65001 >nul
title PeerLink - Development Launcher
color 0B

:: ============================================================
::   PEERLINK  ::  Full-Stack Development Launcher
:: ============================================================
::   Starts backend (Node/Express) and frontend (React/Vite)
::   in two separate windows.
:: ============================================================

cls
echo.
echo    PPPPP  EEEEE  EEEEE  RRRR   L      III  N   N  K   K
echo    P   P  E      E      R   R  L       I   NN  N  K  K
echo    PPPPP  EEE    EEE    RRRR   L       I   N N N  K K
echo    P      E      E      R  R   L       I   N  NN  K  K
echo    P      EEEEE  EEEEE  R   R  LLLLL  III  N   N  K   K
echo.
echo    Peer Tutoring Platform - Dev Environment
echo.
echo    ---------------------------------------------------------
echo     Starting services... please wait.
echo    ---------------------------------------------------------
echo.

:: Start backend in a new window (peerlink_backend_svc marker lets the launcher close it later)
start "PeerLink - Backend (API)" cmd /k "color 0A && echo [BACKEND] peerlink_backend_svc Starting Node/Express API... && cd /d "%~dp0backend" && npm start"

:: Small delay so the backend window opens first
timeout /t 2 /nobreak >nul

:: Start frontend in a new window (peerlink_frontend_svc marker lets the launcher close it later)
start "PeerLink - Frontend (React)" cmd /k "color 0E && echo [FRONTEND] peerlink_frontend_svc Starting React/Vite dev server... && cd /d "%~dp0frontend" && npm run dev"

echo.
echo    ---------------------------------------------------------
echo     Both services launched in separate windows.
echo       - Backend  : http://localhost:5000
echo       - Frontend : http://localhost:5173
echo    ---------------------------------------------------------
echo     Control this launcher from the options below.
echo    ---------------------------------------------------------
echo.

:menu
cls
echo.
echo    PEERLINK LAUNCHER - CONTROL PANEL
echo    -----------------------------------------------
echo      Backend  : http://localhost:5000
echo      Frontend : http://localhost:5173
echo    -----------------------------------------------
echo.
echo      Q = Quit (stop BOTH services and close all windows)
echo      C = Continue running (refresh this menu)
echo.
set /p "opt=Your choice (Q / C): "
if /i "%opt%"=="Q" goto confirmquit
if /i "%opt%"=="C" goto menu
echo    Invalid choice. Please type Q or C.
goto menu

:confirmquit
cls
echo.
echo    WARNING: This will stop both the backend and frontend.
echo.
set /p "opt=Are you sure you want to quit? (Y / N): "
if /i "%opt%"=="Y" goto doquit
if /i "%opt%"=="N" goto menu
echo    Invalid choice. Please type Y or N.
goto confirmquit

:doquit
echo.
echo    Stopping all PeerLink services...
echo      - terminating Node processes...
taskkill /f /im node.exe >nul 2>&1
echo      - closing service windows...
wmic process where "commandline like '%%peerlink_backend_svc%%' and name='cmd.exe'" call terminate >nul 2>&1
wmic process where "commandline like '%%peerlink_frontend_svc%%' and name='cmd.exe'" call terminate >nul 2>&1
echo.
echo    All services stopped. You may close this window.
echo.
pause
exit
