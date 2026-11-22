import { taskDelete, taskMove, taskPatch } from "@/lib/personal-workspace-planning-routes";
export const dynamic = "force-dynamic";
export const PATCH = taskPatch;
export const POST = taskMove;
export const DELETE = taskDelete;
