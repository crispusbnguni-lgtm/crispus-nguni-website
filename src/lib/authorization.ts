import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();

  if (user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return user;
}

export async function requirePortfolioOwner(userId: string) {
  const user = await requireUser();

  if (user.role === "SUPER_ADMIN") {
    return user;
  }

  if (user.id !== userId) {
    redirect("/dashboard");
  }

  return user;
}