import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import LoadingIndicator from '../loader/loading-indicator';

const BlocklyLoading = observer(() => {
    const { blockly_store } = useStore();
    const { is_loading } = blockly_store;

    return (
        <>
            {is_loading && (
                <div className='bot__loading' data-testid='blockly-loader'>
                    <LoadingIndicator message={localize('Loading Bot Builder...')} />
                </div>
            )}
        </>
    );
});

export default BlocklyLoading;
