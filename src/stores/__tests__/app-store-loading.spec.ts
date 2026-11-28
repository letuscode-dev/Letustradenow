import AppStore from '../app-store';
import { DBot } from '@/external/bot-skeleton';

jest.mock('@/external/bot-skeleton', () => ({ api_base: {}, ApiHelpers: {}, runIrreversibleEvents: jest.fn(), DBot: {
    initWorkspace: jest.fn(), terminateBot: jest.fn(), terminateConnection: jest.fn(),
} }));
jest.mock('@/external/bot-skeleton/scratch/utils', () => ({ setCurrency: jest.fn() }));

describe('Bot Builder initialization', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

    const createStore = () => {
        const blockly_store = { setLoading: jest.fn(), setLoadError: jest.fn(), setContainerSize: jest.fn() };
        const root = { blockly_store, run_panel: { is_running: false } };
        const core = { ui: { is_mobile: true, setAccountSwitcherDisabledMessage: jest.fn(), setPromptHandler: jest.fn() } };
        const store = new AppStore(root as any, core as any);
        store.dbot_store = {} as any;
        return { store, blockly_store };
    };

    it('clears the loading overlay and reports an initialization failure', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        (DBot.initWorkspace as jest.Mock).mockRejectedValueOnce(new Error('Chunk unavailable'));
        const { store, blockly_store } = createStore();
        await store.onMount();
        expect(blockly_store.setLoadError).toHaveBeenLastCalledWith('Bot Builder could not load. Check your connection and try again.');
        expect(blockly_store.setLoading.mock.calls).toEqual([[true], [false]]);
        expect(blockly_store.setContainerSize).not.toHaveBeenCalled();
    });

    it('does not activate an initialization that finishes after the builder is unmounted', async () => {
        let finish: () => void = () => {};
        (DBot.initWorkspace as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        const { store, blockly_store } = createStore();
        const mounting = store.onMount();
        store.onUnmount();
        finish();
        await mounting;
        expect(blockly_store.setContainerSize).not.toHaveBeenCalled();
        expect(blockly_store.setLoading).toHaveBeenLastCalledWith(false);
        expect(blockly_store.setLoadError).toHaveBeenLastCalledWith(null);
    });
});
