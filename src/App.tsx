import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { Project, Chipboard, ProjectPart, PlacementResult } from './types';
import ProjectSetup from './components/ProjectSetup';
import PartsManager from './components/PartsManager';
import PlacementView from './components/PlacementView';
import ProjectSettings from './components/ProjectSettings';
import LanguageSwitcher from './components/LanguageSwitcher';
import { optimizePlacement } from './utils/placement';
import { exportProjectToCSV, importProjectFromCSV, downloadCSV } from './utils/projectIO';

function App() {
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [showSetup, setShowSetup] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateProject = (
    name: string,
    sawThickness: number,
    chipboard: Chipboard
  ) => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      sawThickness,
      chipboard,
      parts: [],
    };
    setProject(newProject);
    setShowSetup(false);
  };

  const handleAddPart = (part: ProjectPart) => {
    if (!project) return;
    setProject({
      ...project,
      parts: [...project.parts, part],
      placementResult: undefined, // Clear previous results
    });
  };

  const handleUpdatePart = (partId: string, updatedPart: ProjectPart) => {
    if (!project) return;
    setProject({
      ...project,
      parts: project.parts.map(p => p.id === partId ? updatedPart : p),
      placementResult: undefined,
    });
  };

  const handleDeletePart = (partId: string) => {
    if (!project) return;
    setProject({
      ...project,
      parts: project.parts.filter(p => p.id !== partId),
      placementResult: undefined,
    });
  };

  const handleRunPlacement = () => {
    if (!project || project.parts.length === 0) return;
    
    const result = optimizePlacement(
      project.chipboard,
      project.parts,
      project.sawThickness
    );
    
    setProject({
      ...project,
      placementResult: result,
    });
  };

  const handleNewProject = () => {
    setProject(null);
    setShowSetup(true);
  };

  const handleSaveProject = () => {
    if (!project) return;
    
    const csvContent = exportProjectToCSV(project);
    const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleLoadProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const loadedProject = importProjectFromCSV(csvContent, uuidv4());
        setProject(loadedProject);
        setShowSetup(false);
        
        // Clear the file input so the same file can be loaded again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        alert(`Error loading project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateSettings = (sawThickness: number, margin: number) => {
    if (!project) return;

    setProject({
      ...project,
      sawThickness,
      chipboard: {
        ...project.chipboard,
        margin,
      },
      placementResult: undefined, // Clear placement when settings change
    });
  };

  const handlePlacementUpdate = (updatedResult: PlacementResult) => {
    if (!project) return;
    
    setProject({
      ...project,
      placementResult: updatedResult,
    });
  };

  if (!project || showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
        <ProjectSetup 
          onCreateProject={handleCreateProject}
          onLoadProject={handleLoadProject}
        />
        
        {/* Hidden file input for loading projects */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Chipboard: {project.chipboard.name} | Saw: {project.sawThickness}mm | Margin: {project.chipboard.margin}mm
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <LanguageSwitcher />
              <div className="flex gap-2">
              <button
                onClick={handleSaveProject}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                title="Save project to CSV"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {t('app.save')}
              </button>
              <button
                onClick={handleLoadProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                title="Load project from CSV"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t('app.load')}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                title="Project settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('app.settings')}
              </button>
              <button
                onClick={handleNewProject}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Create new project"
              >
                {t('app.newProject')}
              </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <PartsManager
              parts={project.parts}
              chipboard={project.chipboard}
              onAddPart={handleAddPart}
              onUpdatePart={handleUpdatePart}
              onDeletePart={handleDeletePart}
              onRunPlacement={handleRunPlacement}
              hasPlacement={!!project.placementResult}
            />
          </div>
          
          <div className="lg:col-span-2">
            {project.placementResult ? (
              <PlacementView 
                result={project.placementResult}
                sawThickness={project.sawThickness}
                projectName={project.name}
                projectParts={project.parts}
                onResultUpdate={handlePlacementUpdate}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <svg
                  className="mx-auto h-24 w-24 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No placement yet</h3>
                <p className="mt-2 text-gray-600">
                  Add parts to your project and click "Run Placement" to see the optimized layout.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Hidden file input for loading projects */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      {/* Project settings modal */}
      {showSettings && (
        <ProjectSettings
          project={project}
          onUpdate={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;

