@echo off
echo.
echo ========================================
echo  AI-CE Floorplan Visualizer
echo  One-Click Launcher
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

echo Starting application...
echo.

REM Run the all-in-one launcher
python start.py

pause
