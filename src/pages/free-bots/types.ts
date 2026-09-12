export type FreeBotAction = 'RUN' | 'LOAD';

export type FreeBotSymbolOption = {
    symbol: string;
    label: string;
    group?: 'standard' | '1s' | string;
    defaultSelected?: boolean;
};

/**
 * A free bot entry backed by a raw Blockly XML string.
 * Add entries via catalog.ts.
 */
export type FreeBot = {
    id: string;
    title: string;
    description: string;
    tags?: string[];
    /** Raw Blockly XML content for this bot (used when buildXml is absent). */
    xml: string;
    /** Optional volatility selectors shown on the Free Bots card before load. */
    symbol_options?: FreeBotSymbolOption[];
    /** Build XML from the volatilities the user checked. */
    buildXml?: (selected_symbols: string[]) => string;
};
