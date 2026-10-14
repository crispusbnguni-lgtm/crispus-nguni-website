
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  const dashboardBackground =
    user?.portfolioSite?.dashboardBackground || "#05070D";

  const isImage = /^https?:\/\//i.test(dashboardBackground);

  return (
    <div
      className="relative isolate min-h-screen overflow-clip bg-[#05070D] text-white"
      style={{
        backgroundColor: isImage ? "#05070D" : dashboardBackground,
        ...(isImage
          ? {
              backgroundImage: `url("${dashboardBackground}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }
          : {}),
      }}
    >
      {/* Ambient liquid-glass lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-500/[0.12] blur-[120px]" />

        <div className="absolute -right-40 top-[15%] h-[30rem] w-[30rem] rounded-full bg-cyan-400/[0.08] blur-[140px]" />

        <div className="absolute bottom-[-12rem] left-[30%] h-[28rem] w-[28rem] rounded-full bg-[#D9A441]/[0.07] blur-[130px]" />

        <div className="absolute inset-0 bg-gradient-to-b from-[#05070D]/35 via-[#05070D]/15 to-[#05070D]/65" />

        {isImage && (
          <div className="absolute inset-0 bg-[#05070D]/45" />
        )}
      </div>

      {/* Shared dashboard navigation */}
      <div className="relative z-50">
        <DashboardTopNav />
      </div>

      {/* Dashboard content */}
      <main className="relative z-0 min-h-[calc(100vh-5rem)]">
        {children}
      </main>
    </div>
  );
}