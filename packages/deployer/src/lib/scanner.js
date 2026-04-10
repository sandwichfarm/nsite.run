/**
 * Secret scanning library for the nsite SPA deploy interface.
 *
 * All scanning happens client-side in the browser before any files
 * are uploaded. No file content touches the server until the user
 * approves.
 *
 * Provides:
 *   - scanFilename(path)                  — Detect dangerous filenames
 *   - scanFileContent(arrayBuffer, path)  — Detect secret content patterns
 *   - scanFiles(files)                    — Run both scans over a file list
 *   - DANGEROUS_FILENAME_PATTERNS         — Exported for testing / UI display
 *   - SECRET_CONTENT_PATTERNS             — Exported for testing / UI display
 *   - AUTO_EXCLUDE_DIRS                   — VCS dirs that are always excluded
 */

// ---------------------------------------------------------------------------
// Dangerous filename patterns
// Sourced from: nsyte DEFAULT_IGNORE_PATTERNS + common secret file lists
// (gitleaks, TruffleHog, h33tlit/secret-regex-list)
// ---------------------------------------------------------------------------

/** @type {RegExp[]} Patterns matched against the basename of each file path. */
export const DANGEROUS_FILENAME_PATTERNS = [
  /^\.env(\..+)?$/i,                           // .env, .env.local, .env.production
  /^id_rsa(\.pub)?$/i,                         // SSH private keys (RSA)
  /^id_ed25519(\.pub)?$/i,                     // SSH private keys (Ed25519)
  /^id_ecdsa(\.pub)?$/i,                       // SSH private keys (ECDSA)
  /^id_dsa(\.pub)?$/i,                         // SSH private keys (DSA)
  /\.pem$/i,                                   // Certificates and private keys
  /\.key$/i,                                   // Generic key files
  /\.p12$/i,                                   // PKCS12 keystores
  /\.pfx$/i,                                   // Personal Information Exchange
  /^secrets?\.(json|yaml|yml|toml)$/i,         // Secret config files
  /^credentials?\.(json|yaml|yml)$/i,          // Credential files
  /^\.aws\/credentials$/i,                     // AWS credentials file
  /^google[_-]credentials\.json$/i,            // Google service account
  /^firebase[_-]?adminsdk.*\.json$/i,          // Firebase admin SDK
  /^service[_-]?account.*\.json$/i,            // Generic service account
  /^\.htpasswd$/i,                             // Apache password file
  /^wp-config\.php$/i,                         // WordPress config
  /^\.npmrc$/i,                                // npm config (may contain tokens)
  /^\.pypirc$/i,                               // PyPI credentials
  /^netrc$/i,                                  // netrc (FTP/HTTP credentials)
  /^\.netrc$/i,                                // .netrc
  /^kubeconfig$/i,                             // Kubernetes config
  /^terraform\.tfvars$/i,                      // Terraform variables
  /^terraform\.tfstate$/i,                     // Terraform state (contains secrets)
];

// ---------------------------------------------------------------------------
// Secret content patterns
// Sourced from: gitleaks, TruffleHog, and synthesized patterns
// These are intentionally conservative — false positives better than misses
// ---------------------------------------------------------------------------

/** @type {Array<{name: string, re: RegExp}>} */
export const SECRET_CONTENT_PATTERNS = [
  { name: 'AWS Access Key',    re: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key',    re: /aws_secret_access_key\s*[=:]\s*[A-Za-z0-9/+=]{40}/gi },
  { name: 'GitHub Token',      re: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g },
  { name: 'GitLab Token',      re: /glpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'Private Key Header',re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'nostr nsec',        re: /nsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}/g },
  { name: 'Stripe Secret Key', re: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Stripe Test Key',   re: /sk_test_[0-9a-zA-Z]{24,}/g },
  { name: 'Slack Token',       re: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
  { name: 'Bearer Token',      re: /bearer\s+[A-Za-z0-9\-._~+/]{20,}/gi },
  { name: 'Generic API Key',   re: /api[_-]?key\s*[=:]\s*['"]?[A-Za-z0-9]{20,}['"]?/gi },
  { name: 'Generic Secret',    re: /secret\s*[=:]\s*['"][A-Za-z0-9+/]{20,}['"]/gi },
  { name: 'Database URL',      re: /(postgres|mysql|mongodb):\/\/[^@\s]+:[^@\s]+@/gi },
  { name: 'SendGrid API Key',  re: /SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{43,}/g },
];

// ---------------------------------------------------------------------------
// Auto-exclude directories
// ---------------------------------------------------------------------------

/**
 * VCS and OS metadata directories that are automatically excluded from uploads.
 * These map to path prefixes /.git/, /.svn/, /.hg/.
 */
export const AUTO_EXCLUDE_DIRS = ['.git', '.svn', '.hg', '.DS_Store'];

// ---------------------------------------------------------------------------
// Binary file extensions to skip during content scanning
// ---------------------------------------------------------------------------

/** Regex matching binary file extensions that should never be text-decoded. */
const BINARY_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|woff2?|ttf|otf|eot|pdf|zip|gz|tar|bz2|xz|7z|wasm|mp4|m4v|mov|avi|webm|mp3|ogg|wav|flac|aac|exe|dll|so|dylib|bin|dat|sqlite|db|class|jar|pyc|pyd|o|a|lib)$/i;

// ---------------------------------------------------------------------------
// scanFilename
// ---------------------------------------------------------------------------

/**
 * Check whether a file path has a dangerous filename.
 *
 * Uses only the basename (last path component) for matching.
 *
 * @param {string} path - File path (e.g., "/dir/.env" or ".env")
 * @returns {{ dangerous: boolean, patterns: string[] }}
 */
export function scanFilename(path) {
  // Extract basename
  const basename = path.split('/').filter(Boolean).pop() || path;

  const matchingPatterns = [];
  for (const re of DANGEROUS_FILENAME_PATTERNS) {
    // Each pattern is a fresh regex (no global flag), but reset lastIndex just in case
    re.lastIndex = 0;
    if (re.test(basename)) {
      matchingPatterns.push(re.source);
    }
  }

  return {
    dangerous: matchingPatterns.length > 0,
    patterns: matchingPatterns,
  };
}

// ---------------------------------------------------------------------------
// scanFileContent
// ---------------------------------------------------------------------------

/**
 * Scan the content of a file for secret patterns.
 *
 * Binary files (by extension) are skipped entirely.
 * Uses TextDecoder with `fatal: false` to handle non-UTF-8 gracefully.
 *
 * @param {ArrayBuffer} arrayBuffer - Raw file bytes
 * @param {string} filename - File name (used to check binary extension)
 * @returns {Promise<{ findings: Array<{name: string, pattern: string}> }>}
 */
export async function scanFileContent(arrayBuffer, filename) {
  // Skip binary files by extension
  if (BINARY_EXTENSIONS.test(filename)) {
    return { findings: [] };
  }

  // Decode text content — fatal: false replaces invalid bytes with U+FFFD
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
  } catch {
    return { findings: [] };
  }

  if (!text || text.trim().length === 0) {
    return { findings: [] };
  }

  const findings = [];
  for (const { name, re } of SECRET_CONTENT_PATTERNS) {
    // Reset lastIndex before each test (global flag)
    re.lastIndex = 0;
    if (re.test(text)) {
      findings.push({ name, pattern: re.source });
    }
    // Reset again after test so subsequent calls are clean
    re.lastIndex = 0;
  }

  return { findings };
}

// ---------------------------------------------------------------------------
// scanFiles
// ---------------------------------------------------------------------------

/**
 * Run both filename and content scanning over a list of files.
 *
 * Auto-excludes VCS directory paths (/.git/, /.svn/, /.hg/, .DS_Store).
 *
 * @param {Array<{path: string, data: ArrayBuffer}>} files
 * @returns {Promise<{
 *   warnings: Array<{path: string, type: 'filename'|'content', details: string[]}>,
 *   autoExcluded: string[]
 * }>}
 */
export async function scanFiles(files) {
  const warnings = [];
  const autoExcluded = [];

  for (const file of files) {
    const { path, data } = file;

    // Auto-exclude VCS directories
    if (isAutoExcluded(path)) {
      autoExcluded.push(path);
      continue;
    }

    // Scan filename
    const filenameResult = scanFilename(path);
    if (filenameResult.dangerous) {
      warnings.push({
        path,
        type: 'filename',
        details: filenameResult.patterns,
      });
    }

    // Scan content (if we have data)
    if (data) {
      const contentResult = await scanFileContent(data, path.split('/').pop() || path);
      if (contentResult.findings.length > 0) {
        warnings.push({
          path,
          type: 'content',
          details: contentResult.findings.map(f => f.name),
        });
      }
    }
  }

  return { warnings, autoExcluded };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the path should be auto-excluded as a VCS/OS metadata path.
 *
 * @param {string} path
 * @returns {boolean}
 */
function isAutoExcluded(path) {
  // Check VCS directory prefixes: /.git/, /.svn/, /.hg/
  for (const dir of AUTO_EXCLUDE_DIRS) {
    if (path.startsWith(`/.${dir.replace('.', '')}/`) || path.startsWith(`/${dir}/`)) {
      return true;
    }
    // Handle exact match like "/.DS_Store"
    if (path === `/${dir}` || path.endsWith(`/${dir}`)) {
      return true;
    }
  }
  return false;
}
