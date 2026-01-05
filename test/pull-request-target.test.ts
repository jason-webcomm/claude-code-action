#!/usr/bin/env bun

import { describe, test, expect } from "bun:test";
import {
  getEventTypeAndContext,
  generatePrompt,
  generateDefaultPrompt,
} from "../src/create-prompt";
import type { PreparedContext } from "../src/create-prompt";
import type { Mode } from "../src/modes/types";

describe("pull_request event support", () => {
  // Mock tag mode for testing
  const mockTagMode: Mode = {
    name: "tag",
    description: "Tag mode",
    shouldTrigger: () => true,
    prepareContext: (context) => ({ mode: "tag", giteaContext: context }),
    getAllowedTools: () => [],
    getDisallowedTools: () => [],
    shouldCreateTrackingComment: () => true,
    generatePrompt: (context, githubData, useCommitSigning) =>
      generateDefaultPrompt(context, githubData, useCommitSigning),
    prepare: async () => ({
      commentId: 123,
      branchInfo: {
        baseBranch: "main",
        currentBranch: "main",
        claudeBranch: undefined,
      },
      mcpConfig: "{}",
    }),
  };

  const mockGitHubData = {
    contextData: {
      id: 123,
      number: 123,
      title: "External PR via pull_request_target",
      body: "This PR comes from a forked repository",
      user: {
        login: "external-contributor",
      },
      base: {
        label: "main",
        ref: "main",
        sha: "def456",
        repo: {
          full_name: "owner/repo",
          html_url: "https://example.com/owner/repo",
        },
      },
      head: {
        label: "feature-branch",
        ref: "feature-branch",
        sha: "abc123",
        repo: {
          full_name: "external/repo",
          html_url: "https://example.com/external/repo",
        },
      },
      html_url: "https://example.com/owner/repo/pull/123",
      diff_url: "https://example.com/owner/repo/pull/123.diff",
      patch_url: "https://example.com/owner/repo/pull/123.patch",
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
      merged: false,
      state: "open",
      additions: 25,
      deletions: 3,
      changed_files: 2,
      commits: 2,
      review_comments: 0,
    },
    comments: [],
    changedFiles: [],
    changedFilesWithSHA: [
      {
        filename: "src/feature.ts",
        additions: 20,
        deletions: 2,
        status: "modified",
        changes: 22,
      },
      {
        filename: "tests/feature.test.ts",
        additions: 5,
        deletions: 1,
        status: "added",
        changes: 6,
      },
    ],
    imageUrlMap: new Map<string, string>(),
  };

  describe("prompt generation for pull_request", () => {
    test("should generate correct prompt for pull_request_target event", () => {
      const envVars: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "opened",
          isPR: true,
          prNumber: "123",
        },
      };

      const prompt = generatePrompt(
        envVars,
        mockGitHubData,
        false,
        mockTagMode,
      );

      // Should contain pull request event type and metadata
      expect(prompt).toContain("<event_type>PULL_REQUEST</event_type>");
      expect(prompt).toContain("<is_pr>true</is_pr>");
      expect(prompt).toContain("<pr_number>123</pr_number>");
      expect(prompt).toContain(
        "<trigger_context>pull request opened</trigger_context>",
      );

      // Should contain PR-specific information
      expect(prompt).toContain("- src/feature.ts (modified) +20/-2");
      expect(prompt).toContain("- tests/feature.test.ts (added) +5/-1");
      expect(prompt).toContain("external-contributor");
      expect(prompt).toContain("<repository>owner/repo</repository>");
    });

    test("should handle pull_request_target with commit signing disabled", () => {
      const envVars: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "synchronize",
          isPR: true,
          prNumber: "456",
        },
      };

      const prompt = generatePrompt(
        envVars,
        mockGitHubData,
        false,
        mockTagMode,
      );

      // Should include git commands for non-commit-signing mode
      expect(prompt).toContain("git push");
      expect(prompt).toContain(
        "Always push to the existing branch when triggered on a PR",
      );
      expect(prompt).toContain("mcp__gitea_comment__update_claude_comment");

      // Should not include commit signing tools
      expect(prompt).not.toContain("mcp__gitea_file_ops__commit_files");
    });

    test("should handle pull_request_target with commit signing enabled", () => {
      const envVars: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "synchronize",
          isPR: true,
          prNumber: "456",
        },
      };

      const prompt = generatePrompt(envVars, mockGitHubData, true, mockTagMode);

      // Should include commit signing tools
      expect(prompt).toContain("mcp__gitea_file_ops__commit_files");
      expect(prompt).toContain("mcp__gitea_file_ops__delete_files");
      expect(prompt).toContain("mcp__gitea_comment__update_claude_comment");

      // Should not include git command instructions
      expect(prompt).not.toContain("Use git commands via the Bash tool");
    });

    test("should treat pull_request_target same as pull_request in prompt generation", () => {
      const baseContext: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "opened",
          isPR: true,
          prNumber: "123",
        },
      };

      // Generate prompt for pull_request
      const pullRequestContext: PreparedContext = {
        ...baseContext,
        eventData: {
          ...baseContext.eventData,
          eventName: "pull_request",
          isPR: true,
          prNumber: "123",
        },
      };

      // Generate prompt for pull_request_target
      const pullRequestTargetContext: PreparedContext = {
        ...baseContext,
        eventData: {
          ...baseContext.eventData,
          eventName: "pull_request",
          isPR: true,
          prNumber: "123",
        },
      };

      const pullRequestPrompt = generatePrompt(
        pullRequestContext,
        mockGitHubData,
        false,
        mockTagMode,
      );
      const pullRequestTargetPrompt = generatePrompt(
        pullRequestTargetContext,
        mockGitHubData,
        false,
        mockTagMode,
      );

      // Both should have the same event type and structure
      expect(pullRequestPrompt).toContain(
        "<event_type>PULL_REQUEST</event_type>",
      );
      expect(pullRequestTargetPrompt).toContain(
        "<event_type>PULL_REQUEST</event_type>",
      );

      expect(pullRequestPrompt).toContain(
        "<trigger_context>pull request opened</trigger_context>",
      );
      expect(pullRequestTargetPrompt).toContain(
        "<trigger_context>pull request opened</trigger_context>",
      );

      // Both should contain PR-specific instructions
      expect(pullRequestPrompt).toContain(
        "Always push to the existing branch when triggered on a PR",
      );
      expect(pullRequestTargetPrompt).toContain(
        "Always push to the existing branch when triggered on a PR",
      );
    });

    test("should handle pull_request_target in agent mode with custom prompt", () => {
      const envVars: PreparedContext = {
        repository: "test/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        prompt: "Review this pull_request_target PR for security issues",
        eventData: {
          eventName: "pull_request",
          eventAction: "opened",
          isPR: true,
          prNumber: "789",
        },
      };

      // Use agent mode which passes through the prompt as-is
      const mockAgentMode: Mode = {
        name: "agent",
        description: "Agent mode",
        shouldTrigger: () => true,
        prepareContext: (context) => ({
          mode: "agent",
          githubContext: context,
        }),
        getAllowedTools: () => [],
        getDisallowedTools: () => [],
        shouldCreateTrackingComment: () => true,
        generatePrompt: (context) => context.prompt || "default prompt",
        prepare: async () => ({
          commentId: 123,
          branchInfo: {
            baseBranch: "main",
            currentBranch: "main",
            claudeBranch: undefined,
          },
          mcpConfig: "{}",
        }),
      };

      const prompt = generatePrompt(
        envVars,
        mockGitHubData,
        false,
        mockAgentMode,
      );

      expect(prompt).toBe(
        "Review this pull_request_target PR for security issues",
      );
    });

    test("should handle pull_request_target with no custom prompt", () => {
      const envVars: PreparedContext = {
        repository: "test/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "synchronize",
          isPR: true,
          prNumber: "456",
        },
      };

      const prompt = generatePrompt(
        envVars,
        mockGitHubData,
        false,
        mockTagMode,
      );

      // Should generate default prompt structure
      expect(prompt).toContain("<event_type>PULL_REQUEST</event_type>");
      expect(prompt).toContain("<pr_number>456</pr_number>");
      expect(prompt).toContain(
        "Always push to the existing branch when triggered on a PR",
      );
    });
  });

  describe("pull_request behavior consistency", () => {
    test("should produce identical event processing for both event types", () => {
      const baseEventData = {
        eventAction: "opened",
        isPR: true,
        prNumber: "100",
      };

      const pullRequestEvent: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          ...baseEventData,
          eventName: "pull_request",
          isPR: true,
          prNumber: "100",
        },
      };

      const pullRequestTargetEvent: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          ...baseEventData,
          eventName: "pull_request",
          isPR: true,
          prNumber: "100",
        },
      };

      // Both should have identical event type detection
      const prResult = getEventTypeAndContext(pullRequestEvent);
      const prtResult = getEventTypeAndContext(pullRequestTargetEvent);

      expect(prResult.eventType).toBe(prtResult.eventType);
      expect(prResult.triggerContext).toBe(prtResult.triggerContext);
    });

    test("should handle edge cases in pull_request_target events", () => {
      // Test with minimal event data
      const minimalContext: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          isPR: true,
          prNumber: "1",
        },
      };

      const result = getEventTypeAndContext(minimalContext);
      expect(result.eventType).toBe("PULL_REQUEST");
      expect(result.triggerContext).toBe("pull request event");

      // Should not throw when generating prompt
      expect(() => {
        generatePrompt(minimalContext, mockGitHubData, false, mockTagMode);
      }).not.toThrow();
    });

    test("should handle all valid pull_request actions", () => {
      const actions = ["opened", "synchronize", "reopened", "closed", "edited"];

      actions.forEach((action) => {
        const context: PreparedContext = {
          repository: "owner/repo",
          claudeCommentId: "12345",
          triggerPhrase: "@claude",
          eventData: {
            eventName: "pull_request",
            eventAction: action,
            isPR: true,
            prNumber: "1",
          },
        };

        const result = getEventTypeAndContext(context);
        expect(result.eventType).toBe("PULL_REQUEST");
        expect(result.triggerContext).toBe(`pull request ${action}`);
      });
    });
  });

  describe("security considerations for pull_request", () => {
    test("should maintain same prompt structure regardless of event source", () => {
      // Test that external PRs don't get different treatment in prompts
      const internalPR: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "opened",
          isPR: true,
          prNumber: "1",
        },
      };

      const externalPR: PreparedContext = {
        repository: "owner/repo",
        claudeCommentId: "12345",
        triggerPhrase: "@claude",
        eventData: {
          eventName: "pull_request",
          eventAction: "opened",
          isPR: true,
          prNumber: "1",
        },
      };

      const internalPrompt = generatePrompt(
        internalPR,
        mockGitHubData,
        false,
        mockTagMode,
      );
      const externalPrompt = generatePrompt(
        externalPR,
        mockGitHubData,
        false,
        mockTagMode,
      );

      // Should have same tool access patterns
      expect(
        internalPrompt.includes("mcp__gitea_comment__update_claude_comment"),
      ).toBe(
        externalPrompt.includes("mcp__gitea_comment__update_claude_comment"),
      );

      // Should have same branch handling instructions
      expect(
        internalPrompt.includes(
          "Always push to the existing branch when triggered on a PR",
        ),
      ).toBe(
        externalPrompt.includes(
          "Always push to the existing branch when triggered on a PR",
        ),
      );
    });
  });
});
