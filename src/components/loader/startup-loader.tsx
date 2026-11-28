import { useEffect, useState } from 'react';
import { localize } from '@deriv-com/translations';
import LoadingIndicator from './loading-indicator';
import './startup-loader.scss';

export const STARTUP_HELP_DELAY_MS = 15000;

const StartupLoader = ({ message, error, fullPage = true, onRetry = () => window.location.reload() }: {
    message: string;
    error?: string | null;
    fullPage?: boolean;
    onRetry?: () => void;
}) => {
    const [isSlow, setIsSlow] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsSlow(true), STARTUP_HELP_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);
    return (
        <div className={`startup-loader${fullPage ? ' startup-loader--page' : ''}`}>
            <LoadingIndicator message={error ? localize('Unable to finish loading.') : message} showSpinner={!error} />
            {(error || isSlow) && (
                <div className='startup-loader__help' role='alert'>
                    <p>{error || localize('This is taking longer than expected. Check your connection, then try again.')}</p>
                    <button className='startup-loader__retry' type='button' onClick={onRetry}>{localize('Try again')}</button>
                </div>
            )}
        </div>
    );
};

export default StartupLoader;
