import { PlacedPart, Chipboard, CutLine, ChipboardWithParts, PlacementStatistics } from '../types';

export function recalculateCutLines(
  parts: PlacedPart[],
  chipboard: Chipboard,
  _sawThickness: number
): CutLine[] {
  const horizontalCuts = new Map<number, { start: number; end: number }[]>();
  const verticalCuts = new Map<number, { start: number; end: number }[]>();

  // Collect all cut positions and their ranges
  for (const part of parts) {
    // Vertical cuts (constant X position)
    const leftX = part.x;
    const rightX = part.x + part.dimensions.width;

    // Horizontal cuts (constant Y position)
    const bottomY = part.y;
    const topY = part.y + part.dimensions.height;

    // Add vertical cuts with their Y ranges
    addCutSegment(verticalCuts, leftX, part.y, part.y + part.dimensions.height);
    addCutSegment(verticalCuts, rightX, part.y, part.y + part.dimensions.height);

    // Add horizontal cuts with their X ranges
    addCutSegment(horizontalCuts, bottomY, part.x, part.x + part.dimensions.width);
    addCutSegment(horizontalCuts, topY, part.x, part.x + part.dimensions.width);
  }

  const cutLines: CutLine[] = [];

  // Process vertical cuts (merge overlapping segments)
  for (const [x, segments] of verticalCuts) {
    if (x < chipboard.margin || x > chipboard.dimensions.width - chipboard.margin) continue;
    
    const merged = mergeSegments(segments);
    for (const segment of merged) {
      const y1 = Math.max(segment.start, chipboard.margin);
      const y2 = Math.min(segment.end, chipboard.dimensions.height - chipboard.margin);
      
      if (y2 > y1) {
        cutLines.push({
          x1: x,
          y1,
          x2: x,
          y2,
          length: y2 - y1,
        });
      }
    }
  }

  // Process horizontal cuts (merge overlapping segments)
  for (const [y, segments] of horizontalCuts) {
    if (y < chipboard.margin || y > chipboard.dimensions.height - chipboard.margin) continue;
    
    const merged = mergeSegments(segments);
    for (const segment of merged) {
      const x1 = Math.max(segment.start, chipboard.margin);
      const x2 = Math.min(segment.end, chipboard.dimensions.width - chipboard.margin);
      
      if (x2 > x1) {
        cutLines.push({
          x1,
          y1: y,
          x2,
          y2: y,
          length: x2 - x1,
        });
      }
    }
  }

  return cutLines;
}

function addCutSegment(
  cuts: Map<number, { start: number; end: number }[]>,
  position: number,
  start: number,
  end: number
): void {
  if (!cuts.has(position)) {
    cuts.set(position, []);
  }
  cuts.get(position)!.push({ start, end });
}

function mergeSegments(segments: { start: number; end: number }[]): { start: number; end: number }[] {
  if (segments.length === 0) return [];

  // Sort by start position
  const sorted = segments.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // If segments overlap or are adjacent, merge them
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function recalculateStatistics(
  chipboards: ChipboardWithParts[],
  totalParts: number,
  chipboard: Chipboard
): PlacementStatistics {
  let totalCutLength = 0;
  let totalCutOperations = 0;
  let totalUsedArea = 0;

  for (const board of chipboards) {
    totalCutOperations += board.cutLines.length;
    totalCutLength += board.cutLines.reduce((sum, cut) => sum + cut.length, 0);
    
    for (const part of board.parts) {
      totalUsedArea += part.dimensions.width * part.dimensions.height;
    }
  }

  const totalAvailableArea =
    chipboards.length *
    (chipboard.dimensions.width - 2 * chipboard.margin) *
    (chipboard.dimensions.height - 2 * chipboard.margin);

  const efficiency = totalAvailableArea > 0 
    ? (totalUsedArea / totalAvailableArea) * 100 
    : 0;

  return {
    totalParts,
    totalChipboards: chipboards.length,
    totalCutLength: Math.round(totalCutLength),
    totalCutOperations,
    efficiency: Math.round(efficiency * 100) / 100,
  };
}

