// src/app/lib/roleChange.ts
// The rules for granting/revoking dashboard roles, as a pure function so they
// are unit-tested and the route handler (api/admin/users/[id]/roles) stays a
// thin I/O wrapper. A database trigger repeats the "last admin" rule for edits
// made outside the app (migrations/add-admin-role-guards.sql).

export const ASSIGNABLE_ROLES = ["admin", "editor"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(v: unknown): v is AssignableRole {
  return typeof v === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(v);
}

export type RoleChangeInput = {
  callerId: string;
  callerRoles: readonly string[];
  targetId: string;
  targetRoles: readonly string[];
  role: AssignableRole;
  /** true = grant, false = revoke */
  enable: boolean;
  /**
   * How many accounts hold "admin" right now (the target included). Only
   * consulted when revoking admin; when unknown the revoke is refused
   * (fail closed) rather than risking a database with no admin.
   */
  adminCount?: number;
};

export type RoleChangeRefusal = {
  ok: false;
  status: 403 | 409;
  code: "not_admin" | "self" | "last_admin";
  message: string;
};

export type RoleChangeDecision =
  | { ok: true; newRoles: string[]; changed: boolean }
  | RoleChangeRefusal;

export function decideRoleChange(input: RoleChangeInput): RoleChangeDecision {
  // 1. Only admins change roles — the only way to become (or stop being) an
  //    admin is through another admin.
  if (!input.callerRoles.includes("admin")) {
    return {
      ok: false,
      status: 403,
      code: "not_admin",
      message: "Μόνο διαχειριστές (admin) μπορούν να αλλάζουν ρόλους.",
    };
  }

  // 2. Nobody edits their own roles: no self-lockout, no quiet self-escalation,
  //    and every role change has a second person's account on it.
  if (input.callerId === input.targetId) {
    return {
      ok: false,
      status: 403,
      code: "self",
      message: "Δεν μπορείς να αλλάξεις τους δικούς σου ρόλους — ζήτησέ το από άλλον admin.",
    };
  }

  const has = input.targetRoles.includes(input.role);

  // 3. The database must never end up without an admin.
  if (input.role === "admin" && !input.enable && has && (input.adminCount ?? 0) <= 1) {
    return {
      ok: false,
      status: 409,
      code: "last_admin",
      message: "Δεν μπορεί να αφαιρεθεί ο τελευταίος admin. Όρισε πρώτα άλλον admin.",
    };
  }

  const newRoles = input.enable
    ? Array.from(new Set([...input.targetRoles, input.role]))
    : input.targetRoles.filter((r) => r !== input.role);

  return { ok: true, newRoles, changed: has !== input.enable };
}
