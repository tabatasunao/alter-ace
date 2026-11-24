import { describe, expect, it } from 'vitest';
import { fetchWithRetry, loadCatalog, RETRY_DELAYS, type LoadOptions } from '../src/data/load';
import { readRawData } from './helpers';

/** A fake fetch that answers each call with the next reply: a status code, a thrown error, or a JSON body. */
function fakeFetch(replies: unknown[], calls: string[] = []): NonNullable<LoadOptions['fetch']> {
  let i = 0;
  return async (url) => {
    calls.push(url);
    const reply = replies[Math.min(i++, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    if (typeof reply === 'number') return new Response('', { status: reply });
    return new Response(JSON.stringify(reply), { status: 200 });
  };
}

function recorder(): { waits: number[]; wait: (s: number) => Promise<void> } {
  const waits: number[] = [];
  return { waits, wait: async (s) => void waits.push(s) };
}

describe('data loading', () => {
  it('retries a server error, then returns the response', async () => {
    const { waits, wait } = recorder();
    const calls: string[] = [];
    const res = await fetchWithRetry('data/x.json', { fetch: fakeFetch([503, { ok: true }], calls), wait });
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([RETRY_DELAYS[0]]);
  });

  it('retries a network error', async () => {
    const { waits, wait } = recorder();
    const res = await fetchWithRetry('data/x.json', { fetch: fakeFetch([new TypeError('Failed to fetch'), {}]), wait });
    expect(res.ok).toBe(true);
    expect(waits).toHaveLength(1);
  });

  it('does not retry a missing file', async () => {
    const { waits, wait } = recorder();
    const calls: string[] = [];
    await expect(fetchWithRetry('data/x.json', { fetch: fakeFetch([404], calls), wait })).rejects.toThrow('Failed to load data/x.json (HTTP 404)');
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it('gives up after every retry has failed, reporting the last error', async () => {
    const { waits, wait } = recorder();
    const calls: string[] = [];
    await expect(fetchWithRetry('data/x.json', { fetch: fakeFetch([503, 502, 429, 500], calls), wait })).rejects.toThrow('(HTTP 500)');
    expect(calls).toHaveLength(RETRY_DELAYS.length + 1);
    expect(waits).toEqual([...RETRY_DELAYS]);
  });

  it('builds the catalog when one data file fails once', async () => {
    const raw = readRawData();
    let failedOnce = false;
    const fetch: LoadOptions['fetch'] = async (url) => {
      const name = url.replace(/^.*data\/(\w+)\.json$/, '$1') as keyof typeof raw;
      if (name === 'loadout' && !failedOnce) {
        failedOnce = true;
        return new Response('', { status: 503 });
      }
      return new Response(JSON.stringify(raw[name]), { status: 200 });
    };
    const catalog = await loadCatalog('/', { fetch, wait: async () => {} });
    expect(failedOnce).toBe(true);
    expect(catalog.loadout.defaultLoadout.frame).toBe('vanguard');
  });
});
