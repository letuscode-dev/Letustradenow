export const isRateLimitError = error => {
    const code = String(error?.error?.code ?? error?.code ?? '').toLowerCase();
    const message = String(error?.error?.message ?? error?.message ?? '').toLowerCase();
    return code === 'ratelimit' || code === 'toomanyrequests' || code === '429' || /rate.?limit|too many requests/.test(message);
};
