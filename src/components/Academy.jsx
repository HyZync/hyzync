import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Search, Lightbulb, ArrowRight, Activity, PieChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import RetentionVisual from './RetentionVisual';

const Academy = () => {
    return (
        <div className="pt-24 min-h-screen relative overflow-hidden">
            {/* Dynamic Background Elements */}
            <div className="absolute top-0 left-0 w-full h-[800px] pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-green/5 blur-[120px] rounded-full animate-blob"></div>
                <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-brand-purple/5 blur-[100px] rounded-full animate-blob animation-delay-2000"></div>
            </div>

            {/* Hero Section */}
            <section className="relative py-20 px-6 max-w-screen-2xl mx-auto text-center z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-green/30 bg-brand-green/10 text-brand-green mb-8 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    >
                        <Lightbulb size={16} />
                        <span className="font-semibold text-sm tracking-wide uppercase">Knowledge Hub</span>
                    </motion.span>

                    <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
                        The Science of <br />
                        <motion.span
                            initial={{ backgroundPosition: "0% 50%" }}
                            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                            className="bg-clip-text text-transparent bg-gradient-to-r from-brand-green via-brand-cyan to-brand-green bg-[length:200%_auto]"
                        >
                            Retention
                        </motion.span>
                    </h1>

                    <p className="text-xl text-secondary max-w-3xl mx-auto leading-relaxed mb-12">
                        Deep dive into the mechanics of churn, the economics of loyalty, and how Feedback Intelligence changes the equation.
                    </p>
                </motion.div>
            </section>

            {/* Topic 1: The Churn Equation */}
            <section className="py-16 px-6 max-w-screen-2xl mx-auto relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="order-2 lg:order-1"
                    >
                        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-8 relative overflow-hidden hover:border-white/20 transition-all duration-500 shadow-2xl">
                            <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <div className="p-2 bg-brand-magenta/20 rounded-lg text-brand-magenta">
                                    <TrendingDown size={24} />
                                </div>
                                <span className="text-white">The Silent Leaks</span>
                            </h3>

                            {/* Simple Visual: Churn Buckets */}
                            <div className="space-y-6">
                                <ChurnBar label="Product Friction" percentage={45} color="bg-brand-magenta" delay={0.2} />
                                <ChurnBar label="Poor Service" percentage={30} color="bg-brand-orange" delay={0.4} />
                                <ChurnBar label="Pricing / Value" percentage={15} color="bg-brand-cyan" delay={0.6} />
                                <ChurnBar label="Unknown" percentage={10} color="bg-white/30" delay={0.8} />
                            </div>

                            <p className="mt-8 text-sm text-secondary/60 italic border-t border-white/5 pt-4">
                                *Most "Unknown" churn is actually detectable via weak signals in qualitative feedback.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="order-1 lg:order-2"
                    >
                        <h2 className="text-3xl font-bold mb-6 text-white">What is Churn, Really?</h2>
                        <div className="space-y-6 text-lg text-secondary leading-relaxed">
                            <p>
                                Churn isn't just a metric; it's a <strong className="text-white border-b border-brand-magenta/50 pb-0.5">lagging indicator</strong> of failed expectations. By the time a customer cancels, the decision was likely made weeks or months ago.
                            </p>
                            <p>
                                Traditional analytics tell you <em>who</em> left. <br />
                                <strong className="text-brand-green">Retention Science</strong> tells you <em>why</em> they are leaving and <em>how</em> to stop them before they do.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Topic 2: The Impact Graph */}
            <div className="relative z-10">
                <RetentionVisual />
            </div>

            {/* Topic 3: Key Concepts */}
            <section className="py-24 px-6 max-w-screen-2xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-4">Core Concepts</h2>
                    <p className="text-secondary max-w-2xl mx-auto">The fundamental principles that drive our retention engine.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <ConceptCard
                        title="Sentiment Velocity"
                        text="The speed at which customer sentiment changes. Rapid drops often precede churn by 2-3 weeks, serving as a critical early warning."
                        icon={Activity}
                        color="text-brand-orange"
                        delay={0}
                    />
                    <ConceptCard
                        title="Semantic Density"
                        text="The richness of feedback. One detailed review containing specific feature complaints is worth 100 star ratings for root cause analysis."
                        icon={Search}
                        color="text-brand-purple"
                        delay={0.2}
                    />
                    <ConceptCard
                        title="The Feedback Loop"
                        text="The process of Data Collection > Insight > Action > Validation. The faster this loop spins, the more resilient your retention becomes."
                        icon={PieChart}
                        color="text-brand-cyan"
                        delay={0.4}
                    />
                </div>
            </section>

            <div className="text-center pb-32 relative z-10">
                <Link to="/#contact" className="group inline-flex items-center gap-3 text-white bg-white/5 hover:bg-brand-purple hover:border-brand-purple border border-white/10 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 active:scale-95">
                    Apply these concepts to your data
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
};

const ChurnBar = ({ label, percentage, color, delay }) => (
    <div className="space-y-2">
        <div className="flex justify-between text-sm font-medium">
            <span className="text-white/80">{label}</span>
            <span className={color.replace('bg-', 'text-')}>{percentage}%</span>
        </div>
        <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${percentage}%` }}
                viewport={{ once: true }}
                className={`h-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                transition={{ duration: 1.5, delay, ease: "easeOut" }}
            />
        </div>
    </div>
);

const ConceptCard = ({ title, text, icon: Icon, color, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -10 }}
            className="group p-8 rounded-3xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-2xl relative overflow-hidden"
        >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${color}`}></div>

            <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 ${color} group-hover:scale-110 transition-transform duration-300 border border-white/5`}>
                <Icon size={28} />
            </div>

            <h3 className="text-xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/70 transition-all">
                {title}
            </h3>

            <p className="text-secondary leading-relaxed text-sm">
                {text}
            </p>

            <div className={`absolute -bottom-10 -right-10 w-32 h-32 ${color.replace('text-', 'bg-')}/10 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-0 group-hover:opacity-100`}></div>
        </motion.div>
    );
};

export default Academy;
