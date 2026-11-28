import { Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { useDevice } from '@deriv-com/ui';
import { localize } from '@deriv-com/translations';
import LoadingIndicator from '@/components/loader/loading-indicator';
import ChartModalDesktop from './chart-modal-desktop';

export const ChartModal = observer(() => {
    const { isDesktop } = useDevice();
    return <Suspense fallback={<LoadingIndicator message={localize('Loading chart...')} />}>{isDesktop && <ChartModalDesktop />}</Suspense>;
});

export default ChartModal;
