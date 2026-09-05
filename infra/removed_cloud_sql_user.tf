# Cloud SQL 撤去（#90 Stage 5）の後始末。
#
# #161 の apply で google_sql_user.podcast の削除が以下で失敗し、依存関係により
# インスタンス本体の削除までブロックされた。
#
#   Error: failed to delete user podcast_app in instance
#   podcast-automator-postgres-prod: role "podcast_app" cannot be dropped
#   because some objects depend on it Details: 10 objects in database podcast.
#
# インスタンスごと削除するのだから、ユーザーを個別に DROP する必要はない。
# removed ブロック（destroy = false）で API を呼ばずに state から外し、
# インスタンスの destroy を通す。ユーザーはインスタンス削除で一緒に消える。
#
# インスタンス削除の apply が完了したら、このファイルは削除してよい。
removed {
  from = google_sql_user.podcast

  lifecycle {
    destroy = false
  }
}
