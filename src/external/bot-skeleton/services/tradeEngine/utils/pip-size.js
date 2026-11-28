/** A known positive pip size is required before interpreting displayed last digits. */
export const quietGapPipReady = pip => {
    const size = Number(pip);
    return Number.isInteger(size) && size >= 1;
};
