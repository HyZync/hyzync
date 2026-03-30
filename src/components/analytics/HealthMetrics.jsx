import { apiFetch } from '../../utils/api';

import React, { useState, useEffect } from 'react';
import { Activity, Smile, Frown, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = '';

const MetricCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500 text-sm font-medium">{title}</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
                <Icon size={16} />
            </div>
        </div>
        <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
            <div className="text-xs text-gray-500">{subtext}</div>
        </div>
    </div>
);

const HealthMetrics = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await apiFetch(`${API_BASE}/api/analytics/health`);
                if (!res.ok) throw new Error('Failed to fetch health metrics');
                const data = await res.json();
                setMetrics(data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading health metrics...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!metrics) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Product Health Overview</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Health Score"
                    value={metrics.health_score}
                    subtext="Overall health (0-100)"
                    icon={Activity}
                    color="bg-indigo-50 text-indigo-600"
                />
                <MetricCard
                    title="NPS"
                    value={metrics.nps_score}
                    subtext="Net Promoter Score"
                    icon={Smile}
                    color="bg-green-50 text-green-600"
                />
                <MetricCard
                    title="CSAT"
                    value={`${metrics.csat_score}%`}
                    subtext="Customer Satisfaction"
                    icon={TrendingUp}
                    color="bg-blue-50 text-blue-600"
                />
                <MetricCard
                    title="Risk"
                    value={`${metrics.retention_risk_pct}%`}
                    subtext="At-risk customers"
                    icon={AlertCircle}
                    color="bg-red-50 text-red-600"
                />
            </div>
        </div>
    );
};

export default HealthMetrics;
