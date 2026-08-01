import "server-only";

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { getGoogleCloudProject, getGoogleServiceAccountCredentials } from "@/server/env";

declare global {
  var secretManagerClient: SecretManagerServiceClient | undefined;
}

function getSecretManagerClient(): SecretManagerServiceClient {
  if (!globalThis.secretManagerClient) {
    globalThis.secretManagerClient = new SecretManagerServiceClient({
      projectId: getGoogleCloudProject(),
      credentials: getGoogleServiceAccountCredentials(),
    });
  }
  return globalThis.secretManagerClient;
}

export type ChannelSecrets = {
  x_api_key?: string;
  x_api_secret?: string;
  x_access_token?: string;
  x_access_token_secret?: string;
  discord_bot_token?: string;
};

/**
 * GCP Secret Manager からチャンネル（ポッドキャストID）ごとのシークレットを取得する
 */
export async function getChannelSecrets(podcastId: number): Promise<ChannelSecrets | null> {
  const client = getSecretManagerClient();
  const projectId = getGoogleCloudProject();
  const secretId = `podcast-${podcastId}-secrets`;
  const name = client.secretVersionPath(projectId, secretId, "latest");

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    if (!payload) return null;
    return JSON.parse(payload) as ChannelSecrets;
  } catch (error) {
    // 5: NOT_FOUND (シークレット自体または最新バージョンが存在しない)
    const isNotFoundError =
      error && typeof error === "object" && "code" in error && error.code === 5;
    if (isNotFoundError) {
      return null;
    }
    console.error(`Failed to access secret version for podcast ${podcastId}:`, error);
    throw error;
  }
}

/**
 * チャンネルのシークレットを GCP Secret Manager に保存する。
 * シークレットが存在しない場合は新規作成し、存在する場合は新しいバージョンを追加します。
 */
export async function saveChannelSecrets(podcastId: number, secrets: ChannelSecrets): Promise<void> {
  const client = getSecretManagerClient();
  const projectId = getGoogleCloudProject();
  const secretId = `podcast-${podcastId}-secrets`;
  const secretPath = client.secretPath(projectId, secretId);

  // 1. シークレットの作成を試みる（すでに存在する場合や、作成権限がない場合は無視して次に進み、バージョン追加を試す）
  try {
    await client.createSecret({
      parent: client.projectPath(projectId),
      secretId,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });
  } catch (error) {
    const isAlreadyExistsError =
      error && typeof error === "object" && "code" in error && error.code === 6;
    if (!isAlreadyExistsError) {
      // 権限不足 (PERMISSION_DENIED = 7) などのエラーが起きた場合は、警告を出力した上で、
      // シークレットが既に作成済みであると仮定して、次の addSecretVersion の実行を試みます。
      console.warn(`Failed to create secret ${secretId} (creation is not permitted but it might already exist):`, error);
    }
  }

  // 3. バージョンを追加（JSON文字列として保存）
  try {
    const payload = JSON.stringify(secrets);
    await client.addSecretVersion({
      parent: secretPath,
      payload: {
        data: Buffer.from(payload, "utf8"),
      },
    });
  } catch (error) {
    console.error(`Failed to add secret version for ${secretId}:`, error);
    throw error;
  }
}

/**
 * チャンネルのシークレット自体を GCP Secret Manager から削除する
 */
export async function deleteChannelSecrets(podcastId: number): Promise<void> {
  const client = getSecretManagerClient();
  const projectId = getGoogleCloudProject();
  const secretId = `podcast-${podcastId}-secrets`;
  const name = client.secretPath(projectId, secretId);

  try {
    await client.deleteSecret({ name });
  } catch (error) {
    // すでに存在しない場合はエラーにしない
    const isNotFoundError =
      error && typeof error === "object" && "code" in error && error.code === 5;
    if (isNotFoundError) {
      return;
    }
    console.error(`Failed to delete secret ${secretId}:`, error);
    throw error;
  }
}
