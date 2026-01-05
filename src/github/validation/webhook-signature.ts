import { createHmac } from "crypto";

/**
 * Verify Gitea webhook signature
 *
 * This function verifies that a webhook payload was sent by Gitea
 * by checking the HMAC signature against a shared secret.
 *
 * @param payload - The raw webhook payload (string or Buffer)
 * @param signature - The X-Gitea-Signature header value (format: "sha256=...")
 * @param secret - The webhook secret (GITEA_WEBHOOK_SECRET)
 * @returns true if signature is valid, false otherwise
 *
 * Note: Gitea webhook signature verification uses HMAC-SHA256.
 * The signature format is: "sha256=<hex-digest>"
 *
 * Security Considerations:
 * - This verification is critical to prevent webhook spoofing attacks
 * - Always use a strong, randomly generated secret
 * - Store secrets in environment variables, never in code
 * - If signature verification fails, DO NOT process the webhook
 *
 * @see https://docs.gitea.io/en-us/next/usage/webhooks/
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  try {
    // If no signature provided, reject (unless secret is empty for testing)
    if (!signature && secret) {
      return false;
    }

    // If no secret configured, skip verification (for testing/dev only)
    if (!secret) {
      console.warn(
        "⚠️ SECURITY WARNING: No webhook secret configured. " +
          "Webhook signature verification DISABLED. This should only be used for development/testing.",
      );
      return true;
    }

    // Extract the hash from the signature header
    // Format: "sha256=<hex-digest>"
    const parts = signature.split("=");
    if (parts.length !== 2 || parts[0] !== "sha256") {
      console.error("Invalid signature format:", signature);
      return false;
    }

    const signatureHash = parts[1];

    // Calculate HMAC-SHA256 of the payload using the secret
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const calculatedHash = hmac.digest("hex");

    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(signatureHash, calculatedHash);
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Parse signature from Gitea webhook headers
 *
 * @param headers - Raw headers object
 * @returns The signature string or undefined
 */
export function getWebhookSignature(headers: Record<string, string>): string {
  // Gitea uses X-Gitea-Signature header
  return headers["x-gitea-signature"] || headers["X-Gitea-Signature"];
}

/**
 * Extract and verify webhook signature from environment
 *
 * This is a convenience function that:
 * 1. Gets the secret from GITEA_WEBHOOK_SECRET env var
 * 2. Gets the signature from the headers
 * 3. Verifies the signature
 *
 * @param payload - The raw webhook payload
 * @param headers - Request headers
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookFromEnv(
  payload: string | Buffer,
  headers: Record<string, string>,
): boolean {
  const secret = process.env.GITEA_WEBHOOK_SECRET;
  const signature = getWebhookSignature(headers);

  if (!secret) {
    console.warn(
      "⚠️ GITEA_WEBHOOK_SECRET not set. Skipping signature verification.",
    );
    return true; // Allow for development/testing
  }

  if (!signature) {
    console.error(
      "❌ Webhook signature missing but secret is configured. Rejecting webhook.",
    );
    return false;
  }

  return verifyWebhookSignature(payload, signature, secret);
}
