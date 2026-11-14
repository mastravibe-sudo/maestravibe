"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageCircle, MoreVertical, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord } from "@/lib/profile-schema";
import { requestActivityPush } from "@/lib/notifications/client";
import ProfileRender from "@/components/ProfileRender";
import ProfilePostGrid from "@/components/ProfilePostGrid";
import ProfileMediaEditor from "@/components/profile/ProfileMediaEditor";

export default function ProfileView({
  profile,
  access,
  stats,
  isFollowing: initialFollowing,
}: {
  profile: ProfileRecord;
  access: { isOwner: boolean; canView: boolean; viewerId: string | null };
  stats: { followers: number; following: number };
  isFollowing: boolean;
}) {
  const router = useRouter();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);
  const [followError, setFollowError] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"avatar" | "banner" | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const theme = profile.theme;

  useEffect(() => {
    if (!access.viewerId || access.isOwner || !access.canView) return;
    void fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "profile_view", profileId: profile.id }),
    }).then((response) => {
      if (!response.ok) console.error("Profile visit notification failed.", response.status);
    }).catch(() => {
      console.error("Profile visit notification request failed.");
    });
  }, [access.canView, access.isOwner, access.viewerId, profile.id]);

  const handleFollowToggle = async () => {
    if (!access.viewerId || access.isOwner) return;
    setFollowError(null);
    const supabase = createClient();
    if (isFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", access.viewerId).eq("followed_id", profile.id);
      if (error) return setFollowError(error.message);
      setIsFollowing(false);
      setFollowerCount((count) => Math.max(count - 1, 0));
      return;
    }

    const { error } = await supabase.from("follows").insert({ follower_id: access.viewerId, followed_id: profile.id });
    if (error) return setFollowError(error.message);
    setIsFollowing(true);
    setFollowerCount((count) => count + 1);
    const pushError = await requestActivityPush({ type: "follow", profileId: profile.id });
    if (pushError) setFollowError(pushError);
  };

  const selectMedia = (target: "avatar" | "banner", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setFollowError("Choose an image or video from your gallery.");
      return;
    }
    setFollowError(null);
    setMediaTarget(target);
    setMediaFile(file);
  };

  const uploadMedia = async (image: Blob) => {
    if (!mediaTarget || !access.isOwner) return;
    setMediaSaving(true);
    setFollowError(null);
    try {
      const form = new FormData();
      form.append("purpose", "profile");
      form.append("imageType", mediaTarget);
      form.append("file", image, `${mediaTarget}.webp`);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json() as { publicUrl?: string; error?: string };
      if (!response.ok || !result.publicUrl) throw new Error(result.error || "Profile image upload failed.");

      const column = mediaTarget === "avatar" ? "avatar_url" : "banner_url";
      const { data: saved, error: saveError } = await createClient()
        .from("profiles")
        .update({ [column]: result.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();
      if (saveError) throw new Error(saveError.message);
      if (!saved) throw new Error("Profile image was uploaded, but the profile could not be updated.");

      setMediaFile(null);
      setMediaTarget(null);
      router.refresh();
    } catch (uploadError) {
      setFollowError(uploadError instanceof Error ? uploadError.message : "Profile image upload failed.");
    } finally {
      setMediaSaving(false);
    }
  };

  const BACKGROUND_IMAGE_BYTES = 1024 * 1024;
  const BACKGROUND_VIDEO_BYTES = 4 * 1024 * 1024;
  const BACKGROUND_VIDEO_SECONDS = 15;

  // Background image: 1920 px tak, sabse behtar WebP quality jo 1 MB mein fit ho.
  const compressBackground = (file: File) =>
    new Promise<Blob>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("This image could not be read. Use a JPG, PNG, or WebP file."));
      };
      img.onload = async () => {
        try {
          if (!img.naturalWidth || !img.naturalHeight) throw new Error("This image has no readable size.");
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Your browser could not prepare this image.");
          let scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
          while (scale >= 0.3) {
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            for (const quality of [0.92, 0.86, 0.8, 0.72, 0.64, 0.56]) {
              const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", quality));
              if (!blob || blob.type !== "image/webp") throw new Error("Could not compress this image.");
              if (blob.size <= BACKGROUND_IMAGE_BYTES) {
                resolve(blob);
                return;
              }
            }
            scale *= 0.85;
          }
          throw new Error("This image is too detailed to fit in 1 MB. Try a simpler image.");
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.src = url;
    });

  // Background video: dobara encode NAHI hoti. Sirf check hota hai, phir asal file upload hoti hai.
  const checkBackgroundVideo = (file: File) =>
    new Promise<File>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const finish = (action: () => void) => {
        URL.revokeObjectURL(url);
        action();
      };
      video.onerror = () => finish(() => reject(new Error("This video could not be read. Use MP4 (H.264) or WebM.")));
      video.onloadedmetadata = () => {
        if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) {
          finish(() => reject(new Error("This video could not be read. Use MP4 (H.264) or WebM.")));
          return;
        }
        if (video.duration > BACKGROUND_VIDEO_SECONDS) {
          finish(() => reject(new Error("Background videos must be " + BACKGROUND_VIDEO_SECONDS + " seconds or shorter.")));
          return;
        }
        finish(() => resolve(file));
      };
      video.src = url;
    });

  const uploadBackground = async (file?: File) => {
    if (!file || !access.isOwner) return;
    const isVideo = file.type === "video/mp4" || file.type === "video/webm";
    if (!isVideo && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFollowError("Choose a JPG, PNG, WebP image, or an MP4/WebM video.");
      return;
    }
    if (isVideo && file.size > BACKGROUND_VIDEO_BYTES) {
      setFollowError("Choose a video of " + Math.round(BACKGROUND_VIDEO_BYTES / 1024 / 1024) + " MB or less. Export it at about 1.5 to 2.5 Mbps (720p).");
      return;
    }
    setMediaSaving(true);
    setFollowError(null);
    try {
      const body = isVideo ? await checkBackgroundVideo(file) : await compressBackground(file);
      setBgStatus("Uploading background...");
      const form = new FormData();
      form.append("purpose", isVideo ? "profile-background-video" : "profile-background-image");
      form.append("file", body, isVideo ? (file.type === "video/webm" ? "background.webm" : "background.mp4") : "background.webp");
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json() as { publicUrl?: string; error?: string };
      if (!response.ok || !result.publicUrl) throw new Error(result.error || "Background upload failed.");

      const { data: saved, error: saveError } = await createClient()
        .from("profiles")
        .update({
          theme: {
            ...profile.theme,
            backgroundType: "image",
            backgroundValue: result.publicUrl,
            backgroundMediaType: isVideo ? "video" : "image",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();
      if (saveError) throw new Error(saveError.message);
      if (!saved) throw new Error("Background was uploaded, but the profile could not be updated.");
      router.refresh();
    } catch (uploadError) {
      setFollowError(uploadError instanceof Error ? uploadError.message : "Background upload failed.");
    } finally {
      setMediaSaving(false);
      setBgStatus(null);
    }
  };

  const goToPage = (page: number) => {
    const element = pagesRef.current;
    if (!element) return;
    element.scrollTo({ left: page * element.clientWidth, behavior: "smooth" });
    setActivePage(page);
  };

  if (!access.canView) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-10" style={{ background: theme.backgroundValue || theme.page, color: theme.text, fontFamily: theme.fontBody }}>
        <div className="max-w-lg border border-white/10 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-violet-200">Private profile</p>
          <h1 className="mt-4 text-3xl font-bold">This profile is private.</h1>
          <p className="mt-3 text-sm opacity-70">Follow this creator or log in to request access.</p>
        </div>
      </main>
    );
  }

  const editHref = `/${profile.username}?edit=1`;
  const action = access.isOwner ? (
    <div className="flex items-center gap-2">
      <Link href={editHref} className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold shadow-lg" style={{ color: theme.buttonText, background: theme.accent }}>
        Edit profile
      </Link>
      <div className="relative">
        <button
          type="button"
          aria-label="Profile menu"
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          onClick={() => setProfileMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white hover:bg-black/40"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {profileMenuOpen ? (
          <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#100d24] p-1 text-white shadow-xl">
            <Link role="menuitem" href={editHref} onClick={() => setProfileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-white/10">
              <Settings className="h-4 w-4 text-violet-300" /> Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                const { error } = await createClient().auth.signOut();
                if (error) {
                  setFollowError(error.message);
                  return;
                }
                router.push("/login");
                router.refresh();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-pink-200 hover:bg-pink-400/10"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {access.viewerId ? (
        <button onClick={() => void handleFollowToggle()} className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
          {isFollowing ? "Following" : "Follow"}
        </button>
      ) : (
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
          Follow
        </Link>
      )}
      <button
        type="button"
        onClick={() => access.viewerId ? router.push(`/inbox?user=${encodeURIComponent(profile.id)}`) : router.push("/login")}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-r from-violet-600 to-blue-600 px-4 text-sm font-semibold text-white hover:brightness-110"
      >
        <MessageCircle className="h-4 w-4" /> Message
      </button>
    </div>
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#07061a]">
      <div
        ref={pagesRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          setActivePage(Math.round(element.scrollLeft / element.clientWidth));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
        aria-label={`${profile.name || profile.username}'s profile pages`}
      >
        <section id="profile-page" aria-label="Profile" className="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-y-contain bg-[#07061a]">
          <div className="w-full px-0 py-5 pb-36 sm:py-8 sm:pb-36 md:pb-20">
            {followError ? <p role="alert" className="mb-3 rounded-lg border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{followError}</p> : null}
            {mediaSaving && !mediaFile ? <p role="status" className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">{bgStatus ?? "Uploading background..."}</p> : null}
            <ProfileRender
              profile={profile}
              stats={{ followers: followerCount, following: stats.following }}
              action={action}
              onAvatarClick={access.isOwner ? () => avatarInputRef.current?.click() : undefined}
              onBannerClick={access.isOwner ? () => bannerInputRef.current?.click() : undefined}
            />
          </div>
        </section>

        <section id="posts-page" aria-label="Posts" className="h-full w-full shrink-0 snap-start overflow-y-auto overscroll-y-contain bg-[#07061a] pb-36 text-white md:pb-20">
          <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-white/10 bg-[#07061a]/95 px-3 backdrop-blur sm:px-6">
            <button onClick={() => goToPage(0)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/85 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Profile
            </button>
            <h1 className="text-sm font-semibold">Posts</h1>
            <span className="w-[76px]" aria-hidden="true" />
          </div>
          <ProfilePostGrid profile={profile} viewerId={access.viewerId} />
        </section>
      </div>

      {access.isOwner ? (
        <>
          <input ref={avatarInputRef} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => {
            selectMedia("avatar", event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }} />
          <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="sr-only" onChange={(event) => {
            void uploadBackground(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }} />
        </>
      ) : null}
      {mediaFile && mediaTarget ? (
        <ProfileMediaEditor
          file={mediaFile}
          imageType={mediaTarget}
          saving={mediaSaving}
          onClose={() => {
            if (mediaSaving) return;
            setMediaFile(null);
            setMediaTarget(null);
          }}
          onSave={uploadMedia}
        />
      ) : null}

      <nav aria-label="Profile pages" className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#100d20]/90 px-4 py-2 shadow-xl backdrop-blur md:bottom-4">
        <button onClick={() => goToPage(0)} aria-label="Show profile page" aria-current={activePage === 0 ? "page" : undefined} className={`h-3 w-3 rounded-full transition ${activePage === 0 ? "scale-125 bg-violet-300" : "bg-white/35 hover:bg-white/70"}`} />
        <button onClick={() => goToPage(1)} aria-label="Show posts page" aria-current={activePage === 1 ? "page" : undefined} className={`h-3 w-3 rounded-full transition ${activePage === 1 ? "scale-125 bg-violet-300" : "bg-white/35 hover:bg-white/70"}`} />
        <button onClick={() => goToPage(activePage === 0 ? 1 : 0)} aria-label={activePage === 0 ? "Go to posts" : "Back to profile"} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          {activePage === 0 ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        </button>
      </nav>
    </main>
  );
}