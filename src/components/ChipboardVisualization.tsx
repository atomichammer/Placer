import { useEffect, useRef, useState } from 'react';
import { ChipboardWithParts, PlacedPart } from '../types';

interface ChipboardVisualizationProps {
  chipboardWithParts: ChipboardWithParts;
  chipboardNumber: number;
  onPartsUpdate?: (parts: PlacedPart[]) => void;
}

interface DragState {
  partId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

function ChipboardVisualization({ chipboardWithParts, chipboardNumber, onPartsUpdate }: ChipboardVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localParts, setLocalParts] = useState(chipboardWithParts.parts);

  const { chipboard } = chipboardWithParts;

  // Update local parts when props change (e.g., new placement result)
  useEffect(() => {
    setLocalParts(chipboardWithParts.parts);
    setSelectedPartId(null); // Clear selection when result updates
    setDragState(null); // Clear drag state
  }, [chipboardWithParts]);

  const getScaleAndOffset = (canvas: HTMLCanvasElement) => {
    const padding = 40;
    const maxWidth = canvas.width - 2 * padding;
    const maxHeight = canvas.height - 2 * padding;
    
    const scaleX = maxWidth / chipboard.dimensions.width;
    const scaleY = maxHeight / chipboard.dimensions.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - chipboard.dimensions.width * scale) / 2;
    const offsetY = (canvas.height - chipboard.dimensions.height * scale) / 2;

    return { scale, offsetX, offsetY };
  };

  const getCutLineIntersections = (): { x: number; y: number }[] => {
    const horizontalLines = new Set<number>([chipboard.margin]);
    const verticalLines = new Set<number>([chipboard.margin]);

    // Collect all cut line positions
    for (const part of localParts) {
      horizontalLines.add(part.y);
      horizontalLines.add(part.y + part.dimensions.height);
      verticalLines.add(part.x);
      verticalLines.add(part.x + part.dimensions.width);
    }

    // Generate all intersections
    const intersections: { x: number; y: number }[] = [];
    for (const x of verticalLines) {
      for (const y of horizontalLines) {
        if (x >= chipboard.margin && 
            x <= chipboard.dimensions.width - chipboard.margin &&
            y >= chipboard.margin && 
            y <= chipboard.dimensions.height - chipboard.margin) {
          intersections.push({ x, y });
        }
      }
    }

    return intersections;
  };

  const snapToNearestIntersection = (x: number, y: number, partWidth: number, partHeight: number) => {
    const intersections = getCutLineIntersections();
    const snapThreshold = 100; // mm in world coordinates (increased for better snapping)

    let bestSnap = { x, y };
    let bestDistance = Infinity;

    for (const intersection of intersections) {
      // Check if part would fit at this intersection
      const fitsHorizontally = intersection.x >= chipboard.margin && 
                               intersection.x + partWidth <= chipboard.dimensions.width - chipboard.margin;
      const fitsVertically = intersection.y >= chipboard.margin && 
                            intersection.y + partHeight <= chipboard.dimensions.height - chipboard.margin;
      
      if (fitsHorizontally && fitsVertically) {
        const distance = Math.sqrt(
          Math.pow(intersection.x - x, 2) + Math.pow(intersection.y - y, 2)
        );

        if (distance < snapThreshold && distance < bestDistance) {
          bestDistance = distance;
          bestSnap = intersection;
        }
      }
    }

    return bestSnap;
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { scale, offsetX, offsetY } = getScaleAndOffset(canvas);

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

    // Draw cut line grid (faint)
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 0.5;
    const intersections = getCutLineIntersections();
    const drawnLines = new Set<string>();

    for (const intersection of intersections) {
      const lineKeyV = `v${intersection.x}`;
      const lineKeyH = `h${intersection.y}`;

      if (!drawnLines.has(lineKeyV)) {
        drawnLines.add(lineKeyV);
        ctx.beginPath();
        ctx.moveTo(offsetX + intersection.x * scale, offsetY + chipboard.margin * scale);
        ctx.lineTo(offsetX + intersection.x * scale, offsetY + (chipboard.dimensions.height - chipboard.margin) * scale);
        ctx.stroke();
      }

      if (!drawnLines.has(lineKeyH)) {
        drawnLines.add(lineKeyH);
        ctx.beginPath();
        ctx.moveTo(offsetX + chipboard.margin * scale, offsetY + intersection.y * scale);
        ctx.lineTo(offsetX + (chipboard.dimensions.width - chipboard.margin) * scale, offsetY + intersection.y * scale);
        ctx.stroke();
      }
    }

    // Generate colors for parts
    const colors = generateColors(localParts.length);

    // Draw parts
    localParts.forEach((part, index) => {
      const x = offsetX + part.x * scale;
      const y = offsetY + part.y * scale;
      const width = part.dimensions.width * scale;
      const height = part.dimensions.height * scale;

      const isSelected = selectedPartId === part.id;
      const isDragging = dragState?.partId === part.id;

      // Fill part
      ctx.fillStyle = isSelected || isDragging ? colors[index] + 'dd' : colors[index] + 'aa';
      ctx.fillRect(x, y, width, height);

      // Border
      ctx.strokeStyle = isSelected || isDragging ? '#1f2937' : '#6b7280';
      ctx.lineWidth = isSelected || isDragging ? 3 : 1;
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

      // Drag cursor indicator
      if (isDragging) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.setLineDash([]);
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
  };

  useEffect(() => {
    drawCanvas();
  }, [chipboard, localParts, selectedPartId, dragState]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { scale, offsetX, offsetY } = getScaleAndOffset(canvas);

    // Convert to world coordinates
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    // Check which part was clicked (reverse order to prioritize top parts)
    for (let i = localParts.length - 1; i >= 0; i--) {
      const part = localParts[i];
      
      if (worldX >= part.x && 
          worldX <= part.x + part.dimensions.width &&
          worldY >= part.y && 
          worldY <= part.y + part.dimensions.height) {
        
        setSelectedPartId(part.id);
        
        // Start dragging
        setDragState({
          partId: part.id,
          startX: worldX,
          startY: worldY,
          offsetX: worldX - part.x,
          offsetY: worldY - part.y,
        });
        return;
      }
    }

    // Clicked on empty area
    setSelectedPartId(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { scale, offsetX, offsetY } = getScaleAndOffset(canvas);

    // Convert to world coordinates
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    const partIndex = localParts.findIndex(p => p.id === dragState.partId);
    if (partIndex === -1) return;

    const part = localParts[partIndex];

    // Calculate new position
    let newX = worldX - dragState.offsetX;
    let newY = worldY - dragState.offsetY;

    // Clamp to chipboard bounds
    const minPos = chipboard.margin;
    const maxX = chipboard.dimensions.width - chipboard.margin - part.dimensions.width;
    const maxY = chipboard.dimensions.height - chipboard.margin - part.dimensions.height;

    newX = Math.max(minPos, Math.min(maxX, newX));
    newY = Math.max(minPos, Math.min(maxY, newY));

    // Update part position
    const newParts = [...localParts];
    newParts[partIndex] = {
      ...part,
      x: newX,
      y: newY,
    };

    setLocalParts(newParts);
  };

  const handleMouseUp = () => {
    if (!dragState) return;

    // Just stop dragging, don't snap automatically
    // User can use the "Snap to Grid" button if they want
    if (onPartsUpdate) {
      onPartsUpdate(localParts);
    }

    setDragState(null);
    // Keep the part selected so user can snap it
  };

  const handleSnapToGrid = () => {
    if (!selectedPartId) return;

    const partIndex = localParts.findIndex(p => p.id === selectedPartId);
    if (partIndex === -1) return;

    const part = localParts[partIndex];
    
    // Snap to nearest intersection
    const snapped = snapToNearestIntersection(
      part.x,
      part.y,
      part.dimensions.width,
      part.dimensions.height
    );

    const newParts = [...localParts];
    newParts[partIndex] = {
      ...part,
      x: snapped.x,
      y: snapped.y,
    };

    setLocalParts(newParts);
    
    // Notify parent of update
    if (onPartsUpdate) {
      onPartsUpdate(newParts);
    }
  };

  const handleRotatePart = () => {
    if (!selectedPartId) return;

    const partIndex = localParts.findIndex(p => p.id === selectedPartId);
    if (partIndex === -1) return;

    const part = localParts[partIndex];

    // Swap dimensions
    const newWidth = part.dimensions.height;
    const newHeight = part.dimensions.width;

    // Check if rotated part fits
    if (part.x + newWidth > chipboard.dimensions.width - chipboard.margin ||
        part.y + newHeight > chipboard.dimensions.height - chipboard.margin) {
      alert('Cannot rotate: part would exceed chipboard bounds');
      return;
    }

    const newParts = [...localParts];
    newParts[partIndex] = {
      ...part,
      dimensions: { width: newWidth, height: newHeight },
      rotated: !part.rotated,
    };

    setLocalParts(newParts);
    
    if (onPartsUpdate) {
      onPartsUpdate(newParts);
    }
  };

  const selectedPart = localParts.find(p => p.id === selectedPartId);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Chipboard #{chipboardNumber}: {chipboard.name}
        </h3>
        <p className="text-sm text-gray-600">
          {localParts.length} part{localParts.length !== 1 ? 's' : ''} placed • Click to select, drag to move, use "Snap to Grid" button
        </p>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full cursor-move"
          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
        />
      </div>

      {selectedPart && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-blue-900">Selected Part</h4>
            <div className="flex gap-2">
              <button
                onClick={handleSnapToGrid}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                title="Snap to nearest cut line intersection"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Snap to Grid
              </button>
              <button
                onClick={handleRotatePart}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                title="Rotate part 90 degrees"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rotate 90°
              </button>
            </div>
          </div>
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
          {localParts.map((part) => (
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
