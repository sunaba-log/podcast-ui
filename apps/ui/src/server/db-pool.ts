import {
  Connector,
  GoogleAuth,
  IpAddressTypes,
} from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";
import {
  getCloudSqlConnectionName,
  getDatabaseName,
  getDatabasePassword,
  getDatabaseUrl,
  getDatabaseUser,
  getGoogleCloudProject,
  getGoogleServiceAccountCredentials,
} from "./env-values";

declare global {
  var podcastDbPoolPromise: Promise<Pool> | undefined;
  var podcastCloudSqlConnector: Connector | undefined;
}

async function createPool(): Promise<Pool> {
  const connectionName = getCloudSqlConnectionName();
  if (!connectionName) {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL or CLOUD_SQL_INSTANCE_CONNECTION_NAME is required",
      );
    }
    // node-pg の connectionString 経由は Supabase プーラーの証明書検証で失敗する
    // （sslmode=require が verify-full 扱いとなり SELF_SIGNED_CERT_IN_CHAIN）。
    // URL を分解し、非ローカル接続は SSL（証明書検証なし）を明示して接続する。
    const parsed = new URL(databaseUrl);
    const isLocal =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    return new Pool({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 10,
    });
  }

  const credentials = getGoogleServiceAccountCredentials();
  const auth = credentials
    ? new GoogleAuth({
        projectId: getGoogleCloudProject(),
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/sqlservice.admin",
          "https://www.googleapis.com/auth/sqlservice.login",
        ],
      })
    : undefined;
  const connector = new Connector(auth ? { auth } : undefined);
  globalThis.podcastCloudSqlConnector = connector;
  const connectorOptions = await connector.getOptions({
    instanceConnectionName: connectionName,
    ipType: IpAddressTypes.PUBLIC,
  });
  return new Pool({
    ...connectorOptions,
    user: getDatabaseUser(),
    password: getDatabasePassword(),
    database: getDatabaseName(),
    max: 10,
  });
}

export async function getDbPool(): Promise<Pool> {
  if (!globalThis.podcastDbPoolPromise) {
    globalThis.podcastDbPoolPromise = createPool().catch((err) => {
      globalThis.podcastDbPoolPromise = undefined;
      throw err;
    });
  }
  return globalThis.podcastDbPoolPromise;
}

export async function closeDbPool(): Promise<void> {
  const poolPromise = globalThis.podcastDbPoolPromise;
  globalThis.podcastDbPoolPromise = undefined;
  if (poolPromise) {
    await (await poolPromise).end();
  }
  globalThis.podcastCloudSqlConnector?.close();
  globalThis.podcastCloudSqlConnector = undefined;
}
