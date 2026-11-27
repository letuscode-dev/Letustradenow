describe('fixed Digit Differs block', () => {
    it('passes the four user settings to the bot', () => {
        const generator = { forBlock: {}, valueToCode: (_block, name) => ({ PREDICTION: 'digit', STAKE: 'stake', TAKE_PROFIT: 'tp', STOP_LOSS: 'sl' }[name]), ORDER_NONE: 0 };
        window.Blockly = { Blocks: {}, JavaScript: { javascriptGenerator: generator } };
        require('../fixed_digit_differs');
        expect(generator.forBlock.fixed_digit_differs_run({})).toBe('Bot.runFixedDigitDiffersBot(digit, stake, tp, sl);\n');
    });
});
