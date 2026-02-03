import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar } from 'lucide-react';

const YearProgress = () => {
    const [isVisible, setIsVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const [daysLeft, setDaysLeft] = useState(0);

    useEffect(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        const isLeap = (year) => new Date(year, 1, 29).getDate() === 29;
        const totalDays = isLeap(now.getFullYear()) ? 366 : 365;

        const percent = (dayOfYear / totalDays) * 100;
        setProgress(percent);
        setDaysLeft(totalDays - dayOfYear);
    }, []);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-black border-b border-white/10 text-secondary text-[10px] sm:text-xs relative z-[61]"
            >
                <div className="max-w-screen-2xl mx-auto px-4 py-1.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-6 flex-1 overflow-hidden">
                        {/* Progress Bar */}
                        <div className="flex items-center gap-2 min-w-[120px]">
                            <span className="font-mono text-brand-cyan">{new Date().getFullYear()}</span>
                            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-brand-cyan"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                />
                            </div>
                            <span className="text-white/60 hidden sm:inline">{progress.toFixed(1)}%</span>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-3 bg-white/10 hidden sm:block"></div>

                        {/* Message */}
                        <p className="truncate flex items-center gap-2">
                            <Calendar size={10} className="text-brand-purple" />
                            <span>
                                <span className="text-white font-medium">{daysLeft} days left.</span>
                                <span className="opacity-70 ml-2 hidden sm:inline">Every day is an opportunity to learn, grow, and excel. ✨</span>
                            </span>
                        </p>
                    </div>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="text-white/40 hover:text-white transition-colors"
                    >
                        <X size={12} />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default YearProgress;
