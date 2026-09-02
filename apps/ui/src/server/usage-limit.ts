import "server-only";

import type { Pool } from "pg";
import type { SessionUser } from "@/server/auth";
import {
  getPendingChatLimit,
  getPendingEpisodeUploadLimit,
  getRateLimitHourly,
  getRateLimitDaily,
} from "@/server/env";

export type UsageAction = "chat" | "episode_upload";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function checkUsageAllowed(
  pool: Pool,
  user: SessionUser,
  action: UsageAction,
): Promise<UsageCheckResult> {
  if (user.approvalStatus === "pending_approval") {
    const limit =
      action === "chat"
        ? getPendingChatLimit()
        : getPendingEpisodeUploadLimit();
    const result = await pool.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM api_usage_logs
       WHERE user_id = $1 AND endpoint = $2`,
      [user.uid, action],
    );
    const count = parseInt(result.rows[0]?.count?.toString() ?? "0", 10);
    if (count >= limit) {
      return {
        allowed: false,
        reason: "お試し枠の上限に達しました。管理者の承認をお待ちください",
      };
    }
  } else if (action === "chat") {
    const hourlyLimit = getRateLimitHourly();
    const dailyLimit = getRateLimitDaily();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [hourlyResult, dailyResult] = await Promise.all([
      pool.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM api_usage_logs
         WHERE user_id = $1 AND endpoint = $2 AND called_at > $3`,
        [user.uid, action, oneHourAgo],
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM api_usage_logs
         WHERE user_id = $1 AND endpoint = $2 AND called_at > $3`,
        [user.uid, action, oneDayAgo],
      ),
    ]);

    const hourlyCount = parseInt(hourlyResult.rows[0]?.count?.toString() ?? "0", 10);
    const dailyCount = parseInt(dailyResult.rows[0]?.count?.toString() ?? "0", 10);

    if (hourlyCount >= hourlyLimit) {
      return {
        allowed: false,
        reason: "利用回数の上限に達しました。しばらくしてから再度お試しください",
      };
    }

    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        reason: "1日の利用回数の上限に達しました。明日以降にお試しください",
      };
    }
  }

  return { allowed: true };
}

export async function recordUsage(
  pool: Pool,
  userId: string,
  action: UsageAction,
): Promise<void> {
  await pool.query(
    `INSERT INTO api_usage_logs (user_id, endpoint, called_at)
     VALUES ($1, $2, now())`,
    [userId, action],
  );
}
