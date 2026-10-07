import { waitFor } from '@testing-library/react';
import browser from 'webextension-polyfill';
import {
  pagePermissionBridgeRequestEvent,
  pagePermissionBridgeResultEvent,
} from '@dailydotdev/shared/src/features/extensionEmbed/pagePermissionBridge';
import {
  newTabActivationBridgeRequestEvent,
  newTabActivationBridgeResultEvent,
} from '@dailydotdev/shared/src/features/extensionEmbed/newTabActivationBridge';

jest.mock('webextension-polyfill', () => ({
  runtime: { sendMessage: jest.fn() },
}));

it('clones both bridge results into the Firefox page context', async () => {
  const cloneInto = jest.fn((value) => ({ ...value, cloned: true }));
  Object.defineProperty(globalThis, 'cloneInto', {
    configurable: true,
    value: cloneInto,
  });
  (browser.runtime.sendMessage as jest.Mock).mockResolvedValue({
    triggered: true,
    granted: true,
    willReload: false,
  });
  const permissionResult = jest.fn();
  const activationResult = jest.fn();
  window.addEventListener(pagePermissionBridgeResultEvent, permissionResult);
  window.addEventListener(newTabActivationBridgeResultEvent, activationResult);

  try {
    await import('./index');
    window.dispatchEvent(new Event(pagePermissionBridgeRequestEvent));
    window.dispatchEvent(new Event(newTabActivationBridgeRequestEvent));

    await waitFor(() => {
      expect(permissionResult).toHaveBeenCalledTimes(1);
      expect(activationResult).toHaveBeenCalledTimes(1);
    });
    expect(permissionResult.mock.calls[0][0].detail).toMatchObject({
      granted: true,
      cloned: true,
    });
    expect(activationResult.mock.calls[0][0].detail).toMatchObject({
      triggered: true,
      cloned: true,
    });
    expect(cloneInto).toHaveBeenCalledTimes(2);
    expect(cloneInto).toHaveBeenCalledWith(expect.any(Object), window);
  } finally {
    Reflect.deleteProperty(globalThis, 'cloneInto');
    window.removeEventListener(
      pagePermissionBridgeResultEvent,
      permissionResult,
    );
    window.removeEventListener(
      newTabActivationBridgeResultEvent,
      activationResult,
    );
  }
});
