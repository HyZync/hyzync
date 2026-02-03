import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Brain, Cpu } from 'lucide-react';

const Founder = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-6 overflow-hidden">
            {/* Background elements to match the theme */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-50">
                <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-brand-purple/15 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] bg-brand-blue/10 blur-[100px] rounded-full"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 max-w-5xl w-full"
            >
                <div className="glass-card overflow-hidden border-white-10 bg-white/5 backdrop-blur-xl rounded-[2.5rem]">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                        {/* Profile Image/Visual Area */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-brand-purple/20 via-brand-blue/10 to-transparent p-12 flex flex-col items-center justify-center border-r border-white-10 relative overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="w-48 h-48 rounded-3xl border-2 border-brand-purple/30 bg-black/40 flex items-center justify-center relative z-10"
                            >
                                <Sparkles className="w-20 h-20 text-brand-purple/60" />
                                {/* This would be where an image goes if provided, for now a stylish placeholder */}
                            </motion.div>

                            <div className="mt-8 text-center relative z-10">
                                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Shilin Reji Philip</h1>
                                <p className="text-brand-purple font-medium uppercase tracking-[0.2em] text-xs">Founder & Chief Visionary</p>
                            </div>

                            {/* Abstract background shapes */}
                            <div className="absolute top-0 left-0 w-full h-full opacity-30">
                                <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-purple/20 rounded-full blur-3xl"></div>
                                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-blue/20 rounded-full blur-3xl"></div>
                            </div>
                        </div>

                        {/* Bio/Info Area */}
                        <div className="lg:col-span-3 p-12 lg:p-16 flex flex-col justify-center">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple text-[10px] font-bold uppercase tracking-wider mb-8">
                                    Strategic Intelligence
                                </div>

                                <h2 className="text-4xl font-light text-white mb-8 leading-tight">
                                    Architecting the future of <br />
                                    <span className="text-gradient">Customer Context</span>.
                                </h2>

                                <div className="space-y-6 text-lg text-secondary leading-relaxed mb-10 font-light">
                                    <p>
                                        A seasoned customer intelligence expert, Shilin is the driving force behind the technological evolution at Hyzync.
                                    </p>
                                    <p>
                                        He spearheads VoC analytics research and the pioneering architectural design of context-aware memory systems, ensuring that machine intelligence resonates with human experience.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white-5 border border-white-10 flex items-center justify-center flex-shrink-0">
                                            <Brain className="w-5 h-5 text-brand-purple" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-semibold mb-1">VoC Analytics</h4>
                                            <p className="text-sm text-secondary">Leading breakthrough research in voice-of-customer patterns.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white-5 border border-white-10 flex items-center justify-center flex-shrink-0">
                                            <Cpu className="w-5 h-5 text-brand-blue" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-semibold mb-1">Memory Systems</h4>
                                            <p className="text-sm text-secondary">Designing context-aware architectures for long-term intelligence.</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Secret quote or small detail below */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 1, duration: 2 }}
                    className="mt-12 text-center"
                >
                    <p className="text-sm text-secondary italic font-light">
                        "Intelligence without context is just noise. We build the resonance."
                    </p>
                </motion.div>
            </motion.div>
        </section>
    );
};

export default Founder;
