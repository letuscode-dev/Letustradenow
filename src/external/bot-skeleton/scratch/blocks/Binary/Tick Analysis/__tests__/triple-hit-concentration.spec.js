it('passes all user settings to the Triple-Hit bot', () => {
    const generator = { forBlock: {}, valueToCode: (_block, name) => ({ STAKE: 'stake', LOSSES: 'losses',
        TARGET: 'target', RECOVERY: 'recovery' }[name]), ORDER_NONE: 0 };
    window.Blockly = { Blocks: {}, JavaScript: { javascriptGenerator: generator } };
    require('../triple_hit_concentration');
    expect(generator.forBlock.triple_hit_concentration_run({}))
        .toBe('Bot.runTripleHitConcentrationBot(stake, losses, target, recovery);\n');
});
