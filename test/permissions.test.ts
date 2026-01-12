import { describe, expect, test, spyOn, beforeEach, afterEach } from "bun:test";
import * as core from "../src/gitea-actions/core";
import { checkWritePermissions } from "../src/github/validation/permissions";
import type { GiteaContext } from "../src/github/context";
import { CLAUDE_APP_BOT_ID, CLAUDE_BOT_LOGIN } from "../src/github/constants";

describe("checkWritePermissions", () => {
  let coreInfoSpy: any;
  let coreWarningSpy: any;
  let coreErrorSpy: any;
  let fetchSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Spy on core methods
    coreInfoSpy = spyOn(core, "info").mockImplementation(() => {});
    coreWarningSpy = spyOn(core, "warning").mockImplementation(() => {});
    coreErrorSpy = spyOn(core, "error").mockImplementation(() => {});

    // Spy on console methods
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Spy on fetch
    fetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    coreInfoSpy.mockRestore();
    coreWarningSpy.mockRestore();
    coreErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  const createContext = (): GiteaContext => ({
    runId: "1234567890",
    eventName: "issue_comment",
    eventAction: "created",
    repository: {
      full_name: "test-owner/test-repo",
      owner: "test-owner",
      repo: "test-repo",
    },
    actor: "test-user",
    payload: {
      action: "created",
      issue: {
        number: 1,
        title: "Test Issue",
        body: "Test body",
        user: { login: "test-user" },
      },
      comment: {
        id: 123,
        body: "@claude test",
        user: { login: "test-user" },
      },
    } as any,
    entityNumber: 1,
    isPR: false,
    inputs: {
      prompt: "",
      triggerPhrase: "@claude",
      assigneeTrigger: "",
      labelTrigger: "",
      branchPrefix: "claude/",
      useStickyComment: false,
      useCommitSigning: false,
      sshSigningKey: "",
      botId: String(CLAUDE_APP_BOT_ID),
      botName: CLAUDE_BOT_LOGIN,
      allowedBots: "",
      allowedNonWriteUsers: "",
      trackProgress: false,
      includeFixLinks: true,
    },
  });

  test("should return true for owner permissions", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/collaborators/test-user/permission")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            permission: "owner",
            user: { login: "test-user" },
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createContext();
    const result = await checkWritePermissions(context);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Checking permissions for actor: test-user",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Permission level retrieved (collaborator): owner",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("Actor has write access: owner");
  });

  test("should return true for admin permissions", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/collaborators/test-user/permission")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            permission: "admin",
            user: { login: "test-user" },
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createContext();
    const result = await checkWritePermissions(context);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith("Actor has write access: admin");
  });

  test("should return true for write permissions", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/collaborators/test-user/permission")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            permission: "write",
            user: { login: "test-user" },
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createContext();
    const result = await checkWritePermissions(context);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith("Actor has write access: write");
  });

  test("should return false for read permissions", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/collaborators/test-user/permission")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            permission: "read",
            user: { login: "test-user" },
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createContext();
    const result = await checkWritePermissions(context);

    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Actor has insufficient permissions: read",
    );
  });

  test("should return false for none permissions", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/collaborators/test-user/permission")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            permission: "none",
            user: { login: "test-user" },
          }),
        } as Response);
      }
      if (url.includes("/repos/test-owner/test-repo/teams")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createContext();
    const result = await checkWritePermissions(context);

    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Actor test-user is not a member of any team with write permission",
    );
  });

  test("should return true for bot user", async () => {
    const context = createContext();
    context.actor = "test-bot[bot]";

    const result = await checkWritePermissions(context);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith("Actor is a bot: test-bot[bot]");
  });

  test("should throw error when permission check fails", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/collaborators/test-user/permission")) {
        return Promise.reject(new Error("API error"));
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createContext();

    await expect(checkWritePermissions(context)).rejects.toThrow(
      "Failed to check permissions for test-user: Error: API error",
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to check permissions: Error: API error",
    );
  });

  describe("allowed_non_write_users bypass", () => {
    test("should bypass permission check for specific user when gitea_token provided", async () => {
      fetchSpy.mockImplementation(() => {
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();

      const result = await checkWritePermissions(
        context,
        "test-user,other-user",
        true,
      );

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "⚠️ SECURITY WARNING: Bypassing write permission check for test-user due to allowed_non_write_users configuration. This should only be used for workflows with very limited permissions.",
      );
    });

    test("should bypass permission check for all users with wildcard", async () => {
      fetchSpy.mockImplementation(() => {
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();

      const result = await checkWritePermissions(context, "*", true);

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "⚠️ SECURITY WARNING: Bypassing write permission check for test-user due to allowed_non_write_users='*'. This should only be used for workflows with very limited permissions.",
      );
    });

    test("should NOT bypass permission check when user not in allowed list", async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url.includes("/collaborators/test-user/permission")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              permission: "read",
              user: { login: "test-user" },
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();

      const result = await checkWritePermissions(
        context,
        "other-user,another-user",
        true,
      );

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Actor has insufficient permissions: read",
      );
    });

    test("should NOT bypass permission check when gitea_token not provided", async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url.includes("/collaborators/test-user/permission")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              permission: "read",
              user: { login: "test-user" },
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();

      const result = await checkWritePermissions(context, "test-user", false);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Actor has insufficient permissions: read",
      );
    });

    test("should NOT bypass permission check when allowed_non_write_users is empty", async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url.includes("/collaborators/test-user/permission")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              permission: "read",
              user: { login: "test-user" },
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();

      const result = await checkWritePermissions(context, "", true);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Actor has insufficient permissions: read",
      );
    });

    test("should handle whitespace in allowed_non_write_users list", async () => {
      fetchSpy.mockImplementation(() => {
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();

      const result = await checkWritePermissions(
        context,
        " test-user , other-user ",
        true,
      );

      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "⚠️ SECURITY WARNING: Bypassing write permission check for test-user due to allowed_non_write_users configuration. This should only be used for workflows with very limited permissions.",
      );
    });

    test("should bypass for bot users even when allowed_non_write_users is set", async () => {
      fetchSpy.mockImplementation(() => {
        return Promise.resolve({ ok: false } as Response);
      });

      const context = createContext();
      context.actor = "test-bot[bot]";

      const result = await checkWritePermissions(context, "some-user", true);

      expect(result).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Actor is a bot: test-bot[bot]",
      );
    });
  });
});
