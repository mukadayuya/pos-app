"use client";

// ─── VideoBackground ─────────────────────────────────────────────
// シズル動画背景コンポーネント。
// videoUrl がある場合は動画再生 + 減光オーバーレイ。
// ない場合は従来のグラデーション + 絵文字にフォールバック。
// IntersectionObserver でビューポート外は pause（バッテリー節約）。

import { useEffect, useRef, useState } from "react";

interface VideoBackgroundProps {
  videoUrl?: string;
  fallbackGradient: string;   // Tailwind gradient classes e.g. "from-violet-400 to-purple-500"
  emoji?: string;
  height?: string;            // Tailwind height class, default "h-48"
  overlayOpacity?: number;    // 0–1, default 0.45
}

export default function VideoBackground({
  videoUrl,
  fallbackGradient,
  emoji,
  height = "h-48",
  overlayOpacity = 0.45,
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Play/pause based on viewport visibility (battery-safe)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || videoError) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => setVideoError(true));
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [videoUrl, videoError]);

  const showVideo = videoUrl && !videoError;

  return (
    <div className={`relative ${height} overflow-hidden`}>
      {showVideo ? (
        <>
          {/* 動画レイヤー */}
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            loop
            playsInline
            autoPlay
            onCanPlayThrough={() => setVideoReady(true)}
            onError={() => setVideoError(true)}
            className={[
              "absolute inset-0 w-full h-full object-cover",
              "transition-opacity duration-700",
              videoReady ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
          {/* フォールバック（動画ロード中）*/}
          {!videoReady && (
            <div className={`absolute inset-0 bg-gradient-to-br ${fallbackGradient}`} />
          )}
          {/* 減光オーバーレイ — テキスト視認性確保 */}
          <div
            className="absolute inset-0"
            style={{ background: `rgba(0,0,0,${overlayOpacity})` }}
          />
          {/* ボトム・シズル・グラデーション */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        </>
      ) : (
        /* 静止画フォールバック */
        <div className={`absolute inset-0 bg-gradient-to-br ${fallbackGradient}`} />
      )}

      {/* 絵文字（最前面） */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={[
            "text-7xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]",
            "transition-opacity duration-500",
            showVideo && videoReady ? "opacity-80" : "opacity-100",
          ].join(" ")}
        >
          {emoji ?? "🍽️"}
        </span>
      </div>
    </div>
  );
}
