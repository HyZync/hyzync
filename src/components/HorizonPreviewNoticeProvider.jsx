import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

const HorizonPreviewNoticeContext = createContext(null);

const HORIZON_PREVIEW_DATE = '15/04/2026';

export const HorizonPreviewNoticeProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const previousOverflow = useRef('');

    const openHorizonPreviewNotice = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeHorizonPreviewNotice = useCallback(() => {
        setIsOpen(false);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        previousOverflow.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeHorizonPreviewNotice();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow.current;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeHorizonPreviewNotice, isOpen]);

    const contextValue = useMemo(
        () => ({
            openHorizonPreviewNotice
        }),
        [openHorizonPreviewNotice]
    );

    return (
        <HorizonPreviewNoticeContext.Provider value={contextValue}>
            {children}

            {isOpen && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
                    role="presentation"
                    onClick={closeHorizonPreviewNotice}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="horizon-preview-notice-title"
                        className="relative w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-7 text-slate-900 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.45)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={closeHorizonPreviewNotice}
                            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            aria-label="Close preview notice"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                            <CalendarDays size={24} />
                        </div>

                        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                            Horizon Preview
                        </p>
                        <h2 id="horizon-preview-notice-title" className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                            Preview available from {HORIZON_PREVIEW_DATE}
                        </h2>
                        <p className="mt-4 text-base leading-relaxed text-slate-600">
                            Thanks for your interest.
                        </p>

                        <button
                            type="button"
                            onClick={closeHorizonPreviewNotice}
                            className="mt-8 inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                            Okay
                        </button>
                    </div>
                </div>
            )}
        </HorizonPreviewNoticeContext.Provider>
    );
};

export const useHorizonPreviewNotice = () => {
    const context = useContext(HorizonPreviewNoticeContext);

    if (!context) {
        throw new Error('useHorizonPreviewNotice must be used within HorizonPreviewNoticeProvider.');
    }

    return context;
};
