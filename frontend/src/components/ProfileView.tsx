import React, { useState } from 'react';
import { User, Mail, Shield, Building } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { clearAuthSession } from '../utils/api';

export const ProfileView: React.FC = () => {
  const { currentUser, updateUserProfile, t } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [role, setRole] = useState(currentUser.role);
  const [organization, setOrganization] = useState(currentUser.organization);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name,
      email,
      role,
      organization,
    });
  };

  const handleSignOut = () => clearAuthSession();

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          {t('User Identity')}
        </span>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
          {t('Profile')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Manage your operator identity, workspace credentials, and API access tokens.')}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar & Summary */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
            <div className="w-14 h-14 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-xl font-bold">
              {name.charAt(0) || 'U'}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{name}</h3>
              <p className="text-xs text-slate-400">{email}</p>
              <span className="text-[10px] font-mono text-indigo-400 uppercase mt-0.5 inline-block">
                {role}
              </span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="profile-name">
              {t('Full Name')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="profile-email">
              {t('Work Email')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="profile-role">
              {t('Assigned Role')}
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="profile-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Organization */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="profile-org">
              {t('Organization / Workspace')}
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="profile-org"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {t('Save Changes')}
            </button>
          </div>
        </form>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div><h3 className="text-sm font-semibold text-white">Account session</h3><p className="mt-1 text-xs text-slate-400">Sign out of this browser. Your projects remain saved to your account.</p></div>
        <button type="button" onClick={handleSignOut} className="shrink-0 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-rose-400/40 hover:text-rose-200">Sign out</button>
      </div>
    </div>
  );
};
