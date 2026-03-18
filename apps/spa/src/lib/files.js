/**
 * File processing utilities for the nsite SPA deploy interface.
 *
 * Provides:
 *   - extractZip(arrayBuffer)        — ZIP extraction via fflate
 *   - extractTarGz(arrayBuffer)      — TAR.GZ extraction via fflate + nanotar
 *   - autoExcludeVCS(files)          — Filter .git/, .svn/, .hg/, .DS_Store
 *   - buildFileTree(files)           — Convert flat list to nested tree
 *   - pickDirectory()                — Browser folder picker (not unit-testable)
 *   - pickArchive()                  — Browser archive picker (not unit-testable)
 *   - readDirectoryHandle(handle)    — Recursive File System Access API reader
 */

import { unzip, gunzip } from 'fflate';
import { parseTar } from 'nanotar';

// ---------------------------------------------------------------------------
// VCS auto-exclude patterns
// ---------------------------------------------------------------------------

/** Directory/file names that are always excluded from uploads. */
export const VCS_EXCLUDE_PREFIXES = ['/.git/', '/.svn/', '/.hg/'];
export const VCS_EXCLUDE_EXACT = ['/.DS_Store'];
export const VCS_EXCLUDE_SUFFIX = '/.DS_Store';

// ---------------------------------------------------------------------------
// extractZip
// ---------------------------------------------------------------------------

/**
 * Extract a ZIP archive from an ArrayBuffer.
 *
 * Strips a common root directory prefix if all files share the same
 * top-level directory (e.g., "dist/index.html" → "/index.html").
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Array<{path: string, data: Uint8Array, size: number}>>}
 */
export function extractZip(arrayBuffer) {
  return new Promise((resolve, reject) => {
    unzip(new Uint8Array(arrayBuffer), (err, result) => {
      if (err) return reject(err);

      // Filter out directory entries (end with '/'), normalize paths
      let files = Object.entries(result)
        .filter(([name]) => !name.endsWith('/'))
        .map(([name, data]) => ({
          path: '/' + name,
          data,
          size: data.length,
        }));

      // Detect and strip common root prefix
      // e.g., if all paths start with "/dist/", strip the "/dist" prefix
      files = stripCommonRootPrefix(files);

      resolve(files);
    });
  });
}

/**
 * If all files share the same single top-level directory, strip it.
 * e.g., ["dist/a.html", "dist/b.js"] → ["/a.html", "/b.js"]
 * e.g., ["index.html", "app.js"]     → ["/index.html", "/app.js"] (no change)
 *
 * @param {Array<{path: string, data: Uint8Array, size: number}>} files
 * @returns {Array<{path: string, data: Uint8Array, size: number}>}
 */
function stripCommonRootPrefix(files) {
  if (files.length === 0) return files;

  // Extract the top-level directory name from each path
  // Path format: "/dirname/..." or "/filename"
  const topLevelDirs = files.map(f => {
    const parts = f.path.split('/').filter(Boolean); // remove empty strings from leading "/"
    return parts.length > 1 ? parts[0] : null;
  });

  // All files must be inside a directory (no root-level files)
  // and all must share the same top-level directory name
  if (topLevelDirs.some(d => d === null)) return files;

  const firstDir = topLevelDirs[0];
  const allSameDir = topLevelDirs.every(d => d === firstDir);

  if (!allSameDir) return files;

  // Strip the common prefix "/firstDir"
  const prefix = '/' + firstDir;
  return files.map(f => ({
    ...f,
    path: f.path.slice(prefix.length) || '/',
  }));
}

// ---------------------------------------------------------------------------
// extractTarGz
// ---------------------------------------------------------------------------

/**
 * Extract a TAR.GZ archive from an ArrayBuffer.
 *
 * Uses fflate's gunzip to decompress, then nanotar's parseTar to parse.
 * Filters to file entries only, normalizes paths with leading '/'.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Array<{path: string, data: Uint8Array, size: number}>>}
 */
export function extractTarGz(arrayBuffer) {
  return new Promise((resolve, reject) => {
    gunzip(new Uint8Array(arrayBuffer), (err, decompressed) => {
      if (err) return reject(err);

      let entries;
      try {
        entries = parseTar(decompressed);
      } catch (parseErr) {
        return reject(parseErr);
      }

      // nanotar omits type for regular files, or sets type === 'file'
      const files = entries
        .filter(e => e.type === 'file' || e.type === undefined || e.type === null)
        .map(e => {
          // nanotar returns data as Uint8Array
          const data = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data || []);
          return {
            path: '/' + e.name.replace(/^\//, ''), // normalize leading slash
            data,
            size: data.length,
          };
        });

      resolve(files);
    });
  });
}

// ---------------------------------------------------------------------------
// autoExcludeVCS
// ---------------------------------------------------------------------------

/**
 * Filter out VCS and OS metadata files/directories.
 *
 * Excludes paths under .git/, .svn/, .hg/ and .DS_Store files.
 *
 * @param {Array<{path: string}>} files
 * @returns {{ included: Array, excluded: Array, excludedCount: number }}
 */
export function autoExcludeVCS(files) {
  const included = [];
  const excluded = [];

  for (const file of files) {
    if (isVCSPath(file.path)) {
      excluded.push(file);
    } else {
      included.push(file);
    }
  }

  return { included, excluded, excludedCount: excluded.length };
}

/**
 * Returns true if the path should be auto-excluded as VCS/OS metadata.
 *
 * @param {string} path
 * @returns {boolean}
 */
function isVCSPath(path) {
  // Check for VCS directory prefixes
  for (const prefix of VCS_EXCLUDE_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }

  // Check for .DS_Store files anywhere in path
  if (path === '/.DS_Store' || path.endsWith('/.DS_Store')) return true;

  return false;
}

// ---------------------------------------------------------------------------
// buildFileTree
// ---------------------------------------------------------------------------

/**
 * Convert a flat file list into a nested tree structure suitable for
 * rendering in a tree component.
 *
 * Each node: { name, path, isDir, size?, children? }
 * Directories are sorted before files; items within each group are
 * sorted alphabetically by name.
 *
 * @param {Array<{path: string, size: number}>} files
 * @returns {Array<TreeNode>}
 */
export function buildFileTree(files) {
  if (files.length === 0) return [];

  // Root map: name → node
  const root = new Map();

  for (const file of files) {
    // Split path into parts, filtering out empty strings from leading '/'
    const parts = file.path.split('/').filter(Boolean);
    insertNode(root, parts, file.path, file.size);
  }

  return sortNodes(Array.from(root.values()));
}

/**
 * Recursively insert a file into the tree structure.
 *
 * @param {Map} nodeMap - Current level's map of name → node
 * @param {string[]} parts - Remaining path parts
 * @param {string} fullPath - Full path for leaf nodes
 * @param {number} size - File size for leaf nodes
 */
function insertNode(nodeMap, parts, fullPath, size) {
  const [head, ...rest] = parts;

  if (rest.length === 0) {
    // Leaf node (file)
    nodeMap.set(head, { name: head, path: fullPath, isDir: false, size });
  } else {
    // Directory node
    if (!nodeMap.has(head)) {
      // Build directory path by joining all parts up to this point
      // We compute it lazily from the full path
      const dirPath = '/' + parts.slice(0, parts.length - rest.length).join('/');
      nodeMap.set(head, {
        name: head,
        path: dirPath,
        isDir: true,
        children: new Map(),
      });
    }
    const dirNode = nodeMap.get(head);
    if (!dirNode.children) dirNode.children = new Map();
    insertNode(dirNode.children, rest, fullPath, size);
  }
}

/**
 * Sort a list of tree nodes: directories first, then files, both alphabetically.
 * Recursively sorts children.
 *
 * @param {Array<TreeNode>} nodes
 * @returns {Array<TreeNode>}
 */
function sortNodes(nodes) {
  const dirs = nodes.filter(n => n.isDir).sort((a, b) => a.name.localeCompare(b.name));
  const files = nodes.filter(n => !n.isDir).sort((a, b) => a.name.localeCompare(b.name));

  // Convert children Maps to sorted arrays
  for (const dir of dirs) {
    if (dir.children instanceof Map) {
      dir.children = sortNodes(Array.from(dir.children.values()));
    }
  }

  return [...dirs, ...files];
}

// ---------------------------------------------------------------------------
// pickDirectory (browser-only, not unit-testable)
// ---------------------------------------------------------------------------

/**
 * Open a directory picker dialog. Uses showDirectoryPicker (Chromium)
 * with fallback to a hidden <input webkitdirectory> for Firefox/Safari.
 *
 * @returns {Promise<Array<{path: string, data: Uint8Array, size: number}>>}
 */
export async function pickDirectory() {
  if ('showDirectoryPicker' in window) {
    // Chromium: Chrome, Edge, Brave, Arc
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    return readDirectoryHandle(dirHandle, '');
  } else {
    // Firefox/Safari fallback: hidden file input with webkitdirectory
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const files = await Promise.all(
            Array.from(input.files).map(async file => {
              const data = new Uint8Array(await file.arrayBuffer());
              // webkitRelativePath gives "dirname/path/to/file"
              // Normalize to "/path/to/file" by stripping the top-level dir
              const relPath = file.webkitRelativePath;
              const slashIdx = relPath.indexOf('/');
              const path = slashIdx >= 0 ? relPath.slice(slashIdx) : '/' + relPath;
              return { path, data, size: data.length };
            })
          );
          resolve(files);
        } catch (err) {
          reject(err);
        } finally {
          document.body.removeChild(input);
        }
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve([]);
      };

      document.body.appendChild(input);
      input.click();
    });
  }
}

// ---------------------------------------------------------------------------
// pickArchive (browser-only, not unit-testable)
// ---------------------------------------------------------------------------

/**
 * Open an archive file picker dialog (.zip, .tar.gz, .tgz).
 * Extracts the archive based on file extension.
 *
 * @returns {Promise<Array<{path: string, data: Uint8Array, size: number}>>}
 */
export async function pickArchive() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.tar.gz,.tgz';
    input.style.display = 'none';

    input.onchange = async () => {
      try {
        const file = input.files[0];
        if (!file) {
          resolve([]);
          return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const name = file.name.toLowerCase();

        let files;
        if (name.endsWith('.zip')) {
          files = await extractZip(arrayBuffer);
        } else if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
          files = await extractTarGz(arrayBuffer);
        } else {
          reject(new Error(`Unsupported archive format: ${file.name}`));
          return;
        }
        resolve(files);
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(input);
      }
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve([]);
    };

    document.body.appendChild(input);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// readDirectoryHandle (browser File System Access API, not unit-testable)
// ---------------------------------------------------------------------------

/**
 * Recursively read all files from a FileSystemDirectoryHandle.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} basePath - Path prefix accumulated during recursion
 * @returns {Promise<Array<{path: string, data: Uint8Array, size: number}>>}
 */
export async function readDirectoryHandle(dirHandle, basePath) {
  const files = [];

  for await (const [name, handle] of dirHandle) {
    const path = basePath + '/' + name;

    if (handle.kind === 'directory') {
      const subFiles = await readDirectoryHandle(handle, path);
      files.push(...subFiles);
    } else {
      const file = await handle.getFile();
      const data = new Uint8Array(await file.arrayBuffer());
      files.push({ path, data, size: data.length });
    }
  }

  return files;
}
