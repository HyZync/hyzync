import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

const MouseSpotlight = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };

    // Smooth spring animation for the cursor follower
    const x = useSpring(0, springConfig);
    const y = useSpring(0, springConfig);

    useEffect(() => {
        const handleMouseMove = (e) => {
            const { clientX, clientY } = e;
            // Update spring values
            x.set(clientX - 250); // Center the 500px glow
            y.set(clientY - 250);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [x, y]);

    return (
        <motion.div
            className="fixed top-0 left-0 w-[500px] h-[500px] pointer-events-none z-0 mix-blend-screen"
            style={{
                x,
                y,
                background: 'radial-gradient(circle, rgba(192, 38, 211, 0.15) 0%, rgba(6, 182, 212, 0.05) 30%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(40px)',
            }}
        />
    );
};

export default MouseSpotlight;
