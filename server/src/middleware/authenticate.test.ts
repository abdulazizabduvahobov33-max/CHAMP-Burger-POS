import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import { AppError } from "./error.js";
import { authenticate } from "./authenticate.js";

function makeReq(header?: string) {
  return { headers: { authorization: header } } as any;
}

function makeNext() {
  return vi.fn();
}

function signAccess(overrides: Record<string, unknown> = {}, opts: jwt.SignOptions = {}) {
  return jwt.sign(
    { sub: "user-1", role: "SUPER_ADMIN", locationId: "loc-1", type: "access", ...overrides },
    env.jwt.accessSecret,
    { expiresIn: "15m", ...opts },
  );
}

describe("authenticate middleware — real JWT crypto, no DB", () => {
  it("rejects a request with no Authorization header", () => {
    const req = makeReq(undefined);
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("rejects a header that isn't 'Bearer <token>'", () => {
    const req = makeReq("Basic sometoken");
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("rejects a malformed token (not valid JWT at all)", () => {
    const req = makeReq("Bearer not-a-real-jwt");
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("rejects a token signed with the WRONG secret (invalid signature)", () => {
    const forged = jwt.sign({ sub: "attacker", role: "SUPER_ADMIN", locationId: "loc-1", type: "access" }, "wrong-secret-not-the-real-one", {
      expiresIn: "15m",
    });
    const req = makeReq(`Bearer ${forged}`);
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("rejects an expired token", () => {
    const expired = signAccess({}, { expiresIn: -10 }); // already expired 10s ago
    const req = makeReq(`Bearer ${expired}`);
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("rejects a REFRESH token presented as an access token (wrong `type` claim)", () => {
    const refreshShaped = jwt.sign({ sub: "user-1", jti: "some-jti", type: "refresh" }, env.jwt.accessSecret, { expiresIn: "15m" });
    const req = makeReq(`Bearer ${refreshShaped}`);
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("accepts a valid access token and attaches req.user from its claims", () => {
    const token = signAccess({ sub: "user-42", role: "OWNER", locationId: "loc-7" });
    const req = makeReq(`Bearer ${token}`);
    const next = makeNext();
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(); // called with no error
    expect(req.user).toEqual({ sub: "user-42", role: "OWNER", locationId: "loc-7" });
  });

  it("never leaks the token or the secret into the error it produces", () => {
    const req = makeReq("Bearer some.invalid.token");
    const next = makeNext();
    authenticate(req, {} as any, next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.message).not.toContain(env.jwt.accessSecret);
    expect(JSON.stringify(err)).not.toContain("some.invalid.token");
  });
});
