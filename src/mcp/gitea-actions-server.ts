#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GITEA_API_URL, GITEA_TOKEN } from "../github/api/config";
import { mkdir, writeFile } from "fs/promises";

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const PR_NUMBER = process.env.PR_NUMBER;
const GITEA_TOKEN = process.env.GITEA_TOKEN;
const RUNNER_TEMP = process.env.RUNNER_TEMP || "/tmp";

if (!REPO_OWNER || !REPO_NAME || !PR_NUMBER || !GITEA_TOKEN) {
  console.error(
    "[Gitea Actions Server] Error: REPO_OWNER, REPO_NAME, PR_NUMBER, and GITEA_TOKEN environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "Gitea Actions Server",
  version: "0.0.1",
});

console.error("[Gitea Actions Server] MCP Server instance created");

server.tool(
  "get_ci_status",
  "Get CI status summary for this PR",
  {
    status: z
      .enum([
        "success",
        "failure",
        "pending",
        "running",
        "cancelled",
        "skipped",
      ])
      .optional()
      .describe("Filter workflow runs by status"),
  },
  async ({ status }) => {
    try {
      // Gitea Actions API endpoint for listing workflow runs
      const runsUrl = `${GITEA_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs`;
      const url = status ? `${runsUrl}?status=${status}` : runsUrl;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `token ${GITEA_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch CI status: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();

      // Parse the response and format it
      const runs = Array.isArray(data) ? data : data.runs || [];
      const totalRuns = runs.length;
      const failed = runs.filter(
        (r: any) => r.status === "failure" || r.status === "cancelled",
      ).length;
      const passed = runs.filter((r: any) => r.status === "success").length;
      const pending = runs.filter(
        (r: any) => r.status === "pending" || r.status === "running",
      ).length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                summary: {
                  total_runs: totalRuns,
                  failed: failed,
                  passed: passed,
                  pending: pending,
                },
                runs: runs.map((run: any) => ({
                  id: run.id,
                  name: run.name,
                  status: run.status,
                  number: run.number,
                  event: run.event,
                  created_at: run.created_at,
                  updated_at: run.updated_at,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in get_ci_status:", errorMessage);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

server.tool(
  "get_workflow_run_details",
  "Get job and step details for a workflow run",
  {
    run_id: z.number().describe("The workflow run ID"),
  },
  async ({ run_id }) => {
    try {
      // Gitea Actions API endpoint for workflow run details and jobs
      const runUrl = `${GITEA_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${run_id}`;
      const jobsUrl = `${GITEA_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${run_id}/jobs`;

      const [runResponse, jobsResponse] = await Promise.all([
        fetch(runUrl, {
          headers: {
            Accept: "application/json",
            Authorization: `token ${GITEA_TOKEN}`,
          },
        }),
        fetch(jobsUrl, {
          headers: {
            Accept: "application/json",
            Authorization: `token ${GITEA_TOKEN}`,
          },
        }),
      ]);

      if (!runResponse.ok || !jobsResponse.ok) {
        const errorText = await (
          runResponse.ok ? jobsResponse : runResponse
        ).text();
        throw new Error(
          `Failed to fetch workflow run details: ${(runResponse.ok ? jobsResponse : runResponse).status} - ${errorText}`,
        );
      }

      const runData = await runResponse.json();
      const jobsData = await jobsResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                run: {
                  id: runData.id,
                  name: runData.name,
                  number: runData.number,
                  event: runData.event,
                  status: runData.status,
                  conclusion: runData.conclusion,
                  created_at: runData.created_at,
                  updated_at: runData.updated_at,
                  started_at: runData.started_at,
                  completed_at: runData.completed_at,
                },
                jobs: Array.isArray(jobsData)
                  ? jobsData.map((job: any) => ({
                      id: job.id,
                      name: job.name,
                      status: job.status,
                      conclusion: job.conclusion,
                      started_at: job.started_at,
                      completed_at: job.completed_at,
                      steps: job.steps || [],
                    }))
                  : [],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in get_workflow_run_details:", errorMessage);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

server.tool(
  "download_job_log",
  "Download job logs to disk",
  {
    job_id: z.number().describe("The job ID"),
  },
  async ({ job_id }) => {
    try {
      // Gitea Actions API endpoint for job logs
      const logUrl = `${GITEA_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/actions/jobs/${job_id}/logs`;

      const response = await fetch(logUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `token ${GITEA_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch job logs: ${response.status} - ${errorText}`,
        );
      }

      const logContent = await response.text();

      const logsDir = `${RUNNER_TEMP}/gitea-actions-logs`;
      await mkdir(logsDir, { recursive: true });

      const logPath = `${logsDir}/job-${job_id}.log`;
      await writeFile(logPath, logContent, "utf-8");

      const result = {
        path: logPath,
        size_bytes: logContent.length,
        job_id: job_id,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in download_job_log:", errorMessage);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  try {
    const transport = new StdioServerTransport();

    await server.connect(transport);

    process.on("exit", () => {
      server.close();
    });
  } catch (error) {
    throw error;
  }
}

runServer().catch(() => {
  process.exit(1);
});
