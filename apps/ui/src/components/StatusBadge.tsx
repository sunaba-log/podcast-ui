import { EpisodeStatus } from "@/types/episode";

const statusConfig: Record<EpisodeStatus, { label: string; className: string }> = {
  upload_pending: { label: "アップロード待ち", className: "bg-gray-100 text-gray-700" },
  uploaded: { label: "アップロード済み", className: "bg-blue-100 text-blue-800" },
  processing: { label: "処理中", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "完了", className: "bg-green-100 text-green-800" },
  failed: { label: "失敗", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: EpisodeStatus }) {
  const { label, className } = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
