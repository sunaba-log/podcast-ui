import "server-only";

import type { Pool } from "pg";

export interface PreRegisteredEmail {
  email: string;
  createdAt: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listPreRegisteredEmails(
  pool: Pool,
): Promise<PreRegisteredEmail[]> {
  const result = await pool.query<{ email: string; created_at: string }>(
    `SELECT email, created_at
     FROM pre_registered_emails
     ORDER BY created_at ASC`,
  );
  return result.rows.map((row) => ({
    email: row.email,
    createdAt: row.created_at,
  }));
}

export async function addPreRegisteredEmail(
  pool: Pool,
  email: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO pre_registered_emails (email)
     VALUES ($1)
     ON CONFLICT (email) DO NOTHING`,
    [normalizeEmail(email)],
  );
}

export async function removePreRegisteredEmail(
  pool: Pool,
  email: string,
): Promise<void> {
  await pool.query("DELETE FROM pre_registered_emails WHERE email = $1", [
    normalizeEmail(email),
  ]);
}

export async function isEmailPreRegistered(
  pool: Pool,
  email: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM pre_registered_emails WHERE email = $1",
    [normalizeEmail(email)],
  );
  return (result.rowCount ?? 0) > 0;
}
