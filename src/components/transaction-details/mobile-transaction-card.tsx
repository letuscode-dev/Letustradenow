import { ReactElement } from 'react';
import classNames from 'classnames';
import { getContractTypeName } from '@/external/bot-skeleton';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { getSymbolDisplayNameSync } from '@/utils/symbol-display-name';
import { localize } from '@deriv-com/translations';
import { MarketIcon } from '../market/market-icon';
import { convertDateFormat } from '../shared';
import Popover from '../shared_ui/popover';
import { TradeTypeIcon } from '../trade-type/trade-type-icon';
import { TTransaction } from './transaction-details.types';

const PARENT_CLASS = 'transaction-details-modal-mobile';

type TCardRow = {
    title: string;
    label: string | number | ReactElement;
    right_aligned: boolean;
    large_title: boolean;
    loader: boolean;
};

const CellLoader = () => <span data-testid='transaction_details_card_cell_loader' aria-label={localize('Waiting for data')}>—</span>;

const CardColumn = ({
    label = '',
    large_title = false,
    right_aligned = false,
    title = '',
    loader = false,
}: Partial<TCardRow>) => (
    <div
        className={classNames(`${PARENT_CLASS}__card__column`, {
            [`${PARENT_CLASS}__right-align`]: right_aligned,
        })}
    >
        {title && (
            <div
                className={classNames({
                    [`${PARENT_CLASS}__small-title`]: !large_title,
                    [`${PARENT_CLASS}__large-title`]: large_title,
                })}
            >
                {localize(title)}
            </div>
        )}
        <div className={`${PARENT_CLASS}__label`}>{loader ? <CellLoader /> : label}</div>
    </div>
);

const IconContainer = ({ message, icon }: { message: string; icon: ReactElement }) => (
    <div className={classNames(`${PARENT_CLASS}__table-cell`, `${PARENT_CLASS}__table-cell__icon-wrapper`)}>
        {message && (
            <Popover alignment={isDbotRTL() ? 'left' : 'right'} message={message} zIndex='7'>
                {icon}
            </Popover>
        )}
    </div>
);

export default function MobileTransactionCards({ transaction }: { transaction: TTransaction }) {
    return (
        <div className={`${PARENT_CLASS}__card`} data-testid='dt_mobile_transaction_card'>
            <div className={`${PARENT_CLASS}__card__row`}>
                <CardColumn
                    label={
                        <div className={`${PARENT_CLASS}__icon-wrapper`}>
                            <IconContainer
                                message={
                                    transaction?.display_name ||
                                    getSymbolDisplayNameSync(transaction?.underlying_symbol || '')
                                }
                                icon={<MarketIcon type={transaction?.underlying_symbol} size='md' />}
                            />
                            <IconContainer
                                message={getContractTypeName(transaction)}
                                icon={<TradeTypeIcon type={transaction?.contract_type} size='md' />}
                            />
                        </div>
                    }
                />
            </div>
            <div className={`${PARENT_CLASS}__card__row`}>
                <CardColumn title='Ref. ID' label={transaction?.transaction_ids?.buy} />
            </div>
            <div className={`${PARENT_CLASS}__card__row`}>
                <CardColumn
                    title='Timestamp'
                    label={convertDateFormat(
                        transaction?.date_start,
                        'YYYY-M-D HH:mm:ss [GMT]',
                        'YYYY-MM-DD HH:mm:ss [GMT]'
                    )}
                />
                <CardColumn
                    title='Entry Spot'
                    label={transaction?.entry_spot}
                    right_aligned
                    loader={!transaction.entry_spot}
                />
            </div>
            <div className={`${PARENT_CLASS}__card__row`}>
                <CardColumn title='Buy Price' label={Math.abs(transaction?.buy_price ?? 0).toFixed(2)} />
                <CardColumn
                    title='Exit Spot'
                    label={transaction?.exit_spot}
                    right_aligned
                    loader={!transaction.exit_spot}
                />
            </div>

            <div className={`${PARENT_CLASS}__card__row`}>
                <CardColumn title='Profit / Loss' large_title />
                <CardColumn
                    label={
                        <div
                            className={classNames({
                                [`${PARENT_CLASS}__card__profit--win`]: transaction?.profit > 0,
                                [`${PARENT_CLASS}__card__profit--loss`]: transaction?.profit < 0,
                            })}
                        >
                            {Math.abs(transaction?.profit ?? 0).toFixed(2)}
                        </div>
                    }
                    right_aligned
                    loader={!transaction.is_completed}
                />
            </div>
        </div>
    );
}
