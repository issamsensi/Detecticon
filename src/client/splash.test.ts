import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let requestExpandedModeMock: ReturnType<typeof vi.fn>;

vi.mock('@devvit/web/client', () => {
  requestExpandedModeMock = vi.fn();
  return {
    context: {
      username: 'test-user',
    },
    requestExpandedMode: requestExpandedModeMock,
  };
});

const flush = async () => {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
  // Default: fail fetches so splash falls back to default state
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
});

afterEach(() => {
  requestExpandedModeMock?.mockReset();
  vi.unstubAllGlobals();
});

describe('Splash', () => {
  it('shows default state and Play still opens game when fetch fails', async () => {
    await import('./splash');
    await flush();

    expect(document.body.textContent).toContain('Detecticon');
    expect(document.body.textContent).toContain('4 suspects. 1 liar. 3 tries.');
    expect(document.body.textContent).toContain('New case today');

    const playButton = Array.from(document.querySelectorAll('button')).find((b) =>
      /play/i.test(b.textContent ?? '')
    );
    expect(playButton).toBeTruthy();

    playButton!.click();
    expect(requestExpandedModeMock).toHaveBeenCalledTimes(1);
    expect(requestExpandedModeMock.mock.calls[0]?.[1]).toBe('game');
  });
});
