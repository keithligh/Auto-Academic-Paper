@echo off
echo Starting Auto-Academic Formatter (Local)...

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

:: Check if .env exists
if not exist ".env" (
    echo Configuration file not found. Running setup...
    call node setup.js
)

:: Ensure database schema is up to date
echo Checking database schema...
call npm run db:push

:: Start the server
echo Starting server...
start http://localhost:5000
call npm run dev
