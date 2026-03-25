// Core lib re-exports — packages/deployer barrel file
// Consumers can also use sub-path imports: '@nsite/deployer/store', '@nsite/deployer/nostr', etc.

// Store
export { persistedStore, createDeployerStores, ANON_KEY_STORAGE_KEY, DEFAULT_SESSION } from './lib/store.js';

// Nostr
export {
  DEFAULT_RELAYS,
  NSITE_RELAY,
  NSITE_BLOSSOM,
  NSITE_GATEWAY_HOST,
  NSITE_GATEWAY_PROTOCOL,
  getRelayPool,
  createAnonymousSigner,
  restoreAnonymousSigner,
  saveAnonymousKey,
  clearAnonymousKey,
  downloadNsecFile,
  createExtensionSigner,
  createNostrConnectSigner,
  connectFromBunkerURI,
  queryRelay,
  fetchProfile,
  fetchRelayList,
  fetchBlossomList,
  fetchExistingManifest,
  fetchAllManifests,
  getManifestDTag,
  getManifestTitle,
  getManifestDescription,
} from './lib/nostr.js';

// Upload
export { buildAuthEvent, checkExistence, uploadBlobs, deleteBlobs } from './lib/upload.js';

// Publish
export {
  buildManifest,
  publishToRelay,
  publishManifest,
  publishEmptyManifest,
  publishDeletionEvent,
} from './lib/publish.js';

// Crypto
export { hashFile } from './lib/crypto.js';

// Files
export {
  inferMimeType,
  VCS_EXCLUDE_PREFIXES,
  VCS_EXCLUDE_EXACT,
  VCS_EXCLUDE_SUFFIX,
  extractZip,
  extractTarGz,
  autoExcludeVCS,
  buildFileTree,
  pickDirectory,
  pickArchive,
  readDirectoryHandle,
} from './lib/files.js';

// Scanner
export {
  DANGEROUS_FILENAME_PATTERNS,
  SECRET_CONTENT_PATTERNS,
  AUTO_EXCLUDE_DIRS,
  scanFilename,
  scanFileContent,
  scanFiles,
} from './lib/scanner.js';

// Base36
export { base36Encode } from './lib/base36.js';
