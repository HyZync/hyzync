import React from 'react';
import { motion } from 'framer-motion';

const About = () => {
    return (
        <section className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto"
            >
                <span className="text-brand-purple font-semibold tracking-wider text-sm mb-4 block uppercase font-mono">Operations & Strategy</span>
                <h1 className="text-4xl md:text-6xl font-bold mb-10 tracking-tight">
                    Engineering <span className="text-gradient">Customer Longevity</span> through Intelligence.
                </h1>

                <div className="space-y-8 text-lg text-secondary leading-relaxed font-light">
                    <p>
                        Hyzync is a strategic technology firm specializing in <span className="text-white font-medium">Predictive Retention Intelligence</span>. We operate at the intersection of linguistic AI and enterprise strategy to solve the primary friction point in modern business: Churn.
                    </p>
                    <p>
                        While traditional analytics platforms provide descriptive data on *what* users do, Hyzync provides diagnostic intelligence on <span className="text-white font-medium">why</span> they do it. We bridge the gap between raw behavioral signals and true customer intent.
                    </p>
                    <p>
                        Our core technology, <span className="text-white font-medium">Horizon</span>, is a proprietary Voice of Customer (VoC) engine that processes millions of customer data points—feedback, support tickets, and social sentiment—to extract high-fidelity insights that traditional tools ignore.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
                    <div className="p-6 rounded-2xl bg-white-5 border border-white/5">
                        <div className="text-brand-purple font-bold text-xs uppercase mb-3 tracking-widest">Technique</div>
                        <h3 className="text-xl font-bold text-white mb-2">Semantic Extraction</h3>
                        <p className="text-secondary text-sm leading-relaxed">Using Horizon to map context and emotion across every customer touchpoint at scale.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white-5 border border-white/5">
                        <div className="text-brand-purple font-bold text-xs uppercase mb-3 tracking-widest">Strategy</div>
                        <h3 className="text-xl font-bold text-white mb-2">Intent Diagnostics</h3>
                        <h3 className="text-xl font-bold text-white mb-2">Risk Forecasting</h3>
                        <p className="text-secondary text-sm leading-relaxed">Identifying churn indicators weeks before they manifest in renewal data.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white-5 border border-white/5">
                        <div className="text-brand-purple font-bold text-xs uppercase mb-3 tracking-widest">Impact</div>
                        <h3 className="text-xl font-bold text-white mb-2">Performance Yield</h3>
                        <p className="text-secondary text-sm leading-relaxed">Optimizing LTV for leading Subscription, Retail, and Hospitality brands globally.</p>
                    </div>
                </div>

                {/* Customer First Program Section - "The Gold Standard" */}
                <div id="customer-first" className="mt-32 p-1 border-t border-white/10 pt-20">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                        <div className="lg:col-span-2">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-4 rounded-full bg-brand-purple/10 border border-brand-purple/30">
                                    <span className="font-serif font-black text-3xl text-white italic leading-none">C1</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white uppercase tracking-tighter">The C1 Standard</h2>
                            </div>
                            <p className="text-secondary text-base leading-relaxed mb-6">
                                Hyzync does not just provide intelligence; we define the global benchmark for customer advocacy. The <strong>Customer First (C1)</strong> badge is a certification of operational excellence in retention and ethical data practices.
                            </p>
                            <div className="px-5 py-3 rounded-xl bg-white-5 border border-white/10 text-xs text-white/60 font-medium italic tracking-wide">
                                "The highest honor in retention engineering."
                            </div>
                        </div>

                        <div className="lg:col-span-3 space-y-6">
                            <div className="p-6 border-b border-white/5 group hover:bg-white-5 transition-colors cursor-default">
                                <h4 className="text-white font-bold mb-1 uppercase text-sm tracking-wider group-hover:text-brand-purple transition-colors">01. Ethical Stewardship</h4>
                                <p className="text-secondary text-sm leading-relaxed">Total transparency in the processing and utilization of customer voice data.</p>
                            </div>
                            <div className="p-6 border-b border-white/5 group hover:bg-white-5 transition-colors cursor-default">
                                <h4 className="text-white font-bold mb-1 uppercase text-sm tracking-wider group-hover:text-brand-purple transition-colors">02. Operational Velocity</h4>
                                <p className="text-secondary text-sm leading-relaxed">Proven ability to convert customer friction into resolution within 48-hour windows.</p>
                            </div>
                            <div className="p-6 border-b border-white/5 group hover:bg-white-5 transition-colors cursor-default">
                                <h4 className="text-white font-bold mb-1 uppercase text-sm tracking-wider group-hover:text-brand-purple transition-colors">03. Proactive Evolution</h4>
                                <p className="text-secondary text-sm leading-relaxed">Strategic deployment of R&D resources based directly on aggregate customer intent.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
};

export default About;
