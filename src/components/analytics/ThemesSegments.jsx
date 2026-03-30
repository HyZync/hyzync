import { apiFetch } from '../../utils/api';

import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

const API_BASE = '';

const ThemeList = ({ title, themes, icon: Icon, color, emptyText }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center ${color}`}>
            <Icon size={18} className="mr-2" />
            <h4 className="font-semibold">{title}</h4>
        </div>
        <div className="p-4 flex-grow overflow-y-auto max-h-[300px]">
            {themes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{emptyText}</p>
            ) : (
                <ul className="space-y-3">
                    {themes.map((theme, idx) => (
                        <li key={idx} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">{theme.category}</span>
                            <div className="flex items-center space-x-3">
                                <span className="text-gray-400 text-xs">{theme.mentions} mentions</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold 
                                    ${theme.sentiment > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {theme.sentiment > 0 ? '+' : ''}{theme.sentiment}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
);

const ThemesSegments = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/analytics/themes`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-400">Loading themes...</div>;
    if (!data) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Themes & Segments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ThemeList
                    title="Important Strengths"
                    themes={data.important_strengths}
                    icon={ThumbsUp}
                    color="text-green-600 bg-green-50"
                    emptyText="No major strengths identified yet."
                />
                <ThemeList
                    title="Critical Weaknesses"
                    themes={data.important_weaknesses}
                    icon={ThumbsDown}
                    color="text-red-600 bg-red-50"
                    emptyText="No critical weaknesses identified yet."
                />
                <ThemeList
                    title="Minor Strengths"
                    themes={data.unimportant_strengths}
                    icon={ThumbsUp}
                    color="text-green-500 bg-green-50/50"
                    emptyText="No minor strengths."
                />
                <ThemeList
                    title="Minor Weaknesses"
                    themes={data.unimportant_weaknesses}
                    icon={Minus}
                    color="text-orange-500 bg-orange-50/50"
                    emptyText="No minor weaknesses."
                />
            </div>
        </div>
    );
};

export default ThemesSegments;
