const finiteAmount = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

/** Display a confirmed purchase immediately, and replace it with Deriv's actual contract updates. */
export const mirrorContractForDisplay = ({ account, currency, buy, signal, contract = {} }) => {
    const terminal = contract.status === 'won' || contract.status === 'lost';
    const profit = finiteAmount(contract.profit);
    const sellPrice = finiteAmount(contract.sell_price);
    const settled = terminal && profit !== null && sellPrice !== null && sellPrice >= 0;
    const transactionIds = { ...(contract.transaction_ids || {}) };
    if (transactionIds.buy == null && buy.transaction_id != null) transactionIds.buy = buy.transaction_id;

    return {
        ...contract,
        accountID: account,
        contract_id: buy.contract_id,
        id: contract.id ?? String(buy.contract_id),
        currency: contract.currency ?? currency,
        contract_type: contract.contract_type ?? 'DIGITDIFF',
        underlying_symbol: contract.underlying_symbol ?? contract.underlying ?? signal.symbol ?? '1HZ75V',
        date_start: contract.date_start ?? buy.start_time ?? buy.purchase_time ?? null,
        barrier: contract.barrier ?? signal.barrier,
        tick_count: contract.tick_count ?? 1,
        buy_price: finiteAmount(contract.buy_price) ?? finiteAmount(buy.buy_price),
        payout: settled ? sellPrice : (finiteAmount(contract.payout) ?? finiteAmount(buy.payout)),
        transaction_ids: transactionIds,
        status: settled ? contract.status : 'open',
        is_sold: settled ? 1 : 0,
        is_expired: settled ? contract.is_expired : 0,
        is_settleable: settled ? contract.is_settleable : 0,
        profit: settled ? profit : undefined,
        sell_price: settled ? sellPrice : undefined,
    };
};
