type SubscribeResult = { permission: NotificationPermission };

function applicationServerKey(base64Key: string) {
  const padded = base64Key + "=".repeat((4 - base64Key.length % 4) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)) as BufferSource;
}

export async function subscribeToWebPush(): Promise<SubscribeResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    const installed = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean(navigator.standalone));
    if (!installed) throw new Error("Install Maestra Vibe on your Home Screen first, then enable notifications here.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push is not configured yet. Add the VAPID public key and reload.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { permission };

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicKey),
  });
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) {
    if (!existing) await subscription.unsubscribe();
    throw new Error(result.error?.includes("push_subscriptions")
      ? "Run the Web Push SQL migration before enabling notifications."
      : result.error || "Could not save this device subscription.");
  }

  return { permission };
}
