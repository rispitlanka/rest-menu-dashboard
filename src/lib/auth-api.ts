const DEFAULT_API_BASE_URL = "http://localhost:8080/api/v1";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
} & T;

type AuthTokens = {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
};

type AuthUser = {
  name?: string;
  email?: string;
};

type LoginRegisterResult = AuthTokens & {
  user?: AuthUser;
};

async function postAuth<TResponse, TPayload extends Record<string, unknown>>(
  endpoint: string,
  payload: TPayload,
) {
  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<TResponse>;

  if (!response.ok) {
    const message = body?.message || "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return body;
}

function normalizeAuthResult(result: ApiEnvelope<LoginRegisterResult>) {
  const rawData = (result?.data ?? result) as LoginRegisterResult;
  const accessToken = rawData?.accessToken ?? rawData?.token;

  if (!accessToken) {
    throw new Error("Missing access token in authentication response.");
  }

  return {
    accessToken,
    refreshToken: rawData?.refreshToken,
    user: rawData?.user,
  };
}

export async function registerOwner(payload: {
  name: string;
  email: string;
  password: string;
  restaurantName: string;
}) {
  const result = await postAuth<LoginRegisterResult, typeof payload>(
    "/auth/register",
    payload,
  );

  return normalizeAuthResult(result);
}

export async function loginOwner(payload: { email: string; password: string }) {
  const result = await postAuth<LoginRegisterResult, typeof payload>(
    "/auth/login",
    payload,
  );

  return normalizeAuthResult(result);
}

export async function refreshAccessToken(refreshToken: string) {
  const result = await postAuth<AuthTokens, { refreshToken: string }>(
    "/auth/refresh",
    { refreshToken },
  );

  const rawData = (result?.data ?? result) as AuthTokens;
  const accessToken = rawData?.accessToken ?? rawData?.token;

  if (!accessToken) {
    throw new Error("Missing access token in refresh response.");
  }

  return {
    accessToken,
    refreshToken: rawData?.refreshToken,
  };
}

export async function requestPasswordReset(email: string) {
  return postAuth<{ message?: string }, { email: string }>("/auth/forgot-password", {
    email,
  });
}

export async function resetPassword(payload: {
  token: string;
  password: string;
}) {
  return postAuth<{ message?: string }, typeof payload>(
    "/auth/reset-password",
    payload,
  );
}
