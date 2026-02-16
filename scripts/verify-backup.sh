#!/bin/bash
# =============================================================================
# StoreScore Backup Verification Script
# Lists recent backups from DO Spaces and checks that today's backup exists
# =============================================================================

set -euo pipefail

# --- Configuration ---
PROJECT_DIR="/var/www/storescore"
SCRIPTS_DIR="${PROJECT_DIR}/scripts"
S3CFG="${SCRIPTS_DIR}/.s3cfg"

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
TODAY=$(date +"%Y-%m-%d")

echo "============================================="
echo "  StoreScore Backup Verification Report"
echo "  Date: $(date +"%Y-%m-%d %H:%M:%S %Z")"
echo "============================================="
echo ""

# --- List all backups ---
echo "Recent backups in DigitalOcean Spaces:"
echo "---------------------------------------------"

BACKUP_LIST=$(s3cmd --config="${S3CFG}" ls "${S3_BUCKET}/${S3_BACKUP_DIR}/" 2>/dev/null || true)

if [[ -z "${BACKUP_LIST}" ]]; then
    echo "  WARNING: No backups found!"
    echo ""
    echo "STATUS: FAIL - No backups exist"
    exit 1
fi

# Show last 10 backups
echo "${BACKUP_LIST}" | tail -10 | while read -r line; do
    file_date=$(echo "${line}" | awk '{print $1}')
    file_time=$(echo "${line}" | awk '{print $2}')
    file_size=$(echo "${line}" | awk '{print $3}')
    file_path=$(echo "${line}" | awk '{print $NF}')
    file_name=$(basename "${file_path}")

    # Convert size to human readable
    if [[ "${file_size}" -gt 1048576 ]]; then
        human_size="$(echo "scale=2; ${file_size}/1048576" | bc) MB"
    elif [[ "${file_size}" -gt 1024 ]]; then
        human_size="$(echo "scale=2; ${file_size}/1024" | bc) KB"
    else
        human_size="${file_size} B"
    fi

    echo "  ${file_date} ${file_time}  ${human_size}  ${file_name}"
done

echo ""

# --- Check for today's backup ---
echo "Checking for today's backup (${TODAY})..."
TODAY_BACKUP=$(echo "${BACKUP_LIST}" | grep "storescore_${TODAY}" || true)

if [[ -z "${TODAY_BACKUP}" ]]; then
    echo "  WARNING: No backup found for today (${TODAY})"
    BACKUP_STATUS="MISSING"
else
    TODAY_SIZE=$(echo "${TODAY_BACKUP}" | awk '{print $3}' | head -1)
    TODAY_FILE=$(echo "${TODAY_BACKUP}" | awk '{print $NF}' | head -1)
    TODAY_NAME=$(basename "${TODAY_FILE}")

    echo "  Found: ${TODAY_NAME}"
    echo "  Size:  ${TODAY_SIZE} bytes"

    if [[ "${TODAY_SIZE}" -gt 0 ]]; then
        echo "  Size check: PASS (${TODAY_SIZE} bytes > 0)"
        BACKUP_STATUS="OK"
    else
        echo "  Size check: FAIL (file is empty!)"
        BACKUP_STATUS="EMPTY"
    fi
fi

echo ""

# --- Count total backups ---
TOTAL_BACKUPS=$(echo "${BACKUP_LIST}" | wc -l | tr -d ' ')
echo "Total backups in storage: ${TOTAL_BACKUPS}"

# --- Check backup log for recent errors ---
BACKUP_LOG="${PROJECT_DIR}/logs/backup.log"
FAILURE_LOG="${PROJECT_DIR}/logs/backup-failures.log"

if [[ -f "${FAILURE_LOG}" ]]; then
    RECENT_FAILURES=$(tail -5 "${FAILURE_LOG}" 2>/dev/null || true)
    if [[ -n "${RECENT_FAILURES}" ]]; then
        echo ""
        echo "Recent failures from log:"
        echo "${RECENT_FAILURES}" | while read -r line; do
            echo "  ${line}"
        done
    fi
fi

echo ""
echo "============================================="
if [[ "${BACKUP_STATUS}" == "OK" ]]; then
    echo "  STATUS: PASS - Today's backup is valid"
else
    echo "  STATUS: FAIL - Today's backup: ${BACKUP_STATUS}"
fi
echo "============================================="

if [[ "${BACKUP_STATUS}" != "OK" ]]; then
    exit 1
fi

exit 0
