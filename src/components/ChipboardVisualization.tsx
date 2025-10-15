import { useEffect, useRef, useState } from 'react';
import { ChipboardWithParts, PlacedPart } from '../types';

interface ChipboardVisualizationProps {
  chipboardWithParts: ChipboardWithParts;
  chipboardNumber: number;
  sawThickness: number;
  onPartsUpdate?: (parts: PlacedPart[]) => void;
}

interface DragState {
  partId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

function ChipboardVisualization({ chipboardWithParts, chipboardNumber, sawThickness, onPartsUpdate }: ChipboardVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localParts, setLocalParts] = useState(chipboardWithParts.parts);
  const previousPartsLengthRef = useRef(chipboardWithParts.parts.length);
  const [editedX, setEditedX] = useState<string>('');
  const [editedY, setEditedY] = useState<string>('');

  const { chipboard } = chipboardWithParts;

  // Update local parts when props change (e.g., new placement result)
  useEffect(() => {
    const newPartsLength = chipboardWithParts.parts.length;
    const partsLengthChanged = newPartsLength !== previousPartsLengthRef.current;
    
    setLocalParts(chipboardWithParts.parts);
    
    // Only clear selection if it's a completely new result (different number of parts)
    // Don't clear if it's just position updates from manual adjustments
    if (partsLengthChanged) {
      setSelectedPartId(null);
      setDragState(null);
      previousPartsLengthRef.current = newPartsLength;
    }
  }, [chipboardWithParts]);

  // Update edited coordinates when selected part changes
  useEffect(() => {
    if (selectedPartId) {
      const part = localParts.find(p => p.id === selectedPartId);
      if (part) {
        setEditedX(Math.round(part.x).toString());
        setEditedY(Math.round(part.y).toString());
      }
    } else {
      setEditedX('');
      setEditedY('');
    }
  }, [selectedPartId, localParts]);

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

  const getCutLineIntersections = (excludePartId?: string): { x: number; y: number }[] => {
    const horizontalLines = new Set<number>([chipboard.margin]);
    const verticalLines = new Set<number>([chipboard.margin]);

    // Collect all cut line positions (excluding the specified part if provided)
    // Include saw thickness to account for the kerf between parts
    for (const part of localParts) {
      if (excludePartId && part.id === excludePartId) {
        continue; // Skip this part's cut lines
      }
      // Vertical lines (constant X): left and right edges
      verticalLines.add(part.x);
      verticalLines.add(part.x + part.dimensions.width + sawThickness);
      // Horizontal lines (constant Y): bottom and top edges
      horizontalLines.add(part.y);
      horizontalLines.add(part.y + part.dimensions.height + sawThickness);
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

    console.log('Generated intersections (with saw thickness):', intersections.length);
    return intersections;
  };

  const snapToNearestIntersection = (x: number, y: number, partWidth: number, partHeight: number, excludePartId?: string) => {
    const intersections = getCutLineIntersections(excludePartId);

    let bestSnap = { x, y };
    let bestDistance = Infinity;

    // Find the nearest valid intersection
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

        // Always snap to the nearest valid intersection
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSnap = intersection;
        }
      }
    }

    console.log('Snap from:', { x, y }, 'to:', bestSnap, 'distance:', bestDistance);
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

    // Draw actual cut lines (pale red) - these are used for statistics
    if (chipboardWithParts.cutLines && chipboardWithParts.cutLines.length > 0) {
      ctx.strokeStyle = '#fca5a5'; // pale red (red-300)
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      for (const cutLine of chipboardWithParts.cutLines) {
        ctx.beginPath();
        ctx.moveTo(offsetX + cutLine.x1 * scale, offsetY + cutLine.y1 * scale);
        ctx.lineTo(offsetX + cutLine.x2 * scale, offsetY + cutLine.y2 * scale);
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
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('↻', x + 18, y + 25);
      }

      // PVC edge indicators (dark gray lines inside the part)
      if (part.pvcEdges) {
        ctx.strokeStyle = '#4b5563'; // gray-600
        ctx.lineWidth = 3;
        ctx.setLineDash([]);

        const inset = 6; // Distance from edge in pixels

        if (part.pvcEdges.top) {
          ctx.beginPath();
          ctx.moveTo(x + inset, y + inset);
          ctx.lineTo(x + width - inset, y + inset);
          ctx.stroke();
        }
        if (part.pvcEdges.right) {
          ctx.beginPath();
          ctx.moveTo(x + width - inset, y + inset);
          ctx.lineTo(x + width - inset, y + height - inset);
          ctx.stroke();
        }
        if (part.pvcEdges.bottom) {
          ctx.beginPath();
          ctx.moveTo(x + inset, y + height - inset);
          ctx.lineTo(x + width - inset, y + height - inset);
          ctx.stroke();
        }
        if (part.pvcEdges.left) {
          ctx.beginPath();
          ctx.moveTo(x + inset, y + inset);
          ctx.lineTo(x + inset, y + height - inset);
          ctx.stroke();
        }
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
    if (!selectedPartId) {
      console.log('No part selected');
      return;
    }

    const partIndex = localParts.findIndex(p => p.id === selectedPartId);
    if (partIndex === -1) {
      console.log('Part not found in localParts');
      return;
    }

    const part = localParts[partIndex];
    console.log('Current part position:', part.x, part.y);
    
    // Snap to nearest intersection (excluding this part's own cut lines)
    const snapped = snapToNearestIntersection(
      part.x,
      part.y,
      part.dimensions.width,
      part.dimensions.height,
      selectedPartId // Exclude this part's cut lines
    );

    console.log('Snapped position:', snapped.x, snapped.y);

    // Check if position actually changed
    if (snapped.x === part.x && snapped.y === part.y) {
      console.log('Part is already at an intersection');
      return;
    }

    const newParts = [...localParts];
    newParts[partIndex] = {
      ...part,
      x: snapped.x,
      y: snapped.y,
    };

    console.log('Updating parts...');
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

  const handleApplyCoordinates = () => {
    if (!selectedPartId) return;

    const partIndex = localParts.findIndex(p => p.id === selectedPartId);
    if (partIndex === -1) return;

    const part = localParts[partIndex];
    const newX = parseFloat(editedX);
    const newY = parseFloat(editedY);

    // Validate inputs
    if (isNaN(newX) || isNaN(newY)) {
      alert('Please enter valid numbers for coordinates');
      return;
    }

    // Check bounds
    const minX = chipboard.margin;
    const maxX = chipboard.dimensions.width - chipboard.margin - part.dimensions.width;
    const minY = chipboard.margin;
    const maxY = chipboard.dimensions.height - chipboard.margin - part.dimensions.height;

    if (newX < minX || newX > maxX || newY < minY || newY > maxY) {
      alert(`Coordinates out of bounds. Valid range:\nX: ${minX} to ${Math.round(maxX)}\nY: ${minY} to ${Math.round(maxY)}`);
      return;
    }

    const newParts = [...localParts];
    newParts[partIndex] = {
      ...part,
      x: newX,
      y: newY,
    };

    setLocalParts(newParts);
    
    if (onPartsUpdate) {
      onPartsUpdate(newParts);
    }
  };

  const handlePvcEdgeChange = (edge: 'top' | 'right' | 'bottom' | 'left', checked: boolean) => {
    if (!selectedPartId) return;
    
    const partIndex = localParts.findIndex(p => p.id === selectedPartId);
    if (partIndex === -1) return;

    const newParts = [...localParts];
    const currentEdges = newParts[partIndex].pvcEdges || { top: false, right: false, bottom: false, left: false };
    
    newParts[partIndex] = {
      ...newParts[partIndex],
      pvcEdges: {
        ...currentEdges,
        [edge]: checked,
      },
    };

    setLocalParts(newParts);
    
    if (onPartsUpdate) {
      onPartsUpdate(newParts);
    }
  };

  const selectedPart = localParts.find(p => p.id === selectedPartId);

  return (
    <div className="space-y-4" data-chipboard-canvas>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Chipboard #{chipboardNumber}: {chipboard.name}
        </h3>
        <p className="text-sm text-gray-600">
          {localParts.length} part{localParts.length !== 1 ? 's' : ''} placed • Click to select, drag to move, use "Snap to Grid" button
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-gray-300"></span> Grid lines
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-red-300"></span> Actual cuts ({chipboardWithParts.cutLines.length})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-1 bg-gray-600"></span> PVC edges (inner outline)
          </span>
        </div>
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
            <div className="col-span-2">
              <label className="block text-gray-600 mb-1">Position (mm):</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">X:</label>
                  <input
                    type="number"
                    value={editedX}
                    onChange={(e) => setEditedX(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="X"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Y:</label>
                  <input
                    type="number"
                    value={editedY}
                    onChange={(e) => setEditedY(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Y"
                  />
                </div>
                <button
                  onClick={handleApplyCoordinates}
                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 self-end"
                  title="Apply new coordinates"
                >
                  Apply
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-gray-600 mb-2 text-sm">PVC Edge Banding:</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-pvc-top"
                    checked={selectedPart.pvcEdges?.top || false}
                    onChange={(e) => handlePvcEdgeChange('top', e.target.checked)}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="edit-pvc-top" className="ml-2 text-sm text-gray-700">
                    Top
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-pvc-right"
                    checked={selectedPart.pvcEdges?.right || false}
                    onChange={(e) => handlePvcEdgeChange('right', e.target.checked)}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="edit-pvc-right" className="ml-2 text-sm text-gray-700">
                    Right
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-pvc-bottom"
                    checked={selectedPart.pvcEdges?.bottom || false}
                    onChange={(e) => handlePvcEdgeChange('bottom', e.target.checked)}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="edit-pvc-bottom" className="ml-2 text-sm text-gray-700">
                    Bottom
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-pvc-left"
                    checked={selectedPart.pvcEdges?.left || false}
                    onChange={(e) => handlePvcEdgeChange('left', e.target.checked)}
                    className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="edit-pvc-left" className="ml-2 text-sm text-gray-700">
                    Left
                  </label>
                </div>
              </div>
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
