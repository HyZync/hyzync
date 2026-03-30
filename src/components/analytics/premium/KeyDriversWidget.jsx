import React, { useMemo } from 'react';
import { Smile, Frown } from 'lucide-react';

const KeyDriversWidget = ({ results }) => {
    const data = useMemo(() => {
        const reviews = results?.reviews || [];
        const thematic = results?.thematic || {};

        const posIssueMap = {};
        const negIssueMap = {};

        reviews.forEach(r => {
            const issue = r.issue || r.root_cause;
            if (!issue || ['N/A', 'None', '', 'null', 'n/a', 'none'].includes(issue)) return;

            const score = r.sentiment_score ?? 0;
            const sentiment = (r.sentiment || '').toLowerCase();

            if (sentiment === 'positive' || score > 0.3) {
                posIssueMap[issue] = (posIssueMap[issue] || 0) + 1;
            } else if (sentiment === 'negative' || score < -0.3) {
                negIssueMap[issue] = (negIssueMap[issue] || 0) + 1;
            }
        });

        let positive = Object.entries(posIssueMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ name, count }));

        let negative = Object.entries(negIssueMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ name, count }));

        // Fallback to thematic data
        if (negative.length === 0 && thematic.top_issues?.length > 0) {
            negative = thematic.top_issues.slice(0, 4).map(i => ({ name: i.name, count: i.count }));
        }
        if (positive.length === 0 && thematic.top_features?.length > 0) {
            positive = thematic.top_features.slice(0, 4).map(f => ({ name: f.name, count: f.count }));
        }

        return { positive, negative };
    }, [results]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-5 border-b border-gray-100 mb-4">
                <h3 className="text-[13px] font-bold text-gray-800 tracking-wide uppercase">Key Drivers</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 pb-8">
                {/* Positive Drivers */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Smile size={18} className="text-emerald-500" />
                        <h4 className="text-sm font-semibold text-gray-800">Key Positive Drivers</h4>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        {data.positive.length > 0 ? data.positive.map((item, idx) => (
                            <div
                                key={`pos-${idx}`}
                                className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5"
                            >
                                <Smile size={14} className="text-emerald-500" />
                                <span className="text-sm font-medium text-emerald-800">{item.name}</span>
                                <span className="text-sm font-bold text-emerald-600">{item.count}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-gray-400 italic">No positive drivers detected</p>
                        )}
                    </div>
                </div>

                {/* Negative Drivers */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Frown size={18} className="text-rose-500" />
                        <h4 className="text-sm font-semibold text-gray-800">Key Negative Drivers</h4>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        {data.negative.length > 0 ? data.negative.map((item, idx) => (
                            <div
                                key={`neg-${idx}`}
                                className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5"
                            >
                                <Frown size={14} className="text-rose-500" />
                                <span className="text-sm font-medium text-rose-800">{item.name}</span>
                                <span className="text-sm font-bold text-rose-600">{item.count}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-gray-400 italic">No negative drivers detected</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KeyDriversWidget;
