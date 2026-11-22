
"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { useReader } from "@/components/ui/ReaderProvider";

type Props = {
  backgroundImage: string;
  backgroundColor: string;
  backgroundPosition?: string;
  contained?: boolean;
};

function safeColor(value: string) {
  return /^#[\da-f]{6}$/i.test(value) ? value : "#05070D";
}

function safeMediaUrl(value: string) {
  if (!value || value.length > 2_048) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function safePosition(value: string | undefined) {
  if (!value || value.length > 48) return "center center";
  return /^(?:center|left|right|top|bottom|\d{1,3}(?:\.\d+)?%)(?:\s+(?:center|left|right|top|bottom|\d{1,3}(?:\.\d+)?%))?$/.test(value)
    ? value
    : "center center";
}

export default function WelcomePageBackground({
  backgroundImage,
  backgroundColor,
  backgroundPosition,
  contained = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const reader = useReader();

  const color = safeColor(backgroundColor);
  const mediaUrl = safeMediaUrl(backgroundImage);
  const isVideo = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(mediaUrl);
  const mayAnimateVideo =
    reduceMotion === false && !reader.preferences.reduceMotion;

  // A failed URL remains failed only while that same URL is selected.
  const [failedMediaUrl, setFailedMediaUrl] = useState<string | null>(null);
  const mediaFailed = failedMediaUrl === mediaUrl;

  return (
    <div
      aria-hidden="true"
      className={`welcome-background pointer-events-none ${contained ? "absolute" : "fixed"} inset-0 z-0 overflow-hidden`}
      style={
        {
          backgroundColor: color,
          "--welcome-configured-background": color,
        } as CSSProperties
      }
    >
      {mediaUrl && !mediaFailed &&
        (isVideo ? (
          <video
            autoPlay={mayAnimateVideo}
            muted
            loop={mayAnimateVideo}
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: safePosition(backgroundPosition) }}
            onError={() => setFailedMediaUrl(mediaUrl)}
          >
            <source src={mediaUrl} />
          </video>
        ) : (
          <Image
            src={mediaUrl}
            alt=""
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: safePosition(backgroundPosition) }}
            onError={() => setFailedMediaUrl(mediaUrl)}
          />
        ))}

      <div
        className="welcome-background-overlay absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,7,13,0.30), rgba(5,7,13,0.68))",
        }}
      />
    </div>
  );
}
