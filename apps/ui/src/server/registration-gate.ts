import "server-only";

import type { Pool } from "pg";
import { getGuestEmail, isAdminUser, isGuestModeEnabled } from "./env";
import { isEmailPreRegistered } from "./admin/pre-registered-emails-repository";

export const PRE_REGISTRATION_REQUIRED_MESSAGE =
  "このサービスは事前登録制です。利用をご希望の場合は下記までお問い合わせください";

// 新規登録は事前登録済みメールのみ許可する。
// 登録済みユーザは常に許可（後から事前登録リストを消しても影響しない）。
// 管理者メールは事前登録なしで許可。
// ゲストモード有効時はゲストメールも許可（退会等でゲスト行が消えた場合の自己修復）。
export async function isRegistrationAllowed(
  pool: Pool,
  user: { email: string; registered: boolean },
): Promise<boolean> {
  if (user.registered) return true;
  if (isAdminUser(user.email)) return true;
  if (isGuestModeEnabled() && user.email === getGuestEmail()) return true;
  return isEmailPreRegistered(pool, user.email);
}
