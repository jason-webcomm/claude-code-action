import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { prepareMcpConfig } from "../src/mcp/install-mcp-server";
import * as core from "../src/gitea-actions/core";
import type { GiteaContext } from "../src/github/context";
import { CLAUDE_APP_BOT_ID, CLAUDE_BOT_LOGIN } from "../src/github/constants";

describe("prepareMcpConfig", () => {
  let consoleInfoSpy: any;
  let consoleWarningSpy: any;
  let setFailedSpy: any;
  let processExitSpy: any;

  // Create a mock context for tests
  const mockContext: GiteaContext = {
    runId: "test-run-id",
    eventName: "issue_comment",
    eventAction: "created",
    repository: {
      full_name: "test-owner/test-repo",
      owner: "test-owner",
      repo: "test-repo",
    },
    actor: "test-actor",
    payload: {} as any,
    entityNumber: 123,
    isPR: false,
    inputs: {
      prompt: "",
      triggerPhrase: "@claude",
      assigneeTrigger: "",
      labelTrigger: "",
      branchPrefix: "",
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
  };

  const mockPRContext: GiteaContext = {
    ...mockContext,
    eventName: "pull_request",
    isPR: true,
    entityNumber: 456,
  };

  const mockContextWithSigning: GiteaContext = {
    ...mockContext,
    inputs: {
      ...mockContext.inputs,
      useCommitSigning: true,
    },
  };

  beforeEach(() => {
    consoleInfoSpy = spyOn(core, "info").mockImplementation(() => {});
    consoleWarningSpy = spyOn(core, "warning").mockImplementation(() => {});
    setFailedSpy = spyOn(core, "setFailed").mockImplementation(() => {});
    processExitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("Process exit");
    });

    // Set up required environment variables
    if (!process.env.GITEA_ACTION_PATH) {
      process.env.GITEA_ACTION_PATH = "/test/action/path";
    }
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarningSpy.mockRestore();
    setFailedSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  test("should return comment server when commit signing is disabled", async () => {
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      context: mockContext,
      mode: "tag",
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.github).not.toBeDefined();
    expect(parsed.mcpServers.github_file_ops).not.toBeDefined();
    expect(parsed.mcpServers.gitea_comment).toBeDefined();
    expect(parsed.mcpServers.gitea_comment.env.GITEA_TOKEN).toBe("test-token");
  });

  test("should include file ops server when commit signing is enabled", async () => {
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockContextWithSigning,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.github).not.toBeDefined();
    expect(parsed.mcpServers.gitea_file_ops).toBeDefined();
    expect(parsed.mcpServers.gitea_file_ops.env.GITEA_TOKEN).toBe("test-token");
    expect(parsed.mcpServers.gitea_file_ops.env.BRANCH_NAME).toBe(
      "test-branch",
    );
  });

  test("should include gitea MCP server when mcp__gitea__ tools are allowed", async () => {
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: ["mcp__gitea__create_issue", "mcp__gitea__create_pr"],
      mode: "tag",
      context: mockContext,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.gitea).toBeDefined();
    expect(parsed.mcpServers.gitea.command).toBe("docker");
    expect(parsed.mcpServers.gitea.env.GITEA_PERSONAL_ACCESS_TOKEN).toBe(
      "test-token",
    );
  });

  test("should include inline comment server for PRs when tools are allowed", async () => {
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: ["mcp__gitea_inline_comment__create_inline_comment"],
      mode: "tag",
      context: mockPRContext,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.gitea_inline_comment).toBeDefined();
    expect(parsed.mcpServers.gitea_inline_comment.env.GITEA_TOKEN).toBe(
      "test-token",
    );
    expect(parsed.mcpServers.gitea_inline_comment.env.PR_NUMBER).toBe("456");
  });

  test("should include comment server when no Gitea tools are allowed and signing disabled", async () => {
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockContext,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.github).not.toBeDefined();
    expect(parsed.mcpServers.github_file_ops).not.toBeDefined();
    expect(parsed.mcpServers.gitea_comment).toBeDefined();
  });

  test("should set GITEA_ACTION_PATH correctly", async () => {
    process.env.GITEA_ACTION_PATH = "/test/action/path";

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockContextWithSigning,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_file_ops.args).toContain(
      "/test/action/path/src/mcp/gitea-file-ops-server.ts",
    );
  });

  test("should use current working directory when GITEA_WORKSPACE is not set", async () => {
    delete process.env.GITEA_WORKSPACE;

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockContextWithSigning,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_file_ops.env.REPO_DIR).toBe(process.cwd());
  });

  test("should include CI server when context.isPR is true and DEFAULT_WORKFLOW_TOKEN exists", async () => {
    process.env.DEFAULT_WORKFLOW_TOKEN = "workflow-token";

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockPRContext,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_actions).toBeDefined();
    expect(parsed.mcpServers.gitea_actions.env.GITEA_TOKEN).toBe(
      "workflow-token",
    );
    expect(parsed.mcpServers.gitea_actions.env.PR_NUMBER).toBe("456");

    delete process.env.DEFAULT_WORKFLOW_TOKEN;
  });

  test("should not include gitea_actions server when context.isPR is false", async () => {
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockContext,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_actions).not.toBeDefined();
  });

  test("should not include gitea_actions server when DEFAULT_WORKFLOW_TOKEN is missing", async () => {
    delete process.env.DEFAULT_WORKFLOW_TOKEN;

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context: mockPRContext,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_actions).not.toBeDefined();
  });
});
