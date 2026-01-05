import { describe, test, expect } from "bun:test";
import { parseAllowedTools } from "../../src/modes/agent/parse-tools";

describe("parseAllowedTools", () => {
  test("parses unquoted tools", () => {
    const args = "--allowedTools mcp__gitea__*,mcp__gitea_comment__*";
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__*",
      "mcp__gitea_comment__*",
    ]);
  });

  test("parses double-quoted tools", () => {
    const args = '--allowedTools "mcp__gitea__*,mcp__gitea_comment__*"';
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__*",
      "mcp__gitea_comment__*",
    ]);
  });

  test("parses single-quoted tools", () => {
    const args = "--allowedTools 'mcp__gitea__*,mcp__gitea_comment__*'";
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__*",
      "mcp__gitea_comment__*",
    ]);
  });

  test("returns empty array when no allowedTools", () => {
    const args = "--someOtherFlag value";
    expect(parseAllowedTools(args)).toEqual([]);
  });

  test("handles empty string", () => {
    expect(parseAllowedTools("")).toEqual([]);
  });

  test("handles duplicate --allowedTools flags", () => {
    const args = "--allowedTools --allowedTools mcp__gitea__*";
    // Should not match the first one since the value is another flag
    expect(parseAllowedTools(args)).toEqual([]);
  });

  test("handles typo --alloedTools", () => {
    const args = "--alloedTools mcp__gitea__*";
    expect(parseAllowedTools(args)).toEqual([]);
  });

  test("handles multiple flags with allowedTools in middle", () => {
    const args = '--flag1 value1 --allowedTools "mcp__gitea__*" --flag2 value2';
    expect(parseAllowedTools(args)).toEqual(["mcp__gitea__*"]);
  });

  test("trims whitespace from tool names", () => {
    const args = "--allowedTools 'mcp__gitea__* , mcp__gitea_comment__* '";
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__*",
      "mcp__gitea_comment__*",
    ]);
  });

  test("handles tools with special characters", () => {
    const args =
      '--allowedTools "mcp__gitea__create_issue,mcp__gitea_comment__update"';
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__create_issue",
      "mcp__gitea_comment__update",
    ]);
  });

  test("parses kebab-case --allowed-tools", () => {
    const args = "--allowed-tools mcp__gitea__*,mcp__gitea_comment__*";
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__*",
      "mcp__gitea_comment__*",
    ]);
  });

  test("parses quoted kebab-case --allowed-tools", () => {
    const args = '--allowed-tools "mcp__gitea__*,mcp__gitea_comment__*"';
    expect(parseAllowedTools(args)).toEqual([
      "mcp__gitea__*",
      "mcp__gitea_comment__*",
    ]);
  });
});
