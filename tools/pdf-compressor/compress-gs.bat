@echo off
setlocal enabledelayedexpansion

:: PDF Compressor using Ghostscript
:: Provides excellent compression (50-75% of original size)

set "INPUT=%~1"
set "OUTPUT=%~2"
set "QUALITY=%~3"

if "%INPUT%"=="" (
    echo.
    echo PDF Compressor ^(Ghostscript^)
    echo =============================
    echo.
    echo Usage: compress-gs.bat input.pdf [output.pdf] [quality]
    echo.
    echo Quality levels:
    echo   screen   - Low quality, smallest size ^(72 dpi^)
    echo   ebook    - Medium quality ^(150 dpi^) - DEFAULT
    echo   printer  - High quality ^(300 dpi^)
    echo   prepress - Maximum quality ^(300 dpi, color preserving^)
    echo.
    echo Examples:
    echo   compress-gs.bat document.pdf
    echo   compress-gs.bat document.pdf compressed.pdf
    echo   compress-gs.bat document.pdf compressed.pdf screen
    echo.
    goto :eof
)

:: Check if Ghostscript is installed
set "GS="
where gswin64c >nul 2>&1 && set "GS=gswin64c"
if "%GS%"=="" where gswin32c >nul 2>&1 && set "GS=gswin32c"
if "%GS%"=="" where gs >nul 2>&1 && set "GS=gs"

if "%GS%"=="" (
    echo.
    echo ERROR: Ghostscript is not installed or not in PATH.
    echo.
    echo Please install Ghostscript:
    echo   1. Download from: https://ghostscript.com/releases/gsdnld.html
    echo   2. Install and add to PATH
    echo.
    echo Or use the Node.js version: node compress.js input.pdf
    echo.
    goto :eof
)

:: Set default output name
if "%OUTPUT%"=="" (
    set "OUTPUT=%~dpn1_compressed.pdf"
)

:: Set default quality
if "%QUALITY%"=="" set "QUALITY=ebook"

:: Validate quality setting
if /i not "%QUALITY%"=="screen" if /i not "%QUALITY%"=="ebook" if /i not "%QUALITY%"=="printer" if /i not "%QUALITY%"=="prepress" (
    echo Invalid quality setting. Using 'ebook'.
    set "QUALITY=ebook"
)

:: Get original file size
for %%A in ("%INPUT%") do set "ORIGINAL_SIZE=%%~zA"

echo.
echo Compressing: %~nx1
echo Quality: %QUALITY%
echo Original size: !ORIGINAL_SIZE! bytes

:: Run Ghostscript compression
%GS% -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/%QUALITY% -dNOPAUSE -dQUIET -dBATCH -dDetectDuplicateImages=true -dCompressFonts=true -dColorImageDownsampleType=/Bicubic -dGrayImageDownsampleType=/Bicubic -dMonoImageDownsampleType=/Bicubic -sOutputFile="%OUTPUT%" "%INPUT%"

if errorlevel 1 (
    echo.
    echo ERROR: Compression failed.
    goto :eof
)

:: Get compressed file size
for %%A in ("%OUTPUT%") do set "COMPRESSED_SIZE=%%~zA"

:: Calculate savings
set /a "SAVINGS=ORIGINAL_SIZE-COMPRESSED_SIZE"
set /a "PERCENT=COMPRESSED_SIZE*100/ORIGINAL_SIZE"

echo Compressed size: !COMPRESSED_SIZE! bytes
echo Reduction: !SAVINGS! bytes ^(!PERCENT!%% of original^)
echo Output: %OUTPUT%
echo.
echo Done!

endlocal
