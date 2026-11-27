/** Track confirmed mirror purchases independently until each contract settles. */
export const createMirrorContractTracker = () => ({ active: new Map(), settled: new Set() });

const contractKey = id => {
    if (id === null || id === undefined || id === '') return null;
    return String(id);
};

const monetaryValue = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

export const registerMirrorPurchase = (tracker, signal, response) => {
    const buy = response?.buy;
    const id = contractKey(buy?.contract_id);
    const stake = monetaryValue(buy?.buy_price);
    if (!id || stake === null || stake <= 0 || !Number.isInteger(signal?.barrier) || signal.barrier < 0 || signal.barrier > 9) {
        return false;
    }
    if (tracker.active.has(id) || tracker.settled.has(id)) return false;
    tracker.active.set(id, { signal, contract_id: buy.contract_id, stake });
    return true;
};

/** Return one record only for a confirmed, fully settled and tracked contract. */
export const recordMirrorSettlement = (tracker, contract) => {
    const id = contractKey(contract?.contract_id);
    const purchase = id && tracker.active.get(id);
    if (!purchase || (contract.status !== 'won' && contract.status !== 'lost')) return null;
    const payout = monetaryValue(contract.sell_price);
    const profit = monetaryValue(contract.profit);
    if (payout === null || payout < 0 || profit === null) return null;

    tracker.active.delete(id);
    tracker.settled.add(id);
    return { ...purchase, result: contract.status, payout, profit };
};
