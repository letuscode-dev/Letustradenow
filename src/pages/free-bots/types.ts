import type { TFormData } from '@/pages/bot-builder/quick-strategy/types';

export type FreeBotAction = 'RUN' | 'LOAD';

/**
 * A free bot entry. Developers add new ideas here (or via catalog.ts).
 * `form` is the quick-strategy payload used by Run / Load in Bot Builder.
 */
export type FreeBot = {
    id: string;
    title: string;
    description: string;
    tags?: string[];
    /** Quick-strategy key, e.g. MARTINGALE, D_ALEMBERT */
    strategy: string;
    /** Prefill values passed to quick_strategy.onSubmit (without `action`) */
    form: Omit<TFormData, 'action'>;
};
