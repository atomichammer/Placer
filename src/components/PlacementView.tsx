import { useState } from 'react';
import { PlacementResult } from '../types';
import ChipboardVisualization from './ChipboardVisualization';
import Statistics from './Statistics';

interface PlacementViewProps {
  result: PlacementResult;
}

function PlacementView({ result }: PlacementViewProps) {
  const [selectedChipboardIndex, setSelectedChipboardIndex] = useState(0);

  return (
    <div className="space-y-6">
      <Statistics statistics={result.statistics} />

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-700">
          <h2 className="text-2xl font-bold text-white">Placement Results</h2>
          <p className="text-purple-100 mt-1">
            {result.chipboards.length} chipboard{result.chipboards.length !== 1 ? 's' : ''} used
          </p>
        </div>

        {result.chipboards.length > 1 && (
          <div className="p-4 border-b bg-gray-50">
            <div className="flex gap-2 flex-wrap">
              {result.chipboards.map((_, index) => (
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
            chipboardWithParts={result.chipboards[selectedChipboardIndex]}
            chipboardNumber={selectedChipboardIndex + 1}
          />
        </div>
      </div>
    </div>
  );
}

export default PlacementView;

