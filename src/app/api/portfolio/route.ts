
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOriginApiRequest } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { isValidIanaTimezone } from "@/lib/consultations/availability";
import {
  safePortfolioBackground,
  safePortfolioExternalLink,
  safePortfolioImageUrl,
  safePortfolioPhoneHref,
} from "@/lib/portfolio-public";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function getAdminUserId(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("adminUserId")?.trim() || "";
}

async function getTargetUserId(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      targetUserId: null,
      error: NextResponse.json(
        { success: false, message: "You must be logged in." },
        { status: 401, headers: NO_STORE_HEADERS }
      ),
    };
  }

  const adminUserId = getAdminUserId(request);

  // Only SUPER_ADMIN can manage another user's portfolio.
  if (adminUserId && user.role !== "SUPER_ADMIN") {
    return {
      user,
      targetUserId: null,
      error: NextResponse.json(
        {
          success: false,
          message: "You are not authorized to manage this portfolio.",
        },
        { status: 403, headers: NO_STORE_HEADERS }
      ),
    };
  }

  return {
    user,
    targetUserId: adminUserId || user.id,
    error: null,
  };
}

export async function GET(request: Request) {
  try {
    const { user, targetUserId, error } =
      await getTargetUserId(request);

    if (error || !user || !targetUserId) {
      return (
        error ||
        NextResponse.json(
          {
            success: false,
            message: "Unable to determine portfolio owner.",
          },
          { status: 400 }
        )
      );
    }

    const portfolio = await prisma.portfolioSite.findUnique({
      where: { userId: targetUserId },
    });

    if (!portfolio) {
      return NextResponse.json(
        { success: false, message: "Portfolio not found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return noStoreJson({ success: true, portfolio });
  } catch (error) {
    console.error("Portfolio GET error:", error);

    return noStoreJson(
      { success: false, message: "Unable to load portfolio." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const originResponse = requireSameOriginApiRequest(request);
    if (originResponse) {
      originResponse.headers.set("Cache-Control", "no-store");
      return originResponse;
    }

    const { user, targetUserId, error } =
      await getTargetUserId(request);

    if (error || !user || !targetUserId) {
      return (
        error ||
        noStoreJson(
          {
            success: false,
            message: "Unable to determine portfolio owner.",
          },
          { status: 400 }
        )
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return noStoreJson(
        { success: false, message: "Invalid portfolio details." },
        { status: 400 },
      );
    }
    const input = body as Record<string, unknown>;

    const readText = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const name = readText(input.name);
    const title = readText(input.title);
    const bio = readText(input.bio);
    const location = readText(input.location);
    const timezone = typeof input.timezone === "string" ? input.timezone.trim() : undefined;
    const currentPortfolio = await prisma.portfolioSite.findUnique({
      where: { userId: targetUserId },
      select: { timezoneReviewRequired: true },
    });
    if (!currentPortfolio) {
      return noStoreJson({ success: false, message: "Portfolio not found." }, { status: 404 });
    }
    if (timezone !== undefined && !isValidIanaTimezone(timezone)) {
      return noStoreJson({ success: false, message: "Enter a valid IANA timezone, for example Africa/Nairobi." }, { status: 400 });
    }
    const phone = readText(input.phone);
    const website = readText(input.website);
    const profileImage = readText(input.profileImage);
    const linkedin = readText(input.linkedin);
    const instagram = readText(input.instagram);
    const facebook = readText(input.facebook);
    const youtube = readText(input.youtube);
    const tiktok = readText(input.tiktok);
    const whatsapp = readText(input.whatsapp);

    if (!name || !title || name.length > 120 || title.length > 180 || bio.length > 10_000 || location.length > 160) {
      return noStoreJson(
        {
          success: false,
          message: "Enter a valid name, professional title, biography and location.",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // Validate design choices before saving them.
    const allowedTemplates = ["professional"];
    const allowedThemes = ["dark", "light", "sepia"];

    const requestedTemplate = String(
      input.template ?? "professional"
    ).trim();

    const requestedTheme = String(
      input.theme ?? "dark"
    ).trim();

    if (!allowedTemplates.includes(requestedTemplate)) {
      return noStoreJson(
        {
          success: false,
          message: "Invalid portfolio template.",
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!allowedThemes.includes(requestedTheme)) {
      return noStoreJson(
        {
          success: false,
          message: "Invalid portfolio theme.",
        },
        { status: 400 }
      );
    }

    const dashboardBackgroundInput = readText(input.dashboardBackground);
    const websiteBackgroundInput = readText(input.websiteBackground);
    const dashboardBackgroundResult = dashboardBackgroundInput
      ? safePortfolioBackground(dashboardBackgroundInput)
      : null;
    const websiteBackgroundResult = websiteBackgroundInput
      ? safePortfolioBackground(websiteBackgroundInput)
      : null;
    const dashboardBackground = dashboardBackgroundResult?.value ?? null;
    const websiteBackground = websiteBackgroundResult?.value ?? null;

    const profileImageUrl = profileImage ? safePortfolioImageUrl(profileImage) : null;
    const externalUrls = [website, linkedin, instagram, facebook, youtube, tiktok, whatsapp];
    const invalidUrl = externalUrls.some((value) => value && !safePortfolioExternalLink(value));
    const invalidPhone = phone && !safePortfolioPhoneHref(phone);

    if (
      (dashboardBackgroundInput && !dashboardBackgroundResult) ||
      (websiteBackgroundInput && !websiteBackgroundResult) ||
      (profileImage && !profileImageUrl) ||
      invalidUrl ||
      invalidPhone
    ) {
      return noStoreJson(
        { success: false, message: "One or more portfolio links or backgrounds are invalid." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const data: {
      name: string;
      title: string;
      bio: string | null;
      location: string | null;
      timezone?: string;
      timezoneReviewRequired?: boolean;
      phone: string | null;
      website: string | null;
      profileImage: string | null;
      linkedin: string | null;
      instagram: string | null;
      facebook: string | null;
      youtube: string | null;
      tiktok: string | null;
      whatsapp: string | null;
      template: string;
      theme: string;
      dashboardBackground: string | null;
      websiteBackground: string | null;
      published?: boolean;
      visibility?: "PUBLIC" | "UNLISTED";
    } = {
      name,
      title,
      bio: bio || null,
      location: location || null,
      phone: phone || null,
      website: website || null,
      profileImage: profileImageUrl,
      linkedin: linkedin || null,
      instagram: instagram || null,
      facebook: facebook || null,
      youtube: youtube || null,
      tiktok: tiktok || null,
      whatsapp: whatsapp || null,

      template: requestedTemplate,
      theme: requestedTheme,
      dashboardBackground,
      websiteBackground,
    };

    // A flagged legacy timezone can only be replaced after explicit owner confirmation.
    // Ordinary profile saves and publish changes preserve the unresolved review state.
    if (
      timezone !== undefined &&
      (!currentPortfolio.timezoneReviewRequired || input.timezoneReviewConfirmed === true)
    ) {
      data.timezone = timezone;
      data.timezoneReviewRequired = false;
    }

       // Change publication status only when explicitly provided.
    if (typeof input.published === "boolean") {
      data.published = input.published;
    }

    // Change portfolio visibility only when explicitly provided.
    if (input.visibility !== undefined) {
      if (
        input.visibility !== "PUBLIC" &&
        input.visibility !== "UNLISTED"
      ) {
        return noStoreJson(
          {
            success: false,
            message: "Invalid portfolio visibility.",
          },
          { status: 400 }
        );
      }

      data.visibility = input.visibility;
    }



















































    const portfolio = await prisma.portfolioSite.update({
      where: { userId: targetUserId },
      data,
    });

    return noStoreJson({
      success: true,
      message:
        typeof input.published === "boolean"
          ? input.published
            ? "Portfolio published successfully."
            : "Portfolio unpublished successfully."
          : "Portfolio updated successfully.",
      portfolio,
    });
  } catch (error) {
    console.error("Portfolio PUT error:", error);

    return noStoreJson(
      {
        success: false,
        message: "Unable to update portfolio.",
      },
      { status: 500 }
    );
  }
}
