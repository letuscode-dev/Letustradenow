import { render, screen } from '@testing-library/react';
import Loading from '../../shared_ui/loading/loading';
import JournalLoader from '../../journal/journal-components/journal-loader';

it('uses one circular indicator instead of five loading bars', () => {
    const { container } = render(<Loading is_fullscreen={false} />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(container.querySelector('.initial-loader__spinner')).toBeTruthy();
    expect(container.querySelectorAll('.barspinner__rect')).toHaveLength(0);
});

it('shows a message rather than striped journal placeholders', () => {
    const { container } = render(<JournalLoader is_mobile />);
    expect(screen.getByText('Waiting for journal messages...')).toBeTruthy();
    expect(container.querySelectorAll('rect')).toHaveLength(0);
});
