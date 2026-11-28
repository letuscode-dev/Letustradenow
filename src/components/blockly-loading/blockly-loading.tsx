import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import StartupLoader from '../loader/startup-loader';

const BlocklyLoading = observer(() => {
    const { blockly_store } = useStore();
    const { is_loading, load_error } = blockly_store;

    return (
        <>
            {(is_loading || load_error) && (
                <div className='bot__loading' data-testid='blockly-loader'>
                    <StartupLoader message={localize('Loading Bot Builder...')} error={load_error ? localize(load_error) : null} fullPage={false} />
                </div>
            )}
        </>
    );
});

export default BlocklyLoading;
