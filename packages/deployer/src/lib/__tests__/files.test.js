import { describe, it, expect, beforeAll } from 'vitest';
import { zip } from 'fflate';
import {
  extractZip,
  extractTarGz,
  buildFileTree,
  autoExcludeVCS,
  inferMimeType,
} from '../files.js';

// Helper: create a ZIP buffer using fflate's zip function
function makeZip(files) {
  return new Promise((resolve, reject) => {
    const input = {};
    for (const [name, content] of Object.entries(files)) {
      input[name] = new TextEncoder().encode(content);
    }
    zip(input, (err, data) => (err ? reject(err) : resolve(data.buffer)));
  });
}

// ---------------------------------------------------------------------------
// extractZip
// ---------------------------------------------------------------------------
describe('extractZip', () => {
  it('extracts files from a ZIP archive', async () => {
    const buf = await makeZip({
      'index.html': '<html></html>',
      'style.css': 'body {}',
    });
    const files = await extractZip(buf);
    expect(files).toHaveLength(2);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/style.css');
  });

  it('returns objects with path, data, and size fields', async () => {
    const buf = await makeZip({ 'hello.txt': 'hello world' });
    const files = await extractZip(buf);
    expect(files).toHaveLength(1);
    const f = files[0];
    expect(f.path).toBe('/hello.txt');
    expect(f.data).toBeInstanceOf(Uint8Array);
    expect(f.size).toBe(f.data.length);
  });

  it('skips directory entries (entries ending with /)', async () => {
    // fflate includes directory entries if explicitly added
    const buf = await makeZip({
      'dir/file.txt': 'content',
    });
    const files = await extractZip(buf);
    // Should only have the file, not a synthetic directory entry
    expect(files.every(f => !f.path.endsWith('/'))).toBe(true);
    expect(files.some(f => f.path.includes('file.txt'))).toBe(true);
  });

  it('strips common root directory prefix', async () => {
    // All files share same top-level dir "dist/"
    const buf = await makeZip({
      'dist/index.html': '<html></html>',
      'dist/app.js': 'console.log()',
      'dist/css/style.css': 'body {}',
    });
    const files = await extractZip(buf);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/app.js');
    expect(paths).toContain('/css/style.css');
  });

  it('does NOT strip prefix when files are at root level', async () => {
    const buf = await makeZip({
      'index.html': '<html></html>',
      'app.js': 'code',
    });
    const files = await extractZip(buf);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/app.js');
  });

  it('decodes content correctly', async () => {
    const content = 'Hello, World!';
    const buf = await makeZip({ 'hello.txt': content });
    const files = await extractZip(buf);
    const decoded = new TextDecoder().decode(files[0].data);
    expect(decoded).toBe(content);
  });

  it('infers MIME type from extracted ZIP file paths', async () => {
    const buf = await makeZip({ 'index.html': '<html></html>', 'assets/logo.png': 'png' });
    const files = await extractZip(buf);
    expect(files.find(f => f.path === '/index.html').type).toBe('text/html; charset=UTF-8');
    expect(files.find(f => f.path === '/assets/logo.png').type).toBe('image/png');
  });
});

// ---------------------------------------------------------------------------
// extractTarGz
// ---------------------------------------------------------------------------
describe('extractTarGz', () => {
  it('extracts files from a TAR.GZ archive', async () => {
    // Use nanotar's createTar + fflate's gzip to create a test fixture
    const { createTar } = await import('nanotar');
    const { gzip } = await import('fflate');

    const tarBuf = createTar([
      { name: 'index.html', data: '<html></html>' },
      { name: 'style.css', data: 'body {}' },
    ]);

    const gzBuf = await new Promise((resolve, reject) => {
      gzip(new Uint8Array(tarBuf), (err, data) =>
        err ? reject(err) : resolve(data.buffer)
      );
    });

    const files = await extractTarGz(gzBuf);
    expect(files.length).toBeGreaterThanOrEqual(2);
    const paths = files.map(f => f.path);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/style.css');
  });

  it('returns objects with path, data, and size fields', async () => {
    const { createTar } = await import('nanotar');
    const { gzip } = await import('fflate');

    const tarBuf = createTar([{ name: 'hello.txt', data: 'hello world' }]);
    const gzBuf = await new Promise((resolve, reject) => {
      gzip(new Uint8Array(tarBuf), (err, data) =>
        err ? reject(err) : resolve(data.buffer)
      );
    });

    const files = await extractTarGz(gzBuf);
    expect(files.length).toBeGreaterThanOrEqual(1);
    const f = files.find(x => x.path.includes('hello.txt'));
    expect(f).toBeDefined();
    expect(f.path).toBe('/hello.txt');
    expect(f.data).toBeInstanceOf(Uint8Array);
    expect(f.size).toBeGreaterThan(0);
  });

  it('normalizes paths to start with /', async () => {
    const { createTar } = await import('nanotar');
    const { gzip } = await import('fflate');

    const tarBuf = createTar([{ name: 'sub/page.html', data: 'content' }]);
    const gzBuf = await new Promise((resolve, reject) => {
      gzip(new Uint8Array(tarBuf), (err, data) =>
        err ? reject(err) : resolve(data.buffer)
      );
    });

    const files = await extractTarGz(gzBuf);
    const f = files.find(x => x.path.includes('page.html'));
    expect(f.path).toBe('/sub/page.html');
  });

  it('infers MIME type from extracted TAR entries', async () => {
    const { createTar } = await import('nanotar');
    const { gzip } = await import('fflate');

    const tarBuf = createTar([{ name: 'styles/site.css', data: 'body {}' }]);
    const gzBuf = await new Promise((resolve, reject) => {
      gzip(new Uint8Array(tarBuf), (err, data) =>
        err ? reject(err) : resolve(data.buffer)
      );
    });

    const files = await extractTarGz(gzBuf);
    expect(files.find(f => f.path === '/styles/site.css').type).toBe('text/css; charset=UTF-8');
  });
});

describe('inferMimeType', () => {
  it('returns known MIME types from file extensions', () => {
    expect(inferMimeType('/index.html')).toBe('text/html; charset=UTF-8');
    expect(inferMimeType('/app.js')).toBe('text/javascript; charset=UTF-8');
    expect(inferMimeType('/image.webp')).toBe('image/webp');
  });

  it('returns undefined for unknown extensions', () => {
    expect(inferMimeType('/README.unknown')).toBeUndefined();
    expect(inferMimeType('/no-extension')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// autoExcludeVCS
// ---------------------------------------------------------------------------
describe('autoExcludeVCS', () => {
  it('excludes .git/ paths', () => {
    const files = [
      { path: '/.git/HEAD', size: 100 },
      { path: '/.git/config', size: 200 },
      { path: '/index.html', size: 300 },
    ];
    const result = autoExcludeVCS(files);
    expect(result.included).toHaveLength(1);
    expect(result.included[0].path).toBe('/index.html');
    expect(result.excluded).toHaveLength(2);
    expect(result.excludedCount).toBe(2);
  });

  it('excludes .svn/ paths', () => {
    const files = [
      { path: '/.svn/entries', size: 100 },
      { path: '/app.js', size: 200 },
    ];
    const result = autoExcludeVCS(files);
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.excludedCount).toBe(1);
  });

  it('excludes .hg/ paths', () => {
    const files = [
      { path: '/.hg/manifest', size: 50 },
      { path: '/style.css', size: 100 },
    ];
    const result = autoExcludeVCS(files);
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
  });

  it('excludes .DS_Store files', () => {
    const files = [
      { path: '/.DS_Store', size: 10 },
      { path: '/sub/.DS_Store', size: 10 },
      { path: '/index.html', size: 300 },
    ];
    const result = autoExcludeVCS(files);
    expect(result.included).toHaveLength(1);
    expect(result.excludedCount).toBe(2);
  });

  it('returns excludedCount of 0 when no VCS files', () => {
    const files = [
      { path: '/index.html', size: 300 },
      { path: '/app.js', size: 200 },
    ];
    const result = autoExcludeVCS(files);
    expect(result.included).toHaveLength(2);
    expect(result.excluded).toHaveLength(0);
    expect(result.excludedCount).toBe(0);
  });

  it('includes all files when none match VCS patterns', () => {
    const files = [
      { path: '/index.html', size: 1000 },
      { path: '/assets/logo.png', size: 5000 },
    ];
    const result = autoExcludeVCS(files);
    expect(result.included).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// buildFileTree
// ---------------------------------------------------------------------------
describe('buildFileTree', () => {
  it('builds a flat file list into a tree', () => {
    const files = [
      { path: '/index.html', size: 1000 },
      { path: '/app.js', size: 2000 },
    ];
    const tree = buildFileTree(files);
    expect(tree).toHaveLength(2);
    expect(tree.every(n => !n.isDir)).toBe(true);
  });

  it('nests files into directories', () => {
    const files = [
      { path: '/assets/logo.png', size: 5000 },
      { path: '/assets/style.css', size: 1000 },
      { path: '/index.html', size: 2000 },
    ];
    const tree = buildFileTree(files);
    // Should have 'assets' directory + 'index.html'
    const assetsNode = tree.find(n => n.name === 'assets');
    expect(assetsNode).toBeDefined();
    expect(assetsNode.isDir).toBe(true);
    expect(assetsNode.children).toHaveLength(2);

    const indexNode = tree.find(n => n.name === 'index.html');
    expect(indexNode).toBeDefined();
    expect(indexNode.isDir).toBe(false);
  });

  it('sorts directories before files', () => {
    const files = [
      { path: '/z-file.txt', size: 100 },
      { path: '/a-dir/file.txt', size: 100 },
      { path: '/b-file.txt', size: 100 },
    ];
    const tree = buildFileTree(files);
    // Directory 'a-dir' should come before files 'b-file.txt' and 'z-file.txt'
    expect(tree[0].isDir).toBe(true);
    expect(tree[0].name).toBe('a-dir');
  });

  it('includes path, name, size on leaf nodes', () => {
    const files = [{ path: '/page.html', size: 1234 }];
    const tree = buildFileTree(files);
    expect(tree[0].name).toBe('page.html');
    expect(tree[0].path).toBe('/page.html');
    expect(tree[0].size).toBe(1234);
    expect(tree[0].isDir).toBe(false);
  });

  it('handles deeply nested files', () => {
    const files = [{ path: '/a/b/c/deep.txt', size: 100 }];
    const tree = buildFileTree(files);
    const a = tree.find(n => n.name === 'a');
    expect(a).toBeDefined();
    expect(a.isDir).toBe(true);
    const b = a.children.find(n => n.name === 'b');
    expect(b).toBeDefined();
    expect(b.isDir).toBe(true);
    const c = b.children.find(n => n.name === 'c');
    expect(c).toBeDefined();
    const deep = c.children.find(n => n.name === 'deep.txt');
    expect(deep).toBeDefined();
    expect(deep.isDir).toBe(false);
  });

  it('handles empty file list', () => {
    const tree = buildFileTree([]);
    expect(tree).toEqual([]);
  });
});
