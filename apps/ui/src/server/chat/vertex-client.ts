import "server-only";

import { GoogleGenAI } from "@google/genai";
import {
  getGoogleCloudProject,
  getGoogleServiceAccountCredentials,
  getVertexAiLocation,
} from "@/server/env";

let client: GoogleGenAI | undefined;

/**
 * Vertex AI 上の Gemini を呼ぶための共有クライアント。
 * 認証は Firebase 用のサービスアカウント（FIREBASE_SERVICE_ACCOUNT_JSON）を流用し、
 * 未設定の場合は Application Default Credentials にフォールバックする。
 */
export function getVertexAi(): GoogleGenAI {
  if (client) return client;

  const credentials = getGoogleServiceAccountCredentials();
  client = new GoogleGenAI({
    vertexai: true,
    project: getGoogleCloudProject(),
    location: getVertexAiLocation(),
    googleAuthOptions: credentials
      ? {
          credentials,
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        }
      : undefined,
  });
  return client;
}
