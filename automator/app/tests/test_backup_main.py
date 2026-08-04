from __future__ import annotations

import subprocess
from types import SimpleNamespace

import pytest

import backup_main


def _fake_run(returncode: int, stderr: str = ""):
    def _run(*_args: object, **_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(returncode=returncode, stderr=stderr)

    return _run


def test_required_env_exits_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(SystemExit):
        backup_main._required_env("DATABASE_URL")


def test_main_exits_when_pg_dump_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/db")
    monkeypatch.setenv("BACKUP_BUCKET", "bucket")
    monkeypatch.setattr(subprocess, "run", _fake_run(1, "boom"))

    with pytest.raises(SystemExit):
        backup_main.main()


def test_main_uploads_backup_on_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost/db")
    monkeypatch.setenv("BACKUP_BUCKET", "bucket")
    monkeypatch.setattr(subprocess, "run", _fake_run(0))

    captured: dict[str, str] = {}

    class _Blob:
        def upload_from_filename(self, path: str) -> None:
            captured["path"] = path

    class _Bucket:
        def blob(self, name: str) -> _Blob:
            captured["name"] = name
            return _Blob()

    class _Client:
        def bucket(self, name: str) -> _Bucket:
            captured["bucket"] = name
            return _Bucket()

    monkeypatch.setattr(backup_main.storage, "Client", _Client)

    backup_main.main()

    assert captured["bucket"] == "bucket"
    assert captured["name"].endswith(".dump")
    assert captured["path"]
