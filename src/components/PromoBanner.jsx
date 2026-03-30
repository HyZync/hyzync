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
                className="bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500 text-slate-950 relative z-[60]"
            >
                <div className="max-w-screen-2xl mx-auto px-4 py-2 sm:py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm font-medium text-center">
                        <span className="flex items-center gap-1 bg-black/15 px-2 py-0.5 rounded text-white border border-black/20 shadow-sm">
                            <Sparkles size={12} className="text-white" />
                            <span className="font-bold">NEW</span>
                        </span>

                        <span>
                            <span className="opacity-90">Horizon is the unified feedback intelligence platform for teams handling reviews, tickets, surveys, and CRM signals.</span>
                            <span className="hidden sm:inline mx-2 text-black/30">|</span>
                            <span className="opacity-75">Request priority onboarding</span>
                        </span>

                        <button
                            onClick={handleClaimOffer}
                            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-black/60 transition-colors ml-2 font-bold whitespace-nowrap cursor-pointer"
                        >
                            Apply Now <ArrowRight size={14} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-black/60 hover:text-black transition-colors p-1"
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
