
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DisplayStudioEditor } from "@/components/admin/DisplayStudioEditor";

export default async function PersonalDisplayStudioPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen px-4 py-8 motion-reduce:scroll-auto md:px-8">
      <div className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
        <DisplayStudioEditor mode="personal" />
      </div>
    </main>
  );
}