import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Mail, Shield, ShieldAlert, CheckCircle2, ChevronDown, MoreVertical, X, Loader2 } from 'lucide-react';

const TeamManagement = () => {
    // Mock Data State
    const [team, setTeam] = useState([
        { id: 1, name: 'Alex Harper', email: 'alex@hyzync.com', role: 'Owner', status: 'Active', avatar: 'AH' },
        { id: 2, name: 'Jordan Lee', email: 'jordan@hyzync.com', role: 'Admin', status: 'Active', avatar: 'JL' },
        { id: 3, name: 'Sam Taylor', email: 'sam@hyzync.com', role: 'Editor', status: 'Active', avatar: 'ST' },
        { id: 4, name: 'Casey Smith', email: 'casey@hyzync.com', role: 'Viewer', status: 'Pending', avatar: 'CS' },
    ]);

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Editor');
    const [inviteStatus, setInviteStatus] = useState('idle'); // idle, sending, success

    const handleInvite = (e) => {
        e.preventDefault();
        setInviteStatus('sending');

        // Simulate network request
        setTimeout(() => {
            const newMember = {
                id: team.length + 1,
                name: 'Invited User', // Placeholder before they accept
                email: inviteEmail,
                role: inviteRole,
                status: 'Pending',
                avatar: inviteEmail.charAt(0).toUpperCase()
            };

            setTeam(prev => [...prev, newMember]);
            setInviteStatus('success');

            setTimeout(() => {
                setIsInviteModalOpen(false);
                setInviteEmail('');
                setInviteRole('Editor');
                setInviteStatus('idle');
            }, 1500);

        }, 1200);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'Owner': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200"><ShieldAlert className="inline w-3 h-3 mr-1" />Owner</span>;
            case 'Admin': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200"><Shield className="inline w-3 h-3 mr-1" />Admin</span>;
            case 'Editor': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">Editor</span>;
            case 'Viewer': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">Viewer</span>;
            default: return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">User</span>;
        }
    };

    const getAvatarColor = (name) => {
        const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
        const num = name.length % colors.length;
        return colors[num];
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full h-full flex flex-col relative">

            {/* Header & Metrics */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-7 h-7 text-indigo-600" />
                        Team Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage access, roles, and invite colleagues to your workspace.</p>
                </div>

                <div className="flex gap-3">
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex flex-col justify-center shadow-sm">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Plan Seats</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-gray-900">{team.length}</span>
                            <span className="text-sm text-gray-400">/ 10</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
                    >
                        <UserPlus className="w-4 h-4" />
                        Invite Member
                    </button>
                </div>
            </div>

            {/* Team Roster List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Active Members ({team.length})</h3>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search team..."
                            className="text-sm pl-4 pr-10 py-1.5 rounded-md border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-64"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {team.map((member) => (
                                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(member.name)} shadow-sm`}>
                                                {member.avatar}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{member.name}</p>
                                                <p className="text-gray-500 text-xs flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {member.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getRoleBadge(member.role)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${member.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {member.role !== 'Owner' ? (
                                            <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-300 pointer-events-none">Restricted</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite Modal Overlay */}
            <AnimatePresence>
                {isInviteModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-indigo-500" />
                                    Invite New Member
                                </h3>
                                <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleInvite} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="colleague@company.com"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Role & Permissions</label>
                                        <div className="relative">
                                            <select
                                                value={inviteRole}
                                                onChange={(e) => setInviteRole(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-sm bg-white"
                                            >
                                                <option value="Admin">Admin (Full Access)</option>
                                                <option value="Editor">Editor (Can run setups)</option>
                                                <option value="Viewer">Viewer (Read-only)</option>
                                            </select>
                                            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2 flex items-start gap-1">
                                            <Shield className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            This user will consume 1 seat from your license.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <button
                                        type="submit"
                                        disabled={inviteStatus !== 'idle'}
                                        className={`w-full py-2.5 rounded-lg text-sm font-medium text-white flex justify-center items-center transition-colors ${inviteStatus === 'success' ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700'
                                            }`}
                                    >
                                        {inviteStatus === 'sending' ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Invite...</>
                                        ) : inviteStatus === 'success' ? (
                                            <><CheckCircle2 className="w-4 h-4 mr-2" /> Invite Sent</>
                                        ) : (
                                            'Send Invitation'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default TeamManagement;
