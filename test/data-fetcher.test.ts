import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
  spyOn,
} from "bun:test";
import {
  extractTriggerTimestamp,
  fetchGitHubData,
  filterCommentsToTriggerTime,
  isBodySafeToUse,
} from "../src/github/data/fetcher";
import {
  createMockContext,
  mockIssueCommentContext,
  mockPullRequestOpenedContext,
  mockIssueOpenedContext,
} from "./mockContext";
import type { GiteaComment } from "../src/github/types";
import { giteaGet } from "../src/github/api/client";

describe("extractTriggerTimestamp", () => {
  it("should extract timestamp from IssueCommentEvent", () => {
    const context = mockIssueCommentContext;
    const timestamp = extractTriggerTimestamp(context);
    expect(timestamp).toBe("2024-01-15T12:30:00Z");
  });

  it("should return undefined for pull_request event", () => {
    const context = mockPullRequestOpenedContext;
    const timestamp = extractTriggerTimestamp(context);
    expect(timestamp).toBeUndefined();
  });

  it("should return undefined for issues event", () => {
    const context = mockIssueOpenedContext;
    const timestamp = extractTriggerTimestamp(context);
    expect(timestamp).toBeUndefined();
  });

  it("should handle missing timestamp fields gracefully", () => {
    const context = createMockContext({
      eventName: "issue_comment",
      payload: {
        comment: {
          // No created_at field
          id: 123,
          body: "test",
        },
      } as any,
    });
    const timestamp = extractTriggerTimestamp(context);
    expect(timestamp).toBeUndefined();
  });
});

describe("filterCommentsToTriggerTime", () => {
  const createMockComment = (
    createdAt: string,
    updatedAt?: string,
  ): GiteaComment => ({
    id: Math.floor(Math.random() * 1000000),
    html_url: "https://example.com/comment",
    body: "Test comment",
    user: { login: "test-user" },
    created_at: createdAt,
    updated_at: updatedAt,
  });

  const triggerTime = "2024-01-15T12:00:00Z";

  describe("comment creation time filtering", () => {
    it("should include comments created before trigger time", () => {
      const comments = [
        createMockComment("2024-01-15T11:00:00Z"),
        createMockComment("2024-01-15T11:30:00Z"),
        createMockComment("2024-01-15T11:59:59Z"),
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(3);
      expect(filtered).toEqual(comments);
    });

    it("should exclude comments created after trigger time", () => {
      const comments = [
        createMockComment("2024-01-15T12:00:01Z"),
        createMockComment("2024-01-15T13:00:00Z"),
        createMockComment("2024-01-16T00:00:00Z"),
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(0);
    });

    it("should handle exact timestamp match (at trigger time)", () => {
      const comment = createMockComment("2024-01-15T12:00:00Z");
      const filtered = filterCommentsToTriggerTime([comment], triggerTime);
      // Comments created exactly at trigger time should be excluded for security
      expect(filtered.length).toBe(0);
    });
  });

  describe("comment edit time filtering", () => {
    it("should include comments edited before trigger time", () => {
      const comments = [
        createMockComment("2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
        createMockComment("2024-01-15T10:00:00Z", "2024-01-15T11:30:00Z"),
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(2);
      expect(filtered).toEqual(comments);
    });

    it("should exclude comments edited after trigger time", () => {
      const comments = [
        createMockComment("2024-01-15T10:00:00Z", "2024-01-15T13:00:00Z"),
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(0);
    });

    it("should handle comments without edit timestamps", () => {
      const comment = createMockComment("2024-01-15T10:00:00Z");
      expect(comment.updated_at).toBeUndefined();

      const filtered = filterCommentsToTriggerTime([comment], triggerTime);
      expect(filtered.length).toBe(1);
      expect(filtered[0]).toBe(comment);
    });

    it("should exclude comments edited exactly at trigger time", () => {
      const comments = [
        createMockComment("2024-01-15T10:00:00Z", "2024-01-15T12:00:00Z"), // updatedAt exactly at trigger
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should return all comments when no trigger time provided", () => {
      const comments = [
        createMockComment("2024-01-15T10:00:00Z"),
        createMockComment("2024-01-15T13:00:00Z"),
        createMockComment("2024-01-16T00:00:00Z"),
      ];

      const filtered = filterCommentsToTriggerTime(comments, undefined);
      expect(filtered.length).toBe(3);
      expect(filtered).toEqual(comments);
    });

    it("should handle millisecond precision", () => {
      const comments = [
        createMockComment("2024-01-15T12:00:00.001Z"), // After trigger by 1ms
        createMockComment("2024-01-15T11:59:59.999Z"), // Before trigger
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.created_at).toBe("2024-01-15T11:59:59.999Z");
    });

    it("should handle various ISO timestamp formats", () => {
      const comments = [
        createMockComment("2024-01-15T11:00:00Z"),
        createMockComment("2024-01-15T11:00:00.000Z"),
        createMockComment("2024-01-15T11:00:00+00:00"),
      ];

      const filtered = filterCommentsToTriggerTime(comments, triggerTime);
      expect(filtered.length).toBe(3);
    });
  });
});

describe.skip("filterReviewsToTriggerTime", () => {
  // Gitea doesn't have pull_request_review events, skip these tests
});

describe.skip("filterReviewsToTriggerTime", () => {
  const createMockReview = (
    submittedAt: string,
    updatedAt?: string,
    lastEditedAt?: string,
  ): any => ({
    id: String(Math.random()),
    databaseId: String(Math.random()),
    author: { login: "reviewer" },
    body: "Test review",
    state: "APPROVED",
    submitted_at: submittedAt,
    updated_at: updatedAt,
    lastEditedAt,
    comments: { nodes: [] },
  });

  const triggerTime = "2024-01-15T12:00:00Z";

  describe("review submission time filtering", () => {
    it("should include reviews submitted before trigger time", () => {
      const reviews = [
        createMockReview("2024-01-15T11:00:00Z"),
        createMockReview("2024-01-15T11:30:00Z"),
        createMockReview("2024-01-15T11:59:59Z"),
      ];

      const filtered = filterReviewsToTriggerTime(reviews, triggerTime);
      expect(filtered.length).toBe(3);
      expect(filtered).toEqual(reviews);
    });

    it("should exclude reviews submitted after trigger time", () => {
      const reviews = [
        createMockReview("2024-01-15T12:00:01Z"),
        createMockReview("2024-01-15T13:00:00Z"),
        createMockReview("2024-01-16T00:00:00Z"),
      ];

      const filtered = filterReviewsToTriggerTime(reviews, triggerTime);
      expect(filtered.length).toBe(0);
    });

    it("should handle exact timestamp match", () => {
      const review = createMockReview("2024-01-15T12:00:00Z");
      const filtered = filterReviewsToTriggerTime([review], triggerTime);
      // Reviews submitted exactly at trigger time should be excluded for security
      expect(filtered.length).toBe(0);
    });
  });

  describe("review edit time filtering", () => {
    it("should include reviews edited before trigger time", () => {
      const reviews = [
        createMockReview("2024-01-15T10:00:00Z", "2024-01-15T11:00:00Z"),
        createMockReview(
          "2024-01-15T10:00:00Z",
          undefined,
          "2024-01-15T11:30:00Z",
        ),
        createMockReview(
          "2024-01-15T10:00:00Z",
          "2024-01-15T11:00:00Z",
          "2024-01-15T11:30:00Z",
        ),
      ];

      const filtered = filterReviewsToTriggerTime(reviews, triggerTime);
      expect(filtered.length).toBe(3);
      expect(filtered).toEqual(reviews);
    });

    it("should exclude reviews edited after trigger time", () => {
      const reviews = [
        createMockReview("2024-01-15T10:00:00Z", "2024-01-15T13:00:00Z"),
        createMockReview(
          "2024-01-15T10:00:00Z",
          undefined,
          "2024-01-15T13:00:00Z",
        ),
        createMockReview(
          "2024-01-15T10:00:00Z",
          "2024-01-15T11:00:00Z",
          "2024-01-15T13:00:00Z",
        ),
      ];

      const filtered = filterReviewsToTriggerTime(reviews, triggerTime);
      expect(filtered.length).toBe(0);
    });

    it("should prioritize lastEditedAt over updatedAt", () => {
      const review = createMockReview(
        "2024-01-15T10:00:00Z",
        "2024-01-15T13:00:00Z", // updatedAt after trigger
        "2024-01-15T11:00:00Z", // lastEditedAt before trigger
      );

      const filtered = filterReviewsToTriggerTime([review], triggerTime);
      // lastEditedAt takes precedence, so this should be included
      expect(filtered.length).toBe(1);
      expect(filtered[0]).toBe(review);
    });

    it("should handle reviews without edit timestamps", () => {
      const review = createMockReview("2024-01-15T10:00:00Z");
      expect(review.updated_at).toBeUndefined();
      expect(review.lastEditedAt).toBeUndefined();

      const filtered = filterReviewsToTriggerTime([review], triggerTime);
      expect(filtered.length).toBe(1);
      expect(filtered[0]).toBe(review);
    });

    it("should exclude reviews edited exactly at trigger time", () => {
      const reviews = [
        createMockReview("2024-01-15T10:00:00Z", "2024-01-15T12:00:00Z"), // updatedAt exactly at trigger
        createMockReview(
          "2024-01-15T10:00:00Z",
          undefined,
          "2024-01-15T12:00:00Z",
        ), // lastEditedAt exactly at trigger
      ];

      const filtered = filterReviewsToTriggerTime(reviews, triggerTime);
      expect(filtered.length).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should return all reviews when no trigger time provided", () => {
      const reviews = [
        createMockReview("2024-01-15T10:00:00Z"),
        createMockReview("2024-01-15T13:00:00Z"),
        createMockReview("2024-01-16T00:00:00Z"),
      ];

      const filtered = filterReviewsToTriggerTime(reviews, undefined);
      expect(filtered.length).toBe(3);
      expect(filtered).toEqual(reviews);
    });
  });
});

describe("isBodySafeToUse", () => {
  const triggerTime = "2024-01-15T12:00:00Z";

  const createMockContextData = (createdAt: string, updatedAt?: string) => ({
    created_at: createdAt,
    updated_at: updatedAt,
  });

  describe("body edit time validation", () => {
    it("should return true when body was never edited", () => {
      const contextData = createMockContextData("2024-01-15T10:00:00Z");
      expect(isBodySafeToUse(contextData, triggerTime)).toBe(true);
    });

    it("should return true when body was edited before trigger time", () => {
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T11:00:00Z",
      );
      expect(isBodySafeToUse(contextData, triggerTime)).toBe(true);
    });

    it("should return false when body was edited after trigger time (using updatedAt)", () => {
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T13:00:00Z",
      );
      expect(isBodySafeToUse(contextData, triggerTime)).toBe(false);
    });

    it("should return false when body was edited exactly at trigger time", () => {
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T12:00:00Z",
      );
      expect(isBodySafeToUse(contextData, triggerTime)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return true when no trigger time is provided (backward compatibility)", () => {
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T13:00:00Z", // Would normally fail
      );
      expect(isBodySafeToUse(contextData, undefined)).toBe(true);
    });

    it("should handle millisecond precision correctly", () => {
      // Edit 1ms after trigger - should be unsafe
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T12:00:00.001Z",
      );
      expect(isBodySafeToUse(contextData, triggerTime)).toBe(false);
    });

    it("should handle edit 1ms before trigger - should be safe", () => {
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T11:59:59.999Z",
      );
      expect(isBodySafeToUse(contextData, triggerTime)).toBe(true);
    });

    it("should handle various ISO timestamp formats", () => {
      const contextData1 = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T11:00:00Z",
      );
      const contextData2 = createMockContextData(
        "2024-01-15T10:00:00+00:00",
        "2024-01-15T11:00:00+00:00",
      );
      const contextData3 = createMockContextData(
        "2024-01-15T10:00:00.000Z",
        "2024-01-15T11:00:00.000Z",
      );

      expect(isBodySafeToUse(contextData1, triggerTime)).toBe(true);
      expect(isBodySafeToUse(contextData2, triggerTime)).toBe(true);
      expect(isBodySafeToUse(contextData3, triggerTime)).toBe(true);
    });
  });

  describe("security scenarios", () => {
    it("should detect race condition attack - body edited between trigger and processing", () => {
      // Simulates: Owner triggers @claude at 12:00, attacker edits body at 12:00:30
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z", // Issue created
        "2024-01-15T12:00:30Z", // Body edited after trigger
      );
      expect(isBodySafeToUse(contextData, "2024-01-15T12:00:00Z")).toBe(false);
    });

    it("should allow body that was stable at trigger time", () => {
      // Body was last edited well before the trigger
      const contextData = createMockContextData(
        "2024-01-15T10:00:00Z",
        "2024-01-15T10:30:00Z",
        "2024-01-15T10:30:00Z",
      );
      expect(isBodySafeToUse(contextData, "2024-01-15T12:00:00Z")).toBe(true);
    });
  });
});

describe.skip("fetchGitHubData integration with time filtering", () => {
  let giteaGetSpy: any;

  beforeEach(() => {
    // Set environment variables
    process.env.GITEA_API_URL = "https://your-gitea-instance/api/v1";
    process.env.GITEA_TOKEN = "test-token";

    // Spy on the global fetch
    giteaGetSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    giteaGetSpy?.mockRestore?.();

    // Cleanup environment variables
    delete process.env.GITEA_API_URL;
    delete process.env.GITEA_TOKEN;
  });

  const createMockResponse = (data: any) =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve(data),
    } as Response);

  it("should filter comments based on trigger time when provided", async () => {
    giteaGetSpy.mockImplementation((url: string, init: RequestInit) => {
      if (url.includes("/repos/test-owner/test-repo/issues/123")) {
        return createMockResponse({
          number: 123,
          title: "Test Issue",
          body: "Issue body",
          user: { login: "author" },
        }) as Response;
      }
      if (url.includes("/comments")) {
        return createMockResponse([
          {
            id: 1,
            body: "Comment before trigger",
            user: { login: "user1" },
            created_at: "2024-01-15T11:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          {
            id: 2,
            body: "Comment after trigger",
            user: { login: "user2" },
            created_at: "2024-01-15T13:00:00Z",
            updated_at: "2024-01-15T13:00:00Z",
          },
          {
            id: 3,
            body: "Comment before but edited after",
            user: { login: "user3" },
            created_at: "2024-01-15T11:00:00Z",
            updated_at: "2024-01-15T13:00:00Z",
          },
        ]) as Response;
      }
      return createMockResponse({}) as Response;
    });

    const result = await fetchGitHubData({
      repository: "test-owner/test-repo",
      prNumber: "123",
      isPR: false,
      triggerUsername: "trigger-user",
      triggerTime: "2024-01-15T12:00:00Z",
    });

    // Should only include the comment created before trigger time
    expect(result.comments.length).toBe(1);
    expect(result.comments[0]?.id).toBe(1);
    expect(result.comments[0]?.body).toBe("Comment before trigger");
  });

  it("should handle backward compatibility when no trigger time provided", async () => {
    giteaGetSpy.mockImplementation((url: string, init: RequestInit) => {
      if (url.includes("/repos/test-owner/test-repo/issues/999")) {
        return createMockResponse({
          number: 999,
          title: "Test Issue",
          body: "Issue body",
          user: { login: "author" },
        }) as Response;
      }
      if (url.includes("/comments")) {
        return createMockResponse([
          {
            id: 1,
            body: "Old comment",
            user: { login: "user1" },
            created_at: "2024-01-15T11:00:00Z",
          },
          {
            id: 2,
            body: "New comment",
            user: { login: "user2" },
            created_at: "2024-01-15T13:00:00Z",
          },
          {
            id: 3,
            body: "Edited comment",
            user: { login: "user3" },
            created_at: "2024-01-15T11:00:00Z",
          },
        ]) as Response;
      }
      return createMockResponse({}) as Response;
    });

    const result = await fetchGitHubData({
      repository: "test-owner/test-repo",
      prNumber: "999",
      isPR: false,
      triggerUsername: "trigger-user",
      // No triggerTime provided
    });

    // Without trigger time, all comments should be included
    expect(result.comments.length).toBe(3);
  });

  it("should handle timezone variations in timestamps", async () => {
    giteaGetSpy.mockImplementation((url: string, init: RequestInit) => {
      if (url.includes("/repos/test-owner/test-repo/issues/321")) {
        return createMockResponse({
          number: 321,
          title: "Test Issue",
          body: "Issue body",
          user: { login: "author" },
        }) as Response;
      }
      if (url.includes("/comments")) {
        return createMockResponse([
          {
            id: 1,
            body: "Comment with UTC",
            user: { login: "user1" },
            created_at: "2024-01-15T11:00:00Z",
          },
          {
            id: 2,
            body: "Comment with offset",
            user: { login: "user2" },
            created_at: "2024-01-15T11:00:00+00:00",
          },
          {
            id: 3,
            body: "Comment with milliseconds",
            user: { login: "user3" },
            created_at: "2024-01-15T11:00:00.000Z",
          },
        ]) as Response;
      }
      return createMockResponse({}) as Response;
    });

    const result = await fetchGitHubData({
      repository: "test-owner/test-repo",
      prNumber: "321",
      isPR: false,
      triggerUsername: "trigger-user",
      triggerTime: "2024-01-15T12:00:00Z",
    });

    // All three comments should be included as they're all before trigger time
    expect(result.comments.length).toBe(3);
  });

  it("should include issue body when not edited after trigger time", async () => {
    giteaGetSpy.mockImplementation((url: string, init: RequestInit) => {
      if (url.includes("/repos/test-owner/test-repo/issues/666")) {
        return createMockResponse({
          number: 666,
          title: "Test Issue",
          body: "Safe body not edited after trigger",
          user: { login: "author" },
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T11:00:00Z", // Edited before trigger
        }) as Response;
      }
      if (url.includes("/comments")) {
        return createMockResponse([]) as Response;
      }
      return createMockResponse({}) as Response;
    });

    const result = await fetchGitHubData({
      repository: "test-owner/test-repo",
      prNumber: "666",
      isPR: false,
      triggerUsername: "trigger-user",
      triggerTime: "2024-01-15T12:00:00Z",
    });

    // The contextData should still contain the body
    expect(result.contextData.body).toBe("Safe body not edited after trigger");
  });
});
