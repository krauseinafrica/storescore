#!/bin/bash
set -e

echo "Waiting for database..."
while ! python -c "
import socket
import sys
from decouple import config
host = config('POSTGRES_HOST', default='db')
port = int(config('POSTGRES_PORT', default='5432'))
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
result = sock.connect_ex((host, port))
sock.close()
sys.exit(result)
" 2>/dev/null; do
    echo "Database not ready, waiting..."
    sleep 2
done
echo "Database is ready!"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Ensuring superuser exists..."
python manage.py ensure_superuser

echo "Collecting static files..."
python manage.py collectstatic --noinput

exec "$@"
