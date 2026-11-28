import classnames from 'classnames';
import { localize } from '@deriv-com/translations';
import LoadingIndicator from '../../loader/loading-indicator';

const JournalLoader = ({ is_mobile }: { is_mobile: boolean }) => (
    <div className={classnames('journal__loader', { 'journal__loader--mobile': is_mobile })}>
        <LoadingIndicator message={localize('Waiting for journal messages...')} />
    </div>
);

export default JournalLoader;
