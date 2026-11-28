import './loading-indicator.scss';

const LoadingIndicator = ({ message, fullPage = false }: { message: string; fullPage?: boolean }) => (
    <div className={`app-loading-indicator${fullPage ? ' app-loading-indicator--page' : ''}`} role='status' aria-live='polite'>
        <span className='app-loading-indicator__spinner' aria-hidden='true' />
        <span>{message}</span>
    </div>
);

export default LoadingIndicator;
