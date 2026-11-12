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

  const compressBackground = (file: File) =>
    new Promise<Blob>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          if (!img.naturalWidth || !img.naturalHeight) throw new Error("This image has no readable size.");
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(img.naturalWidth, 1600);
          canvas.height = Math.round(img.naturalHeight * (canvas.width / img.naturalWidth));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Your browser could not prepare this image.");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => (blob && blob.type === "image/webp" ? resolve(blob) : reject(new Error("Could not compress this image."))),
            "image/webp",
            0.82,
          );
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("This image could not be read. Use a JPG, PNG, or WebP file."));
      };
      img.src = url;
    });

  // Re-encodes the first 5 seconds as a small WebM (no audio, max 720px wide).
  const compressVideo = async (file: File): Promise<File> => {
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
      (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
    );
    if (!mimeType || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
      if (file.size <= 600 * 1024) return file;
      throw new Error("This browser cannot compress video. Use a clip under 500 KB.");
    }

    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("This video could not be played. Use MP4 or WebM."));
        video.src = url;
      });
      if (!video.videoWidth || !video.videoHeight) throw new Error("This video has no readable size.");

      const width = Math.min(video.videoWidth, 720);
      const height = Math.round(video.videoHeight * (width / video.videoWidth));
      const canvas = document.createElement("canvas");
      canvas.width = width - (width % 2);
      canvas.height = height - (height % 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser could not prepare this video.");

      const seconds = Math.min(5, Number.isFinite(video.duration) ? video.duration : 5);
      let smallest: Blob | null = null;

      for (const bitrate of [850000, 650000, 450000]) {
        setBgStatus(`Compressing video (${Math.round(bitrate / 1000)} kbps)...`);
        const blob = await new Promise<Blob>((resolve, reject) => {
          const stream = canvas.captureStream(24);
          const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
          const chunks: Blob[] = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
          };
          recorder.onerror = () => reject(new Error("Video compression failed."));
          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            resolve(new Blob(chunks, { type: "video/webm" }));
          };
          const draw = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (video.currentTime >= seconds - 0.05 || video.ended) {
              video.pause();
              recorder.stop();
              return;
            }
            requestAnimationFrame(draw);
          };
          video.currentTime = 0;
          recorder.start();
          video.play().then(() => requestAnimationFrame(draw)).catch(() => reject(new Error("This video could not be played.")));
        });
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= 520 * 1024) break;
      }

      if (!smallest || smallest.size === 0) throw new Error("Video compression failed.");
      if (smallest.size > 1024 * 1024) throw new Error("This video is too complex to compress small enough. Try a simpler clip.");
      return new File([smallest], "background.webm", { type: "video/webm" });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const uploadBackground = async (file?: File) => {
    if (!file || !access.isOwner) return;
    const isVideo = file.type === "video/mp4" || file.type === "video/webm";
    if (!isVideo && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFollowError("Choose a JPG, PNG, WebP image, or an MP4/WebM video.");
      return;
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      setFollowError("Choose a video smaller than 50 MB.");
      return;
    }
    setMediaSaving(true);
    setFollowError(null);
    try {
      const body = isVideo ? await compressVideo(file) : await compressBackground(file);
      setBgStatus("Uploading background...");
      const form = new FormData();
      form.append("purpose", isVideo ? "profile-background-video" : "profile-background-image");
      form.append("file", body, isVideo ? "background.webm" : "background.webp");
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