import { act, render, screen, waitFor } from '@testing-library/react';
import AppContent from '../app-content';

const mockMarket = { retrieveActiveSymbols: jest.fn(), has_initialization_error: false };
const mockStore = {
    app: { setDBotEngineStores: jest.fn(), api_helpers_store: {} },
    transactions: { recovered_transactions: [], recoverPendingContracts: jest.fn() },
    common: { current_language: 'en', setSocketOpened: jest.fn(), error: null },
    client: { is_logged_in: false, loginid: null },
};
jest.mock('@/external/bot-skeleton', () => ({
    api_base: { api: null }, ApiHelpers: { get instance() { return { active_symbols: mockMarket }; }, setInstance: jest.fn() },
    ServerTime: { init: jest.fn() },
}));
jest.mock('@/external/bot-skeleton/services/api/observables/connection-status-stream', () => ({ CONNECTION_STATUS: { OPENED: 'open' } }));
jest.mock('@/hooks/useApiBase', () => ({ useApiBase: () => ({ connectionStatus: 'open' }) }));
jest.mock('@/hooks/useStore', () => ({ useStore: () => mockStore }));
jest.mock('@/hooks/useDevMode', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/hooks/useThemeSwitcher', () => ({ __esModule: true, default: () => ({ is_dark_mode_on: false }) }));
jest.mock('@/components/chat/useLiveChat', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/components/shared', () => ({ getUrlBase: (path) => path }));
jest.mock('@/components/bot-notification/bot-notification', () => ({ botNotification: jest.fn() }));
jest.mock('@/utils/is-preview-mode', () => ({ isPreviewMode: () => true }));
jest.mock('@/utils/gtm', () => ({ __esModule: true, default: { init: jest.fn() } }));
jest.mock('@deriv-com/smartcharts-champion', () => ({ setSmartChartsPublicPath: jest.fn() }));
jest.mock('@deriv-com/quill-ui', () => ({ ThemeProvider: ({ children }) => children }));
jest.mock('react-toastify', () => ({ ToastContainer: () => null }));
jest.mock('@/components/auth-loading-wrapper', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('@/components/transaction-details', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/audio', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/blockly-loading', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/bot-stopped', () => ({ __esModule: true, default: () => null }));
jest.mock('../../pages/bot-builder', () => ({ __esModule: true, default: () => null }));
jest.mock('../../pages/main', () => ({ __esModule: true, default: () => <div>Application ready</div> }));

beforeEach(() => {
    jest.clearAllMocks();
    mockMarket.has_initialization_error = false;
    mockStore.client.is_logged_in = false;
    mockStore.client.loginid = null;
});

it('shows a retry instead of entering the trading app when market loading fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockMarket.retrieveActiveSymbols.mockRejectedValueOnce(new Error('offline'));
    render(<AppContent />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load market data');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('Application ready')).toBeNull();
    expect(mockMarket.retrieveActiveSymbols).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
});

it('initializes once and opens the app when market data is available', async () => {
    mockMarket.retrieveActiveSymbols.mockResolvedValueOnce([{ symbol: '1HZ75V' }]);
    render(<AppContent />);
    expect(await screen.findByText('Application ready')).toBeTruthy();
    expect(mockStore.app.setDBotEngineStores).toHaveBeenCalledTimes(1);
    expect(mockMarket.retrieveActiveSymbols).toHaveBeenCalledTimes(1);
});

it('does not proceed when the market service reports an empty failed response', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockMarket.has_initialization_error = true;
    mockMarket.retrieveActiveSymbols.mockResolvedValueOnce([]);
    render(<AppContent />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load market data');
    expect(screen.queryByText('Application ready')).toBeNull();
    console.error.mockRestore();
});

it('ignores a stale failure when a newer account request has succeeded', async () => {
    let rejectFirst;
    mockMarket.retrieveActiveSymbols.mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
        .mockResolvedValueOnce([{ symbol: '1HZ75V' }]);
    const { rerender } = render(<AppContent testRevision={0} />);
    await waitFor(() => expect(mockMarket.retrieveActiveSymbols).toHaveBeenCalledTimes(1));
    mockStore.client.is_logged_in = true;
    mockStore.client.loginid = 'A';
    rerender(<AppContent testRevision={1} />);
    expect(await screen.findByText('Application ready')).toBeTruthy();
    await act(async () => { rejectFirst(new Error('old request')); await Promise.resolve(); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockMarket.retrieveActiveSymbols).toHaveBeenCalledTimes(2);
});
