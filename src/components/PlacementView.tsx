import { useState, useEffect } from 'react';
import { PlacementResult, PlacedPart } from '../types';
import ChipboardVisualization from './ChipboardVisualization';
import Statistics from './Statistics';

interface PlacementViewProps {
  result: PlacementResult;
  onResultUpdate?: (result: PlacementResult) => void;
}

function PlacementView({ result, onResultUpdate }: PlacementViewProps) {
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

  return (
    <div className="space-y-6">
      <Statistics statistics={localResult.statistics} />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700">
          <h2 className="text-2xl font-bold text-white">Placement Results</h2>
          <p className="text-purple-100 mt-1">
            {localResult.chipboards.length} chipboard{localResult.chipboards.length !== 1 ? 's' : ''} used • Interactive: drag to move, click to select
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
            onPartsUpdate={(parts) => handlePartsUpdate(selectedChipboardIndex, parts)}
          />
        </div>
      </div>
    </div>
  );
}

export default PlacementView;

