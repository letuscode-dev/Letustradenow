import { config } from '../constants/config';

const PURCHASE_SUBSTITUTE_BLOCK_TYPES = ['purchase', 'override_contract_type_purchase'];

const isPurchaseSubstituteBlock = block => PURCHASE_SUBSTITUTE_BLOCK_TYPES.includes(block?.type);

const isInPurchaseConditions = block => {
    if (block?.type === 'before_purchase' || block?.isDescendantOf?.('before_purchase')) {
        return true;
    }

    let parent_block = block?.getParent?.();
    while (parent_block) {
        if (parent_block.type === 'before_purchase') {
            return true;
        }
        parent_block = parent_block.getParent?.();
    }

    return false;
};

const hasRequiredBlock = (blocks, required_block_type) => {
    if (required_block_type === 'purchase') {
        return blocks.some(block => isPurchaseSubstituteBlock(block) && isInPurchaseConditions(block));
    }

    return blocks.some(block => block.type === required_block_type);
};

export const hasAllRequiredBlocks = () => {
    const blocks_in_workspace = window.Blockly.derivWorkspace.getAllBlocks();
    const { mandatoryMainBlocks } = config();
    const required_block_types = ['trade_definition_tradeoptions', ...mandatoryMainBlocks];
    const has_all_required_blocks = required_block_types.every(required_block_type =>
        hasRequiredBlock(blocks_in_workspace, required_block_type)
    );

    return has_all_required_blocks;
};

export const onWorkspaceResize = () => {
    const workspace = window.Blockly.derivWorkspace;
    if (workspace) {
        // kept this commented to fix slow rendering issue
        //workspace.getAllFields().forEach(field => field.forceRerender());

        const el_scratch_div = document.getElementById('scratch_div');
        if (el_scratch_div) {
            window.Blockly.svgResize(workspace);
        }
    }
};

export const removeLimitedBlocks = (workspace, block_types) => {
    const types = Array.isArray(block_types) ? block_types : [block_types];

    types.forEach(block_type => {
        if (config().single_instance_blocks.includes(block_type)) {
            workspace.getAllBlocks().forEach(ws_block => {
                if (ws_block.type === block_type) {
                    ws_block.dispose();
                }
            });
        }
    });
};

export const isDbotRTL = () => {
    const htmlElement = document.documentElement;
    const dirValue = htmlElement.getAttribute('dir');
    return dirValue === 'rtl';
};
