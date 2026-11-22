import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireSameOriginApiRequest } from "@/lib/authorization";
import { normalizeIntelligencePermissions } from "@/lib/personal-intelligence-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: HEADERS }); }
async function readBody(request: Request, limit: number): Promise<string | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); return null; } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginApiRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ success: false, message: "The shared Intelligence model is not configured. Set OPENAI_API_KEY on the server to enable tutoring." }, 503);
  let input: unknown;
  try { const body = await readBody(request, 12_000); if (body === null) return json({ success: false, message: "Tutoring request is too large." }, 413); input = JSON.parse(body); } catch { return json({ success: false, message: "Invalid tutoring request." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return json({ success: false, message: "Invalid tutoring request." }, 400);
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["courseId", "topic", "question", "level", "helpMode", "resourceIds"].includes(key))) return json({ success: false, message: "Unsupported tutoring field." }, 400);
  const { courseId, topic, question, level, helpMode, resourceIds } = value;
  if (typeof courseId !== "string" || typeof topic !== "string" || !topic.trim() || topic.length > 180 || typeof question !== "string" || !question.trim() || question.length > 3000 || !["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(String(level)) || !["HINT", "EXPLAIN", "PRACTICE", "MOCK_CAT", "CHECK_ANSWER"].includes(String(helpMode)) || !Array.isArray(resourceIds) || resourceIds.length > 5 || resourceIds.some((id) => typeof id !== "string" || id.length > 80)) return json({ success: false, message: "Choose a course, topic, learning level, and a question within the limits." }, 400);
  try {
    const workspace = await prisma.personalWorkspace.findUnique({ where: { userId: auth.user.id }, select: { id: true, intelligencePermissions: true } });
    if (!workspace || !normalizeIntelligencePermissions(workspace.intelligencePermissions).ACADEMICS) return json({ success: false, message: "Enable the Academics permission in Personal Intelligence before requesting tutoring." }, 403);
    const course = await prisma.academicCourse.findFirst({ where: { id: courseId, workspaceId: workspace.id, archivedAt: null, academicYear: { archivedAt: null } }, select: { id: true, name: true, code: true, description: true, academicYear: { select: { name: true } }, terms: { where: { term: { isCurrent: true, archivedAt: null } }, take: 1, select: { term: { select: { name: true } } } } } });
    if (!course) return json({ success: false, message: "Course was not found in your active academic records." }, 404);
    const resources = resourceIds.length ? await prisma.academicKnowledgeResource.findMany({ where: { workspaceId: workspace.id, courseId: course.id, id: { in: resourceIds as string[] } }, select: { id: true, title: true, topic: true, description: true, searchableText: true } }) : [];
    if (resources.length !== resourceIds.length) return json({ success: false, message: "One or more selected resources are unavailable for this course." }, 404);
    const resourceContext = resources.map((resource) => `RESOURCE ${resource.id}: ${resource.title}${resource.topic ? ` | topic: ${resource.topic}` : ""}${resource.description ? ` | description: ${resource.description}` : ""}\nUSER-PROVIDED EXTRACT (may be incomplete):\n${(resource.searchableText ?? "No searchable extract supplied.").slice(0, 12_000)}`).join("\n\n");
    const instructions = [
      "You are the tutoring capability of the user's existing Personal Intelligence system. Tutor respectfully and use clear step-by-step reasoning for mathematics.",
      "The selected course, year and term are verified records. The course description and resource text are user-provided and may be incomplete. Never claim that general subject knowledge is an official syllabus or Moi University announcement.",
      "When resources are supplied, prefer them for course-specific claims and cite them inline using [R:<resource-id>]. If material is insufficient, say so and label any explanation as general subject knowledge.",
      "For HINT mode, give a hint only and do not reveal the complete solution. For CHECK_ANSWER, identify errors from the submitted work without assuming omitted steps. For PRACTICE or MOCK_CAT, write original questions based on the requested topic and mark them as AI-generated practice, not official past papers.",
      `Course (verified): ${course.code ? `${course.code} — ` : ""}${course.name}; year: ${course.academicYear.name}; current term: ${course.terms[0]?.term.name ?? "not recorded"}.`,
      `Course description (owner-entered, not independently verified): ${course.description ?? "Not supplied."}`,
      `Selected topic: ${topic.trim()}. Learning level: ${String(level).toLowerCase()}. Requested mode: ${helpMode}.`,
      `Selected course resources:\n${resourceContext || "No course resources selected."}`,
      "Use readable Markdown and LaTeX delimiters for equations. Do not invent course-material references or academic records.",
    ].join("\n\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions, input: question.trim(), max_output_tokens: 1800, store: false }),
      signal: AbortSignal.timeout(45_000), cache: "no-store",
    });
    if (!response.ok) return json({ success: false, message: "The shared Intelligence provider could not complete the tutoring request." }, 502);
    const result = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
    const answer = (result.output ?? []).flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
    if (!answer || answer.length > 16_000) return json({ success: false, message: "The tutoring response was empty or exceeded the display limit." }, 502);
    return json({ success: true, answer, course: { id: course.id, name: course.name, code: course.code }, topic: topic.trim(), mode: helpMode, references: resources.map(({ id, title, topic: resourceTopic }) => ({ id, title, topic: resourceTopic })) });
  } catch {
    return json({ success: false, message: "Tutoring is temporarily unavailable. No answer was saved." }, 503);
  }
}
