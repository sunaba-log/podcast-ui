import { Episode } from "@/types/episode";

export const mockEpisodes: Episode[] = [
  {
    id: "ep-001",
    podcastId: 1,
    title: "AIとポッドキャストの未来について語る",
    description: "",
    createdAt: "2026-06-01T10:00:00Z",
    status: "completed",
    audioFileName: "episode-001.mp3",
    audioUrl: null,
    artworkUrl: null,
    processingError: null,
    minutesGenerated: true,
    xPostsGenerated: true,
    seedsGenerated: true,
    minutes: `## エピソード議事録

**収録日：** 2026年6月1日

### 概要
今回はAI技術がポッドキャスト制作にどのような変革をもたらすかについて議論しました。

### 主なトピック

1. **AI音声合成の進化**
   - 最新の音声合成技術により、ほぼ人間と区別がつかない音声生成が可能に
   - ポッドキャスト制作コストの大幅削減が期待される

2. **コンテンツ自動生成**
   - 台本の自動生成から編集まで、AIがサポート
   - クリエイターがより創造的な作業に集中できる環境へ

3. **リスナーとのエンゲージメント**
   - AIによるパーソナライズされたコンテンツ推薦
   - リアルタイムフィードバック分析の活用

### まとめ
AI技術の進化により、ポッドキャスト制作の民主化が加速しています。`,
    xPosts: [
      { id: "mock-1", message: "🎙️ 新エピソード公開！「AIとポッドキャストの未来」について熱く語りました。", status: "pending", scheduledTime: null },
      { id: "mock-2", message: "AIがポッドキャスト制作を変えつつあります。", status: "pending", scheduledTime: null },
    ],
    conversationSeeds: [
      "AIが生成した音声と人間の声を聴き比べたとき、どこで「違和感」を感じますか？その違和感はなくなると思いますか？",
      "ポッドキャストの「個性」はどこから生まれると思いますか？AIが制作を担った場合、その個性は維持できるでしょうか？",
      "コンテンツ制作でAIに任せたい部分と、絶対に自分でやりたい部分はどこですか？",
      "過去のエピソードを振り返ると、「あのときのリスナーの反応が意外だった」という経験はありますか？",
    ],
  },
  {
    id: "ep-002",
    podcastId: 1,
    title: "スタートアップ創業期のリアルな話",
    description: "",
    createdAt: "2026-05-28T14:30:00Z",
    status: "completed",
    audioFileName: "episode-002.mp3",
    audioUrl: null,
    artworkUrl: null,
    processingError: null,
    minutesGenerated: true,
    xPostsGenerated: true,
    seedsGenerated: false,
    minutes: `## エピソード議事録

**収録日：** 2026年5月28日

### 概要
スタートアップを立ち上げた経験者をゲストに迎え、創業初期の苦労と学びについて語り合いました。

### 主なトピック

1. **資金調達の現実**
   - シードラウンドで直面した壁
   - 投資家へのピッチで重要だったこと

2. **チーム構築**
   - 最初の採用でミスしたこと
   - カルチャーフィットの重要性

3. **プロダクトマーケットフィット**
   - ピボットの決断と実行
   - 顧客の声を聞くことの大切さ

### まとめ
失敗を恐れずに動き続けることが、スタートアップ成功の鍵だと学びました。`,
    xPosts: [
      { id: "mock-3", message: "🚀 スタートアップ創業のリアルをゲストと語り合いました。", status: "pending", scheduledTime: null },
    ],
    conversationSeeds: [],
  },
  {
    id: "ep-003",
    podcastId: 1,
    title: "リモートワーク3年目の本音",
    description: "",
    createdAt: "2026-05-20T09:00:00Z",
    status: "processing",
    audioFileName: "episode-003.mp3",
    audioUrl: null,
    artworkUrl: null,
    processingError: null,
    minutesGenerated: false,
    xPostsGenerated: false,
    seedsGenerated: false,
    minutes: "",
    xPosts: [],
    conversationSeeds: [],
  },
  {
    id: "ep-004",
    podcastId: 1,
    title: "エンジニアのキャリアパスを考える",
    description: "",
    createdAt: "2026-05-15T16:00:00Z",
    status: "uploaded",
    audioFileName: "episode-004.mp3",
    audioUrl: null,
    artworkUrl: null,
    processingError: null,
    minutesGenerated: false,
    xPostsGenerated: false,
    seedsGenerated: false,
    minutes: "",
    xPosts: [],
    conversationSeeds: [],
  },
  {
    id: "ep-005",
    podcastId: 1,
    title: "デザインとエンジニアリングの境界線",
    description: "",
    createdAt: "2026-05-10T11:00:00Z",
    status: "failed",
    audioFileName: "episode-005.mp3",
    audioUrl: null,
    artworkUrl: null,
    processingError: "音声処理に失敗しました",
    minutesGenerated: false,
    xPostsGenerated: false,
    seedsGenerated: false,
    minutes: "",
    xPosts: [],
    conversationSeeds: [],
  },
];
