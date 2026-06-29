export const addDynamicBlockToDOM = (
    name_block: string,
    strategy_value: string,
    trade_type_cat: string,
    strategy_dom: HTMLElement
) => {
    if (trade_type_cat === 'digits' || trade_type_cat === 'highlowticks') {
        const block = document.createElement('value');
        block.setAttribute('name', name_block);
        block.setAttribute('strategy_value', strategy_value);

        const shadow_block = document.createElement('shadow');
        shadow_block.setAttribute('type', 'math_number_positive');
        shadow_block.setAttribute('id', 'p0O]7-M{ZORlORxGuIEb');

        const field_block = document.createElement('field');
        field_block.setAttribute('name', 'NUM');
        field_block.textContent = '0';

        shadow_block.appendChild(field_block);
        block.appendChild(shadow_block);

        const amount_block = strategy_dom.querySelector('value[name="AMOUNT"]');
        if (amount_block) {
            const parent_node = amount_block.parentNode;
            if (parent_node) {
                parent_node.insertBefore(block, amount_block.nextSibling);
            }
        }
    }
    if (name_block === 'PREDICTION' && strategy_dom) {
        const mutation_element = strategy_dom.querySelector('block[type="trade_definition_tradeoptions"] > mutation');
        if (mutation_element) {
            mutation_element.setAttribute('has_prediction', 'true');
        }
    }
};

const BARRIER_INPUTS_BY_TRADE_TYPE: Record<
    string,
    Array<{
        field_name: string;
        input_name: string;
        strategy_value: string;
        type_value: string;
        value: string;
    }>
> = {
    higherlower: [
        {
            field_name: 'BARRIEROFFSETTYPE_LIST',
            input_name: 'BARRIEROFFSET',
            strategy_value: 'barrieroffset',
            type_value: '+',
            value: '1',
        },
    ],
    touchnotouch: [
        {
            field_name: 'BARRIEROFFSETTYPE_LIST',
            input_name: 'BARRIEROFFSET',
            strategy_value: 'barrieroffset',
            type_value: '+',
            value: '1',
        },
    ],
    endsinout: [
        {
            field_name: 'BARRIEROFFSETTYPE_LIST',
            input_name: 'BARRIEROFFSET',
            strategy_value: 'barrieroffset',
            type_value: '+',
            value: '1',
        },
        {
            field_name: 'SECONDBARRIEROFFSETTYPE_LIST',
            input_name: 'SECONDBARRIEROFFSET',
            strategy_value: 'secondbarrieroffset',
            type_value: '-',
            value: '1',
        },
    ],
    staysinout: [
        {
            field_name: 'BARRIEROFFSETTYPE_LIST',
            input_name: 'BARRIEROFFSET',
            strategy_value: 'barrieroffset',
            type_value: '+',
            value: '1',
        },
        {
            field_name: 'SECONDBARRIEROFFSETTYPE_LIST',
            input_name: 'SECONDBARRIEROFFSET',
            strategy_value: 'secondbarrieroffset',
            type_value: '-',
            value: '1',
        },
    ],
};

const createBarrierValue = ({ input_name, strategy_value, value }: { input_name: string; strategy_value: string; value: string }) => {
    const block = document.createElement('value');
    block.setAttribute('name', input_name);
    block.setAttribute('strategy_value', strategy_value);

    const shadow_block = document.createElement('shadow');
    shadow_block.setAttribute('type', 'math_number_positive');

    const field_block = document.createElement('field');
    field_block.setAttribute('name', 'NUM');
    field_block.textContent = value;

    shadow_block.appendChild(field_block);
    block.appendChild(shadow_block);

    return block;
};

export const addBarrierBlocksToDOM = (trade_type: string, strategy_dom: HTMLElement) => {
    const barrier_inputs = BARRIER_INPUTS_BY_TRADE_TYPE[trade_type];
    if (!barrier_inputs?.length || !strategy_dom) return;

    const trade_options_block = strategy_dom.querySelector('block[type="trade_definition_tradeoptions"]');
    const mutation_element = trade_options_block?.querySelector('mutation');

    if (!trade_options_block || !mutation_element) return;

    mutation_element.setAttribute('has_first_barrier', 'true');
    mutation_element.setAttribute('has_second_barrier', barrier_inputs.length > 1 ? 'true' : 'false');

    barrier_inputs.forEach(input => {
        const type_field = document.createElement('field');
        type_field.setAttribute('name', input.field_name);
        type_field.textContent = input.type_value;

        trade_options_block.insertBefore(type_field, trade_options_block.querySelector('value[name="DURATION"]'));
        trade_options_block.appendChild(createBarrierValue(input));
    });
};
