import * as core from "../gitea-actions/core";
import { GITEA_API_URL, GITEA_SERVER_URL } from "../github/api/config";
import type { GiteaContext } from "../github/context";
import { isEntityContext } from "../github/context";
import type { AutoDetectedMode } from "../modes/detector";

type PrepareConfigParams = {
  giteaToken: string;
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
  claudeCommentId?: string;
  allowedTools: string[];
  mode: AutoDetectedMode;
  context: GiteaContext;
};

async function checkActionsReadPermission(
  token: string,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    // Try to list workflow runs - this requires actions:read
    // We use page=1 with limit=1 to minimize the response size
    // Gitea Actions API endpoint (to be verified in Task 41)
    // GET /repos/{owner}/{repo}/actions/runs?limit=1
    const runsUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/actions/runs?limit=1`;
    const response = await fetch(runsUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `token ${token}`,
      },
    });

    if (response.ok) {
      return true;
    }

    // Check if it's a permission error
    if (response.status === 403) {
      return false;
    }

    // For other errors (network issues, etc), log but don't fail
    core.debug(`Failed to check actions permission: ${response.status}`);
    return false;
  } catch (error: any) {
    core.debug(`Failed to check actions permission: ${error.message}`);
    return false;
  }
}

export async function prepareMcpConfig(
  params: PrepareConfigParams,
): Promise<string> {
  const {
    giteaToken,
    owner,
    repo,
    branch,
    baseBranch,
    claudeCommentId,
    allowedTools,
    context,
    mode,
  } = params;
  try {
    const allowedToolsList = allowedTools || [];

    // Detect if we're in agent mode (explicit prompt provided)
    const isAgentMode = mode === "agent";

    const hasGiteaCommentTools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_comment__"),
    );

    const hasGiteaMcpTools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea__"),
    );

    const hasInlineCommentTools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_inline_comment__"),
    );

    const hasGiteaCITools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_actions__"),
    );

    const baseMcpConfig: { mcpServers: Record<string, unknown> } = {
      mcpServers: {},
    };

    // Include comment server:
    // - Always in tag mode (for updating Claude comments)
    // - Only with explicit tools in agent mode
    const shouldIncludeCommentServer = !isAgentMode || hasGiteaCommentTools;

    if (shouldIncludeCommentServer) {
      baseMcpConfig.mcpServers.gitea_comment = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-comment-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          ...(claudeCommentId && { CLAUDE_COMMENT_ID: claudeCommentId }),
          GITEA_EVENT_NAME: process.env.GITEA_EVENT_NAME || "",
          GITEA_API_URL: GITEA_API_URL,
        },
      };
    }

    // Include file ops server when commit signing is enabled
    if (context.inputs.useCommitSigning) {
      baseMcpConfig.mcpServers.gitea_file_ops = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-file-ops-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          BRANCH_NAME: branch,
          BASE_BRANCH: baseBranch,
          REPO_DIR: process.env.GITEA_WORKSPACE || process.cwd(),
          GITEA_EVENT_NAME: process.env.GITEA_EVENT_NAME || "",
          IS_PR: process.env.IS_PR || "false",
          GITEA_API_URL: GITEA_API_URL,
        },
      };
    }

    // Include inline comment server for PRs when requested via allowed tools
    if (
      isEntityContext(context) &&
      context.isPR &&
      (hasGiteaMcpTools || hasInlineCommentTools)
    ) {
      baseMcpConfig.mcpServers.gitea_inline_comment = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-inline-comment-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          PR_NUMBER: context.entityNumber?.toString() || "",
          GITEA_API_URL: GITEA_API_URL,
        },
      };
    }

    // CI server is included when:
    // - In tag mode: when we have a workflow token and context is a PR
    // - In agent mode: same conditions PLUS explicit CI tools in allowedTools
    const hasWorkflowToken = !!process.env.DEFAULT_WORKFLOW_TOKEN;
    const shouldIncludeCIServer =
      (!isAgentMode || hasGiteaCITools) &&
      isEntityContext(context) &&
      context.isPR &&
      hasWorkflowToken;

    if (shouldIncludeCIServer) {
      // Verify the token actually has actions:read permission
      const actuallyHasPermission = await checkActionsReadPermission(
        process.env.DEFAULT_WORKFLOW_TOKEN || "",
        owner,
        repo,
      );

      if (!actuallyHasPermission) {
        core.warning(
          "The gitea_actions MCP server requires 'actions: read' permission. " +
            "Please ensure your Gitea token has this permission.",
        );
      }
      baseMcpConfig.mcpServers.gitea_actions = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-actions-server.ts`,
        ],
        env: {
          // Use workflow gitea token, not app token
          GITEA_TOKEN: process.env.DEFAULT_WORKFLOW_TOKEN,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          PR_NUMBER: context.entityNumber?.toString() || "",
          RUNNER_TEMP: process.env.RUNNER_TEMP || "/tmp",
        },
      };
    }

    if (hasGiteaMcpTools) {
      // Use official Gitea MCP server from https://gitea.com/gitea/gitea-mcp
      // Task 40: Verified - Official Gitea MCP server is available
      // Provides full Gitea API access via MCP protocol
      baseMcpConfig.mcpServers.gitea = {
        command: "docker",
        args: [
          "run",
          "-i",
          "--rm",
          "-e",
          "GITEA_PERSONAL_ACCESS_TOKEN",
          "-e",
          "GITEA_HOST",
          "gitea/gitea-mcp-server:latest",
        ],
        env: {
          GITEA_PERSONAL_ACCESS_TOKEN: giteaToken,
          GITEA_HOST: GITEA_SERVER_URL,
        },
      };
    }

    // Return only our Gitea servers config
    // User's config will be passed as separate --mcp-config flags
    return JSON.stringify(baseMcpConfig, null, 2);
  } catch (error) {
    core.setFailed(`Install MCP server failed with error: ${error}`);
    process.exit(1);
  }
}
