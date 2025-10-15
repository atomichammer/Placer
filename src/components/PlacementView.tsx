import { useState, useEffect } from 'react';
import { PlacementResult, PlacedPart } from '../types';
import ChipboardVisualization from './ChipboardVisualization';
import Statistics from './Statistics';
import { recalculateCutLines, recalculateStatistics } from '../utils/cutOptimization';

interface PlacementViewProps {
  result: PlacementResult;
  sawThickness: number;
  onResultUpdate?: (result: PlacementResult) => void;
}

function PlacementView({ result, sawThickness, onResultUpdate }: PlacementViewProps) {
  const [selectedChipboardIndex, setSelectedChipboardIndex] = useState(0);
  const [localResult, setLocalResult] = useState(result);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Statistics statistics={localResult.statistics} />
        </div>
        <button
          onClick={handleRecalculateStats}
          className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 font-medium"
          title="Recalculate cut lines and statistics based on current part positions"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Recalculate Stats
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700">
          <h2 className="text-2xl font-bold text-white">Placement Results</h2>
          <p className="text-purple-100 mt-1">
            {localResult.chipboards.length} chipboard{localResult.chipboards.length !== 1 ? 's' : ''} used • Interactive: drag parts, then snap to grid
          </p>
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

