import { DBOT_TABS } from '@/constants/bot-contents';
import DigitPanel from '@/pages/bot-builder/digit-panel/digit-panel';
import { useStore } from '@/hooks/useStore';
import { observer } from 'mobx-react-lite';

const Analysis = () => {
    const { dashboard } = useStore();

    return (
        <div className='digit-panel-page'>
            <DigitPanel onClose={() => dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER)} />
        </div>
    );
};

export default observer(Analysis);
