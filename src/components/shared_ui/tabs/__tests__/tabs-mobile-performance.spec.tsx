import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Tabs from '../tabs';

jest.mock('../../themed-scrollbars/themed-scrollbars', () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock('@/utils/tmp/dummy', () => ({ Icon: () => null }));
jest.mock('../../counter', () => ({ __esModule: true, default: () => null }));

describe('mobile tab navigation', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('changes tabs without creating recurring measurement timers', () => {
        const onChange = jest.fn();
        const { unmount } = render(
            <Tabs active_index={0} onTabItemClick={onChange} top>
                <div label='Dashboard'>Dashboard content</div>
                <div label='Bot Builder'>Builder content</div>
            </Tabs>
        );
        fireEvent.click(screen.getByText('Bot Builder'));
        expect(onChange).toHaveBeenCalledWith(1);
        expect(screen.getByText('Builder content')).toBeTruthy();
        unmount();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('does not schedule retries when no tab is active', () => {
        const { unmount } = render(<Tabs active_index={-1} top><div label='Dashboard'>Content</div><div label='Builder'>Builder</div></Tabs>);
        expect(jest.getTimerCount()).toBe(0);
        unmount();
    });
});
