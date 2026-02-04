import React from 'react';
import { motion } from 'framer-motion';
import { Database, AlertTriangle, Bell, Zap, Search, Activity, Layers, Rocket } from 'lucide-react';

const steps = [
    {
        number: '01',
        title: 'Deep Discovery',
        subtitle: 'Audit & Analysis',
        description: 'We ingest your raw data ecosystem—auditing feedback loops, churn metrics, and support tickets to map the hidden geography of user friction.',
        icon: Search,
        color: 'from-brand-purple to-blue-600',
        borderColor: 'border-brand-purple' // Used for static fallbacks or specific borders
    },
    {
        number: '02',
        title: 'Horizon Processing',
        subtitle: 'AI-Powered Decoding',
        description: 'Your unstructured text flows into the Horizon Engine. It decodes thousands of signals in seconds, isolating context-based risk patterns that human analysis misses.',
        icon: Zap,
        color: 'from-brand-cyan to-teal-500',
        borderColor: 'border-brand-cyan'
    },
    {
        number: '03',
        title: 'Strategy Formulation',
        subtitle: 'Bespoke Blueprint',
        description: 'We translate Horizon’s diagnostic outputs into a precision-engineered retention strategy, specific to your product’s architecture and user psychology.',
        icon: Layers,
        color: 'from-brand-magenta to-pink-600',
        borderColor: 'border-brand-magenta'
    },
    {
        number: '04',
        title: 'Execution & Scale',
        subtitle: 'Optimization',
        description: 'We partner with your team to deploy interventions. Then, we continuously calibrate the model, ensuring your retention defense evolves faster than customer expectations.',
        icon: Rocket,
        color: 'from-brand-orange to-red-500',
        borderColor: 'border-brand-orange'
    }
];

const HowItWorks = () => {
    return (
        <section id="how-it-works" className="pt-16 pb-32 px-6 relative overflow-hidden scroll-mt-32">

            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-brand-purple/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-1/4 left-0 w-[600px] h-[600px] bg-brand-cyan/5 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-screen-2xl mx-auto relative z-10">
                <div className="text-center mb-20">
                    <span className="inline-block py-2 px-4 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple font-semibold text-sm mb-6">
                        Engagement Model
                    </span>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">
                        The <span className="text-gradient">Strategic Framework</span>
                    </h2>
                    <p className="text-xl text-secondary max-w-2xl mx-auto">
                        From raw data to revenue defense, our process is a closed-loop system for continuous retention improvement.
                    </p>
                </div>

                <div className="relative">
                    {/* The Neural Spine (Central Line) */}
                    <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent -translate-x-1/2 block">
                        {/* Traveling Pulse */}
                        <motion.div
                            className="w-1 absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-brand-cyan to-transparent box-content blur-[2px]"
                            style={{ left: '-1px' }}
                            animate={{ top: ['-10%', '110%'] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        />
                    </div>

                    <div className="space-y-24 md:space-y-32">
                        {steps.map((step, index) => (
                            <TimelineNode key={index} step={step} index={index} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

const TimelineNode = ({ step, index }) => {
    const isEven = index % 2 === 0;
    const Icon = step.icon;
    const cardRef = React.useRef(null);
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    return (
        <div className={`flex flex-col md:flex-row items-center gap-8 md:gap-24 relative pl-12 md:pl-0 ${isEven ? '' : 'md:flex-row-reverse'}`}>

            {/* 1. Beam Connector (Desktop Only) */}
            <div className={`absolute top-14 hidden md:block h-px w-1/4 z-0 ${isEven ? 'right-1/2 bg-gradient-to-l' : 'left-1/2 bg-gradient-to-r'} from-brand-cyan/50 to-transparent`}>
                <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "circOut" }}
                    className={`w-full h-full bg-white shadow-[0_0_10px_white] Origin-${isEven ? 'right' : 'left'}`}
                    style={{ originX: isEven ? 1 : 0 }}
                />
            </div>

            {/* 2. Central Orb (The connector) - Desktop */}
            <div className="absolute left-1/2 -translate-x-1/2 top-8 w-12 h-12 z-20 hidden md:flex items-center justify-center">
                {/* Inner Glow */}
                <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className={`w-4 h-4 rounded-full bg-gradient-to-r ${step.color} shadow-[0_0_20px_currentColor] z-20`}
                />
                {/* Outer Ring */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1.5, opacity: 0.5 }}
                    transition={{ delay: 0.4, duration: 1 }}
                    className={`absolute inset-0 rounded-full border border-white/50 z-10`}
                />
                {/* Pulse Wave */}
                <motion.div
                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`absolute inset-0 rounded-full bg-gradient-to-r ${step.color} opacity-20 z-0`}
                />
            </div>

            {/* 2b. Mobile Connector Dot (Left Aligned) */}
            <div className="absolute left-6 -translate-x-1/2 top-12 w-4 h-4 z-20 md:hidden flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${step.color} shadow-[0_0_10px_currentColor]`} />
            </div>

            {/* 3. Visual / Icon Side */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8, x: isEven ? 50 : -50 }}
                whileInView={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.6, type: "spring" }}
                className={`flex-1 w-full flex ${isEven ? 'md:justify-end' : 'md:justify-start'}`}
            >
                <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: index * 1 }}
                    className={`relative w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br ${step.color} p-[1px] group shadow-[0_0_50px_rgba(0,0,0,0.5)]`}
                >
                    <div className="absolute inset-0 bg-white/10 blur-xl group-hover:blur-2xl transition-all duration-500 rounded-3xl opacity-50"></div>
                    {/* Inner Card */}
                    <div className="relative w-full h-full bg-[#0a0a0a] rounded-[23px] flex items-center justify-center overflow-hidden backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <Icon size={48} className="text-white relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />

                        {/* Rotate effect */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className={`absolute inset-0 border-2 border-dashed border-white/10 rounded-full scale-150 opacity-20`}
                        />
                    </div>
                </motion.div>
            </motion.div>

            {/* 4. Content Card Side */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex-1 w-full"
            >
                <div
                    ref={cardRef}
                    onMouseMove={handleMouseMove}
                    className="group relative p-8 rounded-3xl border border-white-10 bg-white/[0.02] backdrop-blur-sm overflow-hidden hover:bg-white/[0.04] transition-all duration-500"
                >
                    {/* Spotlight Effect */}
                    <div
                        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition duration-300"
                        style={{
                            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.06), transparent 40%)`,
                        }}
                    />

                    {/* Hover Gradient */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 bg-gradient-to-r ${step.color}`}></div>

                    {/* Number Watermark */}
                    <div className="absolute -right-4 -top-8 text-9xl font-bold text-white/[0.02] pointer-events-none select-none group-hover:text-white/[0.04] transition-colors">
                        {step.number}
                    </div>

                    <div className="relative z-10">
                        <div className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${step.color} text-transparent bg-clip-text flex items-center gap-2`}>
                            {step.subtitle}
                            <span className={`block w-8 h-px bg-gradient-to-r ${step.color}`}></span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/70 transition-all">
                            {step.title}
                        </h3>
                        <p className="text-secondary text-lg leading-relaxed">
                            {step.description}
                        </p>
                    </div>

                    {/* Scanner Line */}
                    <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${step.color} w-0 group-hover:w-full transition-all duration-1000 ease-in-out`}></div>
                </div>
            </motion.div>

        </div>
    );
};

export default HowItWorks;
