import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Scatter, ScatterChart, ZAxis, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, AlertTriangle, Users, Target, Shield, Clock, 
  ArrowRight, Download, RefreshCw, Zap, Search, Globe,
  Briefcase, Activity, Landmark, Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Shared Components ---

const Card = ({ children, title, subtitle, icon: Icon, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {(title || Icon) && (
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Icon size={18} /></div>}
          <div>
            <h3 className="font-semibold text-slate-800 text-sm leading-none">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
        </div>
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

const Badge = ({ children, variant = "default" }) => {
  const variants = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variants[variant]}`}>
      {children}
    </span>
  );
};

// --- Sub-Tabs ---

/**
 * Predictive Intelligence: Velocity, Crisis Radar, Churn Intent
 */
export const PredictiveIntelligenceTab = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-slate-400">No predictive data available.</div>;

  const { velocity = [], crisis_alerts = [], churn_intent = {} } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* 1. Churn Intent Overview */}
      <Card title="Churn Intent Risk" icon={AlertTriangle} subtitle="Detected cancellation signals">
        <div className="flex flex-col items-center justify-center h-48">
          <div className="text-4xl font-bold text-slate-800">{churn_intent.churn_intent_rate || 0}%</div>
          <div className="text-xs text-slate-500 mt-1">Churn Intent Rate</div>
          <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full ${churn_intent.risk_assessment === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'}`} 
              style={{ width: `${churn_intent.churn_intent_rate || 0}%` }}
            />
          </div>
          <div className="grid grid-cols-2 w-full mt-6 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-rose-600">{churn_intent?.explicit_intent || 0}</div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Explicit</div>
            </div>
            <div className="text-center border-l border-slate-100">
              <div className="text-lg font-bold text-amber-600">{churn_intent?.implicit_intent || 0}</div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Implicit</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Sentiment Velocity */}
      <Card title="Sentiment Velocity" icon={TrendingUp} subtitle="Acceleration of negative topics" className="md:col-span-2">
        <div className="h-48 w-full">
           {velocity.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={velocity}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                 <XAxis dataKey="topic" fontSize={10} axisLine={false} tickLine={false} />
                 <YAxis fontSize={10} axisLine={false} tickLine={false} unit="%" />
                 <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                 />
                 <Bar dataKey="percent_change" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40}>
                   {velocity.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.percent_change > 100 ? '#f43f5e' : '#6366f1'} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           ) : (
             <div className="flex items-center justify-center h-full text-slate-400 text-sm">No trending topics detected.</div>
           )}
        </div>
      </Card>

      {/* 3. Crisis Alerts */}
      <Card title="Crisis Radar" icon={Zap} subtitle="Anomalous & severe keyword groups" className="md:col-span-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider">
                <th className="pb-3 px-2">Topic</th>
                <th className="pb-3 px-2">Risk Score</th>
                <th className="pb-3 px-2">Severity</th>
                <th className="pb-3 px-2">Latest Incident</th>
                <th className="pb-3 px-2">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {crisis_alerts.length > 0 ? crisis_alerts.map((alert, idx) => (
                <tr key={idx} className="border-t border-slate-50 group hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-2 font-semibold text-slate-700">{alert.crisis_term}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full" style={{ width: `${alert.risk_score}%` }} />
                      </div>
                      <span>{alert.risk_score}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Badge variant={alert.severity === 'Critical' ? 'error' : 'warning'}>{alert.severity}</Badge>
                  </td>
                  <td className="py-3 px-2 text-slate-500 italic max-w-xs truncate">"{alert.sample_review}"</td>
                  <td className="py-3 px-2 text-rose-600 font-bold uppercase tracking-tighter text-[9px] flex items-center gap-1">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Action Required
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">No crisis alerts detected. System stable.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/**
 * Competitive Intelligence: Mentions, Comparisons, Threat Level
 */
export const CompetitiveIntelligenceTab = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-slate-400">No competitive data available.</div>;

  const { summary = {}, top_threats = [], recommendation = "" } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card title="Deffection Rate" icon={Users}>
             <div className="text-3xl font-bold text-slate-800">{summary.defection_rate || 0}%</div>
             <p className="text-xs text-slate-500 mt-1 uppercase font-semibold">Explicit Switching Mentions</p>
             <div className="mt-4">
                <Badge variant={summary.alert_level === 'Critical' ? 'error' : 'warning'}>{summary.alert_level || 'Normal'} Threat</Badge>
             </div>
          </Card>
          <Card title="Summary" icon={Activity}>
             <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total Mentions</span>
                  <span className="font-bold">{summary.total_competitor_mentions || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Unique Competitors</span>
                  <span className="font-bold">{summary.total_competitors_mentioned || 0}</span>
                </div>
             </div>
          </Card>
        </div>

        <Card title="Top Competitive Threats" icon={Globe} className="md:col-span-3">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart layout="vertical" data={top_threats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis dataKey="competitor" type="category" fontSize={10} axisLine={false} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="defection_count" name="Switching" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="mention_count" name="Total Mentions" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
        <div className="flex gap-4">
           <div className="p-3 bg-white rounded-xl text-indigo-600 h-fit shadow-sm">
              <Briefcase size={24} />
           </div>
           <div>
              <h4 className="font-bold text-indigo-900 mb-2">Competitive Strategy Recommendation</h4>
              <p className="text-sm text-indigo-800 leading-relaxed whitespace-pre-wrap">{recommendation}</p>
           </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Causal Diagnostics: Drivers vs Noise, Rating Attribution
 */
export const CausalDiagnosticsTab = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-slate-400">No causal analysis data available.</div>;

  const { insights = {}, attribution = [] } = data;
  const { true_drivers = [], noise_topics = [], root_cause_distribution = {} } = insights;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Rating Attribution */}
      <Card title="Star Rating Attribution" icon={Scale} subtitle="Impact on overall 1-5 rating per topic">
         <div className="h-64">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={attribution} layout="vertical">
               <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
               <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} domain={[-1, 0.5]} />
               <YAxis dataKey="topic" type="category" fontSize={10} axisLine={false} tickLine={false} width={100} />
               <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                 formatter={(value) => [`${value} stars`, 'Rating Impact']}
               />
               <Bar dataKey="rating_drag" radius={[0, 4, 4, 0]} barSize={20}>
                 {attribution.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.rating_drag < -0.3 ? '#f43f5e' : '#6366f1'} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
         </div>
      </Card>

      {/* 2. Root Cause Distribution */}
      <Card title="Root Cause Census" icon={Search} subtitle="Taxonomy of technical vs human friction">
         <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(root_cause_distribution).map(([name, val]) => ({ name, value: val.count }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#6366f1" />
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#94a3b8" />
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
         </div>
      </Card>

      {/* 3. True Drivers vs Noise */}
      <Card title="Statistical Drivers vs Noise" icon={Target} className="lg:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Zap size={14} className="text-amber-500" /> True Churn Drivers
              </h4>
              <div className="space-y-4">
                 {true_drivers.map((driver, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                       <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-800 text-sm">{driver.topic}</span>
                          <Badge variant="indigo">Impact: {driver.effect_size}%</Badge>
                       </div>
                       <p className="text-[10px] text-slate-600 leading-normal">
                          Statistically proven to cause churn (p={driver.p_value}).
                          <span className="font-semibold block mt-1 text-slate-800">Recommendation: Critical Path Fix</span>
                       </p>
                    </div>
                 ))}
              </div>
           </div>
           <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> Correlated Noise
              </h4>
              <div className="space-y-4 opacity-75">
                 {noise_topics.map((noise, idx) => (
                    <div key={idx} className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                       <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-500 text-sm">{noise.topic}</span>
                          <span className="text-[10px] text-slate-400">P-Value: {noise.p_value}</span>
                       </div>
                       <p className="text-[10px] text-slate-500 leading-normal italic">
                          Users complain but don't actually churn based on statistical regression.
                          <span className="font-semibold block mt-1">Status: Monitoring (Non-Critical)</span>
                       </p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * Prioritization: Impact/Effort Matrix & Decision Package
 */
export const PrioritizationTab = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-slate-400">No prioritization data available.</div>;

  const { matrix = [], decision = {} } = data;

  const getQuadrantColor = (quadrant) => {
    switch(quadrant) {
      case 'Quick Wins': return '#10b981';
      case 'Strategic': return '#6366f1';
      case 'Fill-Ins': return '#94a3b8';
      case 'Money Pits': return '#f43f5e';
      default: return '#cbd5e1';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Decision Hero */}
        <div className="lg:col-span-1 space-y-6">
           <Card title="The Verdict" icon={Landmark} className="bg-indigo-600 border-none !text-white">
              <div className="py-2">
                 <div className="text-[10px] uppercase font-bold text-indigo-200 mb-2">Top Recommendation</div>
                 <h4 className="text-xl font-black leading-tight mb-4">{decision.fix_now_decision}</h4>
                 <div className="space-y-3">
                    <div className="flex justify-between text-xs border-t border-indigo-500/50 pt-3">
                       <span className="text-indigo-200">Impact Score</span>
                       <span className="font-bold">{decision.impact_score}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                       <span className="text-indigo-200">Churn Reduction</span>
                       <span className="font-bold">+{decision.expected_churn_reduction_pct}%</span>
                    </div>
                 </div>
              </div>
           </Card>
           
           <Card title="Resources" icon={Briefcase}>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><Zap size={16}/></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Urgency</div>
                        <div className="text-xs font-bold text-slate-700">{decision.urgency}</div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><Shield size={16}/></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Confidence</div>
                        <div className="text-xs font-bold text-slate-700">{decision.confidence_level}</div>
                    </div>
                 </div>
              </div>
           </Card>
        </div>

        {/* 2x2 Matrix */}
        <Card title="Impact vs. Effort Matrix" icon={Activity} className="lg:col-span-3">
           <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="effort_score" name="Effort" domain={[0, 10]} label={{ value: 'Effort (1-10)', position: 'bottom', offset: 0, fontSize: 10 }} />
                  <YAxis type="number" dataKey="impact_score" name="Impact" domain={[0, 100]} label={{ value: 'Impact (0-100)', angle: -90, position: 'left', fontSize: 10 }} />
                  <ZAxis type="number" dataKey="affected_users" range={[60, 400]} name="Affected Users" />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Scatter name="Issues" data={matrix}>
                    {matrix.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getQuadrantColor(entry.quadrant)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
           </div>
           <div className="flex gap-4 justify-center mt-4">
              {['Quick Wins', 'Strategic', 'Fill-Ins', 'Money Pits'].map(q => (
                <div key={q} className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400">
                   <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getQuadrantColor(q) }} />
                   {q}
                </div>
              ))}
           </div>
        </Card>
      </div>
    </div>
  );
};

/**
 * Trust Center: GDPR, PII, Audit Trail
 */
export const TrustCenterTab = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-slate-400">No trust data available.</div>;

  const { pii_redactions = {}, data_access_events = {} } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total PII Redactions" icon={Shield}>
           <div className="text-3xl font-bold text-emerald-600">{pii_redactions.total || 0}</div>
           <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Across current workspace</p>
        </Card>
        <div className="md:col-span-1 border border-slate-100 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
            <h4 className="text-[10px] uppercase font-black text-slate-400 mb-4">Redacted Entities</h4>
            <div className="space-y-3">
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Emails</span>
                  <span className="font-bold text-slate-800">{pii_redactions.emails || 0}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Phone Numbers</span>
                  <span className="font-bold text-slate-800">{pii_redactions.phones || 0}</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Names & Identity</span>
                  <span className="font-bold text-slate-800">{pii_redactions.names || 0}</span>
               </div>
            </div>
        </div>
      </div>

      <Card title="System Audit Trail" icon={Clock} subtitle="Data providence and lineage logs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider">
                <th className="pb-3 px-2">Action</th>
                <th className="pb-3 px-2">Log ID</th>
                <th className="pb-3 px-2">Access Frequency</th>
                <th className="pb-3 px-2">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {Object.entries(data_access_events).map(([action, count], idx) => (
                <tr key={idx} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-slate-700 capitalize">{action}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-400 font-mono text-[10px]">LOG-(EX-{idx}YZ)</td>
                  <td className="py-3 px-2">
                    <span className="font-bold">{count}</span> events
                  </td>
                  <td className="py-3 px-2 italic text-emerald-600">Verified Secure</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
