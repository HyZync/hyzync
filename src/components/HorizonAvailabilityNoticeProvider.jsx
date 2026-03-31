import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const HorizonAvailabilityNoticeContext = createContext(null);

export const HorizonAvailabilityNoticeProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const openHorizonAvailabilityNotice = () => {
        setIsOpen(true);
    };

    const closeHorizonAvailabilityNotice = () => {
        setIsOpen(false);
    };

    return (
        <HorizonAvailabilityNoticeContext.Provider value={{ openHorizonAvailabilityNotice }}>
            {children}

            {isOpen && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center px-4 py-6">
                    <button
                        type="button"
                        aria-label="Close notice overlay"
                        className="absolute inset-0 bg-slate-950/38 backdrop-blur-[6px]"
                        onClick={closeHorizonAvailabilityNotice}
                    />

                    <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_36px_120px_-56px_rgba(15,23,42,0.42)] ring-1 ring-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-5 py-3">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            </div>

                            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                Horizon FI
                            </div>

                            <button
                                type="button"
                                onClick={closeHorizonAvailabilityNotice}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-700"
                                aria-label="Close notice"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className="px-6 py-7 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                                <Sparkles size={18} />
                            </div>

                            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
                                Notice
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-950">
                                Horizon FI will be available soon.
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                Thanks for visiting.
                            </p>

                            <button
                                type="button"
                                onClick={closeHorizonAvailabilityNotice}
                                className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
