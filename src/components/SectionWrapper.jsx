import React from 'react';
import { motion } from 'framer-motion';

const SectionWrapper = ({ children, delay = 0, className = "" }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut", delay }}
            className={`w-full ${className}`}
        >
            {children}
        </motion.div>
    );
};

export default SectionWrapper;
