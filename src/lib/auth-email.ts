import "server-only";

import { Resend } from "resend";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getCanonicalAppUrl(): string {
  const configuredUrl = process.env.APP_URL?.trim();

  if (!configuredUrl) {
    throw new Error("APP_URL is not configured.");
  }

  let url: URL;

  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("APP_URL is invalid.");
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("APP_URL must be a clean application origin.");
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isLocalDevelopment =
    !isProduction &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("APP_URL must use HTTPS outside local development.");
  }

  if (url.protocol !== "https:" && isProduction) {
    throw new Error("Production authentication links require HTTPS.");
  }

  return url.origin;
}

export async function sendVerificationEmail({
  to,
  name,
  token,
}: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    throw new Error("Authentication email service is not configured.");
  }

  if (!to || !token) {
    throw new Error("Authentication email recipient or token is missing.");
  }

  const appUrl = getCanonicalAppUrl();
  const resend = new Resend(apiKey);

  const verificationUrl = new URL("/verify-email", appUrl);
  verificationUrl.searchParams.set("token", token);

  const safeName = escapeHtml(name || "there");
  const safeUrl = escapeHtml(verificationUrl.toString());

  const result = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: "Verify your Crispus Nguni account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171923;line-height:1.7">
        <div style="background:#101116;color:#ffffff;padding:28px;border-radius:14px 14px 0 0">
          <p style="margin:0;color:#D9A441;font-size:12px;letter-spacing:2px;text-transform:uppercase">
            Account security
          </p>
          <h1 style="margin:12px 0 0;font-size:25px">Verify your email address</h1>
        </div>
        <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px">
          <p>Hello ${safeName},</p>
          <p>Thank you for creating your account. Please verify your email address to activate your account.</p>
          <p style="margin:28px 0">
            <a href="${safeUrl}" style="display:inline-block;background:#D9A441;color:#17130B;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">
              Verify email address
            </a>
          </p>
          <p>This verification link expires in 30 minutes and can only be used once.</p>
          <p>If you did not create this account, you can safely ignore this email.</p>
          <p style="margin-top:28px;color:#6b7280;font-size:12px">
            For your security, do not forward this link to anyone.
          </p>
        </div>
      </div>
    `,
    text: [
      `Hello ${name || "there"},`,
      "",
      "Thank you for creating your account.",
      "Verify your email address using this link:",
      verificationUrl.toString(),
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not create this account, you can ignore this email.",
      "",
      "For your security, do not forward this link.",
    ].join("\n"),
  });

  if (result.error) {
    console.error("Authentication email delivery was rejected.");
    throw new Error("Authentication email delivery failed.");
  }
}

export async function sendMagicLinkEmail({
  to,
  name,
  token,
}: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    throw new Error("Authentication email service is not configured.");
  }

  if (!to || !token) {
    throw new Error("Authentication email recipient or token is missing.");
  }

  const appUrl = getCanonicalAppUrl();
  const resend = new Resend(apiKey);

  const magicLinkUrl = new URL("/magic-link", appUrl);
  magicLinkUrl.searchParams.set("token", token);

  const safeName = escapeHtml(name || "there");
  const safeUrl = escapeHtml(magicLinkUrl.toString());

  const result = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: "Your secure Crispus Nguni sign-in link",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171923;line-height:1.7">
        <div style="background:#101116;color:#ffffff;padding:28px;border-radius:14px 14px 0 0">
          <p style="margin:0;color:#D9A441;font-size:12px;letter-spacing:2px;text-transform:uppercase">
            Secure sign-in
          </p>
          <h1 style="margin:12px 0 0;font-size:25px">Your sign-in link is ready</h1>
        </div>
        <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px">
          <p>Hello ${safeName},</p>
          <p>Use the secure link below to sign in to your Crispus Nguni account. You do not need to enter your password.</p>
          <p style="margin:28px 0">
            <a href="${safeUrl}" style="display:inline-block;background:#D9A441;color:#17130B;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">
              Sign in securely
            </a>
          </p>
          <p>This link expires in 15 minutes and can only be used once.</p>
          <p>If you did not request this link, you can safely ignore this email. Your account will not be accessed unless the link is used.</p>
          <p style="margin-top:28px;color:#6b7280;font-size:12px">
            For your security, do not forward this link to anyone.
          </p>
        </div>
      </div>
    `,
    text: [
      `Hello ${name || "there"},`,
      "",
      "Use this secure link to sign in to your Crispus Nguni account:",
      magicLinkUrl.toString(),
      "",
      "This link expires in 15 minutes and can only be used once.",
      "If you did not request it, you can ignore this email.",
      "",
      "For your security, do not forward this link.",
    ].join("\n"),
  });

  if (result.error) {
    console.error("Magic-link email delivery was rejected.");
    throw new Error("Magic-link email delivery failed.");
  }
}

export async function sendPasswordResetEmail({
  to,
  name,
  token,
}: {
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !fromEmail) {
    throw new Error("Authentication email service is not configured.");
  }

  if (!to || !token) {
    throw new Error("Authentication email recipient or token is missing.");
  }

  const appUrl = getCanonicalAppUrl();
  const resend = new Resend(apiKey);

  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", token);

  const safeName = escapeHtml(name || "there");
  const plainTextName = name.replace(/[\x00-\x1F\x7F]/g, "").trim() || "there";
  const safeUrl = escapeHtml(resetUrl.toString());

  const result = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject: "Reset your Crispus Nguni password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171923;line-height:1.7">
        <div style="background:#101116;color:#ffffff;padding:28px;border-radius:14px 14px 0 0">
          <p style="margin:0;color:#D9A441;font-size:12px;letter-spacing:2px;text-transform:uppercase">
            Account security
          </p>
          <h1 style="margin:12px 0 0;font-size:25px">Reset your password</h1>
        </div>
        <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px">
          <p>Hello ${safeName},</p>
          <p>Use the secure link below to choose a new password for your Crispus Nguni account.</p>
          <p style="margin:28px 0">
            <a href="${safeUrl}" style="display:inline-block;background:#D9A441;color:#17130B;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">
              Reset password
            </a>
          </p>
          <p>This link expires in 30 minutes and can only be used once.</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
          <p style="margin-top:28px;color:#6b7280;font-size:12px">
            For your security, do not forward this link to anyone.
          </p>
        </div>
      </div>
    `,
    text: [
      `Hello ${plainTextName},`,
      "",
      "Use this secure link to reset your Crispus Nguni account password:",
      resetUrl.toString(),
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not request a password reset, you can ignore this email.",
      "",
      "For your security, do not forward this link.",
    ].join("\n"),
  });

  if (result.error) {
    console.error("Password-reset email delivery was rejected.");
    throw new Error("Password-reset email delivery failed.");
  }
}
