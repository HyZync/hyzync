import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
  Briefcase,
} from 'lucide-react';

const API_BASE = '';

const normalizeCode = (value) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

const initialProfile = {
  name: '',
  contact_email: '',
  company: '',
  role: '',
};

const HorizonAccessPortal = ({ onAuthenticated, onPreview }) => {
  const [code, setCode] = useState('');
  const [step, setStep] = useState('code');
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedCode = useMemo(() => normalizeCode(code), [code]);
  const canSubmitCode = normalizedCode.length === 6 && !isSubmitting;
  const canSubmitProfile = normalizedCode.length === 6 && profile.name.trim() && !isSubmitting;

  const submitAccessCode = async (payload) => {
    const response = await fetch(`${API_BASE}/api/access-code/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_err) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.detail || 'Access code validation failed.');
    }

    return data;
  };

  const handleCodeSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmitCode) return;

    setIsSubmitting(true);
    setError('');
    try {
      const data = await submitAccessCode({ code: normalizedCode });
      if (data.status === 'needs_profile') {
        setStep('profile');
        return;
      }
      if (data.status === 'success') {
        onAuthenticated({
          code: normalizedCode,
          token: data.token,
          user: data.user,
        });
      }
    } catch (err) {
      setError(err.message || 'Access code validation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmitProfile) return;

    setIsSubmitting(true);
    setError('');
    try {
      const data = await submitAccessCode({
        code: normalizedCode,
        name: profile.name.trim(),
        contact_email: profile.contact_email.trim(),
        company: profile.company.trim(),
        role: profile.role.trim(),
      });
      if (data.status === 'success') {
        onAuthenticated({
          code: normalizedCode,
          token: data.token,
          user: data.user,
        });
      }
    } catch (err) {
      setError(err.message || 'Profile activation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#050816] text-white selection:bg-cyan-500/30">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_32%),linear-gradient(180deg,#050816,#0b1327)]" />
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <ShieldCheck size={14} />
              Horizon Access Gateway
            </div>
            <h1 className="mt-6 text-5xl font-black tracking-[-0.05em] text-white md:text-6xl">
              Secure Horizon
              <br />
              access with invite codes.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-300">
              Enter a 6-character access code to unlock Horizon. First-time users can activate
              their code and save profile details. Preview mode stays read-only so visitors can
              explore the product without running syncs, exports, or analysis.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">
                  Authenticated
                </p>
                <p className="mt-3 text-sm font-semibold text-white">
                  Full workspace access
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-300">
                  Invite-code users can create workspaces, connect sources, sync review data, and
                  run analysis.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-200">
                  Preview
                </p>
                <p className="mt-3 text-sm font-semibold text-white">
                  Read-only exploration
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-300">
                  Browse a sample workspace, review tables, and settings screens with every real
                  action locked.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/10 shadow-[0_32px_120px_-48px_rgba(15,23,42,0.9)] backdrop-blur-2xl">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">
                  {step === 'code' ? 'Code Sign In' : 'Activate Access'}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {step === 'code' ? 'Enter your Horizon code' : 'Finish your profile'}
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-slate-300">
                  {step === 'code'
                    ? 'Use the 6-character code you received to access Horizon.'
                    : 'This code is valid. Add your details to activate the account for this invite.'}
                </p>
              </div>

              <div className="p-6">
                {error ? (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                {step === 'code' ? (
                  <form onSubmit={handleCodeSubmit} className="space-y-5">
                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                        Access Code
                      </label>
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          value={code}
                          onChange={(event) => setCode(normalizeCode(event.target.value))}
                          placeholder="6E12GH"
                          className="w-full rounded-2xl border border-white/10 bg-[#091227] py-4 pl-12 pr-4 text-lg font-black uppercase tracking-[0.35em] text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-[#0d1830]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmitCode}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition-all hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      Continue
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                      Activating code <span className="font-black tracking-[0.24em]">{normalizedCode}</span>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                        Full Name
                      </label>
                      <div className="relative">
                        <UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          value={profile.name}
                          onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="Jane Doe"
                          className="w-full rounded-2xl border border-white/10 bg-[#091227] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-[#0d1830]"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                          Company
                        </label>
                        <div className="relative">
                          <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={profile.company}
                            onChange={(event) => setProfile((prev) => ({ ...prev, company: event.target.value }))}
                            placeholder="Acme Inc."
                            className="w-full rounded-2xl border border-white/10 bg-[#091227] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-[#0d1830]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                          Role
                        </label>
                        <div className="relative">
                          <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={profile.role}
                            onChange={(event) => setProfile((prev) => ({ ...prev, role: event.target.value }))}
                            placeholder="Product Lead"
                            className="w-full rounded-2xl border border-white/10 bg-[#091227] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-[#0d1830]"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                        Contact Email
                      </label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          value={profile.contact_email}
                          onChange={(event) =>
                            setProfile((prev) => ({ ...prev, contact_email: event.target.value }))
                          }
                          placeholder="Optional"
                          className="w-full rounded-2xl border border-white/10 bg-[#091227] py-3.5 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400/40 focus:bg-[#0d1830]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setStep('code')}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-bold text-slate-200 transition-all hover:bg-white/10"
                      >
                        <ArrowLeft size={16} />
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={!canSubmitProfile}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition-all hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        Activate Horizon
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-8 rounded-[28px] border border-white/10 bg-[#091227]/80 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                        Preview Mode
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        Explore the UI without unlocking actions
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-slate-300">
                        Preview shows a sample workspace and review data. Syncs, connector saves,
                        exports, CRM actions, and analysis runs stay disabled.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onPreview}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
                    >
                      <Eye size={16} />
                      Open Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HorizonAccessPortal;
