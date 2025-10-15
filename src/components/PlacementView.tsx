import { useState, useEffect } from 'react';
import { PlacementResult, PlacedPart, ProjectPart } from '../types';
import ChipboardVisualization from './ChipboardVisualization';
import Statistics from './Statistics';
import { recalculateCutLines, recalculateStatistics } from '../utils/cutOptimization';
import { exportToPDF } from '../utils/pdfExport';

interface PlacementViewProps {
  result: PlacementResult;
  sawThickness: number;
  projectName: string;
  projectParts: ProjectPart[];
  onResultUpdate?: (result: PlacementResult) => void;
}

function PlacementView({ result, sawThickness, projectName, projectParts, onResultUpdate }: PlacementViewProps) {
  const [selectedChipboardIndex, setSelectedChipboardIndex] = useState(0);
  const [localResult, setLocalResult] = useState(result);
  const [isExporting, setIsExporting] = useState(false);

  // Update local result when parent result changes (e.g., recalculation)
  useEffect(() => {
    setLocalResult(result);
  }, [result]);

  const handlePartsUpdate = (chipboardIndex: number, updatedParts: PlacedPart[]) => {
    const newChipboards = [...localResult.chipboards];
    newChipboards[chipboardIndex] = {
      ...newChipboards[chipboardIndex],
      parts: updatedParts,
    };

    const newResult = {
      ...localResult,
      chipboards: newChipboards,
    };

    setLocalResult(newResult);
    
    if (onResultUpdate) {
      onResultUpdate(newResult);
    }
  };

  const handleRecalculateStats = () => {
    // Recalculate cut lines for all chipboards
    const newChipboards = localResult.chipboards.map((chipboardData) => {
      const newCutLines = recalculateCutLines(
        chipboardData.parts,
        chipboardData.chipboard,
        sawThickness
      );
      
      return {
        ...chipboardData,
        cutLines: newCutLines,
      };
    });

    // Count total parts
    const totalParts = newChipboards.reduce(
      (sum, board) => sum + board.parts.length,
      0
    );

    // Recalculate statistics
    const newStatistics = recalculateStatistics(
      newChipboards,
      totalParts,
      localResult.chipboards[0].chipboard
    );

    const newResult = {
      ...localResult,
      chipboards: newChipboards,
      statistics: newStatistics,
    };

    setLocalResult(newResult);
    
    if (onResultUpdate) {
      onResultUpdate(newResult);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF(localResult, projectParts, projectName, sawThickness);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Statistics 
        statistics={localResult.statistics}
        onRecalculate={handleRecalculateStats}
      />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Placement Results</h2>
              <p className="text-purple-100 mt-1">
                {localResult.chipboards.length} chipboard{localResult.chipboards.length !== 1 ? 's' : ''} used • Interactive: drag parts, then snap to grid
              </p>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export to PDF for printing"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {localResult.chipboards.length > 1 && (
          <div className="p-4 border-b bg-gray-50">
            <div className="flex gap-2 flex-wrap">
              {localResult.chipboards.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedChipboardIndex(index)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedChipboardIndex === index
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  Chipboard {index + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          <ChipboardVisualization
            chipboardWithParts={localResult.chipboards[selectedChipboardIndex]}
            chipboardNumber={selectedChipboardIndex + 1}
            sawThickness={sawThickness}
            onPartsUpdate={(parts) => handlePartsUpdate(selectedChipboardIndex, parts)}
          />
        </div>
      </div>
    </div>
  );
}

export default PlacementView;

