import type { GiteaWebhookPayload } from "./types";
import { readFileSync } from "fs";

// Custom types for Gitea Actions events
export type WorkflowDispatchEvent = {
  action?: never;
  inputs?: Record<string, any>;
  ref?: string;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
  workflow: string;
};

export type RepositoryDispatchEvent = {
  action: string;
  client_payload?: Record<string, any>;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
};

export type ScheduleEvent = {
  action?: never;
  schedule?: string;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
};

// Event name constants for better maintainability
const ENTITY_EVENT_NAMES = ["issues", "issue_comment", "pull_request"] as const;

const AUTOMATION_EVENT_NAMES = [
  "workflow_dispatch",
  "repository_dispatch",
  "schedule",
  "workflow_run",
] as const;

// Derive types from constants for better maintainability
type EntityEventName = (typeof ENTITY_EVENT_NAMES)[number];
type AutomationEventName = (typeof AUTOMATION_EVENT_NAMES)[number];

// Common fields shared by all context types
type BaseContext = {
  runId: string;
  eventAction?: string;
  repository: {
    owner: string;
    repo: string;
    full_name: string;
  };
  actor: string;
  inputs: {
    prompt: string;
    triggerPhrase: string;
    assigneeTrigger: string;
    labelTrigger: string;
    baseBranch?: string;
    branchPrefix: string;
    useStickyComment: boolean;
    useCommitSigning: boolean;
    sshSigningKey: string;
    botId: string;
    botName: string;
    allowedBots: string;
    allowedNonWriteUsers: string;
    trackProgress: boolean;
    includeFixLinks: boolean;
  };
};

// Context for entity-based events (issues, PRs, comments)
export type GiteaContext = BaseContext & {
  eventName: EntityEventName | AutomationEventName;
  payload:
    | GiteaWebhookPayload
    | WorkflowDispatchEvent
    | RepositoryDispatchEvent
    | ScheduleEvent;
  entityNumber?: number;
  isPR?: boolean;
};

// Helper to parse repository from Gitea format
function parseRepository(repoString: string): {
  owner: string;
  repo: string;
  full_name: string;
} {
  const [owner, repo] = repoString.split("/");
  return {
    owner,
    repo,
    full_name: repoString,
  };
}

export function parseGiteaContext(): GiteaContext {
  const eventName = process.env.GITHUB_EVENT_NAME || "";
  const runId = process.env.GITEA_RUN_ID || "";

  // Log all relevant environment variables for debugging
  console.log("Environment variables:");
  console.log(`  GITHUB_EVENT_NAME: "${process.env.GITHUB_EVENT_NAME || ""}"`);
  console.log(`  GITEA_RUN_ID: "${process.env.GITEA_RUN_ID || ""}"`);
  console.log(`  GITHUB_REPOSITORY: "${process.env.GITHUB_REPOSITORY || ""}"`);
  console.log(`  GITEA_REPOSITORY: "${process.env.GITEA_REPOSITORY || ""}"`);
  console.log(`  GITHUB_ACTOR: "${process.env.GITHUB_ACTOR || ""}"`);
  console.log(`  GITHUB_EVENT_PATH: "${process.env.GITHUB_EVENT_PATH || ""}"`);

  const repository = parseRepository(
    process.env.GITHUB_REPOSITORY || process.env.GITEA_REPOSITORY || "",
  );
  console.log(`Parsed repository:`, repository);
  const actor = process.env.GITHUB_ACTOR || "";

  // Parse webhook payload if available
  let payload:
    | GiteaWebhookPayload
    | WorkflowDispatchEvent
    | RepositoryDispatchEvent
    | ScheduleEvent = {};

  try {
    const payloadPath = process.env.GITHUB_EVENT_PATH || "";
    let payloadJson = "{}";
    if (payloadPath) {
      try {
        // Use synchronous read to work in both Bun and act environments
        const text = readFileSync(payloadPath, "utf-8");
        console.log(`Payload path: ${payloadPath}`);
        console.log(`Payload text length: ${text.length}`);
        payloadJson = text;
      } catch (err) {
        console.warn("Failed to read event file:", err);
        payloadJson = "{}";
      }
    }
    payload = JSON.parse(payloadJson) as GiteaWebhookPayload;
    console.log(`Parsed payload keys:`, Object.keys(payload));
  } catch (error) {
    console.warn("Failed to parse GITHUB_EVENT_PATH:", error);
  }

  const commonFields = {
    runId,
    eventAction: payload.action,
    repository,
    actor,
    inputs: {
      prompt: process.env.PROMPT || "",
      triggerPhrase: process.env.TRIGGER_PHRASE ?? "@claude",
      assigneeTrigger: process.env.ASSIGNEE_TRIGGER ?? "",
      labelTrigger: process.env.LABEL_TRIGGER ?? "",
      baseBranch: process.env.BASE_BRANCH,
      branchPrefix: process.env.BRANCH_PREFIX ?? "claude/",
      useStickyComment: process.env.USE_STICKY_COMMENT === "true",
      useCommitSigning: process.env.USE_COMMIT_SIGNING === "true",
      sshSigningKey: process.env.SSH_SIGNING_KEY || "",
      botId: process.env.BOT_ID ?? "",
      botName: process.env.BOT_NAME ?? "",
      allowedBots: process.env.ALLOWED_BOTS ?? "",
      allowedNonWriteUsers: process.env.ALLOWED_NON_WRITE_USERS ?? "",
      trackProgress: process.env.TRACK_PROGRESS === "true",
      includeFixLinks: process.env.INCLUDE_FIX_LINKS === "true",
    },
  };

  switch (eventName) {
    case "issues": {
      const giteaPayload = payload as GiteaWebhookPayload;
      return {
        ...commonFields,
        eventName: "issues",
        payload: giteaPayload,
        entityNumber: giteaPayload.number,
        isPR: false,
      };
    }
    case "issue_comment": {
      const giteaPayload = payload as GiteaWebhookPayload;
      return {
        ...commonFields,
        eventName: "issue_comment",
        payload: giteaPayload,
        entityNumber: giteaPayload.number ?? giteaPayload.issue?.number,
        isPR:
          giteaPayload.is_pull === true ||
          giteaPayload.pull_request !== undefined,
      };
    }
    case "pull_request": {
      const giteaPayload = payload as GiteaWebhookPayload;
      return {
        ...commonFields,
        eventName: "pull_request",
        payload: giteaPayload,
        entityNumber: giteaPayload.number,
        isPR: true,
      };
    }
    case "workflow_dispatch": {
      return {
        ...commonFields,
        eventName: "workflow_dispatch",
        payload: payload as unknown as WorkflowDispatchEvent,
      };
    }
    case "repository_dispatch": {
      return {
        ...commonFields,
        eventName: "repository_dispatch",
        payload: payload as unknown as RepositoryDispatchEvent,
      };
    }
    case "schedule": {
      return {
        ...commonFields,
        eventName: "schedule",
        payload: payload as unknown as ScheduleEvent,
      };
    }
    case "workflow_run": {
      return {
        ...commonFields,
        eventName: "workflow_run",
        payload: payload as unknown as any,
      };
    }
    default:
      throw new Error(`Unsupported event type: ${eventName}`);
  }
}

export function isIssuesEvent(
  context: GiteaContext,
): context is GiteaContext & { payload: GiteaWebhookPayload } {
  return context.eventName === "issues";
}

export function isIssueCommentEvent(
  context: GiteaContext,
): context is GiteaContext & { payload: GiteaWebhookPayload } {
  return context.eventName === "issue_comment";
}

export function isPullRequestEvent(
  context: GiteaContext,
): context is GiteaContext & { payload: GiteaWebhookPayload } {
  return context.eventName === "pull_request";
}

export function isIssuesAssignedEvent(
  context: GiteaContext,
): context is GiteaContext & { payload: GiteaWebhookPayload } {
  return isIssuesEvent(context) && context.eventAction === "assigned";
}

// Type guard to check if context is an entity context (has entityNumber and isPR)
export function isEntityContext(
  context: GiteaContext,
): context is GiteaContext & { entityNumber: number; isPR: boolean } {
  return (
    ENTITY_EVENT_NAMES.includes(context.eventName as EntityEventName) &&
    context.entityNumber !== undefined
  );
}

// Type guard to check if context is an automation context
export function isAutomationContext(
  context: GiteaContext,
): context is GiteaContext {
  return AUTOMATION_EVENT_NAMES.includes(
    context.eventName as AutomationEventName,
  );
}
