const ACCESS_TOKEN_COOKIE = "dashboard_access_token";
const REFRESH_TOKEN_COOKIE = "dashboard_refresh_token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

type StoredAuthUser = {
  name?: string;
  email?: string;
};

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

export function saveAuthSession(params: {
  accessToken: string;
  refreshToken?: string;
  user?: StoredAuthUser;
}) {
  setCookie(ACCESS_TOKEN_COOKIE, params.accessToken, COOKIE_MAX_AGE_SECONDS);

  if (params.refreshToken) {
    setCookie(REFRESH_TOKEN_COOKIE, params.refreshToken, COOKIE_MAX_AGE_SECONDS);
  }

  if (params.user) {
    localStorage.setItem("dashboard_auth_user", JSON.stringify(params.user));
  }
}

export function clearAuthSession() {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${REFRESH_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  localStorage.removeItem("dashboard_auth_user");
}

export function getRefreshTokenFromCookie() {
  const allCookies = document.cookie.split("; ");
  const target = allCookies.find((item) => item.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
  if (!target) return null;

  return decodeURIComponent(target.split("=")[1] ?? "");
}

export function getAccessTokenFromCookie() {
  const allCookies = document.cookie.split("; ");
  const target = allCookies.find((item) => item.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  if (!target) return null;

  return decodeURIComponent(target.split("=")[1] ?? "");
}

export const authCookieNames = {
  accessToken: ACCESS_TOKEN_COOKIE,
  refreshToken: REFRESH_TOKEN_COOKIE,
};
