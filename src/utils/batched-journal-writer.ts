/** Coalesce journal persistence without delaying the in-memory journal or trading. */
export const createBatchedJournalWriter = <T>(
    read: () => Record<string, T[]>,
    write: (journals: Record<string, T[]>) => void,
    delay = 5000
) => {
    const pending = new Map<string, T[]>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        if (!pending.size) return;
        const journals = read();
        pending.forEach((messages, account) => { journals[account] = messages; });
        write(journals);
        pending.clear();
    };

    const schedule = (account: string | undefined, messages: T[]) => {
        if (!account) return;
        pending.set(account, messages);
        if (timer === null) timer = setTimeout(flush, delay);
    };

    return { schedule, flush };
};
