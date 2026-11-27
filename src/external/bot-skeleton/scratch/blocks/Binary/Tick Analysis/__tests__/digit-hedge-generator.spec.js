jest.mock('@deriv-com/translations', () => ({ localize: text => text }));
jest.mock('../../../../utils', () => ({ modifyContextMenu: jest.fn() }));

describe('digit hedge purchase generator', () => {
    let originalBlockly;
    let generator;

    beforeAll(() => {
        originalBlockly = window.Blockly;
        generator = {
            forBlock: {},
            ORDER_ATOMIC: 0,
            valueToCode: (_block, name) => ({
                OVER: 'overPrediction',
                UNDER: 'underPrediction',
                OVER_STAKE: 'overStake',
                UNDER_STAKE: 'underStake',
                TAKE_PROFIT: 'target',
                STOP_LOSS: 'loss',
                RUNS_PER_BATCH: 'runs',
                WAIT_SECONDS: 'wait',
            }[name] || ''),
        };
        window.Blockly = { Blocks: {}, JavaScript: { javascriptGenerator: generator } };
        jest.isolateModules(() => require('../digit_hedge'));
    });

    afterAll(() => { window.Blockly = originalBlockly; });

    it('configures both predictions, stakes, limits and pacing before purchase', () => {
        const code = generator.forBlock.digit_hedge_purchase({});
        expect(code).toBe(
            'Bot.digitHedgeSetBarriers(overPrediction, underPrediction);\n' +
            'Bot.digitHedgeSetStakes(overStake, underStake);\n' +
            'Bot.digitHedgeSetLimits(target, loss);\n' +
            'Bot.digitHedgeSetPacing(runs, wait);\n' +
            'Bot.purchaseDigitHedge();\n'
        );
    });
});
