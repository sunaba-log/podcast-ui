"""Secret Manager infrastructure client."""

import json
import logging
from dataclasses import dataclass

from google.cloud import secretmanager_v1

from domain.interfaces import ChannelCredentials, SecretProvider

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SecretJson:
    """Secret payload model."""

    r2_access_key: str | None
    r2_secret_key: str | None
    discord_webhook_url: str | None


class SecretManagerClient(SecretProvider):
    """Google Secret Manager client wrapper."""

    def __init__(self, project_id: str, secret_name: str | None = None, version: str = "latest") -> None:
        """Initialize secret client with project and secret metadata."""
        self.project_id = project_id
        self.secret_name = secret_name
        self.version = version
        self.client = secretmanager_v1.SecretManagerServiceClient()
        self.secrets = self._get_credentials() if secret_name else None

    def _get_credentials(self) -> SecretJson:
        """Load secret JSON from Secret Manager."""
        if not self.secret_name:
            raise ValueError("secret_name must be provided to load global credentials")
        try:
            secret_path = self.client.secret_version_path(self.project_id, self.secret_name, self.version)
            response = self.client.access_secret_version(request={"name": secret_path})
            secret_json = json.loads(response.payload.data.decode("UTF-8"))
            return SecretJson(
                r2_access_key=secret_json.get("r2_access_key"),
                r2_secret_key=secret_json.get("r2_secret_key"),
                discord_webhook_url=secret_json.get("discord_webhook_url"),
            )
        except Exception:
            logger.exception("Failed to get credentials")
            raise

    def get_r2_credentials(self) -> tuple[str | None, str | None]:
        """Get R2 credentials."""
        if not self.secrets:
            return None, None
        return self.secrets.r2_access_key, self.secrets.r2_secret_key

    def get_discord_webhook_url(self) -> str | None:
        """Get Discord webhook URL."""
        if not self.secrets:
            return None
        return self.secrets.discord_webhook_url

    def get_channel_credentials(self, podcast_id: str) -> ChannelCredentials:
        """Load podcast-specific credentials from Secret Manager."""
        if not podcast_id:
            raise ValueError("podcast_id must be provided")

        secret_id = f"podcast-{podcast_id}-secrets"
        try:
            secret_path = self.client.secret_version_path(self.project_id, secret_id, self.version)
            response = self.client.access_secret_version(request={"name": secret_path})
            secret_json = json.loads(response.payload.data.decode("UTF-8"))

            x_api_key = secret_json.get("x_api_key") or secret_json.get("api_key")
            x_api_secret = secret_json.get("x_api_secret") or secret_json.get("api_secret")
            x_access_token = secret_json.get("access_token") or secret_json.get("x_access_token")
            x_access_token_secret = secret_json.get("access_token_secret") or secret_json.get("x_access_token_secret")
            discord_bot_token = secret_json.get("discord_bot_token")

            return ChannelCredentials(
                x_api_key=x_api_key,
                x_api_secret=x_api_secret,
                x_access_token=x_access_token,
                x_access_token_secret=x_access_token_secret,
                discord_bot_token=discord_bot_token,
            )
        except Exception as exc:
            logger.exception("Failed to retrieve credentials for podcast channel: %s", podcast_id)
            err_msg = f"Failed to retrieve credentials for podcast channel {podcast_id}"
            raise RuntimeError(err_msg) from exc
