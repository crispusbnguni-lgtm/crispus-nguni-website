
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { defaultWelcomePageContent } from "@/lib/welcome-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

type WelcomePageVersion = {
  content: JsonRecord;
  publishedAt: string;
};

const MAX_HISTORY = 20;

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getCmsMetadata(content: unknown): JsonRecord {
  if (!isRecord(content) || !isRecord(content.__cms)) {
    return {};
  }

  return content.__cms;
}

function getPublishedContent(content: unknown): JsonRecord {
  if (!isRecord(content)) {
    return defaultWelcomePageContent as unknown as JsonRecord;
  }

  const published: JsonRecord = {};

  for (const [key, value] of Object.entries(content)) {
    if (key !== "__cms") {
      published[key] = value;
    }
  }

  return Object.keys(published).length > 0
    ? published
    : (defaultWelcomePageContent as unknown as JsonRecord);
}

function getDraftContent(content: unknown): JsonRecord | null {
  const draft = getCmsMetadata(content).draft;
  return isRecord(draft) ? draft : null;
}

function getScheduledContent(content: unknown): JsonRecord | null {
  const scheduled = getCmsMetadata(content).scheduledContent;
  return isRecord(scheduled) ? scheduled : null;
}

function getScheduledAt(content: unknown): string | null {
  const value = getCmsMetadata(content).scheduledAt;

  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function getVersions(content: unknown): WelcomePageVersion[] {
  const history = getCmsMetadata(content).history;

  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter(
    (item): item is WelcomePageVersion =>
      isRecord(item) &&
      isRecord(item.content) &&
      typeof item.publishedAt === "string",
  );
}

function responseData(content: unknown) {
  const metadata = getCmsMetadata(content);
  const publishedContent = getPublishedContent(content);
  const draftContent = getDraftContent(content);
  const scheduledContent = getScheduledContent(content);
  const scheduledAt = getScheduledAt(content);

  return {
    publishedContent,
    draftContent,
    hasDraft: draftContent !== null,
    publishedAt:
      typeof metadata.publishedAt === "string"
        ? metadata.publishedAt
        : null,
    scheduledContent,
    scheduledAt,
    hasScheduledPublish:
      scheduledContent !== null && scheduledAt !== null,
    history: getVersions(content),
  };
}

async function saveContent(content: JsonRecord) {
  return prisma.welcomePageSettings.upsert({
    where: { key: "main" },
    create: {
      key: "main",
      content: content as Prisma.InputJsonObject,
    },
    update: {
      content: content as Prisma.InputJsonObject,
    },
  });
}

export async function GET() {
  try {
    await requireSuperAdmin();

    const settings = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    const stored =
      settings?.content ?? defaultWelcomePageContent;

    const data = responseData(stored);

    return NextResponse.json({
      success: true,
      content: data.draftContent ?? data.publishedContent,
      ...data,
    });
  } catch (error) {
    console.error("Failed to load welcome page settings:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load settings.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireSuperAdmin();

    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request.",
        },
        { status: 400 },
      );
    }

    const action =
      typeof body.action === "string" ? body.action : "draft";

    const allowedActions = [
      "draft",
      "publish",
      "restore",
      "schedule",
      "cancel_schedule",
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid action.",
        },
        { status: 400 },
      );
    }

    const needsContent = ["draft", "publish", "schedule"].includes(
      action,
    );

    if (needsContent && !isRecord(body.content)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid welcome page content is required.",
        },
        { status: 400 },
      );
    }

    if (
      action === "restore" &&
      typeof body.versionPublishedAt !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Select a valid version to restore.",
        },
        { status: 400 },
      );
    }

    let scheduledAt: string | null = null;

    if (action === "schedule") {
      if (typeof body.scheduledAt !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Choose a publication date and time.",
          },
          { status: 400 },
        );
      }

      const parsedDate = new Date(body.scheduledAt);

      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "The scheduled date and time are invalid.",
          },
          { status: 400 },
        );
      }

      if (parsedDate.getTime() <= Date.now()) {
        return NextResponse.json(
          {
            success: false,
            message: "Choose a future publication date and time.",
          },
          { status: 400 },
        );
      }

      scheduledAt = parsedDate.toISOString();
    }

    const existing = await prisma.welcomePageSettings.findUnique({
      where: { key: "main" },
    });

    const stored =
      existing?.content ?? defaultWelcomePageContent;

    const publishedContent = getPublishedContent(stored);
    const previousMetadata = getCmsMetadata(stored);
    const history = getVersions(stored);
    const previousDraft = getDraftContent(stored);
    const now = new Date().toISOString();

    let nextStoredContent: JsonRecord;
    let message: string;

    if (action === "restore") {
      const selectedVersion = history.find(
        (version) =>
          version.publishedAt === body.versionPublishedAt,
      );

      if (!selectedVersion) {
        return NextResponse.json(
          {
            success: false,
            message:
              "That version was not found in saved history. Refresh and try again.",
          },
          { status: 404 },
        );
      }

      nextStoredContent = {
        ...publishedContent,
        __cms: {
          ...previousMetadata,
          draft: selectedVersion.content,
          history,
        },
      };

      // A restored draft should not leave an old scheduled
      // publication waiting to publish different content.
      delete (
        nextStoredContent.__cms as JsonRecord
      ).scheduledContent;
      delete (
        nextStoredContent.__cms as JsonRecord
      ).scheduledAt;

      message =
        "Version restored to your draft. Review it and publish when ready.";
    } else if (action === "draft") {
      nextStoredContent = {
        ...publishedContent,
        __cms: {
          ...previousMetadata,
          draft: body.content as JsonRecord,
          history,
        },
      };

      message =
        "Draft saved. Your live homepage is unchanged.";
    } else if (action === "schedule") {
      const metadata: JsonRecord = {
        ...previousMetadata,
        scheduledContent: body.content as JsonRecord,
        scheduledAt,
        history,
      };

      // Keep the existing draft if there is one.
      // The scheduled content is stored separately.
      nextStoredContent = {
        ...publishedContent,
        __cms: metadata,
      };

      message =
        `Publication scheduled for ${scheduledAt}. Automatic publication still needs to be connected to a scheduler.`;
    } else if (action === "cancel_schedule") {
      nextStoredContent = {
        ...publishedContent,
        __cms: {
          ...previousMetadata,
          history,
        },
      };

      delete (
        nextStoredContent.__cms as JsonRecord
      ).scheduledContent;
      delete (
        nextStoredContent.__cms as JsonRecord
      ).scheduledAt;

      message =
        "Scheduled publication cancelled. Your live homepage is unchanged.";
    } else if (action === "publish") {
      const nextHistory: WelcomePageVersion[] = [
        {
          content: publishedContent,
          publishedAt:
            typeof previousMetadata.publishedAt === "string"
              ? previousMetadata.publishedAt
              : now,
        },
        ...history,
      ].slice(0, MAX_HISTORY);

      nextStoredContent = {
        ...(body.content as JsonRecord),
        __cms: {
          ...previousMetadata,
          publishedAt: now,
          history: nextHistory,
        },
      };

      const metadata = nextStoredContent.__cms as JsonRecord;

      // Clear stale draft and scheduled publication after
      // publishing new content immediately.
      delete metadata.draft;
      delete metadata.scheduledContent;
      delete metadata.scheduledAt;

      message = "Welcome page published successfully.";
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported action.",
        },
        { status: 400 },
      );
    }

    const settings = await saveContent(nextStoredContent);
    const data = responseData(settings.content);

    return NextResponse.json({
      success: true,
      message,
      action,
      content:
        action === "publish"
          ? data.publishedContent
          : data.draftContent ?? data.publishedContent,
      ...data,
      previousDraft,
    });
  } catch (error) {
    console.error("Failed to save welcome page settings:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to save, publish, restore, or schedule settings.",
      },
      { status: 500 },
    );
  }
}