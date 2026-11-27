import { api_base } from '../../../api/api-base';
import { pollUntilSettled } from '../rise-fall-hedge-runtime';

jest.mock('../../../api/api-base', () => ({ api_base: { api: { send: jest.fn() } } }));
jest.mock('../../../../utils/observer', () => ({ observer: { emit: jest.fn() } }));
jest.mock('../broadcast', () => ({ contract: jest.fn() }));

describe('hedge settlement polling', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(100000);
        jest.clearAllMocks();
    });
    afterEach(() => jest.useRealTimers());

    it('backs off for a minute after a rate-limited open-contract request', async () => {
        api_base.api.send
            .mockResolvedValueOnce({ error: { code: 'RateLimit' } })
            .mockResolvedValueOnce({ proposal_open_contract: { contract_id: 1, is_sold: 1, profit: -1 } });
        const result = pollUntilSettled(1, 120000, 3000);
        await jest.advanceTimersByTimeAsync(59999);
        expect(api_base.api.send).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        await expect(result).resolves.toMatchObject({ contract_id: 1, is_sold: 1 });
        expect(api_base.api.send).toHaveBeenCalledTimes(2);
    });

    it('uses the configured interval while the contract remains open', async () => {
        api_base.api.send
            .mockResolvedValueOnce({ proposal_open_contract: { contract_id: 1, status: 'open' } })
            .mockResolvedValueOnce({ proposal_open_contract: { contract_id: 1, status: 'won' } });
        const result = pollUntilSettled(1, 120000, 3000);
        await jest.advanceTimersByTimeAsync(2999);
        expect(api_base.api.send).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        await expect(result).resolves.toMatchObject({ status: 'won' });
        expect(api_base.api.send).toHaveBeenCalledTimes(2);
    });
});
