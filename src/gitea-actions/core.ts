/**
 * Gitea Actions Core - Minimal equivalent to @actions/core for Gitea Actions
 *
 * This provides similar functionality to GitHub Actions' @actions/core package
 * but adapted for Gitea Actions environment variables and conventions.
 *
 * Note: This is a minimal implementation. Gitea Actions SDK availability
 * should be verified (Task 41 in tech-spec) and replaced if available.
 */

/**
 * Set an action output which can be accessed in workflows
 *
 * In Gitea Actions, outputs can be accessed via environment variables in subsequent steps.
 * We write to both the output file (for compatibility) and the env file (for actual use).
 */
export function setOutput(name: string, value: string): void {
  if (process.env.GITEA_ACTIONS === "true") {
    // Write to output file
    const outputPath = process.env.GITEA_OUTPUT;
    if (outputPath) {
      const fs = require("fs");
      fs.appendFileSync(outputPath, `${name}=${value}\n`, {
        encoding: "utf-8",
      });
    }

    // Write to env file so it's available in subsequent steps
    // Gitea Actions doesn't support steps.<step>.outputs.* syntax
    const envPath = process.env.GITEA_ENV;
    if (envPath) {
      const fs = require("fs");
      fs.appendFileSync(envPath, `${name}=${value}\n`, { encoding: "utf-8" });
    }
  } else {
    console.log(`[OUTPUT] ${name}=${value}`);
  }
}

/**
 * Mark the action as failed
 */
export function setFailed(message: string | Error): void {
  const errorMessage = message instanceof Error ? message.message : message;
  process.exitCode = 1;
  console.error(`::error::${errorMessage}`);
}

/**
 * Export a variable to be used in subsequent steps
 */
export function exportVariable(name: string, value: string): void {
  // In Gitea Actions, environment variables are typically set via files
  if (process.env.GITEA_ACTIONS === "true") {
    const envPath = process.env.GITEA_ENV;
    if (envPath) {
      const fs = require("fs");
      fs.appendFileSync(envPath, `${name}=${value}\n`, { encoding: "utf-8" });
    } else {
      // Fallback: export to process.env
      process.env[name] = value;
      console.log(`::set-env name=${name}::${value}`);
    }
  } else {
    process.env[name] = value;
    console.log(`[ENV] ${name}=${value}`);
  }
}

/**
 * Get an action input
 */
export function getInput(name: string): string {
  // In Gitea Actions, inputs are typically available as environment variables
  // or via input files. We'll check both.
  const inputKey = `INPUT_${name.toUpperCase()}`;
  return process.env[inputKey] || "";
}

/**
 * Write debug information
 */
export function debug(message: string): void {
  if (
    process.env.DEBUG === "true" ||
    process.env.ACTIONS_STEP_DEBUG === "true"
  ) {
    console.log(`::debug::${message}`);
  }
}

/**
 * Write info to the log
 */
export function info(message: string): void {
  console.log(message);
}

/**
 * Write a warning to the log
 */
export function warning(message: string): void {
  console.log(`::warning::${message}`);
}

/**
 * Write an error to the log
 */
export function error(message: string): void {
  console.error(`::error::${message}`);
}

/**
 * Start a group of log lines
 */
export function startGroup(name: string): void {
  console.log(`::group::${name}`);
}

/**
 * End a group of log lines
 */
export function endGroup(): void {
  console.log(`::endgroup::`);
}

/**
 * Add a path to the system path
 */
export function addPath(path: string): void {
  if (process.env.GITEA_ACTIONS === "true") {
    const pathPath = process.env.GITEA_PATH;
    if (pathPath) {
      const fs = require("fs");
      fs.appendFileSync(pathPath, `${path}\n`, { encoding: "utf-8" });
    } else {
      // Fallback: add to PATH
      process.env.PATH = `${path}${process.env.PATH ? `:${process.env.PATH}` : ""}`;
    }
  } else {
    process.env.PATH = `${path}${process.env.PATH ? `:${process.env.PATH}` : ""}`;
  }
}

/**
 * Save state for use in subsequent steps
 */
export function saveState(name: string, value: string): void {
  if (process.env.GITEA_ACTIONS === "true") {
    const statePath = process.env.GITEA_STATE;
    if (statePath) {
      const fs = require("fs");
      fs.appendFileSync(statePath, `${name}=${value}\n`, { encoding: "utf-8" });
    } else {
      console.log(`::save-state name=${name}::${value}`);
    }
  } else {
    console.log(`[STATE] ${name}=${value}`);
  }
}

/**
 * Get state from previous steps
 */
export function getState(name: string): string {
  // This would need to be implemented based on how Gitea Actions
  // persists state between steps
  return process.env[`STATE_${name}`] || "";
}
