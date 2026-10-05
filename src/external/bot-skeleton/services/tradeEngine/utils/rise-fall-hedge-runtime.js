import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { contract as emitContract } from './broadcast';
import {
    applyContractToLeg,
    finalizeHedge,
    hedgeResultLines,
    isSettled,
    saveHedgeHistory,
} from './rise-fall-hedge';
import { hedgeEntryLines, strategyBreakdownLines } from './rise-fall-hedge-entry';

const POLL_MS = 500;
const SETTLE_TIMEOUT_MS = 120000;

export const notifyHedge = (message, className = 'journal__text') =>
    globalObserver.emit('ui.log.notify', { className, message, sound: 'silent' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll Deriv until the contract has settled; resolves with the final contract (or the last seen). */
export const pollUntilSettled = async (contract_id, timeout_ms = SETTLE_TIMEOUT_MS) => {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeout_ms) {
        try {
            const response = await api_base.api.send({ proposal_open_contract: 1, contract_id });
            last = response?.proposal_open_contract || last;
            if (isSettled(last)) return last;
        } catch {
            // Keep polling; a transient error must not lose the result.
        }
        await sleep(POLL_MS);
    }
    return last;
};

/**
 * Settle the current hedge: apply the engine's settled Rise contract (if given),
 * wait for the Fall leg, record the combined result and journal it.
 */
export const settleCurrentHedge = async (state, rise_contract) => {
    const hedge = state?.current;
    if (!hedge) return null;
    if (rise_contract && rise_contract.contract_id === hedge.rise.contract_id) {
        hedge.rise = applyContractToLeg(hedge.rise, rise_contract);
    }
    const legs = ['rise', 'fall'].filter(side => hedge[side].contract_id && hedge[side].result === undefined);
    const settled_pocs = {};
    await Promise.all(
        legs.map(async side => {
            const poc = await pollUntilSettled(hedge[side].contract_id);
            if (poc) {
                hedge[side] = applyContractToLeg(hedge[side], poc);
                settled_pocs[side] = poc;
            }
        })
    );

    const final = finalizeHedge(hedge, state.settings.asymmetric_threshold_ms);
    state.current = null;
    if (final.net === undefined) {
        notifyHedge(`HEDGE #${final.id}: result not available from Deriv yet — check the Transactions tab.`, 'journal__text--warn');
        return final;
    }
    state.hedges.push(final);
    saveHedgeHistory(state.hedges);

    // The engine only reports Rise to the run panel; add the settled Fall leg too.
    if (settled_pocs.fall && isSettled(settled_pocs.fall)) emitContract(settled_pocs.fall);

    const className =
        final.net > 0 ? 'journal__text--success' : final.net < 0 ? 'journal__text--error' : 'journal__text';
    hedgeResultLines(final, state).forEach((line, i) => notifyHedge(line, i < 5 ? className : 'journal__text'));
    if (final.entry || state.entry_settings?.enabled) {
        hedgeEntryLines(final).forEach(line => notifyHedge(line));
        notifyHedge('Strategy performance (all stored hedges):');
        strategyBreakdownLines(state.hedges).forEach(line => notifyHedge(line));
    }
    return final;
};

/** Used when only Fall was bought (the engine will not run After Purchase). */
export const settleHedgeInBackground = state => {
    settleCurrentHedge(state, null).catch(() => undefined);
};
