import React, { useState, useMemo } from 'react';
import { TrendingUp, Zap, Smile, Frown, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SUB-COMPONENTS ---

const ThemePill = ({ theme, isSelected, onClick }) => {
    const isPositive = theme.type === 'positive';

    const baseBg = isPositive ? 'bg-[#eefcf2]' : 'bg-[#fff1f2]';
    const textColor = isSelected ? (isPositive ? 'text-emerald-700' : 'text-rose-700') : 'text-gray-700';
    const numberColor = isPositive ? 'text-emerald-600' : 'text-rose-600';
    const iconColor = isPositive ? 'text-emerald-500' : 'text-rose-500';

    const ringClass = isSelected
        ? (isPositive ? 'ring-2 ring-emerald-400 ring-offset-2' : 'ring-2 ring-rose-400 ring-offset-2')
        : 'hover:ring-1 hover:ring-gray-200 hover:ring-offset-1';

    return (
        <button
            onClick={() => onClick(theme)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${baseBg} ${ringClass}`}
            style={{ width: 'fit-content' }}
        >
            {isPositive ? <Smile size={16} className={iconColor} /> : <Frown size={16} className={iconColor} />}
            <span className={`text-[13px] font-medium tracking-tight ${textColor}`}>
                {theme.name}
            </span>
            <span className={`text-[13px] font-bold ${numberColor}`}>
                {theme.count}
            </span>
        </button>
    );
};

const ImpactCard = ({ title, metric, impact, change }) => {
    const isNegative = impact < 0;
    const valueColor = isNegative ? 'text-rose-500' : 'text-emerald-500';
    const changeBg = isNegative ? 'bg-rose-50' : 'bg-emerald-50';
    const changeTextColor = isNegative ? 'text-rose-700' : 'text-emerald-700';

    const maxVal = title === 'CSAT' ? 100 : 100;
    const absImpact = Math.abs(impact);
    const fillPercentage = Math.min((absImpact / maxVal) * 100, 100);

    return (
        <div className="bg-white rounded-xl border border-dashed border-[#b0c4c9] p-6 lg:p-8 shadow-sm flex-1 flex flex-col relative overflow-hidden">
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-2">
                {title} IMPACT
            </h4>
            <p className="text-sm text-gray-400 font-medium mb-8 pr-12">
                Impact of "{metric}" on {title} Score
            </p>

            <div className="flex items-center justify-center gap-4 mb-10">
                <span className={`text-6xl font-bold tracking-tighter ${valueColor}`}>
                    {impact > 0 ? '+' : ''}{impact}
                </span>

                {change !== undefined && (
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${changeBg}`}>
                        <span className={`text-sm font-bold ${changeTextColor}`}>
                            {Math.abs(change)}
                        </span>
                        {change > 0 ? (
                            <TrendingUp size={14} className={changeTextColor} />
                        ) : (
                            <TrendingDown size={14} className={changeTextColor} />
                        )}
                    </div>
                )}
            </div>

            {/* Zero-Centered Bar Graph */}
            <div className="mt-auto px-4">
                <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span className="text-rose-500">-100</span>
                    <span className="text-rose-400">-50</span>
                    <span className="text-gray-400">0</span>
                    <span className="text-emerald-400">+50</span>
                    <span className="text-emerald-500">+100</span>
                </div>

                <div className="relative h-3 w-full rounded-sm flex">
                    <div className="w-1/2 h-full bg-[#fae8e8] rounded-l-sm relative">
                        {isNegative && (
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${fillPercentage}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="absolute right-0 top-0 bottom-0 bg-rose-500 rounded-l-sm"
                            />
                        )}
                        <div className="absolute right-0 top-[-4px] bottom-[-4px] w-px bg-rose-300"></div>
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50"></div>
                    </div>

                    <div className="w-1/2 h-full bg-[#e8f5ec] rounded-r-sm relative border-l border-white">
                        {!isNegative && impact > 0 && (
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${fillPercentage}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-r-sm"
                            />
                        )}
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50"></div>
                        <div className="absolute left-0 top-[-4px] bottom-[-4px] w-px bg-emerald-300"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN WIDGET ---

const InteractiveThemesImpactWidget = ({ results }) => {
    // Build trending & emerging themes from real analysis data
    const { trendingThemes, emergingThemes } = useMemo(() => {
        const reviews = results?.reviews || [];
        const nps = results?.nps ?? 0;
        const csat = results?.csat ?? 0;

        // Aggregate trending_theme counts
        const trendingMap = {};
        const emergingMap = {};

        reviews.forEach(r => {
            const tt = r.trending_theme;
            if (tt && !['None', 'N/A', '', 'null', 'none'].includes(tt)) {
                if (!trendingMap[tt]) trendingMap[tt] = { pos: 0, neg: 0, neutral: 0, totalScore: 0 };
                trendingMap[tt].totalScore += (r.sentiment_score || 0);
                if (r.sentiment === 'Positive' || r.sentiment === 'positive') trendingMap[tt].pos++;
                else if (r.sentiment === 'Negative' || r.sentiment === 'negative') trendingMap[tt].neg++;
                else trendingMap[tt].neutral++;
            }

            const et = r.emerging_theme;
            if (et && !['None', 'N/A', '', 'null', 'none'].includes(et)) {
                if (!emergingMap[et]) emergingMap[et] = { pos: 0, neg: 0, neutral: 0, totalScore: 0 };
                emergingMap[et].totalScore += (r.sentiment_score || 0);
                if (r.sentiment === 'Positive' || r.sentiment === 'positive') emergingMap[et].pos++;
                else if (r.sentiment === 'Negative' || r.sentiment === 'negative') emergingMap[et].neg++;
                else emergingMap[et].neutral++;
            }
        });

        const buildList = (map) => {
            return Object.entries(map)
                .map(([name, data]) => {
                    const count = data.pos + data.neg + data.neutral;
                    const avgScore = count > 0 ? data.totalScore / count : 0;
                    const type = avgScore >= 0 ? 'positive' : 'negative';
                    // Estimate CSAT/NPS impact based on sentiment proportions
                    const csatImpact = parseFloat((avgScore * 2).toFixed(1)); // Scale for display
                    const npsImpact = parseFloat((avgScore * count * 0.5).toFixed(1)); // Weighted by volume
                    return {
                        id: name.replace(/\s+/g, '_').toLowerCase(),
                        name,
                        count,
                        type,
                        csatImpact,
                        csatChange: csatImpact,
                        npsImpact,
                        npsChange: npsImpact,
                    };
                })
                .filter(t => t.count >= 2) // Min threshold
                .sort((a, b) => b.count - a.count)
                .slice(0, 6);
        };

        let trending = buildList(trendingMap);
        let emerging = buildList(emergingMap);

        // Fallback: if no trending/emerging themes, derive from top issues
        if (trending.length === 0 && results?.thematic?.top_issues) {
            trending = results.thematic.top_issues.slice(0, 5).map(i => ({
                id: i.name.replace(/\s+/g, '_').toLowerCase(),
                name: i.name,
                count: i.count,
                type: 'negative',
                csatImpact: -1.0,
                csatChange: -1.0,
                npsImpact: parseFloat((-i.count * 0.3).toFixed(1)),
                npsChange: parseFloat((-i.count * 0.3).toFixed(1)),
            }));
        }

        if (emerging.length === 0 && results?.thematic?.top_features) {
            emerging = results.thematic.top_features.slice(0, 5).map(f => ({
                id: f.name.replace(/\s+/g, '_').toLowerCase(),
                name: f.name,
                count: f.count,
                type: 'positive',
                csatImpact: 1.0,
                csatChange: 1.0,
                npsImpact: parseFloat((f.count * 0.3).toFixed(1)),
                npsChange: parseFloat((f.count * 0.3).toFixed(1)),
            }));
        }

        return { trendingThemes: trending, emergingThemes: emerging };
    }, [results]);

    const [selectedTheme, setSelectedTheme] = useState(null);

    // Auto-select first theme if none selected
    const activeTheme = selectedTheme || trendingThemes[0] || emergingThemes[0];

    const handleThemeClick = (theme) => {
        setSelectedTheme(theme);
    };

    if (trendingThemes.length === 0 && emergingThemes.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-dashed border-[#b0c4c9] p-8 shadow-sm text-center">
                <p className="text-sm text-gray-400">No theme data available. Run an analysis to see trending and emerging themes.</p>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-6">

            {/* TOP CONTAINER: Themes List */}
            <div className="bg-white rounded-xl border border-dashed border-[#b0c4c9] p-6 lg:p-8 shadow-sm relative">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                    {/* TRENDING THEMES */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={20} className="text-gray-800" strokeWidth={2.5} />
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">
                                TRENDING THEMES
                            </h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            {trendingThemes.length > 0 ? trendingThemes.map(theme => (
                                <ThemePill
                                    key={`trending-${theme.id}`}
                                    theme={theme}
                                    isSelected={activeTheme?.name === theme.name}
                                    onClick={handleThemeClick}
                                />
                            )) : (
                                <p className="text-xs text-gray-400 italic">No trending themes detected</p>
                            )}
                        </div>
                    </div>

                    {/* EMERGING THEMES */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap size={20} className="text-gray-800 fill-current" />
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">
                                EMERGING THEMES
                            </h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            {emergingThemes.length > 0 ? emergingThemes.map(theme => (
                                <ThemePill
                                    key={`emerging-${theme.id}`}
                                    theme={theme}
                                    isSelected={activeTheme?.name === theme.name}
                                    onClick={handleThemeClick}
                                />
                            )) : (
                                <p className="text-xs text-gray-400 italic">No emerging themes detected</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Visual Connector */}
                <div className="hidden lg:block absolute left-1/2 bottom-[-24px] w-px h-6 border-l-2 border-dashed border-[#b0c4c9]"></div>
            </div>

            {/* BOTTOM CONTAINER: Impact Cards */}
            <AnimatePresence mode="wait">
                {activeTheme && (
                    <motion.div
                        key={activeTheme.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col lg:flex-row gap-6 relative"
                    >
                        <div className="hidden lg:block absolute left-[calc(50%-4px)] top-[-8px] w-2 h-2 rounded-full bg-[#b0c4c9] z-10"></div>

                        <ImpactCard
                            title="CSAT"
                            metric={activeTheme.name}
                            impact={activeTheme.csatImpact}
                            change={activeTheme.csatChange}
                        />
                        <ImpactCard
                            title="NPS"
                            metric={activeTheme.name}
                            impact={activeTheme.npsImpact}
                            change={activeTheme.npsChange}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default InteractiveThemesImpactWidget;
