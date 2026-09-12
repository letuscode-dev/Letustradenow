// @ts-nocheck -- bridges typed React with vendored Blockly/runtime APIs.
import React from 'react';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import { load, save_types } from '@/external/bot-skeleton';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { FREE_BOTS } from './catalog';
import type { FreeBot, FreeBotSymbolOption } from './types';
import './free-bots.scss';

const defaultSelectedSymbols = (options: FreeBotSymbolOption[] = []) =>
    options.filter(option => option.defaultSelected).map(option => option.symbol);

const FreeBots = () => {
    const { dashboard, run_panel } = useStore();
    const [status_by_id, setStatusById] = React.useState<Record<string, string>>({});
    const [busy_id, setBusyId] = React.useState<string | null>(null);
    const [selected_symbols_by_bot, setSelectedSymbolsByBot] = React.useState<Record<string, string[]>>(() => {
        const initial = {};
        FREE_BOTS.forEach(bot => {
            if (bot.symbol_options?.length) {
                initial[bot.id] = defaultSelectedSymbols(bot.symbol_options);
            }
        });
        return initial;
    });

    const setStatus = (bot_id: string, message: string) => {
        setStatusById(prev => ({ ...prev, [bot_id]: message }));
    };

    const toggleSymbol = (bot_id: string, symbol: string) => {
        setSelectedSymbolsByBot(prev => {
            const current = prev[bot_id] || [];
            const next = current.includes(symbol)
                ? current.filter(item => item !== symbol)
                : [...current, symbol];
            return { ...prev, [bot_id]: next };
        });
    };

    const selectSymbolGroup = (bot: FreeBot, group: string, checked: boolean) => {
        if (!bot.symbol_options?.length) return;
        const group_symbols = bot.symbol_options
            .filter(option => (option.group || 'standard') === group)
            .map(option => option.symbol);
        setSelectedSymbolsByBot(prev => {
            const current = new Set(prev[bot.id] || []);
            group_symbols.forEach(symbol => {
                if (checked) current.add(symbol);
                else current.delete(symbol);
            });
            return { ...prev, [bot.id]: [...current] };
        });
    };

    const loadBot = async (bot: FreeBot) => {
        try {
            setBusyId(bot.id);
            setStatus(bot.id, localize('Loading bot into Bot Builder...'));

            const selected_symbols = selected_symbols_by_bot[bot.id] || [];
            if (bot.symbol_options?.length && selected_symbols.length === 0) {
                setStatus(bot.id, localize('Select at least one volatility before loading.'));
                return;
            }

            const block_string =
                typeof bot.buildXml === 'function' ? bot.buildXml(selected_symbols) : bot.xml;

            await load({
                block_string,
                file_name: bot.title,
                workspace: window.Blockly?.derivWorkspace,
                from: save_types.UNSAVED,
                drop_event: null,
                strategy_id: null,
                showIncompatibleStrategyDialog: null,
            });

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
                    <Localize i18n_default_text='Ready-made bots from the team. Load one into Bot Builder to inspect, customise, and run it.' />
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
                    {FREE_BOTS.map((bot, index) => {
                        const is_busy = busy_id === bot.id;
                        const status = status_by_id[bot.id];
                        const bot_number = index + 1;
                        const selected_symbols = selected_symbols_by_bot[bot.id] || [];
                        const has_symbol_options = !!bot.symbol_options?.length;
                        const standard_options =
                            bot.symbol_options?.filter(option => (option.group || 'standard') === 'standard') ||
                            [];
                        const one_s_options =
                            bot.symbol_options?.filter(option => option.group === '1s') || [];

                        return (
                            <li key={bot.id} className='free-bots__card'>
                                <div className='free-bots__card-body'>
                                    <div className='free-bots__card-heading'>
                                        <span
                                            className='free-bots__card-number'
                                            aria-label={localize('Bot {{number}}', { number: bot_number })}
                                        >
                                            {bot_number}
                                        </span>
                                        <h3 className='free-bots__card-title'>{bot.title}</h3>
                                    </div>
                                    <p className='free-bots__card-description'>{bot.description}</p>
                                    {!!bot.tags?.length && (
                                        <div className='free-bots__tags'>
                                            {bot.tags.map(tag => (
                                                <span key={tag} className='free-bots__tag'>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {has_symbol_options && (
                                        <div className='free-bots__symbols'>
                                            <div className='free-bots__symbols-title'>
                                                <Localize i18n_default_text='Volatilities to scan' />
                                            </div>
                                            {!!standard_options.length && (
                                                <fieldset className='free-bots__symbol-group'>
                                                    <legend className='free-bots__symbol-group-label'>
                                                        <Localize i18n_default_text='Standard' />
                                                    </legend>
                                                    <label className='free-bots__symbol-option free-bots__symbol-option--group'>
                                                        <input
                                                            type='checkbox'
                                                            checked={standard_options.every(option =>
                                                                selected_symbols.includes(option.symbol)
                                                            )}
                                                            onChange={event =>
                                                                selectSymbolGroup(
                                                                    bot,
                                                                    'standard',
                                                                    event.target.checked
                                                                )
                                                            }
                                                        />
                                                        <span>
                                                            <Localize i18n_default_text='All standard' />
                                                        </span>
                                                    </label>
                                                    {standard_options.map(option => (
                                                        <label
                                                            key={option.symbol}
                                                            className='free-bots__symbol-option'
                                                        >
                                                            <input
                                                                type='checkbox'
                                                                checked={selected_symbols.includes(
                                                                    option.symbol
                                                                )}
                                                                onChange={() =>
                                                                    toggleSymbol(bot.id, option.symbol)
                                                                }
                                                            />
                                                            <span>{option.label}</span>
                                                        </label>
                                                    ))}
                                                </fieldset>
                                            )}
                                            {!!one_s_options.length && (
                                                <fieldset className='free-bots__symbol-group'>
                                                    <legend className='free-bots__symbol-group-label'>
                                                        <Localize i18n_default_text='1-second' />
                                                    </legend>
                                                    <label className='free-bots__symbol-option free-bots__symbol-option--group'>
                                                        <input
                                                            type='checkbox'
                                                            checked={one_s_options.every(option =>
                                                                selected_symbols.includes(option.symbol)
                                                            )}
                                                            onChange={event =>
                                                                selectSymbolGroup(bot, '1s', event.target.checked)
                                                            }
                                                        />
                                                        <span>
                                                            <Localize i18n_default_text='All 1s' />
                                                        </span>
                                                    </label>
                                                    {one_s_options.map(option => (
                                                        <label
                                                            key={option.symbol}
                                                            className='free-bots__symbol-option'
                                                        >
                                                            <input
                                                                type='checkbox'
                                                                checked={selected_symbols.includes(
                                                                    option.symbol
                                                                )}
                                                                onChange={() =>
                                                                    toggleSymbol(bot.id, option.symbol)
                                                                }
                                                            />
                                                            <span>{option.label}</span>
                                                        </label>
                                                    ))}
                                                </fieldset>
                                            )}
                                        </div>
                                    )}

                                    {status && <div className='free-bots__status'>{status}</div>}
                                </div>
                                <div className='free-bots__actions'>
                                    <Button
                                        className='free-bots__button'
                                        is_disabled={
                                            is_busy ||
                                            run_panel.is_running ||
                                            (has_symbol_options && selected_symbols.length === 0)
                                        }
                                        onClick={() => loadBot(bot)}
                                        primary
                                        type='button'
                                    >
                                        {localize('Load into Bot Builder')}
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
