import { observable, runInAction } from 'mobx';
import { getStoredItemsByKey } from '@/utils/session-storage';
import JournalStore from '../journal-store';

jest.mock('@/components/shared', () => ({ formatDate: () => 'now' }));
jest.mock('@/external/bot-skeleton', () => ({ LogTypes: { WELCOME: 'welcome', WELCOME_BACK: 'welcome back' },
    MessageTypes: { ERROR: 'error', NOTIFY: 'notify', SUCCESS: 'success' } }));
jest.mock('@/external/bot-skeleton/constants/config', () => ({ config: jest.fn() }));
jest.mock('../../utils/journal-notifications', () => ({ isCustomJournalMessage: jest.fn() }));

describe('journal storage and account changes', () => {
    beforeEach(() => { sessionStorage.clear(); jest.useFakeTimers(); });
    afterEach(() => jest.useRealTimers());

    it('displays new messages immediately, batches storage, and flushes on page hide and account switch', async () => {
        const client = observable({ loginid: 'A', account_list: [{ loginid: 'A' }, { loginid: 'B' }] });
        const core = { client, common: { server_time: { get: () => new Date() }, update_time_interval: 1 } } as any;
        const store = new JournalStore({} as any, core);
        await Promise.resolve();
        await Promise.resolve();
        store.pushMessage('first', 'notify', 'journal__text');
        store.pushMessage('second', 'notify', 'journal__text');
        expect(store.unfiltered_messages[0].message).toBe('second');
        expect(getStoredItemsByKey('journal_cache', {}).A).toBeUndefined();
        window.dispatchEvent(new Event('pagehide'));
        expect(getStoredItemsByKey('journal_cache', {}).A.slice(0, 2).map((item: any) => item.message)).toEqual(['second', 'first']);
        store.pushMessage('third', 'notify', 'journal__text');
        runInAction(() => { client.loginid = 'B'; });
        await Promise.resolve();
        await Promise.resolve();
        expect(getStoredItemsByKey('journal_cache', {}).A[0].message).toBe('third');
        store.pushMessage('only B', 'notify', 'journal__text');
        store.disposeReactionsFn();
        const stored = getStoredItemsByKey('journal_cache', {});
        expect(stored.B[0].message).toBe('only B');
        expect(stored.A.some((item: any) => item.message === 'only B')).toBe(false);
    });

    it('retains messages recorded while account details are still loading', async () => {
        const client = observable({ loginid: 'A', account_list: [] as { loginid: string }[] });
        const core = { client, common: { server_time: { get: () => new Date() }, update_time_interval: 1 } } as any;
        const store = new JournalStore({} as any, core);
        store.pushMessage('during login', 'notify', 'journal__text');
        runInAction(() => { client.account_list.push({ loginid: 'A' }); });
        await Promise.resolve();
        await Promise.resolve();
        expect(store.unfiltered_messages.some(item => item.message === 'during login')).toBe(true);
        store.disposeReactionsFn();
        expect(getStoredItemsByKey('journal_cache', {}).A.some((item: any) => item.message === 'during login')).toBe(true);
    });
});
