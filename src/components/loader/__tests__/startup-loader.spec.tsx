import { act, fireEvent, render, screen } from '@testing-library/react';
import StartupLoader, { STARTUP_HELP_DELAY_MS } from '../startup-loader';

describe('startup recovery', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('offers a retry when loading takes too long', () => {
        const retry = jest.fn();
        const { unmount } = render(<StartupLoader message='Connecting...' onRetry={retry} />);
        expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
        act(() => jest.advanceTimersByTime(STARTUP_HELP_DELAY_MS));
        expect(screen.getByRole('alert')).toHaveTextContent('Check your connection');
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(retry).toHaveBeenCalledTimes(1);
        unmount();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('shows a failure and retry immediately without a spinning loader', () => {
        const { container } = render(<StartupLoader message='Loading...' error='Could not load market data.' onRetry={jest.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Could not load market data.');
        expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
        expect(container.querySelector('.app-loading-indicator__spinner')).toBeNull();
    });
});
