import { observable, runInAction } from 'mobx';
import { observer as botObserver } from '@/external/bot-skeleton/utils/observer';
import { getStoredItemsByKey } from '@/utils/session-storage';
import * as sessionStorageUtils from '@/utils/session-storage';
import { createMirrorBotSession } from '@/external/bot-skeleton/services/tradeEngine/utils/mirror-bot-session';
import { leastDigitDecreaseStrategy } from '@/external/bot-skeleton/services/tradeEngine/utils/least-digit-decrease';
import { createTestSignalStrategy } from '../../test-utils/trade-signal-strategy';
import TransactionsStore from '../transactions-store';

jest.mock('@/components/shared', () => ({
    formatDate: (value: unknown) => String(value ?? ''),
    isEnded: (contract: { status?: string }) => Boolean(contract.status && contract.status !== 'open'),
}));
jest.mock('@/external/bot-skeleton', () => ({ LogTypes: { PROFIT: 'profit', LOST: 'lost' } }));

describe('mirror contracts in Transactions', () => {
    beforeEach(() => sessionStorage.clear());

    it('shows confirmed purchases and updates the correct contract after a stop', () => {
        const client = observable({ loginid: 'A' });
        const root = { run_panel: { run_id: 'run-1' } } as any;
        const store = new TransactionsStore(root, { client } as any);
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 11, transaction_ids: { buy: 101 },
            status: 'open', date_start: 1, currency: 'USD', buy_price: 0.62, contract_type: 'DIGITDIFF' });
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 12, transaction_ids: {},
            status: 'open', date_start: 2, currency: 'USD', buy_price: 0.62, contract_type: 'DIGITDIFF' });
        expect(store.transactions).toHaveLength(2);
        root.run_panel.run_id = 'next-run';
        botObserver.emit('bot.stop');
        // The run panel can unmount while an already-bought contract is settling.
        store.disposeReactionsFn();
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 11, transaction_ids: { buy: 101 },
            status: 'won', date_start: 1, currency: 'USD', buy_price: 0.62, payout: 0.67, profit: 0.05 });
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 12, transaction_ids: {},
            status: 'won', date_start: 2, currency: 'USD', buy_price: 0.62, payout: 0.67, profit: 0.05 });
        expect(store.transactions).toHaveLength(2);
        expect(store.transactions.find(item => (item.data as any).contract_id === 11)?.data)
            .toMatchObject({ is_completed: true, profit: 0.05, run_id: 'run-1' });
        expect(store.statistics).toMatchObject({ number_of_runs: 2, won_contracts: 2, total_profit: 0.1 });
        expect(getStoredItemsByKey('transaction_cache', {}).A).toHaveLength(2);
        store.disposeMirrorListener();
        const reloaded = new TransactionsStore(root, { client } as any);
        expect(reloaded.transactions).toHaveLength(2);
        expect(reloaded.statistics.total_profit).toBe(0.1);
        reloaded.disposeReactionsFn();
        reloaded.disposeMirrorListener();
    });

    it('attributes late settlements to the original account', () => {
        const client = observable({ loginid: 'B' });
        const store = new TransactionsStore({ run_panel: { run_id: 'run-1' } } as any, { client } as any);
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 99, transaction_ids: {}, status: 'lost',
            date_start: 1, currency: 'USD', buy_price: 1, profit: -1 });
        expect(store.transactions).toHaveLength(0);
        expect(getStoredItemsByKey('transaction_cache', {}).A[0].data.contract_id).toBe(99);
        runInAction(() => { client.loginid = 'A'; });
        expect(store.transactions).toHaveLength(1);
        store.disposeReactionsFn();
        store.disposeMirrorListener();
    });

    it('keeps different contracts separate when buy transaction ids are missing', () => {
        const client = observable({ loginid: 'A' });
        const store = new TransactionsStore({ run_panel: { run_id: 'run-1' } } as any, { client } as any);
        for (const contract_id of [21, 22]) {
            botObserver.emit('mirror.contract', { accountID: 'A', contract_id, transaction_ids: {}, status: 'open',
                date_start: 1, currency: 'USD', buy_price: 1 });
        }
        expect(store.transactions).toHaveLength(2);
        store.disposeReactionsFn();
        store.disposeMirrorListener();
    });

    it('persists a current-account contract once, and still persists updates after reactions are disposed', () => {
        const client = observable({ loginid: 'A' });
        const store = new TransactionsStore({ run_panel: { run_id: 'run-1' } } as any, { client } as any);
        const persist = jest.spyOn(sessionStorageUtils, 'setStoredItemsByKey');
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 21, transaction_ids: {}, status: 'open',
            date_start: 1, currency: 'USD', buy_price: 1 });
        expect(persist).toHaveBeenCalledTimes(1);
        store.disposeReactionsFn();
        persist.mockClear();
        botObserver.emit('mirror.contract', { accountID: 'A', contract_id: 21, transaction_ids: {}, status: 'won',
            date_start: 1, currency: 'USD', buy_price: 1, payout: 1.1, profit: 0.1 });
        expect(persist).toHaveBeenCalledTimes(1);
        expect(getStoredItemsByKey('transaction_cache', {}).A[0].data.profit).toBe(0.1);
        persist.mockRestore();
        store.disposeMirrorListener();
    });

    it('displays a confirmed mirror purchase and its result even when it settles after stop', async () => {
        const client = observable({ loginid: 'A' });
        const store = new TransactionsStore({ run_panel: { run_id: 'run-1' } } as any, { client } as any);
        let listener: (message: any) => void = () => {};
        const api = {
            connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: (callback: (message: any) => void) => {
                listener = callback; return { unsubscribe: jest.fn() };
            } }),
            send: jest.fn(async (request: any) => {
                if (request.ticks) {
                    const first = { msg_type: 'tick', subscription: { id: 'ticks' },
                        tick: { symbol: '1HZ75V', epoch: 1, quote: 100.07, pip_size: 2 } };
                    listener({ data: first });
                    return first;
                }
                if (request.buy) return { buy: { contract_id: 22054422119, transaction_id: 88, buy_price: 0.62 } };
                if (request.proposal_open_contract) return { proposal_open_contract: { contract_id: request.contract_id, status: 'open' } };
                return {};
            }),
        };
        const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
            settings: { stake: 0.62 }, strategy: createTestSignalStrategy(), journal: jest.fn(), onStop: jest.fn(), round: (value: number) => value,
            onContract: (contract: any) => botObserver.emit('mirror.contract', contract) });
        await session.attach();
        for (const [epoch, quote] of [[2, 100.04], [3, 100.07]]) {
            listener({ data: { msg_type: 'tick', subscription: { id: 'ticks' },
                tick: { symbol: '1HZ75V', epoch, quote, pip_size: 2 } } });
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(store.transactions).toHaveLength(1);
        expect(store.transactions[0].data).toMatchObject({ contract_id: 22054422119, buy_price: 0.62, is_completed: false });
        session.stop();
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 22054422119, status: 'won', sell_price: 0.67, profit: 0.05,
        } } });
        expect(store.transactions).toHaveLength(1);
        expect(store.transactions[0].data).toMatchObject({ contract_id: 22054422119, profit: 0.05, is_completed: true });
        expect(store.statistics).toMatchObject({ number_of_runs: 1, total_profit: 0.05, total_payout: 0.67 });
        store.disposeReactionsFn();
        store.disposeMirrorListener();
    });

    it('shows a confirmed least-digit purchase immediately and updates its final result', async () => {
        const client = observable({ loginid: 'A' });
        const store = new TransactionsStore({ run_panel: { run_id: 'run-1' } } as any, { client } as any);
        let listener: (message: any) => void = () => {};
        const tick = (epoch: number, digit: number) => ({ msg_type: 'tick', subscription: { id: 'ticks' },
            tick: { symbol: '1HZ75V', epoch, quote: 100 + digit / 100, pip_size: 2 } });
        const api = {
            connection: { readyState: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() },
            onMessage: () => ({ subscribe: (callback: (message: any) => void) => {
                listener = callback; return { unsubscribe: jest.fn() };
            } }),
            send: jest.fn(async (request: any) => {
                if (request.ticks) { const first = tick(1001, 9); listener({ data: first }); return first; }
                if (request.ticks_history) {
                    const digits = [...Array(81).fill(0), ...Array(80).fill(1),
                        ...Array.from({ length: 7 }, (_, i) => Array(105).fill(i + 2)).flat(), ...Array(104).fill(9)];
                    return { pip_size: 2, history: { times: digits.map((_, i) => i + 1), prices: digits.map(digit => 100 + digit / 100) } };
                }
                if (request.proposal_open_contract && !request.contract_id) return { subscription: { id: 'all' } };
                if (request.buy) return { buy: { contract_id: 777, buy_price: request.price } };
                return {};
            }),
        };
        const session = createMirrorBotSession({ getApi: () => api, getAccount: () => 'A', account: 'A', currency: 'USD',
            settings: { stake: 5, maxLosses: 2, profitThreshold: 10, symbols: ['1HZ75V'] },
            strategy: leastDigitDecreaseStrategy, journal: jest.fn(), onStop: jest.fn(), round: (value: number) => value,
            onContract: (contract: any) => botObserver.emit('mirror.contract', contract) });
        await session.attach();
        listener({ data: tick(1002, 9) });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(store.transactions).toHaveLength(1);
        expect(store.transactions[0].data).toMatchObject({ contract_id: 777, contract_type: 'DIGITDIFF',
            barrier: 0, tick_count: 1, buy_price: 5, is_completed: false });
        expect((store.transactions[0].data as any).date_start).toBeUndefined();
        listener({ data: { msg_type: 'proposal_open_contract', proposal_open_contract: {
            contract_id: 777, status: 'won', sell_price: 5.48, profit: 0.48,
        } } });
        expect(store.transactions).toHaveLength(1);
        expect(store.transactions[0].data).toMatchObject({ contract_id: 777, profit: 0.48, is_completed: true });
        session.stop();
        store.disposeReactionsFn();
        store.disposeMirrorListener();
    });
});
