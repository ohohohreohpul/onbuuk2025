import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedRequest, clearRequestCache } from '../requestCache';

afterEach(() => {
  clearRequestCache();
  vi.useRealTimers();
});

describe('cachedRequest', () => {
  it('runs the loader once for concurrent callers with the same key', async () => {
    const load = vi.fn().mockResolvedValue('value');
    const [a, b] = await Promise.all([cachedRequest('k', load), cachedRequest('k', load)]);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('loads again after the entry expires', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue('value');
    await cachedRequest('k', load);
    vi.advanceTimersByTime(61_000);
    await cachedRequest('k', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not keep failed requests', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('value');
    await expect(cachedRequest('k', load)).rejects.toThrow('offline');
    await expect(cachedRequest('k', load)).resolves.toBe('value');
  });
});
