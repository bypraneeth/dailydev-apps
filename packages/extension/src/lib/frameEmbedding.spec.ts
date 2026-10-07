import browser from 'webextension-polyfill';
import {
  getDeclarativeNetRequestApi,
  getPermissionsApi,
} from './frameEmbeddingApi';
import { requestFrameEmbeddingPermissions } from './frameEmbeddingPermissions';

jest.mock('webextension-polyfill', () => ({
  declarativeNetRequest: { getSessionRules: jest.fn() },
  permissions: { contains: jest.fn(), request: jest.fn() },
}));

it('uses Promise-based browser APIs for DNR and permissions', async () => {
  (
    browser.declarativeNetRequest.getSessionRules as jest.Mock
  ).mockResolvedValue([]);
  (browser.permissions.contains as jest.Mock).mockResolvedValue(true);
  await expect(
    getDeclarativeNetRequestApi()?.getSessionRules(),
  ).resolves.toEqual([]);
  await expect(getPermissionsApi()?.contains({})).resolves.toBe(true);
});

it.each(['chrome', 'firefox'])(
  'requests only optional permissions in %s',
  async (targetBrowser) => {
    const originalBrowser = process.env.TARGET_BROWSER;
    process.env.TARGET_BROWSER = targetBrowser;
    (browser.permissions.request as jest.Mock).mockResolvedValue(true);

    try {
      await expect(requestFrameEmbeddingPermissions()).resolves.toBe(true);
      expect(browser.permissions.request).toHaveBeenLastCalledWith({
        ...(targetBrowser === 'chrome'
          ? { permissions: ['declarativeNetRequestWithHostAccess'] }
          : {}),
        origins: ['*://*/*'],
      });
    } finally {
      if (originalBrowser === undefined) {
        delete process.env.TARGET_BROWSER;
      } else {
        process.env.TARGET_BROWSER = originalBrowser;
      }
    }
  },
);
