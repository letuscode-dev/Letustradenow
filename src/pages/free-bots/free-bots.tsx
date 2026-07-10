// @ts-nocheck -- bridges typed React with vendored Blockly/runtime APIs.
import React from 'react';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { FREE_BOTS } from './catalog';
import type { FreeBot, FreeBotAction } from './types';
import './free-bots.scss';

const FreeBots = () => {
    const { dashboard, quick_strategy, run_panel } = useStore();
    const [status_by_id, setStatusById] = React.useState<Record<string, string>>({});
    const [busy_id, setBusyId] = React.useState<string | null>(null);

    const setStatus = (bot_id: string, message: string) => {
        setStatusById(prev => ({ ...prev, [bot_id]: message }));
    };

    const launchBot = async (bot: FreeBot, action: FreeBotAction) => {
        if (action === 'RUN' && run_panel.is_running) {
            setStatus(bot.id, localize('Stop the running bot before starting another free bot.'));
            return;
        }

        try {
            setBusyId(bot.id);
            setStatus(
                bot.id,
                action === 'RUN' ? localize('Preparing free bot...') : localize('Loading free bot...')
            );

            quick_strategy.setSelectedStrategy(bot.strategy);
            await quick_strategy.onSubmit({
                ...bot.form,
                action,
            });

            if (action === 'LOAD') {
                dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            }

            setStatus(
                bot.id,
                action === 'RUN'
                    ? localize('{{title}} is running.', { title: bot.title })
                    : localize('{{title}} loaded in Bot Builder.', { title: bot.title })
            );
        } catch (error) {
            const message =
                error?.message || error?.error?.message || localize('Could not prepare this free bot.');
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
                    <Localize i18n_default_text='Ready-made bots from the team. Run one now, or load it into Bot Builder to customize.' />
                </p>
            </header>

            {FREE_BOTS.length === 0 ? (
                <div className='free-bots__empty'>
                    <p>
                        <Localize i18n_default_text='No free bots yet. New ideas will show up here as soon as they are published.' />
                    </p>
                </div>
            ) : (
                <ul className='free-bots__list'>
                    {FREE_BOTS.map(bot => {
                        const is_busy = busy_id === bot.id;
                        const status = status_by_id[bot.id];

                        return (
                            <li key={bot.id} className='free-bots__item'>
                                <div className='free-bots__item-body'>
                                    <h3 className='free-bots__item-title'>{bot.title}</h3>
                                    <p className='free-bots__item-description'>{bot.description}</p>
                                    {!!bot.tags?.length && (
                                        <div className='free-bots__tags'>
                                            {bot.tags.map(tag => (
                                                <span key={tag} className='free-bots__tag'>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {status && <div className='free-bots__status'>{status}</div>}
                                </div>
                                <div className='free-bots__actions'>
                                    <Button
                                        className='free-bots__button'
                                        is_disabled={is_busy || run_panel.is_running}
                                        onClick={() => launchBot(bot, 'RUN')}
                                        primary
                                        type='button'
                                    >
                                        {localize('Run')}
                                    </Button>
                                    <Button
                                        className='free-bots__button'
                                        is_disabled={is_busy}
                                        onClick={() => launchBot(bot, 'LOAD')}
                                        secondary
                                        type='button'
                                    >
                                        {localize('Load in Bot Builder')}
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
