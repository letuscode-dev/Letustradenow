import { render, screen } from '@testing-library/react';
import { contract_stages } from '@/constants/contract-stage';
import ContractCardLoader from '../contract-card-loading';

jest.mock('../contract-card-running-bot', () => ({ __esModule: true, default: ({ message }: { message?: string }) =>
    <div role='status'>{message || 'Waiting for a signal.'}</div> }));

it('shows a clear contract loading status without striped placeholder bars', () => {
    const { container } = render(<ContractCardLoader contract_stage={contract_stages.PURCHASE_SENT} />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for contract details.');
    expect(container.querySelectorAll('rect')).toHaveLength(0);
});

it('shows the waiting-for-a-signal status while the bot is running', () => {
    render(<ContractCardLoader contract_stage={contract_stages.RUNNING} />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for a signal.');
});
