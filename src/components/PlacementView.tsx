import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlacementResult, PlacedPart, ProjectPart } from '../types';
import ChipboardVisualization from './ChipboardVisualization';
import Statistics from './Statistics';
import { recalculateCutLines, recalculateStatistics } from '../utils/cutOptimization';
import { recalculateRemainders } from '../utils/remainderCalculation';
import { exportToPDF } from '../utils/pdfExport';

interface PlacementViewProps {
  result: PlacementResult;
  sawThickness: number;
  projectName: string;
  projectParts: ProjectPart[];
  onResultUpdate?: (result: PlacementResult) => void;
}

function PlacementView({ result, sawThickness, projectName, projectParts, onResultUpdate }: PlacementViewProps) {
  const { t } = useTranslation();
  const [selectedChipboardIndex, setSelectedChipboardIndex] = useState(0);
  const [localResult, setLocalResult] = useState(result);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedRemainderIndex, setSelectedRemainderIndex] = useState<number | null>(null);

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

  const handleRecalculateLayout = () => {
    // Recalculate cut lines and remainders for all chipboards
    const newChipboards = localResult.chipboards.map((chipboardData) => {
      const newCutLines = recalculateCutLines(
        chipboardData.parts,
        chipboardData.chipboard,
        sawThickness
      );
      
      const newRemainders = recalculateRemainders(
        chipboardData.parts,
        chipboardData.chipboard,
        sawThickness
      );
      
      return {
        ...chipboardData,
        cutLines: newCutLines,
        remainders: newRemainders,
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
              <h2 className="text-2xl font-bold text-white">{t('placementView.title')}</h2>
              <p className="text-purple-100 mt-1">
                {t('placementView.chipboardsUsed', { count: localResult.chipboards.length })} • {t('placementView.interactive')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRecalculateLayout}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-400 transition-colors font-medium flex items-center gap-2"
                title="Recalculate cut lines and remainders after manual part movement"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('placementView.recalculateLayout')}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-4 py-2 bg-white text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export to PDF for printing"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isExporting ? t('placementView.exporting') : t('placementView.exportPdf')}
              </button>
            </div>
          </div>
        </div>

        {localResult.chipboards.length > 1 && (
          <div className="p-4 border-b bg-gray-50">
            <div className="flex gap-2 flex-wrap">
              {localResult.chipboards.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedChipboardIndex(index);
                    setSelectedRemainderIndex(null);
                  }}
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
          <div className="mb-6">
            <ChipboardVisualization
              chipboardWithParts={localResult.chipboards[selectedChipboardIndex]}
              chipboardNumber={selectedChipboardIndex + 1}
              sawThickness={sawThickness}
              onPartsUpdate={(parts) => handlePartsUpdate(selectedChipboardIndex, parts)}
              selectedRemainderIndex={selectedRemainderIndex}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Parts List */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3">{t('placementView.partsList', 'Parts')}</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {localResult.chipboards[selectedChipboardIndex].parts.map((part) => (
                  <div
                    key={part.id}
                    className="p-2 bg-white rounded border border-gray-200 text-sm"
                  >
                    <div className="font-medium">{part.name || `Part ${part.partId}`}</div>
                    <div className="text-gray-600 text-xs">
                      {Math.round(part.dimensions.width)} × {Math.round(part.dimensions.height)} mm
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Remainders List */}
            {localResult.chipboards[selectedChipboardIndex].remainders && 
             localResult.chipboards[selectedChipboardIndex].remainders!.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-3">
                  {t('placementView.remaindersList')} 
                  <span className="text-gray-500 font-normal text-sm ml-2">
                    ({localResult.chipboards[selectedChipboardIndex].remainders!.length})
                  </span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {localResult.chipboards[selectedChipboardIndex].remainders!.map((remainder, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedRemainderIndex(selectedRemainderIndex === idx ? null : idx)}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedRemainderIndex === idx
                          ? 'bg-blue-100 border-blue-400'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-sm">
                        <div className="font-medium text-gray-700">
                          {Math.round(remainder.width)} × {Math.round(remainder.height)} mm
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          Area: {Math.round(remainder.area)} mm²
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          From: {remainder.createdFrom}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlacementView;

