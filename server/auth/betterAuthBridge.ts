import type { Request } from "express";

export function isBetterAuthEnabled(): boolean {
  return process.env.ENABLE_BETTER_AUTH === "true";
}

export async function verifyBetterAuthSession(req: Request): Promise<boolean> {
  if (!isBetterAuthEnabled()) return false;

  try {
    const moduleName = "better-auth";
    const mod = (await import(moduleName)) as unknown as {
      auth?: {
        api?: {
          getSession?: (input: { headers: Headers }) => Promise<{ user?: { id?: string } } | null>;
        };
      };
      api?: {
        getSession?: (input: { headers: Headers }) => Promise<{ user?: { id?: string } } | null>;
      };
    };

    const getSession = mod.auth?.api?.getSession || mod.api?.getSession;
    if (!getSession) return false;

    const headers = new Headers();
    if (req.headers.cookie) headers.set("cookie", req.headers.cookie);
    const session = await getSession({ headers });
    return Boolean(session?.user?.id);
  } catch {
    return false;
  }
}
