export type ActivityPush =
  | { type: "vibe" | "comment"; postId: string }
  | { type: "follow"; profileId: string }
  | { type: "message"; messageId: string }
  | { type: "status"; statusId: string };

export async function requestActivityPush(activity: ActivityPush): Promise<string | null> {
  try {
    const response = await fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activity),
    });
    if (response.ok) return null;
    const result = await response.json() as { error?: string };
    return result.error || "Push notification delivery failed.";
  } catch {
    return "Push notification request failed.";
  }
}
