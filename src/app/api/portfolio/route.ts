
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        { status: 401 }
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
        { status: 403 }
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
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, portfolio });
  } catch (error) {
    console.error("Portfolio GET error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load portfolio." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const title = String(body.title ?? "").trim();
    const bio = String(body.bio ?? "").trim();
    const location = String(body.location ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const website = String(body.website ?? "").trim();
    const profileImage = String(body.profileImage ?? "").trim();

    if (!name || !title) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and professional title are required.",
        },
        { status: 400 }
      );
    }

    // Validate design choices before saving them.
    const allowedTemplates = ["professional"];
    const allowedThemes = ["dark", "light", "sepia"];

    const requestedTemplate = String(
      body.template ?? "professional"
    ).trim();

    const requestedTheme = String(
      body.theme ?? "dark"
    ).trim();

    if (!allowedTemplates.includes(requestedTemplate)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid portfolio template.",
        },
        { status: 400 }
      );
    }

    if (!allowedThemes.includes(requestedTheme)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid portfolio theme.",
        },
        { status: 400 }
      );
    }

    const dashboardBackground =
      String(body.dashboardBackground ?? "").trim().slice(0, 500) ||
      null;

    const websiteBackground =
      String(body.websiteBackground ?? "").trim().slice(0, 500) ||
      null;

    const data: {
      name: string;
      title: string;
      bio: string | null;
      location: string | null;
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
    } = {
      name,
      title,
      bio: bio || null,
      location: location || null,
      phone: phone || null,
      website: website || null,
      profileImage: profileImage || null,
      linkedin: String(body.linkedin ?? "").trim() || null,
      instagram: String(body.instagram ?? "").trim() || null,
      facebook: String(body.facebook ?? "").trim() || null,
      youtube: String(body.youtube ?? "").trim() || null,
      tiktok: String(body.tiktok ?? "").trim() || null,
      whatsapp: String(body.whatsapp ?? "").trim() || null,

      template: requestedTemplate,
      theme: requestedTheme,
      dashboardBackground,
      websiteBackground,
    };

    // Change publication status only when explicitly provided.
    if (typeof body.published === "boolean") {
      data.published = body.published;
    }

    const portfolio = await prisma.portfolioSite.update({
      where: { userId: targetUserId },
      data,
    });

    return NextResponse.json({
      success: true,
      message:
        typeof body.published === "boolean"
          ? body.published
            ? "Portfolio published successfully."
            : "Portfolio unpublished successfully."
          : "Portfolio updated successfully.",
      portfolio,
    });
  } catch (error) {
    console.error("Portfolio PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update portfolio.",
      },
      { status: 500 }
    );
  }
}