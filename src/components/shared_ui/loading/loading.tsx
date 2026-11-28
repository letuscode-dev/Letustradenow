import React from 'react';
import classNames from 'classnames';
import { localize } from '@deriv-com/translations';
import Text from '../text/text';

export type TLoadingProps = React.HTMLProps<HTMLDivElement> & {
    is_fullscreen: boolean;
    is_slow_loading: boolean;
    status: string[];
    theme: string;
};

const Loading = ({ className, id, is_fullscreen = true, is_slow_loading, status, theme }: Partial<TLoadingProps>) => {
    return (
        <div
            data-testid='dt_initial_loader'
            className={classNames(
                'initial-loader',
                {
                    'initial-loader--fullscreen': is_fullscreen,
                },
                className
            )}
        >
            <div id={id} className={classNames('initial-loader__spinner', { 'initial-loader__spinner--dark': theme === 'dark' })} role='status' aria-label={localize('Loading')} />
            {is_slow_loading &&
                status?.map((text, inx) => (
                    <Text as='h3' color='prominent' size='xs' align='center' key={inx}>
                        {text}
                    </Text>
                ))}
        </div>
    );
};

export default Loading;
