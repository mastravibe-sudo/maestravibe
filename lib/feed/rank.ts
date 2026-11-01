import { mediaOf, type Row } from "@/components/PostViewer";

type VideoRankOptions = {
  followedIds: string[];
  watchedIds: string[];
};

type FeedKind = "video" | "image" | "text";

function videoId(row: Row): string {
  return row.original?.id ?? row.id;
}

function feedKind(row: Row): FeedKind {
  const media = mediaOf(row.original ?? row)[0];
  return media?.type ?? "text";
}

export function rankVideos(rows: Row[], { followedIds, watchedIds }: VideoRankOptions): Row[] {
  const followed = new Set(followedIds);
  const watched = new Set(watchedIds);
  const seen = new Set<string>();
  const now = Date.now();
  const remaining = rows
    .filter((row) => {
      const id = videoId(row);
      if (watched.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((row) => {
      const ageDays = Math.max(0, now - new Date(row.created_at).getTime()) / 86_400_000;
      const recency = 5 * Math.exp(-ageDays / 7);
      const engagement = Math.log1p(row.vibes.length) * 0.6 + Math.log1p(row.comments.length) * 0.9;
      const followedBoost = followed.has(row.user_id) ? 2 : 0;
      const shuffle = Math.random() * 0.2;
      return { row, score: recency + engagement + followedBoost + shuffle };
    })
    .sort((a, b) => b.score - a.score);

  const ranked: Row[] = [];
  let lastAuthor: string | null = null;
  let authorStreak = 0;

  while (remaining.length) {
    const nextIndex = remaining.findIndex(({ row }) => authorStreak < 2 || row.user_id !== lastAuthor);
    if (nextIndex < 0) break;

    const [{ row }] = remaining.splice(nextIndex, 1);
    ranked.push(row);
    authorStreak = row.user_id === lastAuthor ? authorStreak + 1 : 1;
    lastAuthor = row.user_id;
  }

  return ranked;
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
