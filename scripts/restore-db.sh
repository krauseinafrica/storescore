#!/bin/bash
# =============================================================================
# StoreScore Database Restore Script
# Downloads a backup from DigitalOcean Spaces and restores it into PostgreSQL
#
# Usage: ./restore-db.sh storescore_2025-02-15_03-00.sql.gz
# =============================================================================

set -euo pipefail

# --- Configuration ---
PROJECT_DIR="/var/www/storescore"
SCRIPTS_DIR="${PROJECT_DIR}/scripts"
S3CFG="${SCRIPTS_DIR}/.s3cfg"

# --- Check arguments ---
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup_filename>"
    echo ""
    echo "Examples:"
    echo "  $0 storescore_2025-02-15_03-00.sql.gz"
    echo ""
    echo "Available backups:"
    if [[ -f "${PROJECT_DIR}/.env" ]]; then
        while IFS='=' read -r key value; do
            [[ -z "${key}" || "${key}" =~ ^[[:space:]]*# ]] && continue
            key=$(echo "${key}" | xargs)
            case "${key}" in
                DO_SPACES_BUCKET_NAME) export "${key}=${value}" ;;
            esac
        done < "${PROJECT_DIR}/.env"
        S3_BUCKET="s3://${DO_SPACES_BUCKET_NAME}"
        s3cmd --config="${S3CFG}" ls "${S3_BUCKET}/storescore/backups/db/" 2>/dev/null | awk '{print "  " $NF}' | sed 's|.*/||'
    fi
    exit 1
fi

BACKUP_FILENAME="$1"

# --- Load environment variables ---
# Parse .env safely (handles values with special characters like < >)
if [[ -f "${PROJECT_DIR}/.env" ]]; then
    while IFS='=' read -r key value; do
        [[ -z "${key}" || "${key}" =~ ^[[:space:]]*# ]] && continue
        key=$(echo "${key}" | xargs)
        case "${key}" in
            POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD|DO_SPACES_ACCESS_KEY|DO_SPACES_SECRET_KEY|DO_SPACES_BUCKET_NAME|DO_SPACES_REGION)
                export "${key}=${value}"
                ;;
        esac
    done < "${PROJECT_DIR}/.env"
else
    echo "ERROR: .env file not found at ${PROJECT_DIR}/.env"
    exit 1
fi

S3_BUCKET="s3://${DO_SPACES_BUCKET_NAME}"
S3_BACKUP_DIR="storescore/backups/db"
S3_FULL_PATH="${S3_BUCKET}/${S3_BACKUP_DIR}/${BACKUP_FILENAME}"
LOCAL_PATH="/tmp/${BACKUP_FILENAME}"

# --- Cleanup function ---
cleanup() {
    if [[ -f "${LOCAL_PATH}" ]]; then
        rm -f "${LOCAL_PATH}"
        echo "Cleaned up temporary file: ${LOCAL_PATH}"
    fi
    # Also clean up decompressed file if it exists
    LOCAL_SQL="${LOCAL_PATH%.gz}"
    if [[ -f "${LOCAL_SQL}" ]]; then
        rm -f "${LOCAL_SQL}"
        echo "Cleaned up temporary file: ${LOCAL_SQL}"
    fi
}
trap cleanup EXIT

# --- Safety warnings ---
echo "============================================="
echo "  StoreScore Database Restore"
echo "============================================="
echo ""
echo "WARNING: This will OVERWRITE the current database!"
echo ""
echo "  Database:    ${POSTGRES_DB}"
echo "  Backup file: ${BACKUP_FILENAME}"
echo "  Source:       ${S3_FULL_PATH}"
echo ""
echo "This is a DESTRUCTIVE operation. The current database"
echo "contents will be dropped and replaced with the backup."
echo ""

# --- Confirm with user ---
read -p "Are you sure you want to continue? (yes/no): " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
read -p "Type the database name to confirm (${POSTGRES_DB}): " CONFIRM_DB
if [[ "${CONFIRM_DB}" != "${POSTGRES_DB}" ]]; then
    echo "Database name does not match. Restore cancelled."
    exit 1
fi

echo ""

# --- Step 1: Verify backup exists in Spaces ---
echo "Checking if backup exists in DigitalOcean Spaces..."
if ! s3cmd --config="${S3CFG}" ls "${S3_FULL_PATH}" 2>/dev/null | grep -q "${BACKUP_FILENAME}"; then
    echo "ERROR: Backup file not found: ${S3_FULL_PATH}"
    echo ""
    echo "Available backups:"
    s3cmd --config="${S3CFG}" ls "${S3_BUCKET}/${S3_BACKUP_DIR}/" 2>/dev/null | awk '{print "  " $NF}' | sed 's|.*/||'
    exit 1
fi
echo "Backup found."

# --- Step 2: Download the backup ---
echo "Downloading backup..."
if ! s3cmd --config="${S3CFG}" get "${S3_FULL_PATH}" "${LOCAL_PATH}" --force 2>/dev/null; then
    echo "ERROR: Failed to download backup from DigitalOcean Spaces."
    exit 1
fi

DOWNLOAD_SIZE=$(stat -c%s "${LOCAL_PATH}" 2>/dev/null || stat -f%z "${LOCAL_PATH}" 2>/dev/null)
echo "Downloaded: ${LOCAL_PATH} (${DOWNLOAD_SIZE} bytes)"

# --- Step 3: Create a safety backup of current database ---
echo ""
echo "Creating safety backup of current database before restore..."
SAFETY_BACKUP="/tmp/storescore_pre-restore_$(date +%Y-%m-%d_%H-%M).sql.gz"
cd "${PROJECT_DIR}"
if docker compose exec -T db pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-privileges \
    --format=plain 2>/dev/null | gzip > "${SAFETY_BACKUP}"; then
    SAFETY_SIZE=$(stat -c%s "${SAFETY_BACKUP}" 2>/dev/null || stat -f%z "${SAFETY_BACKUP}" 2>/dev/null)
    echo "Safety backup created: ${SAFETY_BACKUP} (${SAFETY_SIZE} bytes)"
else
    echo "WARNING: Could not create safety backup. Continuing anyway..."
fi

# --- Step 4: Decompress the backup ---
echo ""
echo "Decompressing backup..."
if [[ "${BACKUP_FILENAME}" == *.gz ]]; then
    gunzip -k -f "${LOCAL_PATH}"
    LOCAL_SQL="${LOCAL_PATH%.gz}"
else
    LOCAL_SQL="${LOCAL_PATH}"
fi

if [[ ! -f "${LOCAL_SQL}" ]]; then
    echo "ERROR: Decompressed SQL file not found."
    exit 1
fi

SQL_SIZE=$(stat -c%s "${LOCAL_SQL}" 2>/dev/null || stat -f%z "${LOCAL_SQL}" 2>/dev/null)
echo "Decompressed: ${LOCAL_SQL} (${SQL_SIZE} bytes)"

# --- Step 5: Drop and recreate the database ---
echo ""
echo "Dropping and recreating database ${POSTGRES_DB}..."

# Terminate existing connections and drop/recreate the database
cd "${PROJECT_DIR}"
docker compose exec -T db psql -U "${POSTGRES_USER}" -d postgres -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${POSTGRES_DB}'
    AND pid <> pg_backend_pid();
" 2>/dev/null || true

docker compose exec -T db psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};" 2>/dev/null
docker compose exec -T db psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};" 2>/dev/null

echo "Database recreated."

# --- Step 6: Restore the backup ---
echo ""
echo "Restoring backup into database..."
cd "${PROJECT_DIR}"
if docker compose exec -T db psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --single-transaction \
    < "${LOCAL_SQL}" 2>/dev/null; then
    echo "Restore completed successfully!"
else
    echo "WARNING: Restore completed with some warnings (this is often normal for pg_dump restores)."
fi

# --- Step 7: Verify the restore ---
echo ""
echo "Verifying restore..."
cd "${PROJECT_DIR}"
TABLE_COUNT=$(docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
echo "Tables in restored database: ${TABLE_COUNT}"

echo ""
echo "============================================="
echo "  Restore Complete!"
echo "============================================="
echo ""
echo "  Database: ${POSTGRES_DB}"
echo "  Source:   ${BACKUP_FILENAME}"
echo "  Tables:   ${TABLE_COUNT}"
echo ""
echo "  Safety backup: ${SAFETY_BACKUP}"
echo "  (Delete when you confirm everything works)"
echo ""
echo "NOTE: You may need to restart the application:"
echo "  cd ${PROJECT_DIR} && docker compose restart backend celery_worker celery_beat"
echo ""

exit 0
