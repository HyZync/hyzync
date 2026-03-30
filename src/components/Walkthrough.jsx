import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, LayoutDashboard, Database, Activity, Target, MessageSquare, ChevronRight, Check } from 'lucide-react';

const steps = [
    {
        id: 'welcome',
        title: 'Welcome to Horizon',
        description: 'Enterprise Intelligence Platform. Let\'s take a quick tour to help you get the most out of your data.',
        icon: Zap,
        color: 'from-indigo-500 to-violet-500'
    },
    {
        id: 'dashboard',
        title: 'Your Dashboard',
        description: 'Start new analyses here. You can connect your data sources globally or directly upload CSVs to begin deriving insights.',
        icon: LayoutDashboard,
        color: 'from-blue-500 to-cyan-500'
    },
    {
        id: 'sources',
        title: 'Data Sources (Integrations)',
        description: 'Out of the box, we support processing from App Store, Google Play, Trustpilot and your own custom files.',
        icon: Database,
        color: 'from-emerald-500 to-teal-500'
    },
    {
        id: 'insights',
        title: 'Deep AI Insights',
        description: 'Once processed, Horizon extracts narrative insights, themes, risks, and provides actionable recommendations all via our custom AI models.',
        icon: Activity,
        color: 'from-amber-500 to-orange-500'
    },
    {
        id: 'copilot',
        title: 'Horizon Copilot',
        description: 'Chat directly with your data! Ask specific questions about your analyses and get immediate contextual answers.',
        icon: MessageSquare,
        color: 'from-rose-500 to-pink-500'
    }
];

const Walkthrough = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Simple check to ensure we only show it once
        const hasSeenWalkthrough = localStorage.getItem('horizon_walkthrough_seen');
        if (!hasSeenWalkthrough) {
            // Add a small delay for a cinematic entrance
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        } else {
            onComplete();
        }
    }, [onComplete]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            finish();
        }
    };

    const finish = () => {
        setIsVisible(false);
        localStorage.setItem('horizon_walkthrough_seen', 'true');
        setTimeout(() => onComplete(), 300); // Give time for exit animation
    };

    const CurrentIcon = steps[currentStep].icon;

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden"
                    >
                        {/* Header Gradient */}
                        <div className={`h-2 bg-gradient-to-r ${steps[currentStep].color} transition-all duration-500`} />

                        <div className="p-8">
                            <div className="flex items-center justify-center mb-8 relative">
                                {/* Progress rings background */}
                                <svg className="absolute w-32 h-32 -rotate-90">
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="60"
                                        className="stroke-gray-100"
                                        strokeWidth="4"
                                        fill="none"
                                    />
                                    <motion.circle
                                        cx="64"
                                        cy="64"
                                        r="60"
                                        className="stroke-indigo-600"
                                        strokeWidth="4"
                                        fill="none"
                                        strokeLinecap="round"
                                        initial={{ strokeDasharray: 377, strokeDashoffset: 377 }}
                                        animate={{ strokeDashoffset: 377 - ((currentStep + 1) / steps.length) * 377 }}
                                        transition={{ duration: 0.5, ease: "easeInOut" }}
                                    />
                                </svg>

                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className={`w-20 h-20 rounded-full bg-gradient-to-br ${steps[currentStep].color} flex items-center justify-center text-white shadow-lg relative z-10`}
                                >
                                    <CurrentIcon size={40} className="stroke-[1.5]" />
                                </motion.div>
                            </div>

                            <motion.div
                                key={`text-${currentStep}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-center mb-8"
                            >
                                <h2 className="text-2xl font-bold text-gray-900 mb-3">{steps[currentStep].title}</h2>
                                <p className="text-gray-500 leading-relaxed text-sm">{steps[currentStep].description}</p>
                            </motion.div>

                            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                                <button
                                    onClick={finish}
                                    className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    Skip Tour
                                </button>
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5 mr-4">
                                        {steps.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-4 bg-indigo-600' : 'w-1.5 bg-gray-200'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleNext}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
                                    >
                                        {currentStep === steps.length - 1 ? (
                                            <>
                                                Get Started <Check size={16} />
                                            </>
                                        ) : (
                                            <>
                                                Next <ChevronRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Walkthrough;
