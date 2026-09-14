import { describe, expect, it } from "vitest";
import { decideRoleChange, isAssignableRole } from "../roleChange";

const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER = "bbbbbbbb-0000-0000-0000-000000000002";

describe("decideRoleChange", () => {
  it("refuses callers who are not admins, even editors", () => {
    const d = decideRoleChange({
      callerId: OTHER,
      callerRoles: ["editor"],
      targetId: ADMIN,
      targetRoles: [],
      role: "admin",
      enable: true,
      adminCount: 1,
    });
    expect(d).toMatchObject({ ok: false, status: 403, code: "not_admin" });
  });

  it("refuses an admin editing their own roles (grant or revoke)", () => {
    for (const enable of [true, false]) {
      const d = decideRoleChange({
        callerId: ADMIN,
        callerRoles: ["admin"],
        targetId: ADMIN,
        targetRoles: ["admin"],
        role: "editor",
        enable,
        adminCount: 2,
      });
      expect(d).toMatchObject({ ok: false, status: 403, code: "self" });
    }
  });

  it("refuses to remove the last admin", () => {
    const d = decideRoleChange({
      callerId: ADMIN,
      callerRoles: ["admin"],
      targetId: OTHER,
      targetRoles: ["admin"],
      role: "admin",
      enable: false,
      adminCount: 1,
    });
    expect(d).toMatchObject({ ok: false, status: 409, code: "last_admin" });
  });

  it("fails closed when the admin count is unknown", () => {
    const d = decideRoleChange({
      callerId: ADMIN,
      callerRoles: ["admin"],
      targetId: OTHER,
      targetRoles: ["admin"],
      role: "admin",
      enable: false,
    });
    expect(d).toMatchObject({ ok: false, code: "last_admin" });
  });

  it("lets an admin revoke admin from another admin when more remain", () => {
    const d = decideRoleChange({
      callerId: ADMIN,
      callerRoles: ["admin"],
      targetId: OTHER,
      targetRoles: ["admin", "editor"],
      role: "admin",
      enable: false,
      adminCount: 2,
    });
    expect(d).toEqual({ ok: true, newRoles: ["editor"], changed: true });
  });

  it("grants without duplicating and reports no change when already held", () => {
    const grant = decideRoleChange({
      callerId: ADMIN,
      callerRoles: ["admin"],
      targetId: OTHER,
      targetRoles: [],
      role: "admin",
      enable: true,
    });
    expect(grant).toEqual({ ok: true, newRoles: ["admin"], changed: true });

    const again = decideRoleChange({
      callerId: ADMIN,
      callerRoles: ["admin"],
      targetId: OTHER,
      targetRoles: ["admin"],
      role: "admin",
      enable: true,
    });
    expect(again).toEqual({ ok: true, newRoles: ["admin"], changed: false });
  });

  it("revoking editor never touches the admin count", () => {
    const d = decideRoleChange({
      callerId: ADMIN,
      callerRoles: ["admin"],
      targetId: OTHER,
      targetRoles: ["editor"],
      role: "editor",
      enable: false,
      adminCount: 1,
    });
    expect(d).toEqual({ ok: true, newRoles: [], changed: true });
  });
});

describe("isAssignableRole", () => {
  it("accepts only admin and editor", () => {
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("editor")).toBe(true);
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole(undefined)).toBe(false);
  });
});
