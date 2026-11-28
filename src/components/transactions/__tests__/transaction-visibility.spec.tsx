import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Transaction from '../transaction';
import { getTransactionIdentity } from '../transaction-identity';

jest.mock('@/components/shared_ui/money', () => ({ __esModule: true, default: ({ amount, currency }: any) => <span>{amount} {currency}</span> }));
jest.mock('@/external/bot-skeleton', () => ({ getContractTypeName: () => 'Digit Differs' }));
jest.mock('@/external/bot-skeleton/utils/workspace', () => ({ isDbotRTL: () => false }));
jest.mock('@/utils/symbol-display-name', () => ({ getSymbolDisplayNameSync: () => 'Volatility 75 (1s)' }));
jest.mock('@deriv/quill-icons', () => ({ LegacyRadioOffIcon: () => <span />, LegacyRadioOnIcon: () => <span /> }));
jest.mock('@deriv-com/translations', () => ({ Localize: ({ i18n_default_text }: any) => <span>{i18n_default_text}</span>, localize: (text: string) => text }));
jest.mock('../../market/market-icon', () => ({ MarketIcon: () => <span /> }));
jest.mock('../../trade-type/trade-type-icon', () => ({ TradeTypeIcon: () => <span /> }));
jest.mock('../../shared', () => ({ convertDateFormat: (date: string) => date }));
jest.mock('../../shared_ui/popover', () => ({ __esModule: true, default: ({ children, message, is_open }: any) => <div>{children}{is_open && message}</div> }));

it('shows a confirmed contract with barrier zero and opens its details without a buy reference', () => {
    const contract = { contract_id: 777, transaction_ids: {}, contract_type: 'DIGITDIFF', barrier: 0,
        tick_count: 1, buy_price: 5, currency: 'USD', status: 'open', is_completed: false };
    const onClick = jest.fn();
    render(<Transaction contract={contract as any} active_transaction_id='contract:777' onClickTransaction={onClick} />);
    expect(screen.getByText('Contract ID')).toBeTruthy();
    expect(screen.getByText('777')).toBeTruthy();
    expect(screen.getByText('Barrier')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('5 USD')).toBeTruthy();
    expect(screen.getAllByLabelText('Waiting for data').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('dt_transactions_item'));
    expect(onClick).toHaveBeenCalledWith('contract:777');
    expect(getTransactionIdentity({ transaction_ids: { buy: 777 }, contract_id: 888 })).toBe('buy:777');
    expect(getTransactionIdentity({ transaction_ids: {}, contract_id: 777 })).toBe('contract:777');
    expect(getTransactionIdentity(null)).toBeNull();
});
