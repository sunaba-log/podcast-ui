"""Use case for automatically posting SNS promotion posts to X."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from domain.models.sns_post import SnsPost

if TYPE_CHECKING:
    from domain.interfaces import SecretProvider
    from services.firestore_manager import FirestoreManager

from infrastructure.x_api import XClient

logger = logging.getLogger(__name__)


class AutoPostSnsUsecase:
    """Retrieves due SNS promotions from Firestore and posts the oldest one to X."""

    def __init__(
        self,
        *,
        firestore_manager: FirestoreManager,
        secret_provider: SecretProvider | None = None,
        x_client: XClient | None = None,
        logger: logging.Logger | None = None,
    ) -> None:
        """Initialize use case."""
        self._firestore_manager = firestore_manager
        self._secret_provider = secret_provider
        self._x_client = x_client
        self._logger = logger or logging.getLogger(__name__)

    def run(self) -> None:
        """Execute the auto-posting process."""
        self._logger.info("Auto-posting process started.")

        try:
            pending_promotions = self._firestore_manager.get_pending_sns_promotions()
        except Exception:
            self._logger.exception("Failed to fetch pending SNS promotions from Firestore.")
            raise

        if not pending_promotions:
            self._logger.info("No pending SNS promotions found.")
            return

        now = datetime.now(UTC)
        due_promotions = []
        for promo in pending_promotions:
            sched_time_str = promo.get("scheduled_time")
            if not sched_time_str:
                continue
            try:
                # Parse scheduled time in ISO 8601 format
                sched_time = datetime.fromisoformat(sched_time_str)
            except ValueError:
                self._logger.warning("Invalid scheduled_time format: %s", sched_time_str)
                continue

            if sched_time <= now:
                due_promotions.append((sched_time, promo))

        if not due_promotions:
            self._logger.info("No SNS promotions are due for posting.")
            return

        # Sort by scheduled time, and pick the oldest one.
        due_promotions.sort(key=lambda item: item[0])
        _, oldest_promo = due_promotions[0]

        reference_path = oldest_promo["reference_path"]
        doc_id = oldest_promo["doc_id"]
        self._logger.info("Selected promotion to post. doc_id: %s, path: %s", doc_id, reference_path)

        message = oldest_promo.get("message", "").strip()
        if not message:
            self._logger.warning("Empty message, skipping. doc_id: %s", doc_id)
            return

        # Resolve episode number from the nested 'episode' structure
        episode_number = oldest_promo.get("episode", {}).get("number")

        post = SnsPost(
            message=message,
            platform_urls=oldest_promo.get("platform_urls"),
            episode_number=episode_number,
            hashtags=oldest_promo.get("hashtags"),
        )
        post_text = post.generate_text()

        # Parse reference path to get podcast_id
        podcast_id = None
        parts = reference_path.split("/")
        if len(parts) >= 2 and parts[0] == "podcasts":  # noqa: PLR2004
            podcast_id = parts[1]

        # Determine which XClient to use
        x_client = None
        if self._secret_provider and podcast_id:
            try:
                self._logger.info("Fetching channel credentials for podcast_id: %s", podcast_id)
                creds = self._secret_provider.get_channel_credentials(podcast_id)
                if creds.x_api_key and creds.x_api_secret and creds.x_access_token and creds.x_access_token_secret:
                    x_client = XClient(
                        api_key=creds.x_api_key,
                        api_secret=creds.x_api_secret,
                        access_token=creds.x_access_token,
                        access_token_secret=creds.x_access_token_secret,
                    )
                    # Verify credentials
                    if not x_client.verify_auth():
                        self._logger.error("X credentials verification failed for podcast_id: %s", podcast_id)
                        x_client = None
                else:
                    self._logger.info(
                        "X credentials are incomplete for podcast_id: %s. Skipping custom XClient initialization.",
                        podcast_id,
                    )
                    x_client = None
            except Exception:
                self._logger.exception("Failed to get or verify channel credentials for podcast_id: %s", podcast_id)
                x_client = None

        if not x_client:
            if self._x_client:
                self._logger.info("Falling back to default XClient")
                x_client = self._x_client
            else:
                self._logger.error("No valid XClient could be initialized for podcast_id: %s", podcast_id)
                self._firestore_manager.update_sns_promotion_status(reference_path, "failed")
                return

        self._logger.info("Attempting to post thread. doc_id: %s, text_length: %s", doc_id, len(post_text))
        try:
            success = x_client.post_thread(post_text)
            if success:
                self._firestore_manager.update_sns_promotion_status(reference_path, "posted")
                self._logger.info("SNS promotion posted successfully. doc_id: %s", doc_id)
            else:
                self._firestore_manager.update_sns_promotion_status(reference_path, "failed")
                self._logger.error("SNS promotion posting failed. doc_id: %s", doc_id)
        except Exception:
            self._logger.exception("Unexpected error while posting SNS promotion. doc_id: %s", doc_id)
            try:
                self._firestore_manager.update_sns_promotion_status(reference_path, "failed")
            except Exception:
                self._logger.exception("Failed to update status to failed in Firestore. doc_id: %s", doc_id)
            raise
