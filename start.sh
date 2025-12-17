#!/bin/bash
echo "Starting Auto-Academic Formatter (Local)..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Configuration file not found. Running setup..."
    node setup.js
fi

# Ensure database schema is up to date
echo "Checking database schema..."
npm run db:push

# Start the server
echo "Starting server..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5000
else
    xdg-open http://localhost:5000
fi

npm run dev
