#!/usr/bin/env bun

import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { checkHumanActor } from "../src/github/validation/actor";
import { createMockContext } from "./mockContext";

describe("checkHumanActor", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("should pass for human actor", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/human-user")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "human-user", type: "User" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "human-user";

    await expect(checkHumanActor(context)).resolves.toBeUndefined();
  });

  test("should throw error for bot actor when not allowed", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/test-bot[bot]")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "test-bot[bot]" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "test-bot[bot]";
    context.inputs.allowedBots = "";

    await expect(checkHumanActor(context)).rejects.toThrow(
      "Workflow initiated by non-human actor: test-bot (type: Bot). Add bot to allowed_bots list or use '*' to allow all bots.",
    );
  });

  test("should pass for bot actor when all bots allowed", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/test-bot[bot]")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "test-bot[bot]" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "test-bot[bot]";
    context.inputs.allowedBots = "*";

    await expect(checkHumanActor(context)).resolves.toBeUndefined();
  });

  test("should pass for specific bot when in allowed list", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/dependabot[bot]")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "dependabot[bot]" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "dependabot[bot]";
    context.inputs.allowedBots = "dependabot[bot],renovate[bot]";

    await expect(checkHumanActor(context)).resolves.toBeUndefined();
  });

  test("should pass for specific bot when in allowed list (without [bot])", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/dependabot[bot]")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "dependabot[bot]" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "dependabot[bot]";
    context.inputs.allowedBots = "dependabot,renovate";

    await expect(checkHumanActor(context)).resolves.toBeUndefined();
  });

  test("should throw error for bot not in allowed list", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/other-bot[bot]")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "other-bot[bot]" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "other-bot[bot]";
    context.inputs.allowedBots = "dependabot[bot],renovate[bot]";

    await expect(checkHumanActor(context)).rejects.toThrow(
      "Workflow initiated by non-human actor: other-bot (type: Bot). Add bot to allowed_bots list or use '*' to allow all bots.",
    );
  });

  test("should throw error for bot not in allowed list (without [bot])", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("/users/other-bot[bot]")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ login: "other-bot[bot]" }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });

    const context = createMockContext();
    context.actor = "other-bot[bot]";
    context.inputs.allowedBots = "dependabot,renovate";

    await expect(checkHumanActor(context)).rejects.toThrow(
      "Workflow initiated by non-human actor: other-bot (type: Bot). Add bot to allowed_bots list or use '*' to allow all bots.",
    );
  });
});
