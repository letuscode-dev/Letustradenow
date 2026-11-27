import { createThreeDigitMirrorState, processThreeDigitMirrorTick, resetThreeDigitMirrorWindow } from './three-digit-mirror';
import { createMirrorContractTracker, recordMirrorSettlement, registerMirrorPurchase } from './mirror-contract-tracker';
import { applyMirrorSettlement, createMirrorRiskState } from './mirror-risk';

/** Core runtime: transport supplies ordered live ticks, a direct buy, and settlement messages. */
export const createMirrorRuntime = ({ settings, buy, refreshContract, journal, round = value => value, onStop = () => {}, onChange = () => {}, onPurchase = () => {}, onContractUpdate = () => {}, strategy = null }) => {
    const risk = strategy ? strategy.createRisk(settings) : createMirrorRiskState(settings);
    const detector = strategy ? strategy.createDetector() : createThreeDigitMirrorState();
    const tracker = createMirrorContractTracker();
    const signals = [];
    const waitingSignals = [];
    const executionOrder = [];
    const settledOutcomes = new Map();
    const earlySettlements = new Map();
    let nextSettlementIndex = 0;
    let enabled = true;
    let executionPaused = false;
    let pendingBuys = 0;

    const stop = reason => {
        if (!enabled) return;
        enabled = false;
        while (waitingSignals.length) {
            const signal = waitingSignals.shift();
            signal.status = 'restricted';
            signal.reason = `Bot stopped: ${reason}`;
            journal({ type: 'signal', ...signal });
        }
        journal({ type: 'stop', reason });
        onStop(reason);
    };

    const flushSettlements = deferredEvents => {
        const emit = event => deferredEvents ? deferredEvents.push(event) : journal(event);
        while (nextSettlementIndex < executionOrder.length) {
            const signal = executionOrder[nextSettlementIndex];
            if (signal.status === 'unconfirmed') {
                emit({ type: 'settlement_order_incomplete', signal, reason: 'Purchase was rejected or its outcome is unknown; subsequent confirmed results are still recorded.' });
                nextSettlementIndex += 1;
                continue;
            }
            if (!settledOutcomes.has(signal.tickIndex)) break;
            const key = executionOrder[nextSettlementIndex++].tickIndex;
            const outcome = settledOutcomes.get(key);
            settledOutcomes.delete(key);
            try {
                if (strategy) strategy.applySettlement(risk, outcome, round);
                else applyMirrorSettlement(risk, outcome, round);
                emit({ type: 'settlement', ...outcome, inARow: risk.inARow, lossCount: risk.lossCount,
                    totalLoss: risk.totalLoss, totalProfit: risk.totalProfit, nextStake: risk.stake });
                if (risk.stopped) {
                    if (deferredEvents) return risk.stopReason;
                    stop(risk.stopReason);
                }
            } catch (error) {
                emit({ type: 'settlement_error', contractId: outcome.contract_id, reason: error.message });
                if (deferredEvents) return 'Unable to process a confirmed settlement';
                stop('Unable to process a confirmed settlement');
                return;
            }
        }
    };

    const settle = (contract, beforeDisplay = () => {}) => {
        const id = contract?.contract_id;
        const purchase = id === null || id === undefined ? null : tracker.active.get(String(id));
        if (!purchase) {
            const hasAmount = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
            if (strategy?.bufferEarlySettlements && pendingBuys && id != null &&
                (contract?.status === 'won' || contract?.status === 'lost') &&
                hasAmount(contract.profit) && hasAmount(contract.sell_price) && Number(contract.sell_price) >= 0) {
                if (earlySettlements.size >= 100) earlySettlements.delete(earlySettlements.keys().next().value);
                earlySettlements.set(String(id), contract);
            }
            return;
        }
        const updateDisplay = () => {
            try {
                beforeDisplay();
                onContractUpdate(contract, purchase.signal);
            } catch (error) {
                journal({ type: 'display_error', contractId: id, reason: error?.message || String(error) });
            }
        };
        if (!strategy?.prioritizeExecution) updateDisplay();
        const outcome = recordMirrorSettlement(tracker, contract);
        if (!outcome) {
            if (strategy?.prioritizeExecution) updateDisplay();
            return;
        }
        settledOutcomes.set(outcome.signal.tickIndex, outcome);
        const deferredEvents = strategy?.prioritizeExecution ? [] : null;
        if (executionOrder[nextSettlementIndex]?.tickIndex !== outcome.signal.tickIndex) {
            const event = { type: 'settlement_pending_order', ...outcome,
                reason: 'An earlier purchase has not settled; risk totals will update in purchase order.' };
            if (deferredEvents) deferredEvents.push(event);
            else journal(event);
        }
        const stopReason = flushSettlements(deferredEvents);
        if (deferredEvents) {
            const finishSettlement = () => {
                updateDisplay();
                deferredEvents.forEach(journal);
                if (stopReason) stop(stopReason);
                onChange();
            };
            if (stopReason) finishSettlement();
            else submitNext(finishSettlement);
            return;
        }
        onChange();
        submitNext();
    };

    const submitNext = (afterRequest = () => {}) => {
        if (!enabled || executionPaused || pendingBuys || tracker.active.size ||
            nextSettlementIndex < executionOrder.length || !waitingSignals.length) {
            afterRequest();
            return;
        }
        const signal = waitingSignals.shift();
        signal.stake = risk.stake;
        signal.status = 'submitted';
        delete signal.reason;
        executionOrder.push(signal);
        pendingBuys += 1;
        let purchasePending = true;
        const finishPurchase = (deferChange = false) => {
            if (!purchasePending) return;
            purchasePending = false;
            pendingBuys -= 1;
            if (!deferChange) {
                onChange();
                submitNext();
            }
        };
        let request;
        try {
            request = buy({ barrier: signal.barrier, stake: signal.stake });
        } catch (error) {
            request = Promise.reject(error);
        }
        // Send the next eligible buy before updating the display or writing the journal.
        afterRequest();
        journal({ type: 'signal', ...signal });
        Promise.resolve(request).then(response => {
            if (response?.buy?.contract_id !== undefined && response?.buy?.contract_id !== null) {
                signal.contractId = response.buy.contract_id;
            }
            if (!registerMirrorPurchase(tracker, signal, response)) throw new Error('Invalid purchase confirmation');
            signal.status = 'executed';
            const displayPurchase = () => {
                try {
                    onPurchase(response.buy, signal);
                } catch (error) {
                    journal({ type: 'display_error', contractId: signal.contractId, reason: error?.message || String(error) });
                }
            };
            const earlySettlement = earlySettlements.get(String(signal.contractId));
            earlySettlements.clear();
            if (earlySettlement && strategy?.prioritizeExecution) {
                // A terminal update can precede the buy response. Confirm the buy,
                // apply that result, and send any recovery before display work.
                finishPurchase(true);
                settle(earlySettlement, displayPurchase);
            } else {
                displayPurchase();
                if (earlySettlement) settle(earlySettlement);
                finishPurchase();
            }
            journal({ type: 'purchase', signal, contractId: signal.contractId, stake: response.buy.buy_price,
                barrier: signal.barrier, duration: 1, entryTimestamp: response.buy.start_time ?? response.buy.purchase_time ?? null,
                confirmed: true });
            if (tracker.settled.has(String(signal.contractId))) return;
            return Promise.resolve(refreshContract(signal.contractId)).then(result => settle(result?.proposal_open_contract));
        }).catch(error => {
            if (signal.status === 'executed') {
                journal({ type: 'settlement_check_error', contractId: signal.contractId, reason: error?.message || String(error) });
                if (!tracker.settled.has(String(signal.contractId)) && error?.code !== 'MIRROR_CONNECTION_INTERRUPTED') {
                    stop('Could not confirm contract settlement; check account before restarting');
                }
            } else {
                earlySettlements.clear();
                signal.status = 'unconfirmed';
                signal.reason = error?.error?.message || error?.message || String(error);
                journal({ type: 'purchase_error', signal, reason: signal.reason });
                stop('Purchase was rejected or not confirmed; check account before restarting');
                flushSettlements();
            }
        }).finally(finishPurchase);
    };

    const tick = (digit, timestamp, executable = true) => {
        if (!enabled) return;
        const pattern = strategy ? strategy.evaluate(detector, digit, risk) : processThreeDigitMirrorTick(detector, digit);
        if (!pattern) return;
        const signal = { ...pattern, timestamp, symbol: '1HZ75V',
            pattern: strategy ? `Digit Differs ${pattern.barrier}` : `${pattern.first}-${pattern.middle}-${pattern.third}`,
            status: 'detected' };
        signals.push(signal);
        if (!executable) {
            signal.status = 'restricted';
            signal.reason = 'Recovered historical tick';
            journal({ type: 'signal', ...signal });
            return;
        }
        signal.status = 'queued';
        waitingSignals.push(signal);
        submitNext();
        if (signal.status === 'queued') {
            signal.reason = executionPaused ? 'Waiting for connection recovery' : 'Waiting for the previous contract to settle';
            journal({ type: 'signal', ...signal });
        }
    };

    const pauseExecution = () => { executionPaused = true; };
    const resumeExecution = () => { executionPaused = false; submitNext(); };

    return { tick, settle, stop, pauseExecution, resumeExecution,
        resetWindow: () => strategy ? strategy.reset(detector) : resetThreeDigitMirrorWindow(detector), risk, tracker, signals,
        isEnabled: () => enabled, pendingBuys: () => pendingBuys, queuedSignals: () => waitingSignals.length };
};
