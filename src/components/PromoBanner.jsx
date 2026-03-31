import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PromoBanner = () => {
    const [isVisible, setIsVisible] = useState(true);
    const navigate = useNavigate();

    const handleClaimOffer = (e) => {
        e.preventDefault();
        // Just navigate with hash, the AdvancedScrollManager will take care of the rest
        navigate('/?code=HZNQ1#contact');
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="relative z-[60] border-b border-black/5 bg-[linear-gradient(90deg,#0ea5b8_0%,#18b5a5_48%,#46bff0_100%)] text-slate-950"
            >
                <div className="mx-auto flex max-w-[1660px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center sm:flex-row sm:justify-start sm:text-left">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-slate-950/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur">
                            <Sparkles size={12} className="text-white" />
                            New
                        </span>

                        <span className="text-xs font-medium leading-relaxed text-slate-950 sm:text-sm">
                            <span className="font-semibold">Horizon</span> unifies reviews, tickets, surveys, and CRM signals into one feedback intelligence workflow.
                            <span className="hidden sm:inline mx-3 text-black/25">|</span>
                            <span className="opacity-80">Priority onboarding available</span>
                        </span>

                        <button
                            onClick={handleClaimOffer}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 sm:ml-2 sm:text-sm"
                        >
                            Apply Now <ArrowRight size={14} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/12 text-slate-900/70 transition-colors hover:bg-white/20 hover:text-slate-950"
                        aria-label="Close banner"
                    >
                        <X size={16} />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PromoBanner;
