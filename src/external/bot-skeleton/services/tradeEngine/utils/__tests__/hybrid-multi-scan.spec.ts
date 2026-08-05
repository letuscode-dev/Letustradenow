import {
    CONTRACT_CODE,
    CONTRACT_DIGITDIFF,
    CONTRACT_DIGITOVER,
    CONTRACT_DIGITUNDER,
    HYBRID_LANES,
    evaluateHybridMultiScan,
    makeHybridMultiScanTipKey,
    contractTypeToCode,
} from '../hybrid-multi-scan';

describe('evaluateHybridMultiScan', () => {
    it('maps contract types to codes', () => {
        expect(contractTypeToCode(CONTRACT_DIGITOVER)).toBe(CONTRACT_CODE.DIGITOVER);
        expect(contractTypeToCode(CONTRACT_DIGITUNDER)).toBe(CONTRACT_CODE.DIGITUNDER);
        expect(contractTypeToCode(CONTRACT_DIGITDIFF)).toBe(CONTRACT_CODE.DIGITDIFF);
        expect(contractTypeToCode(null)).toBe(CONTRACT_CODE.NONE);
    });

    it('prefers odd pair Over when last 2 odd and last 3 >= 5', () => {
        const result = evaluateHybridMultiScan([5, 5, 7], {
            odd_max: 5,
            even_min: 4,
            pattern_lookback: 20,
            hot_lookback: 20,
        });
        expect(result.matched).toBe(true);
        expect(result.lane).toBe(HYBRID_LANES.ODD_PAIR);
        expect(result.contract_type).toBe(CONTRACT_DIGITOVER);
        expect(result.prediction).toBe(2);
        expect(result.contract_code).toBe(CONTRACT_CODE.DIGITOVER);
    });

    it('prefers even pair Under when last 2 even and last 3 <= 4', () => {
        const result = evaluateHybridMultiScan([2, 0, 4], {
            odd_max: 5,
            even_min: 4,
            pattern_lookback: 20,
            hot_lookback: 20,
        });
        expect(result.matched).toBe(true);
        expect(result.lane).toBe(HYBRID_LANES.EVEN_PAIR);
        expect(result.contract_type).toBe(CONTRACT_DIGITUNDER);
        expect(result.prediction).toBe(7);
    });

    it('uses sequential Differs when pairs do not match', () => {
        // Ascending 1→2→3 → Differ 1; not an odd/even pair of same parity threshold style for over
        // 2,3 are not both odd; 1,2 not both even
        const digits = Array(50)
            .fill(0)
            .map((_, i) => i % 10);
        // Force tip to ascending without odd-pair / even-pair
        digits[digits.length - 3] = 2;
        digits[digits.length - 2] = 3;
        digits[digits.length - 1] = 4;

        const result = evaluateHybridMultiScan(digits, {
            odd_max: 5,
            even_min: 4,
            pattern_lookback: 20,
            min_occurrences: 99, // force pattern fail
            hot_lookback: 5000, // force hot fail (insufficient)
        });

        expect(result.matched).toBe(true);
        expect(result.lane).toBe(HYBRID_LANES.SEQUENTIAL);
        expect(result.contract_type).toBe(CONTRACT_DIGITDIFF);
        expect(result.prediction).toBe(2);
    });

    it('while recovering odd-pair lane, fires Over 3 immediately', () => {
        const result = evaluateHybridMultiScan([0, 1], {
            recovering: true,
            last_lane: HYBRID_LANES.ODD_PAIR,
            last_contract_type: CONTRACT_DIGITOVER,
            pattern_lookback: 20,
            hot_lookback: 20,
        });
        expect(result.matched).toBe(true);
        expect(result.lane).toBe(HYBRID_LANES.ODD_PAIR);
        expect(result.prediction).toBe(3);
        expect(result.contract_type).toBe(CONTRACT_DIGITOVER);
    });

    it('builds tip keys from lane + contract + prediction', () => {
        const result = {
            matched: true,
            lane: HYBRID_LANES.EVEN_PAIR,
            contract_type: CONTRACT_DIGITUNDER,
            prediction: 7,
        };
        expect(makeHybridMultiScanTipKey('epoch1', result)).toBe(
            'epoch1|even_pair|DIGITUNDER|7'
        );
    });
});
