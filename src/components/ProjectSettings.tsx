import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../types';

interface ProjectSettingsProps {
  project: Project;
  onUpdate: (sawThickness: number, margin: number) => void;
  onClose: () => void;
}

function ProjectSettings({ project, onUpdate, onClose }: ProjectSettingsProps) {
  const { t } = useTranslation();
  const [sawThickness, setSawThickness] = useState(project.sawThickness);
  const [margin, setMargin] = useState(project.chipboard.margin);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(sawThickness, margin);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{t('projectSettings.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t('projectSettings.close')}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('projectSettings.sawThickness')}
            </label>
            <input
              type="number"
              value={sawThickness}
              onChange={(e) => setSawThickness(Number(e.target.value))}
              min="0"
              step="0.1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('projectSettings.chipboardMargin')}
            </label>
            <input
              type="number"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              min="0"
              step="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('projectSettings.marginHelp')}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {t('projectSettings.saveChanges')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              {t('partsManager.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProjectSettings;

