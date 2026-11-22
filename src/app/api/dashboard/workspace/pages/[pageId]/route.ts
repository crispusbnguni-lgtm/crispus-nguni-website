import { pageDelete, pageGet, pagePatch } from "@/lib/personal-workspace-route-handlers";

export const dynamic = "force-dynamic";
export const GET = pageGet;
export const PATCH = pagePatch;
export const DELETE = pageDelete;
