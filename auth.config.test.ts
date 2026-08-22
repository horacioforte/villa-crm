import { describe, it, expect, vi, beforeEach } from "vitest";

import { authConfig } from "./auth.config";

describe("authConfig redirect", () => {
  beforeEach(() => {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    vi.restoreAllMocks();
  });

  it("falls back to baseUrl when AUTH_URL is invalid", async () => {
    process.env.AUTH_URL = "https://[SENSITIVE]";

    const result = await authConfig.callbacks.redirect({
      url: "/login",
      baseUrl: "https://villa-crm.vercel.app",
    });

    expect(result).toBe("https://villa-crm.vercel.app/login");
  });
});
