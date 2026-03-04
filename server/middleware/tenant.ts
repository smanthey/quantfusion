import type { NextFunction, Request, Response } from "express";

export type TenantContext = {
  tenant: string;
  organization_id: string;
  workspace: string;
};

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

function normalizeTenantValue(value: string | undefined): string {
  const fallback = "default";
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw.replace(/[^a-z0-9_-]/g, "").slice(0, 64) || fallback;
}

// Baseline multitenant resolver with organization_id + workspace context.
export function tenantResolver(req: Request, _res: Response, next: NextFunction) {
  const tenant = normalizeTenantValue(
    (req.headers["x-tenant-id"] as string | undefined)
      || (req.headers["x-org-id"] as string | undefined)
      || (req.query.tenant as string | undefined)
      || process.env.DEFAULT_TENANT_ID
  );

  const organization_id = normalizeTenantValue(
    (req.headers["x-organization-id"] as string | undefined)
      || (req.query.organization_id as string | undefined)
      || tenant
  );

  const workspace = normalizeTenantValue(
    (req.headers["x-workspace-id"] as string | undefined)
      || (req.query.workspace as string | undefined)
      || "primary"
  );

  req.tenantContext = {
    tenant,
    organization_id,
    workspace,
  };

  next();
}
