import { describe, expect, it, vi } from "vitest";

import { authorize } from "./authorize.js";

function makeReq(user?: { sub: string; role: string; locationId: string }) {
  return { user } as any;
}

describe("authorize middleware — pure role check", () => {
  it("rejects with 401 when authenticate never ran (no req.user)", () => {
    const next = vi.fn();
    authorize("SUPER_ADMIN")(makeReq(undefined), {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("rejects with 403 when the user's role isn't in the allowed list", () => {
    const next = vi.fn();
    authorize("SUPER_ADMIN", "OWNER")(makeReq({ sub: "u1", role: "SELLER", locationId: "loc-1" }) as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it("passes through with no error when the role is allowed", () => {
    const next = vi.fn();
    authorize("SUPER_ADMIN", "OWNER")(makeReq({ sub: "u1", role: "OWNER", locationId: "loc-1" }) as any, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("a role not passed to authorize() at all is always rejected, even if it's a valid Role value", () => {
    const next = vi.fn();
    authorize("OWNER")(makeReq({ sub: "u1", role: "SUPER_ADMIN", locationId: "loc-1" }) as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
