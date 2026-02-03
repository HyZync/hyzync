import React from 'react';
import { motion } from 'framer-motion';

const Partners = () => {
    const partners = [
        { name: 'AWS', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg' },
        { name: 'Google Cloud', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Google_Cloud_logo.svg' },
        { name: 'Microsoft Azure', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Microsoft_Azure.svg' },
        { name: 'Meta', logo: 'https://cdn.simpleicons.org/meta/0081FB' },
        { name: 'Digital Ocean', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/DigitalOcean_logo.svg' },
        { name: 'Databricks', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Databricks_Logo.png' },
        { name: 'Snowflake', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Snowflake_Logo.svg' },
    ];

    return (
        <section className="py-16 px-6 border-t border-white/5">
            <div className="max-w-screen-xl mx-auto">
                <div className="text-center mb-10">
                    <span className="text-xs uppercase tracking-[0.3em] text-secondary font-medium">
                        Technology Partners
                    </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
                    {partners.map((partner, index) => (
                        <motion.div
                            key={partner.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0"
                        >
                            {partner.logo ? (
                                <img
                                    src={partner.logo}
                                    alt={partner.name}
                                    className={`h-8 md:h-10 w-auto object-contain ${partner.name === 'Digital Ocean' || partner.name === 'Databricks' || partner.name === 'Meta' ? 'scale-125 md:scale-150' : ''
                                        }`}
                                />
                            ) : (
                                <span className="text-lg md:text-xl font-bold text-white/80 tracking-wide">
                                    {partner.text}
                                </span>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Partners;
