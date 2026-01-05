export function stripInvisibleCharacters(content: string): string {
  content = content.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
  content = content.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
    "",
  );
  content = content.replace(/\u00AD/g, "");
  content = content.replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
  return content;
}

export function stripMarkdownImageAltText(content: string): string {
  return content.replace(/!\[[^\]]*\]\(/g, "![](");
}

export function stripMarkdownLinkTitles(content: string): string {
  content = content.replace(/(\[[^\]]*\]\([^\)]+)\s+"[^"]*"/g, "$1");
  content = content.replace(/(\[[^\]]*\]\([^\)]+)\s+'[^']*'/g, "$1");
  return content;
}

export function stripHiddenAttributes(content: string): string {
  content = content.replace(/\salt\s*=\s*["'][^"']*["']/gi, "");
  content = content.replace(/\salt\s*=\s*[^\s>]+/gi, "");
  content = content.replace(/\stitle\s*=\s*["'][^"']*["']/gi, "");
  content = content.replace(/\stitle\s*=\s*[^\s>]+/gi, "");
  content = content.replace(/\saria-label\s*=\s*["'][^"']*["']/gi, "");
  content = content.replace(/\saria-label\s*=\s*[^\s>]+/gi, "");
  content = content.replace(/\sdata-[a-zA-Z0-9-]+\s*=\s*["'][^"']*["']/gi, "");
  content = content.replace(/\sdata-[a-zA-Z0-9-]+\s*=\s*[^\s>]+/gi, "");
  content = content.replace(/\splaceholder\s*=\s*["'][^"']*["']/gi, "");
  content = content.replace(/\splaceholder\s*=\s*[^\s>]+/gi, "");
  return content;
}

export function normalizeHtmlEntities(content: string): string {
  content = content.replace(/&#(\d+);/g, (_, dec) => {
    const num = parseInt(dec, 10);
    if (num >= 32 && num <= 126) {
      return String.fromCharCode(num);
    }
    return "";
  });
  content = content.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const num = parseInt(hex, 16);
    if (num >= 32 && num <= 126) {
      return String.fromCharCode(num);
    }
    return "";
  });
  return content;
}

export function sanitizeContent(content: string): string {
  content = stripHtmlComments(content);
  content = stripInvisibleCharacters(content);
  content = stripMarkdownImageAltText(content);
  content = stripMarkdownLinkTitles(content);
  content = stripHiddenAttributes(content);
  content = normalizeHtmlEntities(content);
  content = redactGiteaTokens(content);
  return content;
}

export function redactGiteaTokens(content: string): string {
  // Gitea Personal Access Tokens: gitea_token_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (variable length)
  // Note: Gitea token format may vary based on configuration
  content = content.replace(
    /\bgitea_token_[A-Za-z0-9_]{20,}\b/g,
    "[REDACTED_GITEA_TOKEN]",
  );

  // Gitea OAuth access tokens (if using OAuth): gitea_oauth_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  content = content.replace(
    /\bgitea_oauth_[A-Za-z0-9_]{20,}\b/g,
    "[REDACTED_GITEA_TOKEN]",
  );

  // Generic token patterns that might be used with Gitea
  content = content.replace(/\b[A-Za-z0-9_-]{20,}\b/g, (match) => {
    // Only redact if it looks like a token (contains uppercase, lowercase, numbers, and underscores/dashes)
    const hasUpper = /[A-Z]/.test(match);
    const hasLower = /[a-z]/.test(match);
    const hasNumber = /[0-9]/.test(match);
    const hasSpecial = /[_-]/.test(match);

    // Redact if it has at least 3 of the 4 characteristics and is long
    if (
      [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length >= 3 &&
      match.length >= 20
    ) {
      return "[REDACTED_GITEA_TOKEN]";
    }

    return match;
  });

  return content;
}

export const stripHtmlComments = (content: string) =>
  content.replace(/<!--[\s\S]*?-->/g, "");
// Backward compatibility alias
export const redactGitHubTokens = redactGiteaTokens;
