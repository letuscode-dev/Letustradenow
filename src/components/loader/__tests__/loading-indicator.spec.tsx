import { render, screen } from '@testing-library/react';
import ChunkLoader from '../chunk-loader';
import BlocklyLoading from '../../blockly-loading';

const mockBlocklyStore = { is_loading: true, load_error: '' };
jest.mock('@/hooks/useStore', () => ({ useStore: () => ({ blockly_store: mockBlocklyStore }) }));

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

it('shows a retry when Bot Builder initialization fails', () => {
    mockBlocklyStore.is_loading = false;
    mockBlocklyStore.load_error = 'Bot Builder could not load. Check your connection and try again.';
    render(<BlocklyLoading />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bot Builder could not load');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    mockBlocklyStore.is_loading = true;
    mockBlocklyStore.load_error = '';
});
