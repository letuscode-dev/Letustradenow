import LoadingIndicator from './loading-indicator';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <LoadingIndicator message={message} fullPage />
    );
}
