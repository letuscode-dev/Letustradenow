export type FreeBotAction = 'RUN' | 'LOAD';

/** Bots that run as a live panel in the Free Bots tab instead of in Bot Builder. */
export type FreeBotPanel = 'rise_fall_hedge';

/**
 * A free bot entry: either raw Blockly XML (loaded into Bot Builder) or a live panel.
 * Add entries via catalog.ts.
 */
export type FreeBot = {
    id: string;
    title: string;
    description: string;
    tags?: string[];
    /** Raw Blockly XML content for this bot. */
    xml?: string;
    panel?: FreeBotPanel;
};
