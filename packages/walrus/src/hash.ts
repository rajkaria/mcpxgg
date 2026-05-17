/**
 * Content-addressed blob ids. Walrus itself derives blob ids from an erasure
 * commitment over the content; we cannot reproduce that off-chain without the
 * encoder, so the in-memory backend uses a sha256 content hash with a `mem:`
 * prefix. The real HTTP backend always uses the publisher-returned id. Both
 * are opaque strings to every consumer — never parsed, only echoed.
 */

import { createHash } from 'node:crypto';

export function contentBlobId(data: Uint8Array): string {
  const digest = createHash('sha256').update(data).digest('base64url');
  return `mem:${digest}`;
}
