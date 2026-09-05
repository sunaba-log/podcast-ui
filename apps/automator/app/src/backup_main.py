"""Daily database backup entrypoint.

Supabase 無料枠には自動バックアップが無いため、`pg_dump` で DB 全体をダンプし
GCS バケットへ保存する。Cloud Run Job として Cloud Scheduler から日次起動される。
app job と同一イメージを共有し、ENTRYPOINT を `python -m backup_main` で override する。
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from google.cloud import storage

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s", force=True)

# PGDG でインストールした pg_dump 17 の絶対パス。部分パス実行を避けるため絶対指定。
PG_DUMP = "/usr/bin/pg_dump"


def _required_env(key: str) -> str:
    """Return a required environment variable or exit with error."""
    value = os.environ.get(key)
    if not value:
        logger.error("%s environment variable is required.", key)
        raise SystemExit(1)
    return value


def main() -> None:
    """Dump the database with pg_dump and upload the dump file to GCS."""
    database_url = _required_env("DATABASE_URL")
    bucket_name = _required_env("BACKUP_BUCKET")

    object_name = datetime.now(UTC).strftime("%Y/%m/%Y%m%dT%H%M%SZ.dump")

    with tempfile.NamedTemporaryFile(suffix=".dump") as tmp:
        logger.info("Starting pg_dump ...")
        result = subprocess.run(  # noqa: S603
            [
                PG_DUMP,
                database_url,
                "--no-owner",
                "--no-privileges",
                "--format=custom",
                "--file",
                tmp.name,
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.error(
                "pg_dump failed (rc=%s): %s",
                result.returncode,
                result.stderr.strip(),
            )
            raise SystemExit(1)

        size_bytes = Path(tmp.name).stat().st_size
        logger.info("pg_dump complete: %d bytes", size_bytes)

        # Upload to GCS using the google-cloud-storage dependency already bundled.
        client = storage.Client()
        blob = client.bucket(bucket_name).blob(object_name)
        blob.upload_from_filename(tmp.name)

    logger.info(
        "Backup uploaded: gs://%s/%s (%d bytes)",
        bucket_name,
        object_name,
        size_bytes,
    )


if __name__ == "__main__":
    main()
