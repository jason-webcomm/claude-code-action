#!/usr/bin/env bun

/**
 * Check if the action trigger is from a human actor
 * Prevents automated tools or bots from triggering Claude
 */

import { GITEA_API_URL, GITEA_TOKEN } from "../api/config";
import type { GiteaContext } from "../context";

export async function checkHumanActor(giteaContext: GiteaContext) {
  // Fetch user information from Gitea API
  // Use the /permission endpoint which works for both direct collaborators and team members
  const { actor, repository } = giteaContext;
  const response = await fetch(
    `${GITEA_API_URL}/repos/${repository.owner}/${repository.repo}/collaborators/${actor}/permission`,
    {
      headers: {
        Authorization: `token ${GITEA_TOKEN}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    // If /permission endpoint fails, try admin/users endpoint
    const adminResponse = await fetch(`${GITEA_API_URL}/admin/users/${actor}`, {
      headers: {
        Authorization: `token ${GITEA_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!adminResponse.ok) {
      throw new Error(
        `Failed to fetch user information: ${response.status} ${response.statusText} (admin endpoint: ${adminResponse.status} ${adminResponse.statusText})`,
      );
    }

    const adminData = (await adminResponse.json()) as {
      login: string;
      full_name?: string;
      email?: string;
      avatar_url?: string;
    };

    const actorLogin = adminData.login;
    console.log(`Actor login: ${actorLogin}`);

    // Check if actor is a bot (Gitea doesn't have a "type" field like GitHub, so we check login patterns)
    const actorType =
      actorLogin.endsWith("[bot]") || actorLogin.startsWith("bot-")
        ? "Bot"
        : "User";

    console.log(`Actor type: ${actorType}`);

    // Check bot permissions if actor is not a User
    if (actorType !== "User") {
      const allowedBots = giteaContext.inputs.allowedBots;

      // Check if all bots are allowed
      if (allowedBots.trim() === "*") {
        console.log(
          `All bots are allowed, skipping human actor check for: ${actorLogin}`,
        );
        return;
      }

      // Parse allowed bots list
      const allowedBotsList = allowedBots
        .split(",")
        .map((bot) =>
          bot
            .trim()
            .toLowerCase()
            .replace(/\[bot\]$/, ""),
        )
        .filter((bot) => bot.length > 0);

      const botName = actorLogin.toLowerCase().replace(/\[bot\]$/, "");

      // Check if specific bot is allowed
      if (allowedBotsList.includes(botName)) {
        console.log(
          `Bot ${botName} is in allowed list, skipping human actor check`,
        );
        return;
      }

      // Bot not allowed
      throw new Error(
        `Workflow initiated by non-human actor: ${botName} (type: ${actorType}). Add bot to allowed_bots list or use '*' to allow all bots.`,
      );
    }

    console.log(`Verified human actor: ${actorLogin}`);
    return;
  }

  const data = (await response.json()) as {
    permission: string;
    user: {
      login: string;
      full_name?: string;
      email?: string;
      avatar_url?: string;
    };
  };

  const actorLogin = data.user.login;
  console.log(`Actor login: ${actorLogin}`);

  // Check if actor is a bot (Gitea doesn't have a "type" field like GitHub, so we check login patterns)
  const actorType =
    actorLogin.endsWith("[bot]") || actorLogin.startsWith("bot-")
      ? "Bot"
      : "User";

  console.log(`Actor type: ${actorType}`);

  // Check bot permissions if actor is not a User
  if (actorType !== "User") {
    const allowedBots = giteaContext.inputs.allowedBots;

    // Check if all bots are allowed
    if (allowedBots.trim() === "*") {
      console.log(
        `All bots are allowed, skipping human actor check for: ${actorLogin}`,
      );
      return;
    }

    // Parse allowed bots list
    const allowedBotsList = allowedBots
      .split(",")
      .map((bot) =>
        bot
          .trim()
          .toLowerCase()
          .replace(/\[bot\]$/, ""),
      )
      .filter((bot) => bot.length > 0);

    const botName = actorLogin.toLowerCase().replace(/\[bot\]$/, "");

    // Check if specific bot is allowed
    if (allowedBotsList.includes(botName)) {
      console.log(
        `Bot ${botName} is in allowed list, skipping human actor check`,
      );
      return;
    }

    // Bot not allowed
    throw new Error(
      `Workflow initiated by non-human actor: ${botName} (type: ${actorType}). Add bot to allowed_bots list or use '*' to allow all bots.`,
    );
  }

  console.log(`Verified human actor: ${actorLogin}`);
}
