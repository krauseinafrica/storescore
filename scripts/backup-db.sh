#!/bin/bash
# =============================================================================
# StoreScore Database Backup Script
# Runs pg_dump inside the Docker container and uploads to DigitalOcean Spaces
# =============================================================================

set -euo pipefail

# --- Configuration ---
PROJECT_DIR="/var/www/storescore"
SCRIPTS_DIR="${PROJECT_DIR}/scripts"
LOGS_DIR="${PROJECT_DIR}/logs"
S3CFG="${SCRIPTS_DIR}/.s3cfg"
BACKUP_LOG="${LOGS_DIR}/backup.log"
FAILURE_LOG="${LOGS_DIR}/backup-failures.log"
RETENTION_DAYS=30

# --- Load environment variables ---
# Parse .env safely (handles values with special characters like < >)
if [[ -f "${PROJECT_DIR}/.env" ]]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ -z "${key}" || "${key}" =~ ^[[:space:]]*# ]] && continue
        # Trim whitespace from key
        key=$(echo "${key}" | xargs)
        # Only export variables we need
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

# --- Derived variables ---
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
DATE_STAMP=$(date +"%Y-%m-%d %H:%M:%S")
BACKUP_FILENAME="storescore_${TIMESTAMP}.sql.gz"
LOCAL_BACKUP_PATH="/tmp/${BACKUP_FILENAME}"
S3_BUCKET="s3://${DO_SPACES_BUCKET_NAME}"
S3_BACKUP_DIR="storescore/backups/db"
S3_FULL_PATH="${S3_BUCKET}/${S3_BACKUP_DIR}/${BACKUP_FILENAME}"

# --- Ensure directories exist ---
mkdir -p "${LOGS_DIR}"

# --- Logging function ---
log() {
    local ts
    ts=$(date +"%Y-%m-%d %H:%M:%S")
    local message="[${ts}] $1"
    echo "${message}" | tee -a "${BACKUP_LOG}"
}

# --- Failure notification function ---
notify_failure() {
    local error_message="$1"
    local fail_timestamp
    fail_timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[${fail_timestamp}] BACKUP FAILED: ${error_message}" >> "${FAILURE_LOG}"
    log "FAILURE: ${error_message}"
    log "Failure details written to ${FAILURE_LOG}"
}

# --- Cleanup function ---
cleanup() {
    if [[ -f "${LOCAL_BACKUP_PATH}" ]]; then
        rm -f "${LOCAL_BACKUP_PATH}"
        log "Cleaned up temporary file: ${LOCAL_BACKUP_PATH}"
    fi
}
trap cleanup EXIT

# --- Start backup ---
log "========================================="
log "Starting database backup"
log "Database: ${POSTGRES_DB}"
log "Backup file: ${BACKUP_FILENAME}"
log "========================================="

# --- Step 1: Run pg_dump inside the Docker container ---
log "Running pg_dump inside the db container..."
cd "${PROJECT_DIR}"
if ! docker compose exec -T db pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner \
    --no-privileges \
    --format=plain \
    2>>"${BACKUP_LOG}" | gzip > "${LOCAL_BACKUP_PATH}"; then
    notify_failure "pg_dump failed. Check database container status."
    exit 1
fi

# --- Step 2: Verify the backup file was created and has content ---
if [[ ! -f "${LOCAL_BACKUP_PATH}" ]]; then
    notify_failure "Backup file was not created at ${LOCAL_BACKUP_PATH}"
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "${LOCAL_BACKUP_PATH}" 2>/dev/null || stat -f%z "${LOCAL_BACKUP_PATH}" 2>/dev/null)
if [[ "${BACKUP_SIZE}" -lt 100 ]]; then
    notify_failure "Backup file is suspiciously small (${BACKUP_SIZE} bytes). Possible empty dump."
    exit 1
fi

log "Local backup created: ${LOCAL_BACKUP_PATH} (${BACKUP_SIZE} bytes)"

# --- Step 3: Upload to DigitalOcean Spaces ---
log "Uploading to DigitalOcean Spaces: ${S3_FULL_PATH}"
if ! s3cmd --config="${S3CFG}" put "${LOCAL_BACKUP_PATH}" "${S3_FULL_PATH}" 2>>"${BACKUP_LOG}"; then
    notify_failure "Failed to upload backup to DigitalOcean Spaces."
    exit 1
fi

log "Upload complete."

# --- Step 4: Verify upload ---
log "Verifying upload..."
if ! s3cmd --config="${S3CFG}" ls "${S3_FULL_PATH}" 2>>"${BACKUP_LOG}" | grep -q "${BACKUP_FILENAME}"; then
    notify_failure "Upload verification failed. File not found in Spaces."
    exit 1
fi

log "Upload verified successfully."

# --- Step 5: Delete old backups (older than RETENTION_DAYS days) ---
log "Checking for backups older than ${RETENTION_DAYS} days..."

CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +"%Y-%m-%d" 2>/dev/null || date -v-${RETENTION_DAYS}d +"%Y-%m-%d" 2>/dev/null)

if [[ -n "${CUTOFF_DATE}" ]]; then
    s3cmd --config="${S3CFG}" ls "${S3_BUCKET}/${S3_BACKUP_DIR}/" 2>/dev/null | while read -r line; do
        file_date=$(echo "${line}" | awk '{print $1}')
        file_path=$(echo "${line}" | awk '{print $NF}')

        if [[ -n "${file_date}" && -n "${file_path}" && "${file_date}" < "${CUTOFF_DATE}" ]]; then
            log "Deleting old backup: ${file_path} (date: ${file_date})"
            s3cmd --config="${S3CFG}" del "${file_path}" 2>>"${BACKUP_LOG}" || true
        fi
    done
    log "Old backup cleanup complete."
else
    log "WARNING: Could not calculate cutoff date. Skipping retention cleanup."
fi

# --- Done ---
log "========================================="
log "Backup completed successfully!"
log "File: ${S3_FULL_PATH}"
log "Size: ${BACKUP_SIZE} bytes"
log "========================================="
log ""

exit 0
