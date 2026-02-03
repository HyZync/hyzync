import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase } from 'lucide-react';

const Careers = () => {
    return (
        <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto min-h-[80vh] flex flex-col items-center justify-center text-center">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="w-20 h-20 rounded-2xl bg-white-5 flex items-center justify-center text-brand-purple mx-auto mb-8 border border-white-10">
                    <Briefcase size={40} />
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-6">
                    Join the <span className="text-gradient">Revolution</span>
                </h1>
                <p className="text-xl text-secondary max-w-2xl mx-auto mb-12">
                    We are always looking for brilliant minds to join our mission of redefining customer retention.
                </p>

                <div className="glass-card p-12 max-w-3xl mx-auto border-brand-purple/20">
                    <h3 className="text-2xl font-bold text-white mb-4">No Current Openings</h3>
                    <p className="text-secondary leading-relaxed mb-8">
                        While we don’t have any specific roles open right now, we are growing fast.
                        Check back soon or follow us on social media for updates.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white-5 text-sm text-secondary">
                        <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse"></span>
                        Keep an eye out for Q3 2026 roles
                    </div>
                </div>
            </motion.div>
        </section>
    );
};

export default Careers;
