#!/usr/bin/env bun

import { GITEA_TOKEN } from "./api/config";
import { retryWithBackoff } from "../utils/retry";

export async function setupGiteaToken(): Promise<string> {
  try {
    // Check if Gitea token was provided
    const providedToken = process.env.GITEA_TOKEN || GITEA_TOKEN;

    if (!providedToken) {
      throw new Error(
        "GITEA_TOKEN environment variable is required. Please provide your Gitea Personal Access Token or JWT token.",
      );
    }

    console.log("Using GITEA_TOKEN for authentication");
    return providedToken;
  } catch (error) {
    console.error(`Failed to setup Gitea token: ${error}`);
    throw new Error(
      `Failed to setup Gitea token: ${error}\n\nPlease ensure GITEA_TOKEN is set in your environment or workflow secrets.`,
    );
  }
}
