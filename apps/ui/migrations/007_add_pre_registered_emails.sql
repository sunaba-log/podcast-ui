-- 事前登録メールアドレス。このリストにあるメールのみ新規ユーザ登録できる
-- （管理者メールは事前登録なしで登録可能。登録済みユーザには影響しない）。
CREATE TABLE IF NOT EXISTS pre_registered_emails (
  email VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
