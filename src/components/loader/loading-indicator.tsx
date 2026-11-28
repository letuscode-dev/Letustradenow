import './loading-indicator.scss';

const LoadingIndicator = ({ message, fullPage = false, showSpinner = true }: { message: string; fullPage?: boolean; showSpinner?: boolean }) => (
    <div className={`app-loading-indicator${fullPage ? ' app-loading-indicator--page' : ''}`} role='status' aria-live='polite'>
        {showSpinner && <span className='app-loading-indicator__spinner' aria-hidden='true' />}
        <span>{message}</span>
    </div>
);

export default LoadingIndicator;
