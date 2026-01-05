import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { checkAndCommitOrDeleteBranch } from "../src/github/operations/branch-cleanup";
import { GITEA_SERVER_URL } from "../src/github/api/config";

describe("checkAndCommitOrDeleteBranch", () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let fetchSpy: any;
  let bunSpy: any;

  beforeEach(() => {
    // Set required environment variables
    process.env.GITEA_API_URL = "https://your-gitea-instance/api/v1";
    process.env.GITEA_TOKEN = "test-token";

    // Spy on console methods
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Spy on fetch
    fetchSpy = spyOn(global, "fetch");

    // Spy on Bun.$
    bunSpy = spyOn(Bun, "$");
    bunSpy.mockImplementation(
      (strings: TemplateStringsArray, ...values: any[]) => ({
        quiet: () => Promise.resolve({ stdout: Buffer.from("0") }),
      }),
    );
  });

  afterEach(() => {
    // Restore spy
    bunSpy?.mockRestore?.();

    // Cleanup environment variables
    delete process.env.GITEA_API_URL;
    delete process.env.GITEA_TOKEN;
  });

  test("should return no branch link and not delete when branch is undefined", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      "owner",
      "repo",
      undefined,
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test.skip("should mark branch for deletion when commit signing is enabled and no commits", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.resolve({ ok: true } as Response);
    });

    // Update mock to handle different scenarios
    bunSpy.mockImplementation(
      (strings: TemplateStringsArray, ...values: any[]) => {
        const cmd = strings[0];
        // For rev-list, return 0 commits
        if (cmd.includes("rev-list")) {
          return {
            quiet: () => Promise.resolve({ stdout: Buffer.from("0") }),
          };
        }
        // For git push (delete), succeed
        if (cmd.includes("delete")) {
          return {
            quiet: () => Promise.resolve({ stdout: Buffer.from("") }),
          };
        }
        return {
          quiet: () => Promise.resolve({ stdout: Buffer.from("0") }),
        };
      },
    );

    const result = await checkAndCommitOrDeleteBranch(
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      true, // commit signing enabled
    );

    expect(result.shouldDeleteBranch).toBe(true);
    expect(result.branchLink).toBe("");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Branch claude/issue-123-20240101-1234 has no commits from Claude, will delete it",
    );
  });

  test("should not delete branch and return link when branch has commits", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.resolve({ ok: true } as Response);
    });

    const result = await checkAndCommitOrDeleteBranch(
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe(
      `\n[View branch](${GITEA_SERVER_URL}/owner/repo/src/branch/claude/issue-123-20240101-1234)`,
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("has no commits"),
    );
  });

  test("should handle branch comparison errors gracefully", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.resolve({ ok: true } as Response);
    });

    const result = await checkAndCommitOrDeleteBranch(
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe(
      `\n[View branch](${GITEA_SERVER_URL}/owner/repo/src/branch/claude/issue-123-20240101-1234)`,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error comparing commits on Claude branch:",
      expect.any(Error),
    );
  });

  test.skip("should handle branch deletion errors gracefully", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.resolve({ ok: true } as Response);
    });

    const result = await checkAndCommitOrDeleteBranch(
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      true, // commit signing enabled - will try to delete
    );

    expect(result.shouldDeleteBranch).toBe(true);
    expect(result.branchLink).toBe("");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to delete branch claude/issue-123-20240101-1234:",
      expect.any(Error),
    );
  });

  test("should return no branch link when branch doesn't exist remotely", async () => {
    fetchSpy.mockImplementation(() => {
      return Promise.resolve({ ok: false } as Response);
    });

    const result = await checkAndCommitOrDeleteBranch(
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Branch claude/issue-123-20240101-1234 does not exist remotely, no branch link will be added",
    );
  });
});
