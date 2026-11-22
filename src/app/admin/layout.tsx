
import type { CSSProperties, ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/authorization";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireSuperAdmin();

  // Use the signed-in Super Admin's existing dashboard wallpaper.
  const dashboardBackground =
    user?.portfolioSite?.dashboardBackground || "#05070D";

  const isImage = /^https?:\/\//i.test(dashboardBackground);

  const backgroundStyle: CSSProperties = {
    backgroundColor: isImage ? "#05070D" : dashboardBackground,
    ...(isImage
      ? {
          backgroundImage: `url("${dashboardBackground}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }
      : {}),
  };

  return (
    <div
      className="relative isolate min-h-screen overflow-clip bg-[#05070D]"
      style={backgroundStyle}
    >
      <AdminNavigation administratorName={user?.name?.trim() || "Super Admin"}>
        {children}
      </AdminNavigation>
    </div>
  );
}
