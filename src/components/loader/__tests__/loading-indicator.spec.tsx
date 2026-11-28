import { render, screen } from '@testing-library/react';
import ChunkLoader from '../chunk-loader';
import BlocklyLoading from '../../blockly-loading';

jest.mock('@/hooks/useStore', () => ({ useStore: () => ({ blockly_store: { is_loading: true } }) }));

it('shows a readable loading status without the five-bar loader', () => {
    const { container } = render(<ChunkLoader message='Connecting...' />);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting...');
    expect(container.querySelectorAll('.app-loading-indicator__spinner')).toHaveLength(1);
    expect(container.querySelectorAll('.barspinner__rect')).toHaveLength(0);
});

it('shows a centred Bot Builder loading status', () => {
    const { container } = render(<BlocklyLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Bot Builder...');
    expect(container.querySelectorAll('.app-loading-indicator__spinner')).toHaveLength(1);
    expect(container.querySelectorAll('.barspinner__rect')).toHaveLength(0);
});
