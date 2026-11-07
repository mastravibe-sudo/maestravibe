import { mediaOf, type Row } from "@/components/PostViewer";

type VideoRankOptions = {
  followedIds: string[];
  watchedIds: string[];
};

type FeedKind = "video" | "image" | "text";

function feedKind(row: Row): FeedKind {
  const media = mediaOf(row.original ?? row)[0];
  return media?.type ?? "text";
}

export function rankVideos(rows: Row[], { followedIds, watchedIds }: VideoRankOptions): Row[] {
  const followed = new Set(followedIds);
  const watched = new Set(watchedIds);
  const now = Date.now();
  return rows
    .map((row, index) => {
      const ageDays = Math.max(0, now - new Date(row.created_at).getTime()) / 86_400_000;
      const recency = 5 * Math.exp(-ageDays / 7);
      const engagement = Math.log1p(row.vibes.length) * 0.6 + Math.log1p(row.comments.length) * 0.9;
      const followedBoost = followed.has(row.user_id) ? 2 : 0;
      const unseenBoost = watched.has(row.original?.id ?? row.id) ? 0 : 1000;
      return { row, index, score: unseenBoost + recency + engagement + followedBoost };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ row }) => row);
}

export function diversifyFeed(rows: Row[]): Row[] {
  const remaining = [...rows];
  const mixed: Row[] = [];

  while (remaining.length) {
    const nextIndex = remaining.findIndex((row) => {
      const kind = feedKind(row);
      const last = mixed.slice(-2);
      return last.length < 2 || last.some((previous) => feedKind(previous) !== kind);
    });
    mixed.push(remaining.splice(nextIndex < 0 ? 0 : nextIndex, 1)[0]);
  }

  return mixed;
}
