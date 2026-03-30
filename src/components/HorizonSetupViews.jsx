import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Cpu,
  Database,
  FileUp,
  Filter,
  Globe,
  Loader2,
  Network,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';

const PIPELINE_OPTIONS = [
  {
    key: 'token_efficiency',
    label: 'Dedup and boilerplate',
    desc: 'Suppress repeats, templated copy, and obvious filler rows before analysis.',
  },
  {
    key: 'magic_clean',
    label: 'Noise scoring',
    desc: 'Prioritize high-signal comments and reduce low-information feedback.',
  },
  {
    key: 'html_shield',
    label: 'HTML cleanup',
    desc: 'Remove markup fragments, encoded entities, and formatting residue.',
  },
  {
    key: 'language_focus',
    label: 'English focus',
    desc: 'Keep the working set aligned to English-language feedback.',
  },
];

const getConnectorCategory = (connector) => {
  switch (connector.id) {
    case 'appstore':
    case 'playstore':
    case 'trustpilot':
      return 'Reviews';
    case 'surveymonkey':
    case 'typeform':
      return 'Surveys';
    case 'crm':
      return 'CRM';
    case 'csv':
      return 'Files';
    case 'api':
      return 'APIs';
    default:
      return 'Sources';
  }
};

const getReviewTone = (score) => {
  if (score >= 4) {
    return {
      label: 'Clean',
      chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      rowClass: 'hover:bg-emerald-50/35',
    };
  }
  if (score <= 2) {
    return {
      label: 'At risk',
      chipClass: 'border-rose-200 bg-rose-50 text-rose-700',
      rowClass: 'hover:bg-rose-50/35',
    };
  }
  return {
    label: 'Neutral',
    chipClass: 'border-amber-200 bg-amber-50 text-amber-700',
    rowClass: 'hover:bg-amber-50/35',
  };
};

const formatDate = (value) => {
  if (!value) return '--';
  return String(value).split('T')[0];
};

const ConnectorVisual = ({ connector, active = false, compact = false }) => (
  <div
    className={`flex shrink-0 items-center justify-center border ${
      compact ? 'h-9 w-9 rounded-[11px]' : 'h-12 w-12 rounded-2xl'
    } ${
      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
    }`}
  >
    {connector?.img ? (
      <img src={connector.img} alt={connector.name} className={`${compact ? 'h-[18px] w-[18px]' : 'h-6 w-6'} object-contain`} />
    ) : connector?.icon ? (
      <connector.icon size={compact ? 15 : 18} />
    ) : (
      <Database size={compact ? 15 : 18} />
    )}
  </div>
);

const PanelLabel = ({ children }) => (
  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{children}</p>
);

const InputShell = ({ label, hint, required = false, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5">
    <div className="mb-2 flex items-center justify-between gap-3">
      <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </div>
    {children}
  </div>
);

const TextField = ({ id, type = 'text', placeholder, defaultValue, autoFocus = false }) => (
  <input
    id={id}
    type={type}
    placeholder={placeholder}
    defaultValue={defaultValue}
    autoFocus={autoFocus}
    autoComplete="off"
    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
  />
);

const SelectField = ({ id, defaultValue, children }) => (
  <select
    id={id}
    defaultValue={defaultValue}
    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white"
  >
    {children}
  </select>
);

export const ConnectorStudio = ({
  connectorCatalog,
  bulkSurveyMode,
  setBulkSurveyMode,
  activeNodes,
  csvFiles,
  setCsvFiles,
  handleRemoveNode,
  handleSyncNodes,
  isLoadingPreview,
  expandedConnector,
  setExpandedConnector,
  tempFile,
  setTempFile,
  parseCsvHeaders,
  csvHeaders,
  csvColumnMap,
  setCsvColumnMap,
  handleAddConnectorInline,
  isPreviewMode = false,
}) => {
  const [categoryFilter, setCategoryFilter] = React.useState('All');

  const selectedConnector = expandedConnector
    ? connectorCatalog.find((connector) => connector.id === expandedConnector)
    : null;
  const categories = ['All', ...new Set(connectorCatalog.map(getConnectorCategory))];
  const filteredConnectors = connectorCatalog.filter(
    (connector) => categoryFilter === 'All' || getConnectorCategory(connector) === categoryFilter,
  );
  const pendingUploads = activeNodes.filter(
    (node) => node.connector_type === 'csv' && !csvFiles[node.identifier],
  ).length;
  const showColumnMapping = !!selectedConnector?.isFile && csvHeaders.length > 0;
  const showWorkspaceIntake = !!selectedConnector || activeNodes.length > 0;

  return (
    <div className="grid min-h-[640px] rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_70px_-56px_rgba(15,23,42,0.32)] lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
      <section className="flex min-w-0 flex-col lg:min-h-0">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                <Network size={12} />
                Source Connector
              </div>
              <h2 className="mt-3 text-[25px] font-black tracking-[-0.04em] text-slate-950">
                Feedback intake workspace
              </h2>
              <p className="mt-2 max-w-2xl text-[12px] leading-5 text-slate-500">
                Pick a source from the palette, configure it, and keep the connected intake list
                visible in the same workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                <span className="font-black text-slate-950">{connectorCatalog.length}</span> channels
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                <span className="font-black text-slate-950">{activeNodes.length}</span> connected
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                {pendingUploads > 0 ? `${pendingUploads} upload pending` : 'Ready to calibrate'}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={() => setBulkSurveyMode(!bulkSurveyMode)}
                className={`relative mt-0.5 h-7 w-12 rounded-full transition-colors ${
                  bulkSurveyMode ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                    bulkSurveyMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Bulk survey review analysis</h3>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                    {bulkSurveyMode ? 'Enabled' : 'Optional'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-slate-500">
                  Treat imported survey responses as a review dataset during sync and calibration.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    categoryFilter === category
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50/60 px-5 py-4 lg:min-h-0 lg:flex-1">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <PanelLabel>Connector Directory</PanelLabel>
              <p className="mt-1 text-[13px] font-semibold text-slate-700">
                Compact source palette for quick setup.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              {filteredConnectors.length} visible
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredConnectors.map((connector) => {
              const isSelected = selectedConnector?.id === connector.id;
              const isAlreadyAdded = activeNodes.some((node) => node.connector_type === connector.id);
              const traitLabel = connector.isFile
                ? 'Upload'
                : connector.hasToken
                  ? 'Secure'
                  : connector.hasInterval
                    ? 'Auto sync'
                    : 'Manual';

              return (
                <motion.button
                  key={connector.id}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExpandedConnector(isSelected ? null : connector.id)}
                  className={`group flex min-h-[98px] flex-col justify-between rounded-[18px] border px-3.5 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-white text-slate-900 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.34)] ring-1 ring-slate-900/5'
                      : 'border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-950/5 hover:border-slate-300 hover:shadow-[0_16px_26px_-26px_rgba(15,23,42,0.18)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <ConnectorVisual connector={connector} active={isSelected} compact />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="line-clamp-1 text-[14px] font-black tracking-tight text-slate-950">
                            {connector.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${
                              isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {traitLabel}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                          {connector.desc}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-slate-50 group-hover:border-slate-300'
                      }`}
                    >
                      {isSelected ? (
                        <Check size={13} className="text-white" />
                      ) : (
                        <ChevronRight size={13} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${
                          isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {getConnectorCategory(connector)}
                      </span>
                      {isAlreadyAdded ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          Active
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {isSelected ? 'Selected' : connector.hasInterval ? 'Auto' : 'Manual'}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
          {selectedConnector ? (
            <div className="mt-3 flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3.5 py-2.5">
              <div>
                <PanelLabel>Selected</PanelLabel>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedConnector.name}</p>
              </div>
              <p className="text-[12px] text-slate-500">Configure details in the setup panel.</p>
            </div>
          ) : null}

          {showColumnMapping ? (
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <PanelLabel>Column Mapping</PanelLabel>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Tell Horizon which columns to read from the uploaded file.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {csvHeaders.length} detected
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Feedback text
                  </label>
                  <select
                    value={csvColumnMap.content}
                    onChange={(e) =>
                      setCsvColumnMap((prev) => ({ ...prev, content: e.target.value }))
                    }
                    className={`w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ${
                      csvColumnMap.content ? 'border-emerald-300' : 'border-amber-300'
                    }`}
                  >
                    <option value="">Select column</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Rating or score
                  </label>
                  <select
                    value={csvColumnMap.score}
                    onChange={(e) =>
                      setCsvColumnMap((prev) => ({ ...prev, score: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                  >
                    <option value="">Skip</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">Date</label>
                  <select
                    value={csvColumnMap.date}
                    onChange={(e) =>
                      setCsvColumnMap((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                  >
                    <option value="">Skip</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">Author</label>
                  <select
                    value={csvColumnMap.author}
                    onChange={(e) =>
                      setCsvColumnMap((prev) => ({ ...prev, author: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                  >
                    <option value="">Skip</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          {showWorkspaceIntake ? (
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <PanelLabel>Workspace Intake</PanelLabel>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Connected sources for this workspace.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {activeNodes.length}
                </span>
              </div>

              {activeNodes.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {activeNodes.map((node) => {
                    const catalogItem = connectorCatalog.find(
                      (item) => item.id === node.connector_type,
                    );
                    const isCsv = node.connector_type === 'csv';
                    const csvFileReady = isCsv ? !!csvFiles[node.identifier] : true;

                    return (
                      <div
                        key={node.id}
                        className={`rounded-2xl border px-4 py-4 ${
                          isCsv && !csvFileReady
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <ConnectorVisual connector={catalogItem} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {node.name || node.identifier}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  {node.connector_type}
                                </span>
                                {isCsv ? (
                                  <span
                                    className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                                      csvFileReady
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {csvFileReady ? 'file ready' : 'upload needed'}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveNode(node.id)}
                            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {isCsv && !csvFileReady ? (
                          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[12px] font-semibold text-amber-700">
                            <Upload size={13} />
                            Re-select "{node.identifier}"
                            <input
                              type="file"
                              className="hidden"
                              accept=".csv,.xlsx,.xls"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setCsvFiles((prev) => ({ ...prev, [node.identifier]: file }));
                                }
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <Database size={18} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-bold text-slate-900">No sources connected yet</p>
                  <p className="mt-1 text-[12px] leading-5 text-slate-500">
                    Add one or more connectors to build the calibration dataset.
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div className="text-[12px] text-slate-500">
                  <span>{activeNodes.length} source{activeNodes.length === 1 ? '' : 's'} connected</span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span>{pendingUploads > 0 ? `${pendingUploads} upload pending` : 'All uploads ready'}</span>
                </div>
                <button
                  onClick={handleSyncNodes}
                  disabled={isLoadingPreview || activeNodes.length === 0}
                  className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLoadingPreview ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Syncing
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      Sync To Calibration
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}
          {filteredConnectors.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <Filter size={20} className="mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">No connectors in this view</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-500">
                Switch the category filter to see the rest of the source catalog.
              </p>
            </div>
          ) : null}
        </div>
      </section>
      <aside className="flex flex-col border-t border-slate-200 bg-slate-50/95 lg:min-h-0 lg:border-l lg:border-t-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <PanelLabel>Setup Panel</PanelLabel>
          <h3 className="mt-2 text-lg font-black tracking-tight text-slate-950">
            {selectedConnector ? selectedConnector.name : 'Select a source'}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            {selectedConnector
              ? 'Configure the connector in-place, then add it to the workspace.'
              : 'Choose a connector to configure it here.'}
          </p>
        </div>

        <div className="p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {selectedConnector ? (
              <motion.div
                key={selectedConnector.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="space-y-5"
              >
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
                  <div className="flex items-start gap-4">
                    <ConnectorVisual connector={selectedConnector} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {getConnectorCategory(selectedConnector)}
                        </span>
                        {selectedConnector.hasInterval ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Recurring sync
                          </span>
                        ) : null}
                      </div>
                      <h4 className="mt-3 text-lg font-black text-slate-950">{selectedConnector.name}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{selectedConnector.desc}</p>
                    </div>
                  </div>
                </div>

                {selectedConnector.isFile ? (
                  <InputShell
                    label={selectedConnector.label}
                    hint={tempFile ? 'File selected' : 'Upload required'}
                  >
                    <div
                      className={`rounded-2xl border-2 border-dashed p-5 transition-all ${
                        tempFile
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <input
                        id={`file-upload-hidden-${selectedConnector.id}`}
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setTempFile(file);
                            parseCsvHeaders(file);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById(`file-upload-hidden-${selectedConnector.id}`)?.click()
                        }
                        className="flex w-full items-center gap-4 text-left"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                          {tempFile ? <Check size={18} className="text-emerald-600" /> : <FileUp size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {tempFile ? tempFile.name : 'Upload CSV or spreadsheet'}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-500">
                            CSV, XLSX, or XLS. Best for backfills, survey exports, and review dumps.
                          </p>
                        </div>
                      </button>
                    </div>

                    {csvHeaders.length > 0 ? (
                      <p className="mt-3 text-[12px] font-medium text-slate-500">
                        Column mapping is available below the connector directory.
                      </p>
                    ) : null}
                  </InputShell>
                ) : (
                  <InputShell label={selectedConnector.label} required>
                    <TextField
                      id={`inline-id-${selectedConnector.id}`}
                      placeholder={selectedConnector.placeholder}
                      autoFocus
                    />
                  </InputShell>
                )}

                {selectedConnector.hasToken ? (
                  <InputShell label={selectedConnector.tokenLabel} required>
                    <TextField
                      id={`inline-token-${selectedConnector.id}`}
                      type="password"
                      placeholder={selectedConnector.tokenPlaceholder}
                    />
                  </InputShell>
                ) : null}

                {selectedConnector.hasSalesforce ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
                    <div>
                      <PanelLabel>Salesforce Access</PanelLabel>
                      <h4 className="mt-2 text-base font-black text-slate-950">OAuth credentials</h4>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField id={`inline-sf-client_id-${selectedConnector.id}`} placeholder="Client ID" />
                      <TextField
                        id={`inline-sf-client_secret-${selectedConnector.id}`}
                        type="password"
                        placeholder="Client Secret"
                      />
                      <TextField id={`inline-sf-username-${selectedConnector.id}`} placeholder="Username" />
                      <TextField
                        id={`inline-sf-password-${selectedConnector.id}`}
                        type="password"
                        placeholder="Password + Security Token"
                      />
                    </div>
                    <div className="grid gap-3">
                      <TextField
                        id={`inline-sf-object-${selectedConnector.id}`}
                        placeholder="Object Name"
                        defaultValue="Case"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField
                          id={`inline-sf-content-${selectedConnector.id}`}
                          placeholder="Content Field"
                          defaultValue="Description"
                        />
                        <TextField
                          id={`inline-sf-score-${selectedConnector.id}`}
                          placeholder="Score Field"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedConnector.hasApiConfig ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
                    <div>
                      <PanelLabel>Request Shape</PanelLabel>
                      <h4 className="mt-2 text-base font-black text-slate-950">API configuration</h4>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField id={`inline-api-method-${selectedConnector.id}`} defaultValue="GET">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </SelectField>
                      <SelectField id={`inline-api-auth_type-${selectedConnector.id}`} defaultValue="none">
                        <option value="none">None</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="apikey">API Key Header</option>
                        <option value="basic">Basic Auth</option>
                      </SelectField>
                    </div>
                    <TextField
                      id={`inline-api-auth_value-${selectedConnector.id}`}
                      type="password"
                      placeholder="Auth token or user:password"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        id={`inline-api-data_path-${selectedConnector.id}`}
                        placeholder="Data path"
                      />
                      <TextField
                        id={`inline-api-content_field-${selectedConnector.id}`}
                        placeholder="Content field"
                      />
                    </div>
                    <TextField
                      id={`inline-api-score_field-${selectedConnector.id}`}
                      placeholder="Score field"
                    />
                  </div>
                ) : null}

                <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5">
                  <div>
                    <PanelLabel>Sync Rules</PanelLabel>
                    <h4 className="mt-2 text-base font-black text-slate-950">Connector defaults</h4>
                  </div>

                  {selectedConnector.hasCountry ? (
                    <InputShell label="Country code">
                      <TextField id={`inline-country-${selectedConnector.id}`} placeholder="us" defaultValue="us" />
                    </InputShell>
                  ) : null}

                  {selectedConnector.hasInterval ? (
                    <InputShell label="Fetch interval">
                      <SelectField id={`inline-interval-${selectedConnector.id}`} defaultValue="manual">
                        <option value="manual">Manual pull only</option>
                        <option value="hourly">Every hour</option>
                        <option value="daily">Every 24 hours</option>
                        <option value="weekly">Every week</option>
                      </SelectField>
                    </InputShell>
                  ) : null}

                  {selectedConnector.hasLimit ? (
                    <InputShell label="Max reviews">
                      <TextField
                        id={`inline-limit-${selectedConnector.id}`}
                        type="number"
                        defaultValue="200"
                      />
                    </InputShell>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => handleAddConnectorInline(selectedConnector)}
                      disabled={isPreviewMode}
                      className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-all ${
                        isPreviewMode
                          ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isPreviewMode ? 'Preview only' : 'Add source'}
                    </button>
                    <button
                      onClick={() => {
                        setExpandedConnector(null);
                        setTempFile(null);
                      }}
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                    >
                      Close panel
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Network size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">No connector selected</p>
                  <p className="text-[12px] leading-5 text-slate-500">
                    Pick a source from the strip to open its config.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </aside>
    </div>
  );
};

export const CalibrationStudio = ({
  previewReviews,
  getFilteredReviews,
  sourceFilter,
  setSourceFilter,
  ratingFilter,
  setRatingFilter,
  countRange,
  setCountRange,
  arpu,
  setArpu,
  cleaningOptions,
  setCleaningOptions,
  handleStartAnalysis,
  isPreviewMode = false,
}) => {
  const filteredReviews = getFilteredReviews();
  const allSources = [...new Set((previewReviews || []).map((review) => review.source).filter(Boolean))];
  const avgScore =
    filteredReviews.length > 0
      ? (
          filteredReviews.reduce((acc, review) => acc + (Number(review.score) || 0), 0) /
          filteredReviews.length
        ).toFixed(2)
      : '0.00';
  const cleanCount = Object.values(cleaningOptions).filter(Boolean).length;
  const activePills = [
    cleaningOptions.token_efficiency && {
      key: 'token',
      label: 'Token Eff.',
      cls: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: Zap,
    },
    cleaningOptions.magic_clean && {
      key: 'magic',
      label: 'Noise Score',
      cls: 'border-violet-200 bg-violet-50 text-violet-700',
      icon: Sparkles,
    },
    cleaningOptions.html_shield && {
      key: 'html',
      label: 'HTML Clean',
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: Shield,
    },
    cleaningOptions.language_focus && {
      key: 'lang',
      label: 'English',
      cls: 'border-sky-200 bg-sky-50 text-sky-700',
      icon: Globe,
    },
  ].filter(Boolean);

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_34px_90px_-58px_rgba(15,23,42,0.35)]">
      <div className="grid min-h-[760px] gap-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:h-[calc(100vh-140px)] md:grid-cols-[300px_minmax(0,1fr)] md:overflow-hidden">
        <aside className="relative z-10 rounded-[22px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5 md:flex md:min-h-0 md:flex-col md:overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
                <Cpu size={11} />
                Tuning Menu
              </div>
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                {filteredReviews.length}
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-slate-500">
              Small control bar for shaping the working set while the table stays visible.
            </p>
          </div>

          <div className="relative z-0 space-y-3 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto custom-scrollbar">
            {allSources.length > 1 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <PanelLabel>Sources</PanelLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allSources.map((source) => {
                    const active = sourceFilter.length === 0 || sourceFilter.includes(source);
                    return (
                      <button
                        key={source}
                        onClick={() =>
                          setSourceFilter((prev) =>
                            prev.length === 0
                              ? allSources.filter((item) => item !== source)
                              : prev.includes(source)
                                ? prev.length > 1
                                  ? prev.filter((item) => item !== source)
                                  : allSources
                                : [...prev, source],
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                      >
                        {source}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <PanelLabel>Ratings</PanelLabel>
                <span className="text-[10px] font-semibold text-slate-500">{ratingFilter.length}/5</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() =>
                      setRatingFilter((prev) =>
                        prev.includes(rating)
                          ? prev.length > 1
                            ? prev.filter((item) => item !== rating)
                            : prev
                          : [...prev, rating].sort(),
                      )
                    }
                    className={`rounded-lg border px-0 py-2 text-xs font-black transition-all ${
                      ratingFilter.includes(rating)
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <PanelLabel>Range</PanelLabel>
                <span className="text-[10px] font-semibold text-slate-500">
                  {countRange[0]}-{countRange[1]}
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'From', idx: 0, min: 1, max: Math.max(2, countRange[1] - 1) },
                  {
                    label: 'To',
                    idx: 1,
                    min: Math.max(2, countRange[0] + 1),
                    max: Math.max((previewReviews || []).length, 500),
                  },
                ].map(({ label, idx, min, max }) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <span>{label}</span>
                      <span>{countRange[idx]}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={countRange[idx]}
                      onChange={(e) =>
                        setCountRange((prev) =>
                          idx === 0 ? [Number(e.target.value), prev[1]] : [prev[0], Number(e.target.value)],
                        )
                      }
                      className="w-full accent-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <PanelLabel>ARPU</PanelLabel>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={arpu}
                  onChange={(e) => setArpu(e.target.value)}
                  placeholder="49.99"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <PanelLabel>Cleaning</PanelLabel>
              <div className="mt-2 space-y-2">
                {PIPELINE_OPTIONS.map((option) => {
                  const enabled = !!cleaningOptions[option.key];
                  return (
                    <button
                      key={option.key}
                      onClick={() =>
                        setCleaningOptions((prev) => ({ ...prev, [option.key]: !prev[option.key] }))
                      }
                      className={`flex w-full items-start gap-2 rounded-xl border px-3 py-3 text-left transition-all ${
                        enabled
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          enabled ? 'border-white/15 bg-white text-slate-900' : 'border-slate-200 bg-slate-50 text-transparent'
                        }`}
                      >
                        <Check size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[12px] font-bold ${enabled ? 'text-white' : 'text-slate-900'}`}>
                          {option.label}
                        </p>
                        <p className={`mt-0.5 text-[11px] leading-4 ${enabled ? 'text-slate-300' : 'text-slate-500'}`}>
                          {option.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200 bg-white px-4 py-4">
            {isPreviewMode ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                Preview mode keeps analysis disabled. Filters and review exploration still work.
              </div>
            ) : null}
            <div className="flex justify-end">
              <button
                onClick={handleStartAnalysis}
                disabled={isPreviewMode || filteredReviews.length === 0}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Cpu size={14} />
                {isPreviewMode ? 'Preview Locked' : 'Run Analysis'}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col rounded-[22px] border border-slate-200 bg-white shadow-sm shadow-slate-950/5 md:min-h-0 md:overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[20px] font-black tracking-tight text-slate-950">
                    Review preview
                  </h3>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                    {filteredReviews.length} records
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">
                  Scroll the table inside this card while keeping the menu visible on the side.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activePills.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <span
                      key={pill.key}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${pill.cls}`}
                    >
                      <Icon size={12} />
                      {pill.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white custom-scrollbar md:min-h-0 md:flex-1 md:overflow-auto">
          {filteredReviews.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-10 py-14 text-center">
                <Filter size={24} className="mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-black text-slate-950">No matching rows</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Loosen the tuning parameters on the left to widen the calibration dataset.
                </p>
              </div>
            </div>
          ) : (
            <table className="min-w-[980px] w-full table-fixed border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Row
                  </th>
                  <th className="sticky top-0 z-20 w-[140px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Date
                  </th>
                  <th className="sticky top-0 z-20 w-[180px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Source
                  </th>
                  <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Review
                  </th>
                  <th className="sticky top-0 z-20 w-[150px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Status
                  </th>
                  <th className="sticky top-0 z-20 w-[140px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review, index) => {
                  const score = Number(review?.score) || 3;
                  const tone = getReviewTone(score);

                  return (
                    <tr key={`${review?.source || 'review'}-${index}`} className={`border-b border-slate-200 ${tone.rowClass}`}>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-slate-700">
                        {formatDate(review?.date)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="inline-flex max-w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
                          <span className="truncate">{review?.source || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm leading-6 text-slate-700">
                          {review?.content || '--'}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tone.chipClass}`}
                        >
                          {tone.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, starIndex) => (
                            <Star
                              key={starIndex}
                              size={15}
                              className={
                                starIndex < score
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200'
                              }
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
      </div>
    </div>
  );
};
