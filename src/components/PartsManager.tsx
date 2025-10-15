import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ProjectPart, Chipboard, PartFormData } from '../types';

interface PartsManagerProps {
  parts: ProjectPart[];
  chipboard: Chipboard;
  onAddPart: (part: ProjectPart) => void;
  onUpdatePart: (partId: string, part: ProjectPart) => void;
  onDeletePart: (partId: string) => void;
  onRunPlacement: () => void;
  hasPlacement: boolean;
}

function PartsManager({
  parts,
  chipboard,
  onAddPart,
  onUpdatePart,
  onDeletePart,
  onRunPlacement,
  hasPlacement,
}: PartsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<PartFormData>({
    name: '',
    dimensions: { width: 100, height: 100 },
    canRotate: true,
    count: 1,
    pvcEdges: { top: false, right: false, bottom: false, left: false },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate available chipboard dimensions (accounting for margins)
    const availableWidth = chipboard.dimensions.width - 2 * chipboard.margin;
    const availableHeight = chipboard.dimensions.height - 2 * chipboard.margin;
    
    const { width, height } = formData.dimensions;
    
    // Check if part can fit in any orientation
    const fitsNormal = width <= availableWidth && height <= availableHeight;
    const fitsRotated = formData.canRotate && height <= availableWidth && width <= availableHeight;
    
    if (!fitsNormal && !fitsRotated) {
      // Part is too large to fit on the chipboard
      const maxDimension = Math.max(availableWidth, availableHeight);
      const maxPartDimension = Math.max(width, height);
      
      let errorMessage = `Part dimensions (${width} × ${height} mm) are too large for the chipboard!\n`;
      errorMessage += `Available space: ${availableWidth} × ${availableHeight} mm`;
      
      if (maxPartDimension > maxDimension) {
        errorMessage += `\nThe largest dimension (${maxPartDimension} mm) exceeds the chipboard's maximum (${maxDimension} mm).`;
      }
      
      setValidationError(errorMessage);
      return;
    }
    
    // Clear any previous errors
    setValidationError(null);
    
    const part: ProjectPart = {
      id: editingId || uuidv4(),
      ...formData,
      name: formData.name || `Part ${parts.length + 1}`,
    };

    if (editingId) {
      onUpdatePart(editingId, part);
      setEditingId(null);
    } else {
      onAddPart(part);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      dimensions: { width: 100, height: 100 },
      canRotate: true,
      count: 1,
      pvcEdges: { top: false, right: false, bottom: false, left: false },
    });
    setShowAddForm(false);
    setValidationError(null);
  };

  const handleEdit = (part: ProjectPart) => {
    setFormData({
      name: part.name,
      dimensions: { ...part.dimensions },
      canRotate: part.canRotate,
      count: part.count,
      pvcEdges: part.pvcEdges,
    });
    setEditingId(part.id);
    setShowAddForm(true);
    setValidationError(null);
  };

  const updateFormData = (updates: Partial<PartFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setValidationError(null);
  };

  const updateDimensions = (updates: Partial<{ width: number; height: number }>) => {
    setFormData(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, ...updates }
    }));
    setValidationError(null);
  };

  const updatePvcEdges = (updates: Partial<{ top: boolean; right: boolean; bottom: boolean; left: boolean }>) => {
    setFormData(prev => ({
      ...prev,
      pvcEdges: { ...prev.pvcEdges, ...updates }
    }));
  };

  const totalParts = parts.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700">
        <h2 className="text-2xl font-bold text-white">Parts Manager</h2>
        <p className="text-blue-100 mt-1">
          {parts.length} types • {totalParts} total parts
        </p>
      </div>

      <div className="p-6 space-y-4">
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Add Part
          </button>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Part Name (optional)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="e.g., Shelf, Door..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Width (mm)
                </label>
                <input
                  type="number"
                  value={formData.dimensions.width}
                  onChange={(e) => updateDimensions({ width: Number(e.target.value) })}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Height (mm)
                </label>
                <input
                  type="number"
                  value={formData.dimensions.height}
                  onChange={(e) => updateDimensions({ height: Number(e.target.value) })}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={formData.count}
                onChange={(e) => updateFormData({ count: Number(e.target.value) })}
                min="1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="canRotate"
                checked={formData.canRotate}
                onChange={(e) => updateFormData({ canRotate: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="canRotate" className="ml-2 text-sm text-gray-700">
                Allow rotation
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                PVC Edge Banding
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pvc-top"
                    checked={formData.pvcEdges.top}
                    onChange={(e) => updatePvcEdges({ top: e.target.checked })}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="pvc-top" className="ml-2 text-sm text-gray-700">
                    Top
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pvc-right"
                    checked={formData.pvcEdges.right}
                    onChange={(e) => updatePvcEdges({ right: e.target.checked })}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="pvc-right" className="ml-2 text-sm text-gray-700">
                    Right
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pvc-bottom"
                    checked={formData.pvcEdges.bottom}
                    onChange={(e) => updatePvcEdges({ bottom: e.target.checked })}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="pvc-bottom" className="ml-2 text-sm text-gray-700">
                    Bottom
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pvc-left"
                    checked={formData.pvcEdges.left}
                    onChange={(e) => updatePvcEdges({ left: e.target.checked })}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="pvc-left" className="ml-2 text-sm text-gray-700">
                    Left
                  </label>
                </div>
              </div>
            </div>

            {validationError && (
              <div className="bg-red-50 border border-red-400 text-red-800 px-3 py-2 rounded-lg text-sm">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="whitespace-pre-line">{validationError}</div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                {editingId ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setEditingId(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {parts.map((part) => (
            <div
              key={part.id}
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{part.name}</div>
                  <div className="text-sm text-gray-600">
                    {part.dimensions.width} × {part.dimensions.height} mm
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Qty: {part.count} • {part.canRotate ? 'Rotatable' : 'Fixed orientation'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(part)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeletePart(part.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {parts.length > 0 && (
          <button
            onClick={onRunPlacement}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium text-lg shadow-md"
          >
            {hasPlacement ? 'Recalculate Placement' : 'Run Placement'}
          </button>
        )}
      </div>
    </div>
  );
}

export default PartsManager;

