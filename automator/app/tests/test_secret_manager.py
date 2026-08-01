"""Tests for SecretManagerClient."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from domain.interfaces import ChannelCredentials
from infrastructure.secret_manager import SecretManagerClient


def test_secret_manager_client_global_secrets() -> None:
    """Test loading global secrets via SecretManagerClient."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.payload.data = b'{"r2_access_key": "k", "r2_secret_key": "s", "discord_webhook_url": "w"}'
    mock_client.access_secret_version.return_value = mock_response

    with patch("infrastructure.secret_manager.secretmanager_v1.SecretManagerServiceClient", return_value=mock_client):
        client = SecretManagerClient(project_id="proj", secret_name="sec")
        r2_k, r2_s = client.get_r2_credentials()
        assert r2_k == "k"
        assert r2_s == "s"
        assert client.get_discord_webhook_url() == "w"


def test_secret_manager_client_channel_credentials() -> None:
    """Test loading channel-specific credentials via SecretManagerClient."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.payload.data = b'{"x_api_key": "x1", "x_api_secret": "x2", "access_token": "x3", "access_token_secret": "x4", "discord_bot_token": "db1"}'
    mock_client.access_secret_version.return_value = mock_response

    with patch("infrastructure.secret_manager.secretmanager_v1.SecretManagerServiceClient", return_value=mock_client):
        client = SecretManagerClient(project_id="proj")
        creds = client.get_channel_credentials("chan123")
        assert isinstance(creds, ChannelCredentials)
        assert creds.x_api_key == "x1"
        assert creds.x_api_secret == "x2"
        assert creds.x_access_token == "x3"
        assert creds.x_access_token_secret == "x4"
        assert creds.discord_bot_token == "db1"

        # Verify the secret name generated matches the podcast_id
        mock_client.secret_version_path.assert_called_with("proj", "podcast-chan123-secrets", "latest")


def test_secret_manager_client_channel_credentials_alternate_keys() -> None:
    """Test loading channel-specific credentials with alternate key names (no prefix)."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.payload.data = b'{"api_key": "x1", "api_secret": "x2", "x_access_token": "x3", "x_access_token_secret": "x4", "discord_bot_token": "db1"}'
    mock_client.access_secret_version.return_value = mock_response

    with patch("infrastructure.secret_manager.secretmanager_v1.SecretManagerServiceClient", return_value=mock_client):
        client = SecretManagerClient(project_id="proj")
        creds = client.get_channel_credentials("chan123")
        assert isinstance(creds, ChannelCredentials)
        assert creds.x_api_key == "x1"
        assert creds.x_api_secret == "x2"
        assert creds.x_access_token == "x3"
        assert creds.x_access_token_secret == "x4"
        assert creds.discord_bot_token == "db1"


def test_secret_manager_client_channel_credentials_missing_keys() -> None:
    """Test that missing keys in the JSON payload default to None without raising error."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    # Missing api_key (x_api_key)
    mock_response.payload.data = (
        b'{"api_secret": "x2", "x_access_token": "x3", "x_access_token_secret": "x4", "discord_bot_token": "db1"}'
    )
    mock_client.access_secret_version.return_value = mock_response

    with patch("infrastructure.secret_manager.secretmanager_v1.SecretManagerServiceClient", return_value=mock_client):
        client = SecretManagerClient(project_id="proj")
        creds = client.get_channel_credentials("chan123")
        assert creds.x_api_key is None
        assert creds.x_api_secret == "x2"
        assert creds.x_access_token == "x3"
        assert creds.x_access_token_secret == "x4"
        assert creds.discord_bot_token == "db1"


def test_secret_manager_client_channel_credentials_nonexistent() -> None:
    """Test error handling when Secret Manager raises an exception."""
    mock_client = MagicMock()
    mock_client.access_secret_version.side_effect = Exception("Secret not found")

    with patch("infrastructure.secret_manager.secretmanager_v1.SecretManagerServiceClient", return_value=mock_client):
        client = SecretManagerClient(project_id="proj")
        with pytest.raises(RuntimeError, match="Failed to retrieve credentials for podcast channel chan123"):
            client.get_channel_credentials("chan123")
