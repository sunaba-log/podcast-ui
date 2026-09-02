import "server-only";

import type { Pool } from "pg";

export type ApprovalStatus = "pending_approval" | "active";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string | null;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export async function listUsers(pool: Pool): Promise<AdminUser[]> {
  const result = await pool.query<{
    user_id: string;
    email: string;
    display_name: string | null;
    approval_status: string;
    created_at: string;
  }>(
    `SELECT user_id, email, display_name, approval_status, created_at
     FROM users
     ORDER BY created_at ASC`,
  );

  return result.rows.map((row) => ({
    uid: row.user_id,
    email: row.email,
    displayName: row.display_name,
    approvalStatus:
      row.approval_status === "active" ? "active" : "pending_approval",
    createdAt: row.created_at,
  }));
}

export async function getUserEmail(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const result = await pool.query<{ email: string }>(
    "SELECT email FROM users WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.email ?? null;
}

export async function setApprovalStatus(
  pool: Pool,
  userId: string,
  status: ApprovalStatus,
): Promise<void> {
  await pool.query(
    `UPDATE users SET approval_status = $2 WHERE user_id = $1`,
    [userId, status],
  );
}

export async function deleteUser(pool: Pool, userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM podcast_ownerships WHERE user_id = $1",
      [userId],
    );
    await client.query("DELETE FROM users WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
