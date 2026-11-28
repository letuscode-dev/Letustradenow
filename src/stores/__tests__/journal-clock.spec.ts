import JournalStore from '../journal-store';

jest.mock('@/components/shared', () => ({ formatDate: jest.fn() }));
jest.mock('@/external/bot-skeleton', () => ({ LogTypes: {}, MessageTypes: {} }));
jest.mock('@/external/bot-skeleton/constants/config', () => ({ config: jest.fn() }));
jest.mock('../../utils/journal-notifications', () => ({ isCustomJournalMessage: jest.fn() }));

describe('journal clock', () => {
    afterEach(() => jest.useRealTimers());

    it('uses the current clock until the server clock is running', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-11-27T20:10:10Z'));
        const common = { server_time: { get: () => new Date('2026-11-27T20:08:31Z') }, update_time_interval: undefined };
        const store = { core: { common } } as unknown as JournalStore;
        expect(JournalStore.prototype.getServerTime.call(store)).toEqual(new Date('2026-11-27T20:10:10Z'));
    });

    it('uses the synchronised server clock when available', () => {
        const serverTime = new Date('2026-11-27T20:10:10Z');
        const common = { server_time: { get: () => serverTime }, update_time_interval: 1 };
        const store = { core: { common } } as unknown as JournalStore;
        expect(JournalStore.prototype.getServerTime.call(store)).toBe(serverTime);
    });
});
