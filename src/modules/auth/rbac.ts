import { UserRole } from "@/core/types/tenant.types";

export type Permission =
  | "stores:read"
  | "stores:write"
  | "products:read"
  | "products:write"
  | "rules:read"
  | "rules:write"
  | "sessions:read"
  | "analytics:read"
  | "billing:manage"
  | "team:manage";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    "stores:read",
    "stores:write",
    "products:read",
    "products:write",
    "rules:read",
    "rules:write",
    "sessions:read",
    "analytics:read",
    "billing:manage",
    "team:manage",
  ],
  ADMIN: [
    "stores:read",
    "stores:write",
    "products:read",
    "products:write",
    "rules:read",
    "rules:write",
    "sessions:read",
    "analytics:read",
    "team:manage",
  ],
  OPERATOR: [
    "stores:read",
    "products:read",
    "rules:read",
    "rules:write",
    "sessions:read",
    "analytics:read",
  ],
  VIEWER: ["stores:read", "products:read", "rules:read", "sessions:read", "analytics:read"],
};

export class RBAC {
  public static hasPermission(role: UserRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }

  public static assertPermission(role: UserRole, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      throw new Error(`Forbidden: Role '${role}' lacks permission '${permission}'`);
    }
  }
}
