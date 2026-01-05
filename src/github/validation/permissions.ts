import { GITEA_API_URL, GITEA_TOKEN } from "../api/config";
import type { GiteaContext } from "../context";
import { GITEA_PERMISSION_LEVELS } from "../constants";

/**
 * Check if the actor has write permissions to the repository
 * @param context - The Gitea context
 * @param allowedNonWriteUsers - Comma-separated list of users allowed without write permissions, or '*' for all
 * @param giteaTokenProvided - Whether gitea_token was provided as input (not from app)
 * @returns true if the actor has write permissions, false otherwise
 */
export async function checkWritePermissions(
  context: GiteaContext,
  allowedNonWriteUsers?: string,
  giteaTokenProvided?: boolean,
): Promise<boolean> {
  const { repository, actor } = context;

  try {
    console.log(`Checking permissions for actor: ${actor}`);

    // Check if we should bypass permission checks for this user
    if (allowedNonWriteUsers && giteaTokenProvided) {
      const allowedUsers = allowedNonWriteUsers.trim();
      if (allowedUsers === "*") {
        console.warn(
          `⚠️ SECURITY WARNING: Bypassing write permission check for ${actor} due to allowed_non_write_users='*'. This should only be used for workflows with very limited permissions.`,
        );
        return true;
      } else if (allowedUsers) {
        const allowedUserList = allowedUsers
          .split(",")
          .map((u) => u.trim())
          .filter((u) => u.length > 0);
        if (allowedUserList.includes(actor)) {
          console.warn(
            `⚠️ SECURITY WARNING: Bypassing write permission check for ${actor} due to allowed_non_write_users configuration. This should only be used for workflows with very limited permissions.`,
          );
          return true;
        }
      }
    }

    // Check if the actor is a bot (Gitea bots typically have specific patterns)
    if (actor.endsWith("[bot]") || actor.startsWith("bot-")) {
      console.log(`Actor is a bot: ${actor}`);
      return true;
    }

    // Check permissions using Gitea REST API
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
      throw new Error(
        `Failed to check permissions: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      permission: string;
      user: {
        login: string;
      };
    };

    const permissionLevel = data.permission;
    console.log(`Permission level retrieved: ${permissionLevel}`);

    if (
      permissionLevel === GITEA_PERMISSION_LEVELS.OWNER ||
      permissionLevel === GITEA_PERMISSION_LEVELS.ADMIN ||
      permissionLevel === GITEA_PERMISSION_LEVELS.WRITE
    ) {
      console.log(`Actor has write access: ${permissionLevel}`);
      return true;
    } else {
      console.warn(`Actor has insufficient permissions: ${permissionLevel}`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to check permissions: ${error}`);
    throw new Error(`Failed to check permissions for ${actor}: ${error}`);
  }
}
