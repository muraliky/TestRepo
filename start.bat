@echo off
setlocal enabledelayedexpansion

echo.
echo ===============================================================================
echo    SELENIUM TO PLAYWRIGHT + CUCUMBER MIGRATION TOOLKIT
echo    Setup Wizard
echo ===============================================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Please install Node.js 18+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Show Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% detected
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 1: Ask for source Java repo path
:: ═══════════════════════════════════════════════════════════════

echo ───────────────────────────────────────────────────────────────
echo  STEP 1: Source Repository
echo ───────────────────────────────────────────────────────────────
echo.
echo  Enter the full path to your Java Selenium repository.
echo  This is the folder containing your pages, steps, features, etc.
echo.
echo  Examples:
echo    C:\Projects\my-selenium-tests
echo    D:\Automation\wim-automation
echo.

set /p SOURCE_PATH="  Source repo path: "

:: Remove quotes if present
set SOURCE_PATH=%SOURCE_PATH:"=%

:: Check if path exists
if not exist "%SOURCE_PATH%" (
    echo.
    echo [ERROR] Path does not exist: %SOURCE_PATH%
    echo.
    pause
    exit /b 1
)

:: Check if it looks like a Java project
if exist "%SOURCE_PATH%\pom.xml" (
    echo [OK] Maven project detected (pom.xml found)
) else if exist "%SOURCE_PATH%\build.gradle" (
    echo [OK] Gradle project detected (build.gradle found)
) else if exist "%SOURCE_PATH%\src" (
    echo [OK] Source folder detected
) else (
    echo [WARN] No pom.xml, build.gradle, or src folder found.
    echo        Make sure this is the correct repository.
    echo.
    set /p CONTINUE="  Continue anyway? (y/n): "
    if /i not "!CONTINUE!"=="y" (
        echo Aborted.
        pause
        exit /b 1
    )
)

echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 2: Copy source repo to _source-java
:: ═══════════════════════════════════════════════════════════════

echo ───────────────────────────────────────────────────────────────
echo  STEP 2: Copying Source Repository
echo ───────────────────────────────────────────────────────────────
echo.

:: Check if _source-java already has content
set HAS_CONTENT=0
for /f %%A in ('dir /b "_source-java" 2^>nul ^| find /c /v ""') do set FILE_COUNT=%%A
if %FILE_COUNT% gtr 1 (
    set HAS_CONTENT=1
)

if %HAS_CONTENT%==1 (
    echo [WARN] _source-java folder already contains files.
    echo.
    set /p OVERWRITE="  Overwrite existing files? (y/n): "
    if /i not "!OVERWRITE!"=="y" (
        echo Skipping copy. Using existing source files.
        goto :SETUP_AGENTS
    )
    echo.
    echo  Clearing existing files...
    rmdir /s /q "_source-java" 2>nul
    mkdir "_source-java"
)

echo  Copying from: %SOURCE_PATH%
echo  Copying to:   %CD%\_source-java
echo.
echo  This may take a moment...
echo.

:: Use xcopy to copy (excludes common unnecessary folders)
xcopy "%SOURCE_PATH%" "_source-java" /E /I /H /Y /EXCLUDE:exclude-list.tmp 2>nul

:: Create exclude list for common folders we don't need
(
    echo \node_modules\
    echo \.git\
    echo \target\
    echo \build\
    echo \.idea\
    echo \.vscode\
    echo \out\
    echo \.gradle\
) > exclude-list.tmp

xcopy "%SOURCE_PATH%" "_source-java" /E /I /H /Y /EXCLUDE:exclude-list.tmp
del exclude-list.tmp 2>nul

echo.
echo [OK] Source repository copied successfully!
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 3: Setup GitHub Copilot Agents
:: ═══════════════════════════════════════════════════════════════

:SETUP_AGENTS
echo ───────────────────────────────────────────────────────────────
echo  STEP 3: Setting Up GitHub Copilot Agents
echo ───────────────────────────────────────────────────────────────
echo.

:: Create .github folders if they don't exist
if not exist ".github" mkdir ".github"
if not exist ".github\agents" mkdir ".github\agents"
if not exist ".github\copilot" mkdir ".github\copilot"
if not exist ".github\copilot\agents" mkdir ".github\copilot\agents"

:: Copy agents from agents folder to .github locations
echo  Copying agents to .github\agents...
copy /Y "agents\*.md" ".github\agents\" >nul 2>nul

echo  Copying agents to .github\copilot\agents...
copy /Y "agents\*.md" ".github\copilot\agents\" >nul 2>nul

echo.
echo [OK] Agents installed:
echo      - @pw-orchestrator (main conversion workflow)
echo      - @pw-migrate (manual file conversion)
echo      - @pw-verify (verification helper)
echo      - @pw-debug (debugging helper)
echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 4: Install Dependencies
:: ═══════════════════════════════════════════════════════════════

echo ───────────────────────────────────────────────────────────────
echo  STEP 4: Installing Dependencies
echo ───────────────────────────────────────────────────────────────
echo.

:: Check if node_modules exists
if exist "node_modules" (
    echo [OK] Dependencies already installed.
    set /p REINSTALL="  Reinstall dependencies? (y/n): "
    if /i "!REINSTALL!"=="y" (
        echo.
        echo  Installing npm packages...
        call npm install
    )
) else (
    echo  Installing npm packages...
    call npm install
)

echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 5: Install Playwright Browsers
:: ═══════════════════════════════════════════════════════════════

echo ───────────────────────────────────────────────────────────────
echo  STEP 5: Installing Playwright Browsers
echo ───────────────────────────────────────────────────────────────
echo.

set /p INSTALL_BROWSERS="  Install Playwright browsers (Chromium)? (y/n): "
if /i "%INSTALL_BROWSERS%"=="y" (
    echo.
    echo  Installing Chromium browser...
    call npx playwright install chromium
    echo.
    echo [OK] Playwright browsers installed.
) else (
    echo  Skipping browser installation.
)

echo.

:: ═══════════════════════════════════════════════════════════════
:: STEP 6: Generate Skeletons
:: ═══════════════════════════════════════════════════════════════

echo ───────────────────────────────────────────────────────────────
echo  STEP 6: Generate TypeScript Skeletons
echo ───────────────────────────────────────────────────────────────
echo.

set /p GENERATE="  Generate skeleton files now? (y/n): "
if /i "%GENERATE%"=="y" (
    echo.
    call npm run migrate
    echo.
) else (
    echo  Skipping skeleton generation.
    echo  Run 'npm run migrate' when ready.
)

echo.

:: ═══════════════════════════════════════════════════════════════
:: DONE!
:: ═══════════════════════════════════════════════════════════════

echo ===============================================================================
echo    SETUP COMPLETE!
echo ===============================================================================
echo.
echo  Next Steps:
echo  ───────────────────────────────────────────────────────────────
echo.
echo  1. Open this folder in VS Code
echo.
echo  2. Start conversion with GitHub Copilot:
echo     @pw-orchestrator start
echo.
echo  3. After all files are converted:
echo     npm run auth:setup     (if login is required)
echo     npm test               (run all tests)
echo.
echo  Useful Commands:
echo  ───────────────────────────────────────────────────────────────
echo    npm run migrate        - Regenerate skeletons
echo    npm run migrate:status - Check progress
echo    npm run verify         - Run verification on all files
echo    npm test               - Run Cucumber tests
echo    npm run test:headed    - Run with visible browser
echo.
echo ===============================================================================
echo.

pause
