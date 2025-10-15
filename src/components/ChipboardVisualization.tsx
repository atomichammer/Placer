import { useEffect, useRef, useState } from 'react';
import { ChipboardWithParts } from '../types';

interface ChipboardVisualizationProps {
  chipboardWithParts: ChipboardWithParts;
  chipboardNumber: number;
}

function ChipboardVisualization({ chipboardWithParts, chipboardNumber }: ChipboardVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const { chipboard, parts } = chipboardWithParts;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scale to fit canvas
    const padding = 40;
    const maxWidth = canvas.width - 2 * padding;
    const maxHeight = canvas.height - 2 * padding;
    
    const scaleX = maxWidth / chipboard.dimensions.width;
    const scaleY = maxHeight / chipboard.dimensions.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - chipboard.dimensions.width * scale) / 2;
    const offsetY = (canvas.height - chipboard.dimensions.height * scale) / 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw chipboard background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(
      offsetX,
      offsetY,
      chipboard.dimensions.width * scale,
      chipboard.dimensions.height * scale
    );

    // Draw chipboard border
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      offsetX,
      offsetY,
      chipboard.dimensions.width * scale,
      chipboard.dimensions.height * scale
    );

    // Draw margin area if exists
    if (chipboard.margin > 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        offsetX + chipboard.margin * scale,
        offsetY + chipboard.margin * scale,
        (chipboard.dimensions.width - 2 * chipboard.margin) * scale,
        (chipboard.dimensions.height - 2 * chipboard.margin) * scale
      );
      ctx.setLineDash([]);
    }

    // Generate colors for parts
    const colors = generateColors(parts.length);

    // Draw parts
    parts.forEach((part, index) => {
      const x = offsetX + part.x * scale;
      const y = offsetY + part.y * scale;
      const width = part.dimensions.width * scale;
      const height = part.dimensions.height * scale;

      // Fill part
      ctx.fillStyle = selectedPartId === part.id ? colors[index] + 'dd' : colors[index] + 'aa';
      ctx.fillRect(x, y, width, height);

      // Border
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = selectedPartId === part.id ? 3 : 1;
      ctx.strokeRect(x, y, width, height);

      // Label
      ctx.fillStyle = '#000000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const text = part.name || part.id.slice(0, 8);
      const maxTextWidth = width - 10;
      const textWidth = ctx.measureText(text).width;
      
      if (textWidth <= maxTextWidth && height > 20) {
        ctx.fillText(text, x + width / 2, y + height / 2 - 8);
        ctx.font = '10px sans-serif';
        ctx.fillText(
          `${Math.round(part.dimensions.width)}×${Math.round(part.dimensions.height)}`,
          x + width / 2,
          y + height / 2 + 8
        );
      }

      // Rotation indicator
      if (part.rotated) {
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('↻', x + 10, y + 15);
      }
    });

    // Draw dimensions
    ctx.fillStyle = '#374151';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${chipboard.dimensions.width} mm`,
      canvas.width / 2,
      offsetY + chipboard.dimensions.height * scale + 25
    );
    ctx.save();
    ctx.translate(offsetX - 25, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${chipboard.dimensions.height} mm`, 0, 0);
    ctx.restore();
  }, [chipboard, parts, selectedPartId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 40;
    const maxWidth = canvas.width - 2 * padding;
    const maxHeight = canvas.height - 2 * padding;
    
    const scaleX = maxWidth / chipboard.dimensions.width;
    const scaleY = maxHeight / chipboard.dimensions.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - chipboard.dimensions.width * scale) / 2;
    const offsetY = (canvas.height - chipboard.dimensions.height * scale) / 2;

    // Check which part was clicked
    for (const part of parts) {
      const partX = offsetX + part.x * scale;
      const partY = offsetY + part.y * scale;
      const partWidth = part.dimensions.width * scale;
      const partHeight = part.dimensions.height * scale;

      if (x >= partX && x <= partX + partWidth && y >= partY && y <= partY + partHeight) {
        setSelectedPartId(selectedPartId === part.id ? null : part.id);
        return;
      }
    }

    setSelectedPartId(null);
  };

  const selectedPart = parts.find(p => p.id === selectedPartId);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Chipboard #{chipboardNumber}: {chipboard.name}
        </h3>
        <p className="text-sm text-gray-600">
          {parts.length} part{parts.length !== 1 ? 's' : ''} placed
        </p>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onClick={handleCanvasClick}
          className="w-full cursor-pointer"
        />
      </div>

      {selectedPart && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Selected Part</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Name:</span>{' '}
              <span className="font-medium">{selectedPart.name}</span>
            </div>
            <div>
              <span className="text-gray-600">ID:</span>{' '}
              <span className="font-mono text-xs">{selectedPart.id.slice(0, 8)}</span>
            </div>
            <div>
              <span className="text-gray-600">Dimensions:</span>{' '}
              <span className="font-medium">
                {Math.round(selectedPart.dimensions.width)} × {Math.round(selectedPart.dimensions.height)} mm
              </span>
            </div>
            <div>
              <span className="text-gray-600">Position:</span>{' '}
              <span className="font-medium">
                ({Math.round(selectedPart.x)}, {Math.round(selectedPart.y)})
              </span>
            </div>
            {selectedPart.rotated && (
              <div className="col-span-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ↻ Rotated 90°
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Parts List</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {parts.map((part) => (
            <div
              key={part.id}
              onClick={() => setSelectedPartId(selectedPartId === part.id ? null : part.id)}
              className={`p-2 rounded cursor-pointer transition-colors ${
                selectedPartId === part.id
                  ? 'bg-blue-100 border border-blue-300'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{part.name}</span>
                <span className="text-xs text-gray-600">
                  {Math.round(part.dimensions.width)} × {Math.round(part.dimensions.height)} mm
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function generateColors(count: number): string[] {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
}

export default ChipboardVisualization;

