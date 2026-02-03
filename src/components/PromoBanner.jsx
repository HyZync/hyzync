import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PromoBanner = () => {
    const [isVisible, setIsVisible] = useState(true);
    const navigate = useNavigate();

    const handleClaimOffer = (e) => {
        e.preventDefault();

        // 1. Update URL with code
        navigate('/?code=YOU40#contact', { replace: true });

        // 2. Define robust scroll logic
        const scrollToContact = () => {
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                const navHeight = 80; // Approximate navbar height
                const targetPosition = contactSection.getBoundingClientRect().top + window.scrollY - navHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        };

        // Try immediately
        scrollToContact();

        // Retry logic for dynamic layouts
        setTimeout(scrollToContact, 100);
        setTimeout(scrollToContact, 300);
        setTimeout(scrollToContact, 600);
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-gradient-to-r from-brand-purple via-brand-magenta to-brand-purple text-white relative z-[60]"
            >
                <div className="max-w-screen-2xl mx-auto px-4 py-2 sm:py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm font-medium text-center">
                        <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-white border border-white/20 shadow-sm animate-pulse">
                            <Sparkles size={12} className="text-yellow-300 fill-yellow-300" />
                            <span className="font-bold">40% OFF</span>
                        </span>

                        <span>
                            <span className="opacity-90">Quick Feedback & Retention Insight for Subscription-Based Apps.</span>
                            <span className="hidden sm:inline mx-2 text-white/40">|</span>
                            <span className="opacity-75">Offer ends March 31st, 2026</span>
                        </span>

                        <button
                            onClick={handleClaimOffer}
                            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white/80 transition-colors ml-2 font-bold whitespace-nowrap cursor-pointer"
                        >
                            Claim Offer <ArrowRight size={14} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-white/60 hover:text-white transition-colors p-1"
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
