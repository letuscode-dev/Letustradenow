import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import {
    LabelPairedArrowRotateLeftMdRegularIcon,
    LabelPairedArrowRotateRightMdRegularIcon,
    LabelPairedArrowsRotateMdRegularIcon,
    LabelPairedChartLineMdRegularIcon,
    LabelPairedChartTradingviewMdRegularIcon,
    LabelPairedFloppyDiskMdRegularIcon,
    LabelPairedFolderOpenMdRegularIcon,
    LabelPairedMagnifyingGlassMinusMdRegularIcon,
    LabelPairedMagnifyingGlassPlusMdRegularIcon,
    LabelPairedObjectsAlignLeftMdRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
/* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
/* [/AI] */
import ToolbarIcon from './toolbar-icon';

type WorkspaceGroupProps = {
    is_digit_open: boolean;
    onToggleDigit: () => void;
};

const WorkspaceGroup = observer(({ is_digit_open, onToggleDigit }: WorkspaceGroupProps) => {
    const { dashboard, toolbar, load_modal, save_modal } = useStore();
    const { setPreviewOnPopup, setChartModalVisibility, setTradingViewModalVisibility } = dashboard;
    const { has_redo_stack, has_undo_stack, onResetClick, onSortClick, onUndoClick, onZoomInOutClick } = toolbar;
    const { toggleSaveModal } = save_modal;
    const { toggleLoadModal } = load_modal;
    const { isDesktop } = useDevice();

    return (
        <div className='toolbar__wrapper'>
            <div className='toolbar__group toolbar__group-btn' data-testid='dt_toolbar_group_btn'>
                <ToolbarIcon
                    popover_message={localize('Reset')}
                    icon={
                        <span
                            id='db-toolbar__reset-button'
                            className='toolbar__icon'
                            onClick={onResetClick}
                            data-testid='dt_toolbar_reset_button'
                        >
                            <LabelPairedArrowsRotateMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Import')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__import-button'
                            data-testid='dt_toolbar_import_button'
                            onClick={() => {
                                setPreviewOnPopup(true);
                                toggleLoadModal();
                                /* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
                                /* [/AI] */
                            }}
                        >
                            <LabelPairedFolderOpenMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Save')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__save-button'
                            data-testid='dt_toolbar_save_button'
                            onClick={toggleSaveModal}
                        >
                            <LabelPairedFloppyDiskMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Digit distribution')}
                    icon={
                        <span
                            className={classNames('toolbar__icon', {
                                'toolbar__icon--active': is_digit_open,
                            })}
                            id='db-toolbar__digits-button'
                            data-testid='dt_toolbar_digits_button'
                            onClick={onToggleDigit}
                        >
                            <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true'>
                                {[0, 1, 2].map(row =>
                                    [0, 1, 2].map(column => (
                                        <circle key={`${row}-${column}`} cx={2.5 + column * 5.5} cy={2.5 + row * 5.5} r='1.35' />
                                    ))
                                )}
                            </svg>
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Sort blocks')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__sort-button'
                            data-testid='dt_toolbar_sort_button'
                            onClick={onSortClick}
                        >
                            <LabelPairedObjectsAlignLeftMdRegularIcon />
                        </span>
                    }
                />
                {isDesktop && (
                    <>
                        <div className='vertical-divider' />
                        <ToolbarIcon
                            popover_message={localize('Charts')}
                            icon={
                                <span
                                    className='toolbar__icon'
                                    id='db-toolbar__charts-button'
                                    onClick={() => setChartModalVisibility()}
                                >
                                    <LabelPairedChartLineMdRegularIcon />
                                </span>
                            }
                        />
                        <ToolbarIcon
                            popover_message={localize('TradingView Chart')}
                            icon={
                                <span
                                    className='toolbar__icon'
                                    id='db-toolbar__tradingview-button'
                                    onClick={() => setTradingViewModalVisibility()}
                                >
                                    <LabelPairedChartTradingviewMdRegularIcon />
                                </span>
                            }
                        />
                    </>
                )}
                <div className='vertical-divider' />
                <ToolbarIcon
                    popover_message={localize('Undo')}
                    icon={
                        <span
                            className={classNames('toolbar__icon undo', {
                                'toolbar__icon--disabled': !has_undo_stack,
                            })}
                            id='db-toolbar__undo-button'
                            data-testid='dt_toolbar_undo_button'
                            onClick={() => onUndoClick(/* redo */ false)}
                        >
                            <LabelPairedArrowRotateLeftMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Redo')}
                    icon={
                        <span
                            className={classNames('toolbar__icon redo', {
                                'toolbar__icon--disabled': !has_redo_stack,
                            })}
                            id='db-toolbar__redo-button'
                            data-testid='dt_toolbar_redo_button'
                            onClick={() => onUndoClick(/* redo */ true)}
                        >
                            <LabelPairedArrowRotateRightMdRegularIcon />
                        </span>
                    }
                />
                <div className='vertical-divider' />
                <ToolbarIcon
                    popover_message={localize('Zoom in')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__zoom-in-button'
                            data-testid='dt_toolbar_zoom_in_button'
                            onClick={() => onZoomInOutClick(/* in */ true)}
                        >
                            <LabelPairedMagnifyingGlassPlusMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Zoom out')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__zoom-out'
                            data-testid='dt_toolbar_zoom_out_button'
                            onClick={() => onZoomInOutClick(/* in */ false)}
                        >
                            <LabelPairedMagnifyingGlassMinusMdRegularIcon />
                        </span>
                    }
                />
            </div>
        </div>
    );
});

export default WorkspaceGroup;
