import { describe, it, expect } from 'vitest';
import {
  scanFilename,
  scanFileContent,
  scanFiles,
  DANGEROUS_FILENAME_PATTERNS,
  SECRET_CONTENT_PATTERNS,
  AUTO_EXCLUDE_DIRS,
} from '../scanner.js';

// Helper: create an ArrayBuffer from a string
function strToBuffer(str) {
  return new TextEncoder().encode(str).buffer;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('constants', () => {
  it('DANGEROUS_FILENAME_PATTERNS is an array of regex', () => {
    expect(Array.isArray(DANGEROUS_FILENAME_PATTERNS)).toBe(true);
    expect(DANGEROUS_FILENAME_PATTERNS.length).toBeGreaterThan(0);
    expect(DANGEROUS_FILENAME_PATTERNS[0]).toBeInstanceOf(RegExp);
  });

  it('SECRET_CONTENT_PATTERNS is an array of {name, re} objects', () => {
    expect(Array.isArray(SECRET_CONTENT_PATTERNS)).toBe(true);
    expect(SECRET_CONTENT_PATTERNS.length).toBeGreaterThan(0);
    for (const p of SECRET_CONTENT_PATTERNS) {
      expect(typeof p.name).toBe('string');
      expect(p.re).toBeInstanceOf(RegExp);
    }
  });

  it('AUTO_EXCLUDE_DIRS contains .git, .svn, .hg', () => {
    expect(AUTO_EXCLUDE_DIRS).toContain('.git');
    expect(AUTO_EXCLUDE_DIRS).toContain('.svn');
    expect(AUTO_EXCLUDE_DIRS).toContain('.hg');
  });
});

// ---------------------------------------------------------------------------
// scanFilename — dangerous filenames
// ---------------------------------------------------------------------------
describe('scanFilename', () => {
  it('detects .env as dangerous', () => {
    const result = scanFilename('.env');
    expect(result.dangerous).toBe(true);
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  it('detects .env.local as dangerous', () => {
    const result = scanFilename('.env.local');
    expect(result.dangerous).toBe(true);
  });

  it('detects .env.production as dangerous', () => {
    const result = scanFilename('.env.production');
    expect(result.dangerous).toBe(true);
  });

  it('detects id_rsa as dangerous', () => {
    const result = scanFilename('id_rsa');
    expect(result.dangerous).toBe(true);
  });

  it('detects id_ed25519 as dangerous', () => {
    const result = scanFilename('id_ed25519');
    expect(result.dangerous).toBe(true);
  });

  it('detects secrets.json as dangerous', () => {
    const result = scanFilename('secrets.json');
    expect(result.dangerous).toBe(true);
  });

  it('detects credentials.json as dangerous', () => {
    const result = scanFilename('credentials.json');
    expect(result.dangerous).toBe(true);
  });

  it('detects file.pem as dangerous', () => {
    const result = scanFilename('server.pem');
    expect(result.dangerous).toBe(true);
  });

  it('detects file.key as dangerous', () => {
    const result = scanFilename('private.key');
    expect(result.dangerous).toBe(true);
  });

  it('detects .htpasswd as dangerous', () => {
    const result = scanFilename('.htpasswd');
    expect(result.dangerous).toBe(true);
  });

  it('detects wp-config.php as dangerous', () => {
    const result = scanFilename('wp-config.php');
    expect(result.dangerous).toBe(true);
  });

  it('detects google-credentials.json as dangerous', () => {
    const result = scanFilename('google-credentials.json');
    expect(result.dangerous).toBe(true);
  });

  it('returns safe=false for index.html', () => {
    const result = scanFilename('index.html');
    expect(result.dangerous).toBe(false);
    expect(result.patterns).toHaveLength(0);
  });

  it('returns safe=false for style.css', () => {
    const result = scanFilename('style.css');
    expect(result.dangerous).toBe(false);
  });

  it('returns safe=false for app.js', () => {
    const result = scanFilename('app.js');
    expect(result.dangerous).toBe(false);
  });

  it('works with a full path (uses basename only)', () => {
    const result = scanFilename('/some/deep/path/.env');
    expect(result.dangerous).toBe(true);
  });

  it('handles very long filename safely', () => {
    const long = 'a'.repeat(1000) + '.html';
    expect(() => scanFilename(long)).not.toThrow();
    const result = scanFilename(long);
    expect(result.dangerous).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scanFileContent — secret content patterns
// ---------------------------------------------------------------------------
describe('scanFileContent', () => {
  it('detects AWS Access Key pattern', async () => {
    const buf = strToBuffer('const key = "AKIAIOSFODNN7EXAMPLE";');
    const result = await scanFileContent(buf, 'config.js');
    const names = result.findings.map(f => f.name);
    expect(names.some(n => n.includes('AWS'))).toBe(true);
  });

  it('detects GitHub Token (ghp_ prefix)', async () => {
    // GitHub Personal Access Tokens: ghp_ + 36 alphanumeric chars
    const buf = strToBuffer('const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";');
    const result = await scanFileContent(buf, 'auth.js');
    const names = result.findings.map(f => f.name);
    expect(names.some(n => n.toLowerCase().includes('github'))).toBe(true);
  });

  it('detects private key header', async () => {
    const buf = strToBuffer('-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAK...');
    const result = await scanFileContent(buf, 'key.txt');
    const names = result.findings.map(f => f.name);
    expect(names.some(n => n.toLowerCase().includes('private'))).toBe(true);
  });

  it('detects OpenSSH private key header', async () => {
    const buf = strToBuffer('-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC...');
    const result = await scanFileContent(buf, 'id_ed25519');
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('detects nostr nsec key', async () => {
    // Valid-looking nsec1 bech32 (58 chars of valid alphabet after nsec1)
    const nsec = 'nsec1' + 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(2).slice(0, 58);
    const buf = strToBuffer(`const secret = "${nsec}";`);
    const result = await scanFileContent(buf, 'nostr.js');
    const names = result.findings.map(f => f.name);
    expect(names.some(n => n.toLowerCase().includes('nostr') || n.toLowerCase().includes('nsec'))).toBe(true);
  });

  it('detects Stripe secret key', async () => {
    const key = 'sk_' + 'live_ABCDEFGHIJKLMNOPQRSTUVWX';
    const buf = strToBuffer(`const stripe = "${key}";`);
    const result = await scanFileContent(buf, 'payment.js');
    const names = result.findings.map(f => f.name);
    expect(names.some(n => n.toLowerCase().includes('stripe'))).toBe(true);
  });

  it('detects Slack token', async () => {
    const buf = strToBuffer('const slackToken = "xoxb-1234567890-abcdefghij";');
    const result = await scanFileContent(buf, 'slack.js');
    const names = result.findings.map(f => f.name);
    expect(names.some(n => n.toLowerCase().includes('slack'))).toBe(true);
  });

  it('returns empty findings for normal HTML content', async () => {
    const buf = strToBuffer('<html><head><title>Hello</title></head><body><p>Welcome!</p></body></html>');
    const result = await scanFileContent(buf, 'index.html');
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty findings for normal CSS content', async () => {
    const buf = strToBuffer('body { margin: 0; padding: 0; background: #fff; }');
    const result = await scanFileContent(buf, 'style.css');
    expect(result.findings).toHaveLength(0);
  });

  it('skips content scanning for binary .png files', async () => {
    // Even if we put a "secret" pattern in the buffer, .png files should be skipped
    const buf = strToBuffer('AKIAIOSFODNN7EXAMPLE');
    const result = await scanFileContent(buf, 'image.png');
    expect(result.findings).toHaveLength(0);
  });

  it('skips content scanning for .woff2 files', async () => {
    const buf = strToBuffer('AKIAIOSFODNN7EXAMPLE');
    const result = await scanFileContent(buf, 'font.woff2');
    expect(result.findings).toHaveLength(0);
  });

  it('skips content scanning for .wasm files', async () => {
    const buf = strToBuffer('AKIAIOSFODNN7EXAMPLE');
    const result = await scanFileContent(buf, 'module.wasm');
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty findings for empty file', async () => {
    const buf = new ArrayBuffer(0);
    const result = await scanFileContent(buf, 'empty.txt');
    expect(result.findings).toHaveLength(0);
  });

  it('returns empty findings for whitespace-only file', async () => {
    const buf = strToBuffer('   \n\n\t   ');
    const result = await scanFileContent(buf, 'blank.txt');
    expect(result.findings).toHaveLength(0);
  });

  it('returns findings with name and pattern fields', async () => {
    const buf = strToBuffer('AKIAIOSFODNN7EXAMPLE');
    const result = await scanFileContent(buf, 'config.txt');
    if (result.findings.length > 0) {
      const finding = result.findings[0];
      expect(typeof finding.name).toBe('string');
      expect(typeof finding.pattern).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// scanFiles — integration
// ---------------------------------------------------------------------------
describe('scanFiles', () => {
  it('returns warnings and autoExcluded for mixed file list', async () => {
    const files = [
      { path: '/index.html', data: strToBuffer('<html></html>') },
      { path: '/.env', data: strToBuffer('SECRET=password123') },
      { path: '/.git/HEAD', data: strToBuffer('ref: refs/heads/main') },
      { path: '/config.js', data: strToBuffer('const apiKey = "AKIAIOSFODNN7EXAMPLE"') },
    ];

    const result = await scanFiles(files);

    // .env should trigger filename warning
    const envWarning = result.warnings.find(w => w.path === '/.env');
    expect(envWarning).toBeDefined();
    expect(envWarning.type).toBe('filename');

    // config.js with AWS key should trigger content warning
    const configWarning = result.warnings.find(w => w.path === '/config.js');
    expect(configWarning).toBeDefined();
    expect(configWarning.type).toBe('content');

    // .git/HEAD should be auto-excluded
    expect(result.autoExcluded).toContain('/.git/HEAD');
  });

  it('returns empty warnings for clean files', async () => {
    const files = [
      { path: '/index.html', data: strToBuffer('<html><body>Hello</body></html>') },
      { path: '/app.js', data: strToBuffer('console.log("hello");') },
    ];

    const result = await scanFiles(files);
    expect(result.warnings).toHaveLength(0);
    expect(result.autoExcluded).toHaveLength(0);
  });

  it('auto-excludes .svn/ files', async () => {
    const files = [
      { path: '/.svn/entries', data: strToBuffer('svn data') },
      { path: '/index.html', data: strToBuffer('<html></html>') },
    ];

    const result = await scanFiles(files);
    expect(result.autoExcluded).toContain('/.svn/entries');
  });

  it('auto-excludes .hg/ files', async () => {
    const files = [
      { path: '/.hg/manifest', data: strToBuffer('hg data') },
      { path: '/index.html', data: strToBuffer('<html></html>') },
    ];

    const result = await scanFiles(files);
    expect(result.autoExcluded).toContain('/.hg/manifest');
  });

  it('warning details include path and type', async () => {
    const files = [
      { path: '/id_rsa', data: strToBuffer('') },
    ];
    const result = await scanFiles(files);
    expect(result.warnings.length).toBeGreaterThan(0);
    const w = result.warnings[0];
    expect(w.path).toBeDefined();
    expect(w.type).toBeDefined();
    expect(w.details).toBeDefined();
  });
});
