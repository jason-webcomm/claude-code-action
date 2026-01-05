export const GITEA_API_URL =
  process.env.GITEA_API_URL || "https://your-gitea-instance/api/v1";
export const GITEA_SERVER_URL =
  process.env.GITEA_SERVER_URL || "https://your-gitea-instance";
export const GITEA_TOKEN = process.env.GITEA_TOKEN || "";

// Log the API configuration for debugging
console.log(`Gitea API configuration:`);
console.log(`  GITEA_API_URL: ${GITEA_API_URL}`);
console.log(`  GITEA_SERVER_URL: ${GITEA_SERVER_URL}`);
console.log(`  GITEA_TOKEN: ${GITEA_TOKEN ? "***" : "NOT SET"}`);
