import { createThreeDigitMirrorState, processThreeDigitMirrorTick, resetThreeDigitMirrorWindow } from './three-digit-mirror';
import { createMirrorContractTracker, recordMirrorSettlement, registerMirrorPurchase } from './mirror-contract-tracker';
import { applyMirrorSettlement, createMirrorRiskState } from './mirror-risk';

/** Core runtime: transport supplies ordered live ticks, a direct buy, and settlement messages. */
export const createMirrorRuntime = ({ settings, buy, refreshContract, journal, round = value => value, onStop = () => {}, onChange = () => {} }) => {
    const risk = createMirrorRiskState(settings);
    const detector = createThreeDigitMirrorState();
    const tracker = createMirrorContractTracker();
    const signals = [];
    const executionOrder = [];
    const settledOutcomes = new Map();
    let nextSettlementIndex = 0;
    let enabled = true;
    let pendingBuys = 0;

    const stop = reason => {
        if (!enabled) return;
        enabled = false;
        journal({ type: 'stop', reason });
        onStop(reason);
    };

    const flushSettlements = () => {
        while (settledOutcomes.has(executionOrder[nextSettlementIndex]?.tickIndex)) {
            const key = executionOrder[nextSettlementIndex++].tickIndex;
            const outcome = settledOutcomes.get(key);
            settledOutcomes.delete(key);
            try {
            applyMirrorSettlement(risk, outcome, round);
            journal({ type: 'settlement', ...outcome, inARow: risk.inARow, lossCount: risk.lossCount,
                totalLoss: risk.totalLoss, totalProfit: risk.totalProfit, nextStake: risk.stake });
            if (risk.stopped) stop(risk.stopReason);
            } catch (error) {
                journal({ type: 'settlement_error', contractId: outcome.contract_id, reason: error.message });
                stop('Unable to process a confirmed settlement');
                return;
            }
        }
    };

    const settle = contract => {
        const outcome = recordMirrorSettlement(tracker, contract);
        if (!outcome) return;
        settledOutcomes.set(outcome.signal.tickIndex, outcome);
        flushSettlements();
        onChange();
    };

    const tick = (digit, timestamp, executable = true) => {
        if (!enabled) return;
        const pattern = processThreeDigitMirrorTick(detector, digit);
        if (!pattern) return;
        const signal = { ...pattern, timestamp, symbol: '1HZ75V', pattern: `${pattern.first}-${pattern.middle}-${pattern.third}`, status: 'detected' };
        signals.push(signal);
        if (!executable) {
            signal.status = 'restricted';
            signal.reason = 'Recovered historical tick';
            journal({ type: 'signal', ...signal });
            return;
        }
        signal.stake = risk.stake;
        signal.status = 'submitted';
        executionOrder.push(signal);
        pendingBuys += 1;
        let request;
        try {
            request = buy({ barrier: signal.barrier, stake: signal.stake });
        } catch (error) {
            request = Promise.reject(error);
        }
        journal({ type: 'signal', ...signal });
        Promise.resolve(request).then(response => {
            if (!registerMirrorPurchase(tracker, signal, response)) throw new Error('Invalid purchase confirmation');
            signal.status = 'executed';
            signal.contractId = response.buy.contract_id;
            journal({ type: 'purchase', signal, contractId: signal.contractId, stake: response.buy.buy_price,
                barrier: signal.barrier, duration: 1, entryTimestamp: response.buy.start_time ?? response.buy.purchase_time ?? null,
                confirmed: true });
            return Promise.resolve(refreshContract(signal.contractId)).then(result => settle(result?.proposal_open_contract));
        }).catch(error => {
            if (signal.status === 'executed') {
                journal({ type: 'settlement_check_error', contractId: signal.contractId, reason: error?.message || String(error) });
                stop('Could not confirm contract settlement; check account before restarting');
            } else {
                signal.status = 'unconfirmed';
                signal.reason = error?.error?.message || error?.message || String(error);
                journal({ type: 'purchase_error', signal, reason: signal.reason });
                stop('Purchase was rejected or not confirmed; check account before restarting');
            }
        }).finally(() => { pendingBuys -= 1; onChange(); });
    };

    return { tick, settle, stop, resetWindow: () => resetThreeDigitMirrorWindow(detector), risk, tracker, signals,
        isEnabled: () => enabled, pendingBuys: () => pendingBuys };
};
