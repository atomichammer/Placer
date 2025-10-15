import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Chipboard } from '../types';
import { storageUtils } from '../utils/storage';

interface ProjectSetupProps {
  onCreateProject: (name: string, sawThickness: number, chipboard: Chipboard) => void;
  onLoadProject?: () => void;
}

function ProjectSetup({ onCreateProject, onLoadProject }: ProjectSetupProps) {
  const [projectName, setProjectName] = useState('New Project');
  const [sawThickness, setSawThickness] = useState(3);
  const [selectedChipboard, setSelectedChipboard] = useState<Chipboard | null>(null);
  const [showNewChipboard, setShowNewChipboard] = useState(false);
  const [chipboards, setChipboards] = useState<Chipboard[]>(storageUtils.getChipboards());

  // New chipboard form
  const [newChipboardName, setNewChipboardName] = useState('');
  const [newChipboardWidth, setNewChipboardWidth] = useState(2440);
  const [newChipboardHeight, setNewChipboardHeight] = useState(1220);
  const [newChipboardThickness, setNewChipboardThickness] = useState(18);
  const [newChipboardMargin, setNewChipboardMargin] = useState(20);

  const handleCreateChipboard = () => {
    const newChipboard: Chipboard = {
      id: uuidv4(),
      name: newChipboardName,
      dimensions: {
        width: newChipboardWidth,
        height: newChipboardHeight,
      },
      thickness: newChipboardThickness,
      margin: newChipboardMargin,
    };

    storageUtils.saveChipboard(newChipboard);
    setChipboards(storageUtils.getChipboards());
    setSelectedChipboard(newChipboard);
    setShowNewChipboard(false);
    
    // Reset form
    setNewChipboardName('');
    setNewChipboardWidth(2440);
    setNewChipboardHeight(1220);
    setNewChipboardThickness(18);
    setNewChipboardMargin(20);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedChipboard) {
      onCreateProject(projectName, sawThickness, selectedChipboard);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Placer</h1>
        <p className="text-gray-600 mb-4">2D Rectangle Cutting Optimizer</p>

        {onLoadProject && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <button
              type="button"
              onClick={onLoadProject}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Load Existing Project from CSV
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Saw Thickness (mm)
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
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Chipboard
              </label>
              <button
                type="button"
                onClick={() => setShowNewChipboard(!showNewChipboard)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showNewChipboard ? 'Cancel' : '+ New Chipboard'}
              </button>
            </div>

            {showNewChipboard ? (
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <input
                  type="text"
                  placeholder="Chipboard name"
                  value={newChipboardName}
                  onChange={(e) => setNewChipboardName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Width (mm)</label>
                    <input
                      type="number"
                      value={newChipboardWidth}
                      onChange={(e) => setNewChipboardWidth(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Height (mm)</label>
                    <input
                      type="number"
                      value={newChipboardHeight}
                      onChange={(e) => setNewChipboardHeight(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Thickness (mm)</label>
                    <input
                      type="number"
                      value={newChipboardThickness}
                      onChange={(e) => setNewChipboardThickness(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Margin (mm)</label>
                    <input
                      type="number"
                      value={newChipboardMargin}
                      onChange={(e) => setNewChipboardMargin(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateChipboard}
                  disabled={!newChipboardName}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create Chipboard
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {chipboards.map((chipboard) => (
                  <div
                    key={chipboard.id}
                    onClick={() => setSelectedChipboard(chipboard)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedChipboard?.id === chipboard.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{chipboard.name}</div>
                    <div className="text-sm text-gray-600">
                      {chipboard.dimensions.width} × {chipboard.dimensions.height} mm
                      {chipboard.margin > 0 && ` • Margin: ${chipboard.margin}mm`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!selectedChipboard}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg transition-colors"
          >
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProjectSetup;

