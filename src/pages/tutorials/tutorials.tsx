// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import NoSearchResult from './common/no-search-result-found';
import FAQContent from './faq-content';
import GuideContent from './guide-content';
import TutorialsTabDesktop from './tutorials-tab-desktop';
import TutorialsTabMobile from './tutorials-tab-mobile';

type TTutorialsTab = {
    handleTabChange: (active_number: number) => void;
};

export type TTutorialsTabItem = {
    label: string;
    content?: JSX.Element;
};

const TutorialsTab = observer(({ handleTabChange }: TTutorialsTab) => {
    const { isDesktop } = useDevice();
    const { dashboard } = useStore();
    const [prev_active_tutorials, setPrevActiveTutorialsTab] = React.useState<number>(0);

    const {
        active_tab_tutorials,
        video_tab_content,
        guide_tab_content,
        faq_tab_content,
        is_dialog_open,
    } = dashboard;

    React.useEffect(() => {
        if ([0, 1].includes(active_tab_tutorials)) {
            setPrevActiveTutorialsTab(active_tab_tutorials);
        }
    }, [active_tab_tutorials]);

    const has_content_guide_tab =
        guide_tab_content().length > 0 ||
        video_tab_content().length > 0 ||
        faq_tab_content().length > 0;

    const tutorial_tabs: TTutorialsTabItem[] = [
        {
            label: localize('Guide'),
            content: (
                <GuideContent
                    is_dialog_open={is_dialog_open}
                    guide_tab_content={guide_tab_content()}
                    video_tab_content={video_tab_content()}
                />
            ),
        },
        {
            label: localize('FAQ'),
            content: <FAQContent faq_list={faq_tab_content()} handleTabChange={handleTabChange} />,
        },
        {
            label: localize('Search'),
            content: has_content_guide_tab ? (
                <>
                    <GuideContent
                        is_dialog_open={is_dialog_open}
                        guide_tab_content={guide_tab_content()}
                        video_tab_content={video_tab_content()}
                    />
                    <FAQContent faq_list={faq_tab_content()} />
                </>
            ) : (
                <NoSearchResult />
            ),
        },
    ];

    return isDesktop ? (
        <TutorialsTabDesktop tutorial_tabs={tutorial_tabs} prev_active_tutorials={prev_active_tutorials} />
    ) : (
        <TutorialsTabMobile tutorial_tabs={tutorial_tabs} prev_active_tutorials={prev_active_tutorials} />
    );
});

export default TutorialsTab;
