/** A confirmed contract can be visible before a buy transaction reference is available. */
export const getTransactionIdentity = (contract?: { contract_id?: string | number; transaction_ids?: { buy?: string | number } } | null) => {
    const buy = contract?.transaction_ids?.buy;
    if (buy !== null && buy !== undefined && buy !== '') return `buy:${buy}`;
    const id = contract?.contract_id;
    if (id !== null && id !== undefined && id !== '') return `contract:${id}`;
    return null;
};
