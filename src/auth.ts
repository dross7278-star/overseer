import { timingSafeEqual } from "node:crypto";

export interface DashboardCredentials {
  username: string;
  password: string;
}

export function getDashboardCredentials(
  env: NodeJS.ProcessEnv = process.env,
): DashboardCredentials | undefined {
  const username = env.DASHBOARD_USERNAME;
  const password = env.DASHBOARD_PASSWORD;
  const hasUsername = Boolean(username);
  const hasPassword = Boolean(password);

  if (hasUsername !== hasPassword) {
    throw new Error("Set both DASHBOARD_USERNAME and DASHBOARD_PASSWORD, or neither.");
  }
  if (env.NODE_ENV === "production" && env.PUBLIC_READ_ONLY !== "true" && !hasUsername) {
    throw new Error("DASHBOARD_USERNAME and DASHBOARD_PASSWORD are required in production.");
  }
  if (!username || !password) return undefined;

  return { username, password };
}

export function isAuthorized(
  authorization: string | undefined,
  credentials: DashboardCredentials,
): boolean {
  const match = authorization?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return false;

  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  if (Buffer.from(decoded, "utf8").toString("base64") !== match[1]) return false;

  const actual = Buffer.from(decoded, "utf8");
  const expected = Buffer.from(`${credentials.username}:${credentials.password}`, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
