import React from 'react';
import { motion } from 'framer-motion';

const Stats = () => {
    return (
        <section className="py-24 px-6">
            <div className="max-w-screen-2xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                    <StatItem number="100" suffix="%" label="Feedback Analyzed" />
                    <StatItem number="24" suffix="h" label="Insight Delivery" />
                    <StatItem number="0" suffix="%" label="Missed Signals" />
                </div>
            </div>
        </section>
    );
};

const CountUp = ({ end, duration = 2 }) => {
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        let start = 0;
        const increment = end / (duration * 60);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, 1000 / 60);
        return () => clearInterval(timer);
    }, [end, duration]);

    return <span>{Number.isInteger(end) ? Math.ceil(count) : count.toFixed(1)}</span>;
};

const StatItem = ({ number, suffix, label }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="flex flex-col items-center"
    >
        <div className="text-7xl font-extrabold text-brand-purple mb-2">
            <CountUp end={parseInt(number)} />
            <span className="text-brand-purple/50 ml-1">{suffix}</span>
        </div>
        <span className="text-xl text-white font-medium">{label}</span>
    </motion.div>
);

export default Stats;
