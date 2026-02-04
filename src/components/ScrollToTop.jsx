import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

const ScrollToTop = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.pageYOffset > 500) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 z-[100] w-12 h-12 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white shadow-2xl hover:bg-brand-purple/20 hover:border-brand-purple/40 hover:scale-110 active:scale-95 transition-all group"
                    aria-label="Scroll to top"
                >
                    <ArrowUp size={20} className="group-hover:-translate-y-1 transition-transform" />

                    {/* Ring glow */}
                    <div className="absolute inset-0 rounded-full border border-brand-purple/0 group-hover:border-brand-purple/20 animate-pulse"></div>
                </motion.button>
            )}
        </AnimatePresence>
    );
};

export default ScrollToTop;
