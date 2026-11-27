describe('mirror bot block', () => {
    it('generates the runtime call with the configured risk settings', () => {
        const generator = { forBlock: {}, valueToCode: (_block, name) => ({ STAKE: 'stake', LOSSES: 'losses', TARGET: 'target' }[name]), ORDER_NONE: 0 };
        window.Blockly = { Blocks: {}, JavaScript: { javascriptGenerator: generator } };
        require('../mirror_bot');
        expect(generator.forBlock.mirror_bot_run({})).toBe('Bot.runMirrorBot(stake, losses, target);\n');
    });
});
