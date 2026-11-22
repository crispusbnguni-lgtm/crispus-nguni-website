"use client";

import WelcomePageBackground from "@/components/welcome-page/WelcomePageBackground";

type Props = {
  backgroundImage: string;
  backgroundColor: string;
  backgroundPosition?: string;
};

/** Compatibility wrapper for authentication routes using the shared site background. */
export default function WelcomeAuthBackground(props: Props) {
  return <WelcomePageBackground {...props} />;
}
