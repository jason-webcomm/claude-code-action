import type { GiteaContext, AutomationContext } from "../src/github/context";
import { CLAUDE_APP_BOT_ID, CLAUDE_BOT_LOGIN } from "../src/github/constants";

const defaultInputs = {
  prompt: "",
  triggerPhrase: "/claude",
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
};

const defaultRepository = {
  owner: "test-owner",
  repo: "test-repo",
  full_name: "test-owner/test-repo",
};

type MockContextOverrides = Omit<Partial<GiteaContext>, "inputs"> & {
  inputs?: Partial<GiteaContext["inputs"]>;
};

export const createMockContext = (
  overrides: MockContextOverrides = {},
): GiteaContext => {
  const baseContext: GiteaContext = {
    runId: "1234567890",
    eventName: "issue_comment", // Default to a valid entity event
    eventAction: "",
    repository: defaultRepository,
    actor: "test-actor",
    payload: {} as any,
    entityNumber: 1,
    isPR: false,
    inputs: defaultInputs,
  };

  const mergedInputs = overrides.inputs
    ? { ...defaultInputs, ...overrides.inputs }
    : defaultInputs;

  return { ...baseContext, ...overrides, inputs: mergedInputs };
};

type MockAutomationOverrides = Omit<Partial<AutomationContext>, "inputs"> & {
  inputs?: Partial<AutomationContext["inputs"]>;
};

export const createMockAutomationContext = (
  overrides: MockAutomationOverrides = {},
): AutomationContext => {
  const baseContext: AutomationContext = {
    runId: "1234567890",
    eventName: "workflow_dispatch",
    eventAction: undefined,
    repository: defaultRepository,
    actor: "test-actor",
    payload: {} as any,
    inputs: defaultInputs,
  };

  const mergedInputs = overrides.inputs
    ? { ...defaultInputs, ...overrides.inputs }
    : { ...defaultInputs };

  return { ...baseContext, ...overrides, inputs: mergedInputs };
};

export const mockRepositoryDispatchContext: AutomationContext = {
  runId: "1234567890",
  eventName: "repository_dispatch",
  eventAction: undefined,
  repository: defaultRepository,
  actor: "automation-user",
  payload: {
    action: "trigger-analysis",
    client_payload: {
      source: "issue-detective",
      issue_number: 42,
      repository_name: "test-owner/test-repo",
      analysis_type: "bug-report",
    },
    repository: {
      name: "test-repo",
      owner: {
        login: "test-owner",
      },
    },
    sender: {
      login: "automation-user",
    },
  } as any,
  inputs: defaultInputs,
};

export const mockIssueOpenedContext: GiteaContext = {
  runId: "1234567890",
  eventName: "issues",
  eventAction: "opened",
  repository: defaultRepository,
  actor: "john-doe",
  payload: {
    action: "opened",
    issue: {
      number: 42,
      title: "Bug: Application crashes on startup",
      body: "## Description\n\nThe application crashes immediately after launching.\n\n## Steps to reproduce\n\n1. Install the app\n2. Launch it\n3. See crash\n\n/claude please help me fix this",
      assignee: null,
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-15T10:30:00Z",
      html_url: "https://github.com/test-owner/test-repo/issues/42",
      user: {
        login: "john-doe",
        id: 12345,
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      private: false,
      owner: {
        login: "test-owner",
      },
    },
  } as any,
  entityNumber: 42,
  isPR: false,
  inputs: defaultInputs,
};

export const mockIssueAssignedContext: GiteaContext = {
  runId: "1234567890",
  eventName: "issues",
  eventAction: "assigned",
  repository: defaultRepository,
  actor: "admin-user",
  payload: {
    action: "assigned",
    assignee: {
      login: "claude-bot",
      id: 11111,
      avatar_url: "https://avatars.githubusercontent.com/u/11111",
      html_url: "https://github.com/claude-bot",
    },
    issue: {
      number: 123,
      title: "Feature: Add dark mode support",
      body: "We need dark mode for better user experience",
      user: {
        login: "jane-smith",
        id: 67890,
        avatar_url: "https://avatars.githubusercontent.com/u/67890",
        html_url: "https://github.com/jane-smith",
      },
      assignee: {
        login: "claude-bot",
        id: 11111,
        avatar_url: "https://avatars.githubusercontent.com/u/11111",
        html_url: "https://github.com/claude-bot",
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      private: false,
      owner: {
        login: "test-owner",
      },
    },
  } as any,
  entityNumber: 123,
  isPR: false,
  inputs: { ...defaultInputs, assigneeTrigger: "@claude-bot" },
};

export const mockIssueLabeledContext: GiteaContext = {
  runId: "1234567890",
  eventName: "issues",
  eventAction: "labeled",
  repository: defaultRepository,
  actor: "admin-user",
  payload: {
    action: "labeled",
    issue: {
      number: 1234,
      title: "Enhancement: Improve search functionality",
      body: "The current search is too slow and needs optimization",
      user: {
        login: "alice-wonder",
        id: 54321,
        avatar_url: "https://avatars.githubusercontent.com/u/54321",
        html_url: "https://github.com/alice-wonder",
      },
      assignee: null,
    },
    label: {
      id: 987654321,
      name: "claude-task",
      color: "f29513",
      description: "Label for Claude AI interactions",
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      private: false,
      owner: {
        login: "test-owner",
      },
    },
  } as any,
  entityNumber: 1234,
  isPR: false,
  inputs: { ...defaultInputs, labelTrigger: "claude-task" },
};

// Issue comment on issue event
export const mockIssueCommentContext: GiteaContext = {
  runId: "1234567890",
  eventName: "issue_comment",
  eventAction: "created",
  repository: defaultRepository,
  actor: "contributor-user",
  payload: {
    action: "created",
    comment: {
      id: 12345678,
      body: "@claude can you help explain how to configure the logging system?",
      user: {
        login: "contributor-user",
        id: 88888,
        avatar_url: "https://avatars.githubusercontent.com/u/88888",
        html_url: "https://github.com/contributor-user",
      },
      created_at: "2024-01-15T12:30:00Z",
      updated_at: "2024-01-15T12:30:00Z",
      html_url:
        "https://github.com/test-owner/test-repo/issues/55#issuecomment-12345678",
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      private: false,
      owner: {
        login: "test-owner",
      },
    },
  } as any,
  entityNumber: 55,
  isPR: false,
  inputs: { ...defaultInputs, triggerPhrase: "@claude" },
};

export const mockPullRequestCommentContext: GiteaContext = {
  runId: "1234567890",
  eventName: "issue_comment",
  eventAction: "created",
  repository: defaultRepository,
  actor: "reviewer-user",
  payload: {
    action: "created",
    issue: {
      number: 789,
      title: "Fix: Memory leak in user service",
      body: "This PR fixes the memory leak issue reported in #788",
      user: {
        login: "developer-user",
        id: 77777,
        avatar_url: "https://avatars.githubusercontent.com/u/77777",
        html_url: "https://github.com/developer-user",
      },
      pull_request: {
        url: "https://api.github.com/repos/test-owner/test-repo/pulls/789",
        html_url: "https://github.com/test-owner/test-repo/pull/789",
        diff_url: "https://github.com/test-owner/test-repo/pull/789.diff",
        patch_url: "https://github.com/test-owner/test-repo/pull/789.patch",
      },
    },
    comment: {
      id: 87654321,
      body: "/claude please review the changes and ensure we're not introducing any new memory issues",
      user: {
        login: "reviewer-user",
        id: 66666,
        avatar_url: "https://avatars.githubusercontent.com/u/66666",
        html_url: "https://github.com/reviewer-user",
      },
      created_at: "2024-01-15T13:15:00Z",
      updated_at: "2024-01-15T13:15:00Z",
      html_url:
        "https://github.com/test-owner/test-repo/pull/789#issuecomment-87654321",
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      private: false,
      owner: {
        login: "test-owner",
      },
    },
  } as any,
  entityNumber: 789,
  isPR: true,
  inputs: defaultInputs,
};

export const mockPullRequestOpenedContext: GiteaContext = {
  runId: "1234567890",
  eventName: "pull_request",
  eventAction: "opened",
  repository: defaultRepository,
  actor: "feature-developer",
  payload: {
    action: "opened",
    number: 456,
    pull_request: {
      number: 456,
      title: "Feature: Add user authentication",
      body: "## Summary\n\nThis PR adds JWT-based authentication to the API.\n\n## Changes\n\n- Added auth middleware\n- Added login endpoint\n- Added JWT token generation\n\n/claude please review the security aspects",
      user: {
        login: "feature-developer",
        id: 55555,
        avatar_url: "https://avatars.githubusercontent.com/u/55555",
        html_url: "https://github.com/feature-developer",
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      private: false,
      owner: {
        login: "test-owner",
      },
    },
  } as any,
  entityNumber: 456,
  isPR: true,
  inputs: defaultInputs,
};

// Gitea does not have pull_request_review or pull_request_review_comment events
// These GitHub-specific event types are not supported in Gitea
