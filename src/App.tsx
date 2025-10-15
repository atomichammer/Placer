import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Project, Chipboard, ProjectPart } from './types';
import ProjectSetup from './components/ProjectSetup';
import PartsManager from './components/PartsManager';
import PlacementView from './components/PlacementView';
import { optimizePlacement } from './utils/placement';

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [showSetup, setShowSetup] = useState(true);

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

  if (!project || showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
        <ProjectSetup onCreateProject={handleCreateProject} />
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
                Chipboard: {project.chipboard.name} | Saw thickness: {project.sawThickness}mm
              </p>
            </div>
            <button
              onClick={handleNewProject}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              New Project
            </button>
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
              <PlacementView result={project.placementResult} />
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
    </div>
  );
}

export default App;

