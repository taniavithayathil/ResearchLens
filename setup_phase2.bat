@echo off
echo ====================================================
echo Installing Frontend Dependencies for Phase 2
echo ====================================================

cd frontend
echo Installing icons and utility libraries...
call npm install lucide-react clsx tailwind-merge recharts

echo.
echo Dependencies installed! You can now restart the Next.js server with:
echo npm run dev
echo.
pause
