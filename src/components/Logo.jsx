import React from 'react';

const Logo = ({ size = 'default', className = '' }) => {
    const sizeConfig = {
        small: { text: 'text-lg', dotSize: 6, gap: 2, dotGap: 3 },
        default: { text: 'text-[1.7rem]', dotSize: 8, gap: 3, dotGap: 4 },
        large: { text: 'text-3xl', dotSize: 10, gap: 4, dotGap: 5 }
    };

    const config = sizeConfig[size];

    return (
        <span
            className={`inline-flex items-center ${className}`}
            style={{ fontFamily: 'Ubuntu, sans-serif' }}
        >
            <span
                className={`text-white ${config.text}`}
                style={{ fontWeight: 400, letterSpacing: '-0.02em' }}
            >
                Hyzync
            </span>
            {/* 4 Purple dots in 2x2 grid */}
            <span
                className="inline-grid grid-cols-2"
                style={{
                    gap: `${config.dotGap}px`,
                    marginLeft: `${config.gap + 2}px`,
                    marginTop: '2px'
                }}
            >
                <span
                    className="rounded-full bg-brand-purple"
                    style={{ width: config.dotSize, height: config.dotSize }}
                ></span>
                <span
                    className="rounded-full bg-brand-purple"
                    style={{ width: config.dotSize, height: config.dotSize }}
                ></span>
                <span
                    className="rounded-full bg-brand-purple"
                    style={{ width: config.dotSize, height: config.dotSize }}
                ></span>
                <span
                    className="rounded-full bg-brand-purple"
                    style={{ width: config.dotSize, height: config.dotSize }}
                ></span>
            </span>
        </span>
    );
};

export default Logo;
