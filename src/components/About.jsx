import React from 'react';
import { motion } from 'framer-motion';

const About = () => {
    return (
        <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto"
            >
                <span className="text-brand-purple font-semibold tracking-wider text-sm mb-4 block">ABOUT HYZYNC</span>
                <h1 className="text-4xl md:text-6xl font-bold mb-8">
                    We are the <span className="text-gradient">Retention Architects</span>.
                </h1>

                <div className="space-y-8 text-lg text-secondary leading-relaxed">
                    <p>
                        Hyzync was founded on a simple yet powerful premise: <strong>Customer retention shouldn't be a guessing game.</strong>
                    </p>
                    <p>
                        In a world awash with data, most brands are still drowning in churn. They see the numbers drop, but they don't understand the <em>why</em>. Standard analytics tools give you charts; they don't give you answers.
                    </p>
                    <p>
                        We built <strong>Horizon</strong>, our proprietary VoC engine, to bridge that gap. By combining human strategic expertise with advanced AI that understands context, emotion, and intent, we help the world's leading Subscription, Retail, Insurance, and Hospitality brands stop churn before it happens.
                    </p>
                    <p>
                        We are not just a tool provider. We are your strategic partner in building a business that lasts.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
                    <div className="glass-card p-8">
                        <h3 className="text-2xl font-bold text-white mb-2">Our Mission</h3>
                        <p className="text-secondary">To make every customer feel heard, understood, and valued, turning retention into a science.</p>
                    </div>
                    <div className="glass-card p-8">
                        <h3 className="text-2xl font-bold text-white mb-2">Our Vision</h3>
                        <p className="text-secondary">A world where churn is a choice, not an inevitability, powered by perfect customer intelligence.</p>
                    </div>
                </div>

                {/* Customer First Program Section - Linked from Footer */}
                <div id="customer-first" className="mt-24 p-8 md:p-12 rounded-3xl bg-gradient-to-br from-brand-purple/10 to-transparent border border-brand-purple/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <span className="font-serif font-black text-9xl text-white italic">C1</span>
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center">
                                <span className="font-serif font-bold text-xl text-white italic">C1</span>
                            </div>
                            <h2 className="text-3xl font-bold text-white">The Customer First Standard</h2>
                        </div>

                        <div className="mb-8 border-l-2 border-brand-purple pl-6 py-1">
                            <h3 className="text-xl text-white font-semibold mb-2">We create Customer First brands across the world.</h3>
                            <p className="text-secondary">
                                Our mission goes beyond software. We define and cultivate the ecosystem of brands that prioritize human value above all else. This seal is the global benchmark for that commitment.
                            </p>
                        </div>

                        <p className="text-lg text-secondary mb-6">
                            The <strong>Customer First (C1) Certified Partner Program</strong> is an exclusive recognition awarded to brands that demonstrate exceptional commitment to listening, understanding, and acting on customer feedback.
                        </p>

                        <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3 text-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-purple mt-2"></span>
                                <span><strong>Ethical Data Use:</strong> Transparent and respectful handling of customer voice data.</span>
                            </li>
                            <li className="flex items-start gap-3 text-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-purple mt-2"></span>
                                <span><strong>Reactive Resolution:</strong> A proven track record of resolving friction points within 48 hours.</span>
                            </li>
                            <li className="flex items-start gap-3 text-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-purple mt-2"></span>
                                <span><strong>Proactive Delight:</strong> investing in features requested directly by the user base.</span>
                            </li>
                        </ul>

                        <div className="inline-block px-4 py-2 rounded-lg bg-brand-purple/20 border border-brand-purple/40 text-brand-purple text-sm font-bold">
                            Certified for Excellence in Retention
                        </div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
};

export default About;
