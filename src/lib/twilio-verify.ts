import "server-only";

type TwilioConfiguration = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  verifyServiceSid: string;
};

function getTwilioConfiguration(): TwilioConfiguration {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

  if (
    !accountSid ||
    !apiKeySid ||
    !apiKeySecret ||
    !verifyServiceSid ||
    !/^AC[0-9a-fA-F]{32}$/.test(accountSid) ||
    !/^SK[0-9a-fA-F]{32}$/.test(apiKeySid) ||
    !/^VA[0-9a-fA-F]{32}$/.test(verifyServiceSid)
  ) {
    throw new Error("Twilio Verify is not configured.");
  }

  return { accountSid, apiKeySid, apiKeySecret, verifyServiceSid };
}

function endpoint(configuration: TwilioConfiguration, action: string) {
  return `https://verify.twilio.com/v2/Services/${configuration.verifyServiceSid}/${action}`;
}

async function postTwilioForm(
  configuration: TwilioConfiguration,
  action: string,
  values: URLSearchParams,
  missingIsNegative = false,
): Promise<unknown> {
  const authorization = Buffer.from(
    `${configuration.apiKeySid}:${configuration.apiKeySecret}`,
  ).toString("base64");

  const response = await fetch(endpoint(configuration, action), {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: values,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    if (missingIsNegative && response.status === 404) return null;
    throw new Error("Twilio Verify request failed.");
  }
  return response.json().catch(() => null);
}

function belongsToConfiguredService(
  result: unknown,
  configuration: TwilioConfiguration,
): result is Record<string, unknown> {
  return (
    typeof result === "object" &&
    result !== null &&
    "account_sid" in result &&
    result.account_sid === configuration.accountSid &&
    "service_sid" in result &&
    result.service_sid === configuration.verifyServiceSid
  );
}

export function validateTwilioVerifyConfiguration(): void {
  getTwilioConfiguration();
}

export async function sendPhoneVerification(phone: string): Promise<boolean> {
  const configuration = getTwilioConfiguration();
  const result = await postTwilioForm(
    configuration,
    "Verifications",
    new URLSearchParams({ To: phone, Channel: "sms" }),
  );

  return belongsToConfiguredService(result, configuration) &&
    result.status === "pending";
}

export async function checkPhoneVerification(
  phone: string,
  code: string,
): Promise<boolean> {
  const configuration = getTwilioConfiguration();
  const result = await postTwilioForm(
    configuration,
    "VerificationCheck",
    new URLSearchParams({ To: phone, Code: code }),
    true,
  );

  return belongsToConfiguredService(result, configuration) &&
    result.status === "approved";
}
