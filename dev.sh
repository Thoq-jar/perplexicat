#!/bin/bash

cleanup() {
    echo "Shutting down..."
    kill $FLASK_PID $VITE_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting Flask backend..."
python run.py &
FLASK_PID=$!

echo "Starting Vite dev server..."
cd frontend && pnpm dev &
VITE_PID=$!

echo ""
echo "Flask running on http://localhost:5001"
echo "Vite running on http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

wait
