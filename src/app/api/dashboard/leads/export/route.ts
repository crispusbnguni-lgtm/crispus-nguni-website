
import { LeadSource, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { leadPortfolioScope } from "@/lib/lead-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 25_000;

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISQUALIFIED",
  "CONVERTED",
  "LOST",
] as const;

const TEMPERATURES = ["HOT", "WARM", "COLD", "DORMANT"] as const;

const SORT_OPTIONS = ["newest", "oldest", "score", "name"] as const;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store, private" },
    },
  );
}

function readSingleParam(params: URLSearchParams, key: string) {
  const values = params.getAll(key);

  if (values.length > 1) {
    return { value: "", invalid: true };
  }

  return {
    value: values[0] ?? "",
    invalid: false,
  };
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);

  // Prevent spreadsheet formula execution in exported cells.
  if (/^[\u0000-\u0020\ufeff]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Authentication required.", 401);
    }

    const url = new URL(request.url);
    const params = url.searchParams;

    const qParam = readSingleParam(params, "q");
    const statusParam = readSingleParam(params, "status");
    const temperatureParam = readSingleParam(params, "temperature");
    const sourceParam = readSingleParam(params, "source");
    const sortParam = readSingleParam(params, "sort");

    if (
      qParam.invalid ||
      statusParam.invalid ||
      temperatureParam.invalid ||
      sourceParam.invalid ||
      sortParam.invalid
    ) {
      return errorResponse(
        "Invalid or repeated filter parameters.",
        400,
      );
    }

    const q = qParam.value.trim().slice(0, 100);
    const status = statusParam.value;
    const temperature = temperatureParam.value;
    const source = sourceParam.value;
    const requestedSort = sortParam.value || "newest";

    if (
      status &&
      !STATUSES.includes(status as (typeof STATUSES)[number])
    ) {
      return errorResponse("Invalid lead status filter.", 400);
    }

    if (
      temperature &&
      !TEMPERATURES.includes(
        temperature as (typeof TEMPERATURES)[number],
      )
    ) {
      return errorResponse("Invalid lead temperature filter.", 400);
    }

    if (
      source &&
      !Object.values(LeadSource).includes(source as LeadSource)
    ) {
      return errorResponse("Invalid lead source filter.", 400);
    }

    if (
      !SORT_OPTIONS.includes(
        requestedSort as (typeof SORT_OPTIONS)[number],
      )
    ) {
      return errorResponse("Invalid lead sort option.", 400);
    }

    const where: Prisma.LeadWhereInput = {
      ...leadPortfolioScope(user),

      ...(status
        ? { status: status as (typeof STATUSES)[number] }
        : {}),

      ...(temperature
        ? {
            temperature:
              temperature as (typeof TEMPERATURES)[number],
          }
        : {}),

      ...(source
        ? { source: source as LeadSource }
        : {}),

      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              {
                interestedIn: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const sort = requestedSort as (typeof SORT_OPTIONS)[number];

    const orderBy: Prisma.LeadOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : sort === "score"
          ? [
              { score: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ]
          : sort === "name"
            ? [
                { name: "asc" },
                { createdAt: "desc" },
                { id: "desc" },
              ]
            : [{ createdAt: "desc" }, { id: "desc" }];

    const leads = await prisma.lead.findMany({
      where,
      orderBy,
      take: MAX_EXPORT_ROWS + 1,
      select: {
        name: true,
        email: true,
        phone: true,
        company: true,
        location: true,
        interestedIn: true,
        budget: true,
        timeline: true,
        decisionMaker: true,
        source: true,
        sourceDetail: true,
        origin: true,
        status: true,
        temperature: true,
        score: true,
        createdAt: true,
        nextFollowUpAt: true,
        portfolio: {
          select: {
            name: true,
          },
        },
      },
    });

    if (leads.length > MAX_EXPORT_ROWS) {
      return errorResponse(
        `This export exceeds ${MAX_EXPORT_ROWS.toLocaleString()} leads. Narrow your filters and try again.`,
        413,
      );
    }

    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Location",
      "Interested In",
      "Budget",
      "Buying Timeline",
      "Decision Maker",
      "Source",
      "Source Details",
      "Origin",
      "Status",
      "Temperature",
      "Lead Score",
      "Created At",
      "Next Follow-up",
      "Portfolio",
    ];

    const rows = leads.map((lead) =>
      csvRow([
        lead.name,
        lead.email,
        lead.phone,
        lead.company,
        lead.location,
        lead.interestedIn,
        lead.budget,
        lead.timeline,
        lead.decisionMaker == null
          ? ""
          : lead.decisionMaker
            ? "Yes"
            : "No",
        lead.source,
        lead.sourceDetail,
        lead.origin,
        lead.status,
        lead.temperature,
        lead.score,
        lead.createdAt.toISOString(),
        lead.nextFollowUpAt?.toISOString() ?? "",
        lead.portfolio.name,
      ]),
    );

    const csv = "\uFEFF" + [csvRow(headers), ...rows].join("\r\n");

    const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/leads/export failed:", error);

    return errorResponse(
      "Unable to export leads right now.",
      500,
    );
  }
}
