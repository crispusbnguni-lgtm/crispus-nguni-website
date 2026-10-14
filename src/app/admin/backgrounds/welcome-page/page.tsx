import { requireSuperAdmin } from "@/lib/authorization";
import WelcomePageEditor from "./WelcomePageEditor";

export const dynamic = "force-dynamic";

export default async function WelcomePageAdmin() {
  await requireSuperAdmin();

  return (
    <main className="min-h-screen bg-[#05070D] px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Super Admin
        </a>

        <div className="mt-8">
          <WelcomePageEditor />
        </div>
      </div>
    </main>
  );
}