
import type { Metadata } from "next";
import "./globals.css";

import { ReaderProvider } from "@/components/ui/ReaderProvider";
import { PageTransition } from "@/components/ui/PageTransition";
import { OpportunityReveal } from "@/components/animations/OpportunityReveal";
import { ThemeInitializer } from "@/components/ui/ThemeInitializer";

export const metadata: Metadata = {
  title: "Crispus Nguni | Your Work. Your Story.",
  description:
    "Build your professional portfolio, showcase your skills, and unlock your next opportunity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeInitializer />

        <ReaderProvider>
          <OpportunityReveal />
          <PageTransition>{children}</PageTransition>
        </ReaderProvider>
      </body>
    </html>
  );
}