/** Validate contract barriers and positive Over/Under settings. */
export const validOverUnderSwitchSettings = (over, under, stake, multiplier, target) => {
    const inputs = [over, under, stake, multiplier, target];
    if (inputs.some(value => value === null || value === undefined || value === '' || typeof value === 'boolean')) return false;
    const [overDigit, underDigit, initialStake, factor, takeProfit] = inputs.map(Number);
    return (
        Number.isInteger(overDigit) && overDigit >= 0 && overDigit <= 8 &&
        Number.isInteger(underDigit) && underDigit >= 1 && underDigit <= 9 &&
        Number.isFinite(initialStake) && initialStake > 0 &&
        Number.isFinite(factor) && factor > 0 &&
        Number.isFinite(takeProfit) && takeProfit > 0
    );
};
