import React, { useState, useEffect } from 'react';
import { Layers, ArrowRight, Check, Search, PlusCircle, Trash2, X, Sliders } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PROFESSIONAL_TEMPLATES } from '../data/templates';
import { TransformationTemplate, AudienceType, ToneType, ObjectiveType } from '../types';

export const TemplatesView: React.FC = () => {
  const { updateTransformationState, setTransformationStep, setCurrentRoute, showToast, appSettings, t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAudienceFilter, setSelectedAudienceFilter] = useState<string>('all');
  const [customTemplates, setCustomTemplates] = useState<TransformationTemplate[]>(() => {
    const saved = localStorage.getItem('transformhub_custom_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAudience, setNewAudience] = useState<AudienceType>('Executives');
  const [newTone, setNewTone] = useState<ToneType>('Formal');
  const [newObjective, setNewObjective] = useState<ObjectiveType>('Summarize');
  const [newOutputs, setNewOutputs] = useState<string[]>(['Executive Summary', 'Detailed Report']);

  useEffect(() => {
    try {
      localStorage.setItem('transformhub_custom_templates', JSON.stringify(customTemplates));
    } catch { /* ignore */ }
  }, [customTemplates]);

  const allAvailableOutputs = [
    'Executive Summary',
    'Advisory',
    'Detailed Report',
    'Presentation Deck (Slides)',
    'LinkedIn Post',
    'X / Twitter Thread',
    'Infographic Blueprint',
    'Video Script & Storyboard',
    'Press Release',
    'FAQ & Talking Points',
    'Technical Whitepaper',
    'Compliance Checklist',
  ];

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTmpl: TransformationTemplate = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || 'Custom Enterprise Blueprint',
      description: newDesc.trim() || 'Custom configured transformation blueprint.',
      recommendedOutputs: newOutputs.length > 0 ? newOutputs : ['Executive Summary'],
      defaultAudience: newAudience,
      defaultTone: newTone,
      defaultObjective: newObjective,
      samplePreview: '',
    };

    setCustomTemplates((prev) => [newTmpl, ...prev]);
    showToast(`Template "${newTmpl.title}" created.`);
    setCreateModalOpen(false);
    setNewTitle('');
    setNewSubtitle('');
    setNewDesc('');
  };

  const handleDeleteCustomTemplate = (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    showToast('Custom template removed.');
  };

  const combinedTemplates = [...customTemplates, ...PROFESSIONAL_TEMPLATES];

  const filteredTemplates = combinedTemplates.filter((tmpl) => {
    const matchesSearch =
      tmpl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tmpl.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tmpl.subtitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAudience =
      selectedAudienceFilter === 'all' || tmpl.defaultAudience === selectedAudienceFilter;
    return matchesSearch && matchesAudience;
  });

  const handleUseTemplate = (tmpl: TransformationTemplate) => {
    setCurrentRoute('transformation/new');
    updateTransformationState({
      selectedTemplateId: tmpl.id,
      configuration: {
        outputTypes: tmpl.recommendedOutputs,
        audience: tmpl.defaultAudience,
        tone: tmpl.defaultTone,
        languages: [appSettings.transformationDefaults.defaultLanguage],
        objective: tmpl.defaultObjective,
        detail: 'Balanced',
      },
    });
    setTransformationStep('upload');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            {t('Catalog & Standards')}
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
            {t('Transformation Templates')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('Enterprise blueprints for audience-calibrated communication. Zero demo mock data.')}
          </p>
        </div>

        {/* Search, Filter & New Template Action */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('Search blueprints...')}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            {['all', 'Executives', 'Analysts', 'General Public'].map((aud) => (
              <button
                key={aud}
                onClick={() => setSelectedAudienceFilter(aud)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                  selectedAudienceFilter === aud
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {aud === 'all' ? t('All') : t(aud)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('Create Blueprint')}</span>
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((tmpl) => {
          const isCustom = tmpl.id.startsWith('custom-');
          return (
            <div
              key={tmpl.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm group relative"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {t('Custom')}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">
                      {tmpl.defaultAudience} &bull; {tmpl.defaultTone}
                    </span>
                    {isCustom && (
                      <button
                        onClick={() => handleDeleteCustomTemplate(tmpl.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title={t('Delete custom blueprint')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  {tmpl.title}
                </h3>
                <p className="text-xs font-medium text-indigo-400 mb-2 mt-0.5">
                  {tmpl.subtitle}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {tmpl.description}
                </p>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 mb-6">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                    {t('Output Deliverables')}
                  </span>
                  <div className="text-xs text-slate-300">
                    {tmpl.recommendedOutputs.join(' · ')}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleUseTemplate(tmpl)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{t('Use Blueprint')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Create Custom Blueprint Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">{t('Create Custom Blueprint')}</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('Blueprint Title')} *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('e.g. Quarterly Executive Digest')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('Subtitle / Purpose')}</label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder={t('e.g. Rapid synthesis for board committees')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">{t('Operational Description')}</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t('Describe the target communication objectives...')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('Audience')}</label>
                  <select
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value as any)}
                    className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="Executives">{t('Executives')}</option>
                    <option value="Analysts">{t('Analysts')}</option>
                    <option value="General Public">{t('General Public')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('Tone')}</label>
                  <select
                    value={newTone}
                    onChange={(e) => setNewTone(e.target.value as any)}
                    className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="Formal">{t('Formal')}</option>
                    <option value="Technical">{t('Technical')}</option>
                    <option value="Urgent">{t('Urgent')}</option>
                    <option value="Simple">{t('Simple')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('Objective')}</label>
                  <select
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value as any)}
                    className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="Summarize">{t('Summarize')}</option>
                    <option value="Inform">{t('Inform')}</option>
                    <option value="Educate">{t('Educate')}</option>
                    <option value="Alert">{t('Alert')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {t('Target Deliverables')} ({newOutputs.length} {t('selected')})
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-800">
                  {allAvailableOutputs.map((ot) => {
                    const isChecked = newOutputs.includes(ot);
                    return (
                      <button
                        key={ot}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            if (newOutputs.length === 1) return;
                            setNewOutputs(newOutputs.filter((o) => o !== ot));
                          } else {
                            setNewOutputs([...newOutputs, ot]);
                          }
                        }}
                        className={`text-left p-1.5 rounded text-[11px] truncate cursor-pointer ${
                          isChecked ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '}{ot}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg"
                >
                  {t('Save Blueprint')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
