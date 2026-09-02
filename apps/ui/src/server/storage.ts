import "server-only";

import { Storage } from "@google-cloud/storage";
import {
  getGoogleCloudProject,
  getGoogleServiceAccountCredentials,
  getSignedUrlTtlMs,
  getUploadBucket,
} from "@/server/env";

declare global {
  var podcastStorage: Storage | undefined;
}

function getStorage(): Storage {
  if (!globalThis.podcastStorage) {
    globalThis.podcastStorage = new Storage({
      projectId: getGoogleCloudProject(),
      credentials: getGoogleServiceAccountCredentials(),
    });
  }
  return globalThis.podcastStorage;
}

export async function createAudioUploadUrl(
  objectPath: string,
): Promise<{ uploadUrl: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + getSignedUrlTtlMs());
  const [uploadUrl] = await getStorage()
    .bucket(getUploadBucket())
    .file(objectPath)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: expiresAt,
    });

  return { uploadUrl, expiresAt };
}
