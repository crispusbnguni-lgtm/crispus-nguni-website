
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "goojiqcqybiposohhuin.supabase.co",
        pathname: "/storage/v1/object/public/welcome-page-media/**",
      },
    ],
  },
};

export default nextConfig;