export type FreeBotAction = 'RUN' | 'LOAD';

export type FreeBotSymbolOption = {
    symbol: string;
    label: string;
    group?: 'standard' | '1s' | string;
    defaultSelected?: boolean;
};

export type FreeBotNumberParam = {
    key: string;
    label: string;
    defaultValue: number;
    min?: number;
    step?: number;
};

export type FreeBotBuildOptions = {
    selected_symbols?: string[];
    params?: Record<string, number>;
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
    /** Optional numeric controls (stake, size, TP, SL, …) shown before load. */
    param_options?: FreeBotNumberParam[];
    /** Build XML from the volatilities / params the user configured. */
    buildXml?: (options: FreeBotBuildOptions) => string;
};
