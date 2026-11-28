it('passes the increase and risk settings to the bot', () => {
    const generator = { forBlock: {}, valueToCode: (_block, name) => ({ INCREASE: 'increase', STAKE: 'stake',
        LOSSES: 'losses', TARGET: 'target', STOP_LOSS: 'stop', RECOVERY: 'recovery' }[name]), ORDER_NONE: 0 };
    window.Blockly = { Blocks: {}, JavaScript: { javascriptGenerator: generator } };
    require('../digit_percentage_increase_bot');
    expect(generator.forBlock.digit_percentage_increase_run({}))
        .toBe('Bot.runDigitPercentageIncreaseBot(increase, stake, losses, target, stop, recovery);\n');
});
