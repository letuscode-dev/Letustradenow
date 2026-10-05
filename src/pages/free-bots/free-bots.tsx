// @ts-nocheck -- bridges typed React with vendored Blockly/runtime APIs.
import React from 'react';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import { load, save_types } from '@/external/bot-skeleton';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { FREE_BOTS } from './catalog';
import type { FreeBot } from './types';
import './free-bots.scss';

/** Keep trade parameters visible; leave purchase/risk/scan stacks collapsed. */
const VISIBLE_MAIN_TYPES = new Set(['trade_definition']);
const FORCE_COLLAPSED_TYPES = new Set(['before_purchase', 'after_purchase', 'during_purchase']);

const applyFreeBotCollapseState = workspace => {
    if (!workspace?.getAllBlocks) return;
    workspace.getAllBlocks(false).forEach(block => {
        if (!block || typeof block.setCollapsed !== 'function') return;

        if (VISIBLE_MAIN_TYPES.has(block.type)) {
            if (block.isCollapsed?.()) block.setCollapsed(false);
            return;
        }

        if (FORCE_COLLAPSED_TYPES.has(block.type)) {
            if (!block.isCollapsed?.()) block.setCollapsed(true);
            return;
        }

        const block_id = String(block.id || '');
        if (
            block_id.includes('_advanced_init') ||
            block_id.includes('_scan_loop') ||
            block.type === 'controls_whileUntil'
        ) {
            if (!block.isCollapsed?.()) block.setCollapsed(true);
        }
    });
    if (typeof workspace.render === 'function') {
        workspace.render();
    }
};

const FreeBots = () => {
    const { dashboard, run_panel } = useStore();
    const [status_by_id, setStatusById] = React.useState<Record<string, string>>({});
    const [busy_id, setBusyId] = React.useState<string | null>(null);

    const setStatus = (bot_id: string, message: string) => {
        setStatusById(prev => ({ ...prev, [bot_id]: message }));
    };

    const loadBot = async (bot: FreeBot) => {
        try {
            setBusyId(bot.id);
            setStatus(bot.id, localize('Loading bot into Bot Builder...'));

            await load({
                block_string: bot.xml,
                file_name: bot.title,
                workspace: window.Blockly?.derivWorkspace,
                from: save_types.UNSAVED,
                drop_event: null,
                strategy_id: null,
                showIncompatibleStrategyDialog: null,
            });

            const workspace = window.Blockly?.derivWorkspace;
            applyFreeBotCollapseState(workspace);
            window.setTimeout(() => applyFreeBotCollapseState(workspace), 0);
            window.setTimeout(() => applyFreeBotCollapseState(workspace), 50);

            dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            setStatus(bot.id, localize('{{title}} loaded in Bot Builder.', { title: bot.title }));
        } catch (error) {
            const message =
                error?.message || error?.error?.message || localize('Could not load this free bot.');
            setStatus(bot.id, message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className='free-bots'>
            <header className='free-bots__header'>
                <h2 className='free-bots__title'>
                    <Localize i18n_default_text='Free Bots' />
                </h2>
                <p className='free-bots__subtitle'>
                    <Localize i18n_default_text='Choose a strategy, load it into Bot Builder, then configure and run.' />
                </p>
            </header>

            {FREE_BOTS.length === 0 ? (
                <div className='free-bots__empty'>
                    <p>
                        <Localize i18n_default_text='No free bots yet. New ideas will show up here as soon as they are published.' />
                    </p>
                </div>
            ) : (
                <ul className='free-bots__grid'>
                    {FREE_BOTS.map((bot, index) => {
                        const is_busy = busy_id === bot.id;
                        const status = status_by_id[bot.id];
                        const bot_number = index + 1;

                        return (
                            <li key={bot.id} className='free-bots__card'>
                                <div className='free-bots__card-top'>
                                    <span
                                        className='free-bots__badge'
                                        aria-label={localize('Bot {{number}}', { number: bot_number })}
                                    >
                                        {bot_number}
                                    </span>
                                    <h3 className='free-bots__card-title'>{bot.title}</h3>
                                </div>

                                <p className='free-bots__card-desc'>{bot.description}</p>

                                {!!bot.tags?.length && (
                                    <ul className='free-bots__tags' aria-label={localize('Tags')}>
                                        {bot.tags.map(tag => (
                                            <li key={tag} className='free-bots__tag'>
                                                {tag}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className='free-bots__card-footer'>
                                    {status && <p className='free-bots__status'>{status}</p>}
                                    <Button
                                        className='free-bots__button'
                                        is_disabled={is_busy || run_panel.is_running}
                                        onClick={() => loadBot(bot)}
                                        primary
                                        type='button'
                                    >
                                        {is_busy
                                            ? localize('Loading...')
                                            : localize('Load into Bot Builder')}
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default observer(FreeBots);
