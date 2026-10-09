// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import { observer } from 'mobx-react-lite';
import Dialog from '@/components/shared_ui/dialog';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
/* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
/* [/AI] */
import DigitPanel from '../digit-panel/digit-panel';
import ToolbarButton from './toolbar-button';
import WorkspaceGroup from './workspace-group';

const Toolbar = observer(() => {
    const { run_panel, toolbar, quick_strategy } = useStore();
    const { isDesktop } = useDevice();
    const [is_digit_open, setDigitOpen] = React.useState(false);
    const toggleDigit = () => setDigitOpen(open => !open);
    const digit_popover_ref = React.useRef(null);
    const digit_drag = React.useRef(null);
    const startDigitDrag = event => {
        const target = event.target;
        if (!target?.closest?.('.digit-panel__header')) return;
        if (target.closest('button, select, option')) return;
        event.preventDefault();
        const node = digit_popover_ref.current;
        if (!node) return;
        node.setPointerCapture?.(event.pointerId);
        digit_drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: node.dataset.dragX ? Number(node.dataset.dragX) : 0,
            top: node.dataset.dragY ? Number(node.dataset.dragY) : 0,
        };
    };
    const moveDigitDrag = event => {
        const drag = digit_drag.current;
        const node = digit_popover_ref.current;
        if (!drag || !node) return;
        const x = drag.left + event.clientX - drag.x;
        const y = drag.top + event.clientY - drag.y;
        node.dataset.dragX = String(x);
        node.dataset.dragY = String(y);
        node.style.transform = `translate(${x}px, ${y}px)`;
    };
    const endDigitDrag = () => {
        digit_drag.current = null;
    };
    const { is_dialog_open, closeResetDialog, onResetOkButtonClick: onOkButtonClick } = toolbar;
    const { is_running } = run_panel;
    const { setFormVisibility } = quick_strategy;
    const confirm_button_text = is_running ? localize('Yes') : localize('OK');
    const cancel_button_text = is_running ? localize('No') : localize('Cancel');
    const handleQuickStrategyOpen = () => {
        setFormVisibility(true);
        /* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
        /* [/AI] */
    };
    return (
        <React.Fragment>
            <div className='toolbar dashboard__toolbar' data-testid='dt_dashboard_toolbar'>
                <div className='toolbar__section'>
                    {!isDesktop && (
                        <ToolbarButton
                            popover_message={localize('Click here to start building your Deriv Bot.')}
                            button_id='db-toolbar__get-started-button'
                            button_classname='toolbar__btn toolbar__btn--icon toolbar__btn--start'
                            buttonOnClick={handleQuickStrategyOpen}
                            button_text={localize('Quick strategy')}
                            is_bot_running={is_running}
                        />
                    )}
                    {isDesktop && <WorkspaceGroup is_digit_open={is_digit_open} onToggleDigit={toggleDigit} />}
                </div>
            </div>
            {!isDesktop && <WorkspaceGroup is_digit_open={is_digit_open} onToggleDigit={toggleDigit} />}
            {is_digit_open && (
                <div
                    className='digit-panel-popover'
                    ref={digit_popover_ref}
                    onPointerDown={startDigitDrag}
                    onPointerMove={moveDigitDrag}
                    onPointerUp={endDigitDrag}
                    onPointerCancel={endDigitDrag}
                >
                    <DigitPanel onClose={() => setDigitOpen(false)} />
                </div>
            )}
            <Dialog
                portal_element_id='modal_root'
                title={localize('Are you sure?')}
                is_visible={is_dialog_open}
                confirm_button_text={confirm_button_text}
                onConfirm={onOkButtonClick}
                cancel_button_text={cancel_button_text}
                onCancel={closeResetDialog}
                is_mobile_full_width={false}
                className={'toolbar__dialog'}
                has_close_icon
            >
                {is_running ? (
                    <Localize
                        i18n_default_text='The workspace will be reset to the default strategy and any unsaved changes will be lost. <0>Note: This will not affect your running bot.</0>'
                        components={[
                            <div
                                key={0}
                                className='toolbar__dialog-text--second'
                                data-testid='dt_toolbar_dialog_text_second'
                            />,
                        ]}
                    />
                ) : (
                    <Localize i18n_default_text='Any unsaved changes will be lost.' />
                )}
            </Dialog>
        </React.Fragment>
    );
});

export default Toolbar;
