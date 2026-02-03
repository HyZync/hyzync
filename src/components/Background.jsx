import React from 'react';
import { motion } from 'framer-motion';

const Background = () => {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050508]"> {/* Darker background for contrast */}
            {/* Aurora Borealis Effect */}

            {/* Layer 1: Deep Purple Flow */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                    rotate: [0, 10, -10, 0],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute -top-[20%] -left-[10%] w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-purple/20 via-transparent to-transparent blur-[100px]"
            ></motion.div>

            {/* Layer 2: Cyan Drift */}
            <motion.div
                animate={{
                    x: [-50, 50, -50],
                    y: [-20, 20, -20],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-[20%] right-[0%] w-[80vw] h-[40vh] bg-gradient-to-l from-brand-cyan/10 to-transparent blur-[80px] rounded-full mix-blend-screen"
            ></motion.div>

            {/* Layer 3: Magenta Rising Mist */}
            <motion.div
                animate={{
                    y: [50, -50, 50],
                    scaleY: [1, 1.5, 1],
                    opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[50vh] bg-gradient-to-t from-brand-magenta/10 to-transparent blur-[100px] rounded-full mix-blend-screen"
            ></motion.div>

            {/* Layer 4: Global Mesh Texture (very subtle) */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
        </div>
    );
};

export default Background;
