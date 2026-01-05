#!/usr/bin/env bun

/**
 * Prepare the Gitea action by checking trigger conditions, verifying human actor,
 * and creating the initial tracking comment
 */

import * as core from "../gitea-actions/core";
import { setupGiteaToken } from "../github/token";
import { checkWritePermissions } from "../github/validation/permissions";
import { parseGiteaContext, isEntityContext } from "../github/context";
import { getMode } from "../modes/registry";
import { prepare } from "../prepare";
import { collectActionInputsPresence } from "./collect-inputs";

async function run() {
  try {
    collectActionInputsPresence();

    // Parse Gitea context first to enable mode detection
    const context = parseGiteaContext();

    // Auto-detect mode based on context
    const mode = getMode(context);

    // Setup Gitea token
    const giteaToken = await setupGiteaToken();

    // If no mode detected, set outputs and exit early
    if (!mode) {
      console.log("No trigger found, skipping remaining steps");
      core.setOutput("contains_trigger", "false");
      // Still set gitea_token output even when skipping
      core.setOutput("gitea_token", giteaToken);
      // Also export as GITHUB_TOKEN for compatibility
      core.setOutput("GITHUB_TOKEN", giteaToken);
      return;
    }

    // Step 3: Check write permissions (only for entity contexts)
    if (isEntityContext(context)) {
      // Check if gitea_token was provided as input (not from app)
      const giteaTokenProvided = !!process.env.OVERRIDE_GITEA_TOKEN;
      const hasWritePermissions = await checkWritePermissions(
        context,
        context.inputs.allowedNonWriteUsers,
        giteaTokenProvided,
      );
      if (!hasWritePermissions) {
        throw new Error(
          "Actor does not have write permissions to the repository",
        );
      }
    }

    // Check trigger conditions
    const containsTrigger = mode.shouldTrigger(context);

    // Debug logging
    console.log(`Mode: ${mode.name}`);
    console.log(`Context prompt: ${context.inputs?.prompt || "NO PROMPT"}`);
    console.log(`Trigger result: ${containsTrigger}`);

    // Set output for action.yml to check
    core.setOutput("contains_trigger", containsTrigger.toString());

    if (!containsTrigger) {
      console.log("No trigger found, skipping remaining steps");
      // Still set gitea_token output even when skipping
      core.setOutput("gitea_token", giteaToken);
      // Also export as GITHUB_TOKEN for compatibility
      core.setOutput("GITHUB_TOKEN", giteaToken);
      return;
    }

    // Step 5: Use the new modular prepare function
    const result = await prepare({
      context,
      giteaToken,
      mode,
    });

    // MCP config is handled by individual modes (tag/agent) and included in their claude_args output

    // Expose the Gitea token as an output
    core.setOutput("gitea_token", giteaToken);
    // Also export as GITHUB_TOKEN for compatibility with GitHub-based code
    core.setOutput("GITHUB_TOKEN", giteaToken);

    // Step 6: Get system prompt from mode if available
    if (mode.getSystemPrompt) {
      const modeContext = mode.prepareContext(context, {
        commentId: result.commentId,
        baseBranch: result.branchInfo.baseBranch,
        claudeBranch: result.branchInfo.claudeBranch,
      });
      const systemPrompt = mode.getSystemPrompt(modeContext);
      if (systemPrompt) {
        core.exportVariable("APPEND_SYSTEM_PROMPT", systemPrompt);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Prepare step failed with error: ${errorMessage}`);
    // Also output the clean error message for the action to capture
    core.setOutput("prepare_error", errorMessage);
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
