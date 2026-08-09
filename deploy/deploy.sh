#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/deploy.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "deploy/deploy.env가 없어요. deploy/deploy.env.example을 복사해서 채워주세요." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${FTP_HOST:?FTP_HOST가 비어있어요}"
: "${FTP_USER:?FTP_USER가 비어있어요}"
: "${FTP_PASS:?FTP_PASS가 비어있어요}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-}"

TOP_FILES=(index.html main.html onboarding.html)
DIRS=(src api)

upload_file() {
  local local_path="$1"
  local rel_path="${local_path#"$ROOT_DIR"/}"
  local remote_url="ftp://${FTP_HOST}${FTP_REMOTE_DIR}/${rel_path}"

  echo "업로드: $rel_path"
  curl --fail --silent --show-error --ftp-create-dirs --user "${FTP_USER}:${FTP_PASS}" -T "$local_path" "$remote_url"
}

cd "$ROOT_DIR"

for f in "${TOP_FILES[@]}"; do
  if [ -f "$ROOT_DIR/$f" ]; then
    upload_file "$ROOT_DIR/$f"
  fi
done

for d in "${DIRS[@]}"; do
  if [ -d "$ROOT_DIR/$d" ]; then
    while IFS= read -r -d '' f; do
      upload_file "$f"
    done < <(find "$ROOT_DIR/$d" -type f -print0)
  fi
done

echo "배포 완료."
