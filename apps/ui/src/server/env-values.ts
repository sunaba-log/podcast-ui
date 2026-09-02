function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function getCloudSqlConnectionName(): string | undefined {
  return process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME;
}

export function getDatabaseName(): string {
  return required("DB_NAME");
}

export function getDatabaseUser(): string {
  return required("DB_USER");
}

export function getDatabasePassword(): string {
  return required("DB_PASSWORD");
}

export function getGoogleCloudProject(): string {
  return required("GOOGLE_CLOUD_PROJECT");
}

export function getFirebaseServiceAccountJson(): string | undefined {
  return process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}

export function parseServiceAccountJson(raw: string): unknown {
  let str = raw.trim();
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(str);
  } catch {
    const fixedNewlines = str
      .replace(/\r\n/g, "\\n")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\n");
    try {
      parsed = JSON.parse(fixedNewlines);
    } catch {
      try {
        parsed = JSON.parse(fixedNewlines.replace(/\\"/g, '"'));
      } catch {
        try {
          const unescaped = JSON.parse(`"${str}"`);
          parsed = JSON.parse(unescaped);
        } catch {
          parsed = JSON.parse(raw);
        }
      }
    }
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "private_key" in parsed &&
    typeof (parsed as Record<string, unknown>).private_key === "string"
  ) {
    const obj = parsed as { private_key: string };
    obj.private_key = obj.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

export function getGoogleServiceAccountCredentials():
  | { client_email: string; private_key: string }
  | undefined {
  const raw = getFirebaseServiceAccountJson();
  if (!raw) return undefined;
  const value = parseServiceAccountJson(raw) as {
    client_email?: unknown;
    private_key?: unknown;
  };
  if (
    typeof value.client_email !== "string" ||
    typeof value.private_key !== "string"
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must include client_email and private_key",
    );
  }
  return {
    client_email: value.client_email,
    private_key: value.private_key.replace(/\\n/g, "\n"),
  };
}

export function getAllowedDevEmails(): string[] {
  return (process.env.DEV_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// 許可リストが未設定・空の場合は全アカウントを許可する
export function isEmailAllowed(email: string): boolean {
  const allowedEmails = getAllowedDevEmails();
  return allowedEmails.length === 0 || allowedEmails.includes(email);
}

export function isLocalMockAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_LOCAL_MOCK_AUTH === "true";
}

// ハッカソン審査等でログインなしにお試し利用させるゲストモード。
// dev の Cloud Run にのみ設定する（prod では未設定＝無効）。
export function isGuestModeEnabled(): boolean {
  return process.env.ENABLE_GUEST_MODE === "true";
}

export function getGuestEmail(): string {
  return (process.env.GUEST_EMAIL ?? "guest@sunabalog.com").toLowerCase();
}

export function getUploadBucket(): string {
  return required("GCS_UPLOAD_BUCKET");
}

export function getSignedUrlTtlMs(): number {
  const raw = process.env.GCS_SIGNED_URL_TTL_SECONDS ?? "900";
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new Error("GCS_SIGNED_URL_TTL_SECONDS must be a positive integer");
  }
  return seconds * 1000;
}

export function getCronSecret(): string {
  return required("CRON_SECRET");
}

export function getVertexAiLocation(): string {
  return process.env.VERTEX_AI_LOCATION ?? "global";
}

export function getVertexAiModel(): string {
  return process.env.VERTEX_AI_MODEL ?? "gemini-2.5-flash";
}

export function getVertexAiEmbeddingModel(): string {
  return process.env.VERTEX_AI_EMBEDDING_MODEL ?? "text-multilingual-embedding-002";
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "admin@sunabalog.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(email: string): boolean {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

export function getContactEmail(): string {
  return process.env.CONTACT_EMAIL ?? "admin@sunabalog.com";
}

export function getPendingChatLimit(): number {
  const raw = process.env.PENDING_CHAT_LIMIT ?? "5";
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("PENDING_CHAT_LIMIT must be a positive integer");
  }
  return value;
}

export function getPendingEpisodeUploadLimit(): number {
  const raw = process.env.PENDING_EPISODE_UPLOAD_LIMIT ?? "2";
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("PENDING_EPISODE_UPLOAD_LIMIT must be a positive integer");
  }
  return value;
}

export function getRateLimitHourly(): number {
  const raw = process.env.RATE_LIMIT_HOURLY ?? "20";
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("RATE_LIMIT_HOURLY must be a positive integer");
  }
  return value;
}

export function getRateLimitDaily(): number {
  const raw = process.env.RATE_LIMIT_DAILY ?? "100";
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("RATE_LIMIT_DAILY must be a positive integer");
  }
  return value;
}
