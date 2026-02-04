import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Database, Server, BarChart2, Cpu, Globe, Share2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import xcelLogo from '../assets/xcel.png';
import salesforceLogo from '../assets/sforce.png';
import appStoreLogo from '../assets/app.png';
import typeformLogo from '../assets/typeform.png';

const HorizonStandalone = () => {
    const navigate = useNavigate();
    return (
        <section id="horizon" className="pt-32 pb-16 px-6 max-w-screen-2xl mx-auto relative scroll-mt-32">

            {/* Background Ambience */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-cyan/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="text-center mb-32 relative z-10">
                <span className="inline-block py-2 px-4 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan font-semibold text-sm mb-6">
                    Hyzync Data Analytics
                </span>
                <h2 className="text-4xl md:text-6xl font-bold mb-6">
                    Powered by <span className="text-brand-cyan">Horizon</span>
                </h2>
                <p className="text-xl text-secondary max-w-3xl mx-auto leading-relaxed">
                    Our proprietary <strong>Gen AI-enabled, context-aware VOC analytic engine</strong> built for deep feedback intelligence at scale.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center relative z-10">

                {/* Left Column: Inputs (The "Fuel") */}
                <div className="space-y-8 lg:text-right order-2 lg:order-1">
                    <FeatureNode
                        icon={FileText}
                        title="Bulk Survey Processing"
                        text="Ingest 10k+ survey responses (Typeform, SurveyMonkey) in minutes."
                        align="right"
                        delay={0}
                        className="items-center text-center lg:items-end lg:text-right"
                    />
                    <FeatureNode
                        icon={Database}
                        title="Legacy Data Mining"
                        text="Uncover hidden insights from Zendesk, Salesforce & Intercom."
                        align="right"
                        delay={0.2}
                    />
                    <FeatureNode
                        icon={BarChart2}
                        title="Review Intelligence"
                        text="Direct fetch from Play Store, App Store, G2, and Capterra."
                        align="right"
                        delay={0.4}
                    />
                </div>

                {/* Center Column: The Engine (The "Core") */}
                <div className="order-1 lg:order-2 h-[500px] relative flex items-center justify-center">
                    {/* Central Orb/Scanner Visual */}
                    <div className="relative w-full h-full max-w-md mx-auto bg-black/60 backdrop-blur-xl border border-brand-cyan/20 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between text-xs text-secondary mb-6 border-b border-white-10 pb-4">
                            <span className="font-mono text-brand-cyan">HORIZON_CORE_v4.2</span>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse"></span>
                                <span className="text-white">ONLINE</span>
                            </div>
                        </div>

                        {/* Console Output */}
                        <div className="flex-1 font-mono text-xs space-y-3 overflow-hidden mask-gradient-b">
                            <LogLine text="> Initializing Horizon VOC Engine..." color="text-brand-cyan" delay={0.5} />
                            <LogLine text="> Mapping context graph: 25k+ signals..." color="text-white/60" delay={1.5} />
                            <LogLine text="> Extracting core customer pain points..." color="text-white" delay={2.5} />
                            <LogLine text="> Identifying expansion opportunities..." color="text-brand-purple" delay={3.0} />
                            <LogLine text="> Mapping product growth clusters..." color="text-brand-orange" delay={4.0} />
                            <LogLine text="> Compiling strategic client roadmap..." color="text-brand-green" delay={5.0} />
                            <LogLine text="> System: Context Loaded & Optimized." color="text-white/60" delay={6.0} />
                            <motion.div
                                className="h-0.5 bg-brand-cyan shadow-[0_0_10px_#06b6d4]"
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>

                        {/* Stats Footer */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white-10 mt-4">
                            <div>
                                <div className="text-[10px] text-secondary uppercase tracking-wider">Throughput</div>
                                <div className="text-lg font-bold text-white">45MB<span className="text-brand-cyan">/s</span></div>
                            </div>
                            <div>
                                <div className="text-[10px] text-secondary uppercase tracking-wider">Accuracy</div>
                                <div className="text-lg font-bold text-white">99.8<span className="text-brand-cyan">%</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Outputs (The "Value") */}
                <div className="space-y-8 order-3">
                    <div className="p-6 rounded-2xl bg-white-5 border border-white-10 hover:border-brand-cyan/30 transition-all group">
                        <div className="w-12 h-12 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple mb-4 group-hover:scale-110 transition-transform">
                            <Share2 size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Pain & Growth Extraction</h3>
                        <p className="text-secondary text-sm leading-relaxed">
                            Automatically isolate critical <span className="text-white">customer pain points</span> and identify untapped expansion opportunities at scale.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white-5 border border-white-10 hover:border-brand-cyan/30 transition-all group">
                        <div className="w-12 h-12 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green mb-4 group-hover:scale-110 transition-transform">
                            <Globe size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Strategic Transformation</h3>
                        <p className="text-secondary text-sm leading-relaxed">
                            Convert feedback into <span className="text-white">precise product improvements</span> and data-driven strategies for your clients.
                        </p>
                    </div>
                </div>
            </div>

            {/* Integrations Ticker */}
            <div className="mt-24">
                <p className="text-center text-secondary text-sm mb-8 font-semibold uppercase tracking-wider opacity-60">Seamlessly Integrating With</p>
                <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                    {[
                        { name: 'Google Play', src: 'https://cdn.simpleicons.org/googleplay' },
                        { name: 'App Store', src: appStoreLogo },
                        { name: 'Zendesk', src: 'https://cdn.simpleicons.org/zendesk' },
                        { name: 'Salesforce', src: salesforceLogo },
                        { name: 'HubSpot', src: 'https://cdn.simpleicons.org/hubspot' },
                        { name: 'Typeform', src: typeformLogo },
                    ].map((logo) => (
                        <img
                            key={logo.name}
                            src={logo.src}
                            alt={logo.name}
                            className="h-8 md:h-10 w-auto hover:scale-110 transition-transform cursor-pointer"
                            title={logo.name}
                        />
                    ))}
                </div>

                <div className="text-center mt-8">
                    <button
                        onClick={() => navigate('/#contact')}
                        className="inline-flex items-center gap-2 bg-white-5 border border-white-10 hover:bg-brand-cyan hover:border-brand-cyan hover:text-black text-white px-8 py-4 rounded-full font-bold transition-all duration-300 cursor-pointer"
                    >
                        Request Data Analysis
                        <Server size={18} />
                    </button>
                </div>
            </div>
        </section>
    );
};

const FeatureNode = ({ icon: Icon, title, text, align, delay, className }) => (
    <motion.div
        initial={{ opacity: 0, x: align === 'right' ? -20 : 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.5 }}
        className={`flex flex-col ${className || (align === 'right' ? 'lg:items-end' : 'lg:items-start')} gap-2 group`}
    >
        <div className="w-12 h-12 rounded-full bg-white-5 border border-white-10 flex items-center justify-center text-secondary group-hover:text-brand-cyan group-hover:border-brand-cyan transition-all">
            <Icon size={20} />
        </div>
        <h4 className="text-lg font-bold text-white">{title}</h4>
        <p className="text-secondary text-sm max-w-xs">{text}</p>
    </motion.div>
);

const LogLine = ({ text, color, delay }) => (
    <motion.div
        className={`${color} truncate`}
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.4 }}
    >
        {text}
    </motion.div>
);

export default HorizonStandalone;
