import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, MapPin, X } from 'lucide-react';

const HorizonAvailabilityNoticeContext = createContext(null);

export const HorizonAvailabilityNoticeProvider = ({ children }) => {
    const [isNoticeOpen, setIsNoticeOpen] = useState(false);

    const openHorizonAvailabilityNotice = () => {
        setIsNoticeOpen(true);
    };

    const closeHorizonAvailabilityNotice = () => {
        setIsNoticeOpen(false);
    };

    useEffect(() => {
        if (!isNoticeOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsNoticeOpen(false);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isNoticeOpen]);

    const value = useMemo(
        () => ({
            openHorizonAvailabilityNotice,
            closeHorizonAvailabilityNotice,
            isHorizonLocked: true
        }),
        []
    );

    return (
        <HorizonAvailabilityNoticeContext.Provider value={value}>
            {children}
            <AnimatePresence>
                {isNoticeOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
                        onClick={closeHorizonAvailabilityNotice}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 18, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 14, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,248,255,0.96))] text-slate-900 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)]"
                            onClick={(event) => event.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="horizon-notice-title"
                        >
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />

                            <div className="relative flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.96))] px-5 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                </div>
                                <button
                                    type="button"
                                    onClick={closeHorizonAvailabilityNotice}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-900"
                                    aria-label="Close Horizon availability notice"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="relative px-6 py-7 sm:px-7 sm:py-8">
                                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                                    <Lock size={14} />
                                    Horizon Locked
                                </div>

                                <h2 id="horizon-notice-title" className="mt-5 text-3xl font-semibold leading-tight text-slate-950 sm:text-[34px]">
                                    Horizon FI will be available soon for your region.
                                </h2>

                                <p className="mt-4 text-base leading-relaxed text-slate-600">
                                    Thanks for visiting. We are expanding access carefully and will open Horizon FI in more regions soon.
                                </p>

                                <div className="mt-6 rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                                            <MapPin size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-950">Regional rollout in progress</p>
                                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                                We are enabling Horizon FI market by market to keep the experience stable and high quality.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-7 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={closeHorizonAvailabilityNotice}
                                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                                    >
                                        Got it
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeHorizonAvailabilityNotice}
                                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        Thanks for visiting
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </HorizonAvailabilityNoticeContext.Provider>
    );
};

export const useHorizonAvailabilityNotice = () => {
    const context = useContext(HorizonAvailabilityNoticeContext);

    if (!context) {
        throw new Error('useHorizonAvailabilityNotice must be used within HorizonAvailabilityNoticeProvider');
    }

    return context;
};
