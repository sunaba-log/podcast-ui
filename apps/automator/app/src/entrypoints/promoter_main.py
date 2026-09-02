"""SNS auto-posting entrypoint."""

from __future__ import annotations

import logging
import os
import sys

from infrastructure.secret_manager import SecretManagerClient
from infrastructure.x_api import XClient
from services.firestore_manager import FirestoreManager
from usecases.auto_post_sns import AutoPostSnsUsecase

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s", force=True)


def _required_env(environ: dict[str, str], key: str) -> str:
    """Return required environment value or raise ValueError."""
    value = environ.get(key)
    if value is None:
        msg = f"{key} environment variable is required."
        logger.error(msg)
        raise ValueError(msg)
    return value


def auto_post_sns() -> None:
    """Fetch due SNS promotion posts and post the oldest one to X."""
    project_id = _required_env(os.environ, "PROJECT_ID")

    api_key = os.environ.get("X_API_KEY")
    api_secret = os.environ.get("X_API_SECRET")
    access_token = os.environ.get("X_ACCESS_TOKEN")
    access_token_secret = os.environ.get("X_ACCESS_TOKEN_SECRET")

    x_client = None
    if api_key and api_secret and access_token and access_token_secret:
        x_client = XClient(
            api_key=api_key,
            api_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )
        auth_ok = x_client.verify_auth()
        if not auth_ok:
            logger.error("Fallback X credentials verification failed.")
            sys.exit(1)
    else:
        logger.info("No fallback X credentials provided in environment variables.")

    secret_provider = SecretManagerClient(project_id=project_id)
    firestore_manager = FirestoreManager(project_id=project_id)
    usecase = AutoPostSnsUsecase(
        firestore_manager=firestore_manager,
        secret_provider=secret_provider,
        x_client=x_client,
        logger=logger,
    )
    usecase.run()


def main() -> None:
    """Main entry point."""
    auto_post_sns()


if __name__ == "__main__":
    main()
