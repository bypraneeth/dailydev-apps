import browser from 'webextension-polyfill';
import type { DeclarativeNetRequest, Permissions } from 'webextension-polyfill';

export const FRAME_EMBED_PERMISSION = 'declarativeNetRequestWithHostAccess';
export const FRAME_EMBED_ORIGIN = '*://*/*';

// Chromium can take a few seconds to apply DNR session-rule changes,
// especially right after the optional host-access permission is granted.
const DNR_CALL_TIMEOUT_MS = 4000;

export type FrameEmbedRule = DeclarativeNetRequest.Rule;

export type DeclarativeNetRequestApi = Pick<
  DeclarativeNetRequest.Static,
  'updateSessionRules' | 'getSessionRules'
>;

export type PermissionsApi = Pick<Permissions.Static, 'contains'> & {
  // Chromium also allows requesting DNR, which Firefox requires at install.
  request(options: Permissions.AnyPermissions): Promise<boolean>;
};

export const getDeclarativeNetRequestApi =
  (): DeclarativeNetRequestApi | null => browser.declarativeNetRequest ?? null;

export const getPermissionsApi = (): PermissionsApi | null =>
  browser.permissions ?? null;

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withDnrTimeout = async <T>(
  promise: Promise<T>,
  label: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = globalThis.setTimeout(() => {
          reject(
            new Error(`${label} timed out after ${DNR_CALL_TIMEOUT_MS}ms`),
          );
        }, DNR_CALL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};
