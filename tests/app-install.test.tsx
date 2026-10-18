// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppInstall } from '@/components/AppInstall';

afterEach(cleanup);

describe('web app installation', () => {
  it('keeps platform instructions available without a native install prompt', async () => {
    const user = userEvent.setup();
    render(<AppInstall />);
    await user.click(screen.getByRole('button', { name: 'App 安裝' }));
    expect(screen.getByRole('dialog', { name: '安裝 Pain Medicine App' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'iPhone／iPad' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Android' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '安裝到此裝置' })).toBeNull();
  });

  it.each(['accepted', 'dismissed'] as const)('uses a %s prompt only once without assuming installation', async (outcome) => {
    const user = userEvent.setup();
    render(<AppInstall />);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'App 安裝' }));
    await user.click(screen.getByRole('button', { name: '安裝到此裝置' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '安裝到此裝置' })).toBeNull();
    expect(screen.queryByText('已安裝或正在 App 模式中開啟。')).toBeNull();
    act(() => window.dispatchEvent(new Event('appinstalled')));
    expect(screen.getByText('已安裝或正在 App 模式中開啟。')).toBeTruthy();
  });

  it('falls back to manual instructions when the browser prompt fails', async () => {
    const user = userEvent.setup();
    render(<AppInstall />);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockRejectedValue(new Error('unsupported')),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    act(() => window.dispatchEvent(event));
    await user.click(screen.getByRole('button', { name: 'App 安裝' }));
    await user.click(screen.getByRole('button', { name: '安裝到此裝置' }));
    expect(screen.getByRole('status').textContent).toContain('請依下方步驟使用瀏覽器選單');
    expect(screen.getByRole('heading', { name: '電腦' })).toBeTruthy();
  });
});
