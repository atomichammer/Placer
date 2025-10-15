import { PlacedPart, Chipboard, CutLine, ChipboardWithParts, PlacementStatistics } from '../types';

export function recalculateCutLines(
  parts: PlacedPart[],
  chipboard: Chipboard,
  _sawThickness: number
): CutLine[] {
  if (parts.length === 0) return [];

  const cutLines: CutLine[] = [];
  const minX = chipboard.margin;
  const maxX = chipboard.dimensions.width - chipboard.margin;
  const minY = chipboard.margin;
  const maxY = chipboard.dimensions.height - chipboard.margin;

  // Collect all unique X and Y positions (edges of parts)
  const xPositions = new Set<number>([minX, maxX]);
  const yPositions = new Set<number>([minY, maxY]);

  for (const part of parts) {
    xPositions.add(part.x);
    xPositions.add(part.x + part.dimensions.width);
    yPositions.add(part.y);
    yPositions.add(part.y + part.dimensions.height);
  }

  const sortedX = Array.from(xPositions).sort((a, b) => a - b);
  const sortedY = Array.from(yPositions).sort((a, b) => a - b);

  // Determine which direction to cut first (more divisions = primary direction)
  const useVerticalFirst = sortedX.length >= sortedY.length;

  if (useVerticalFirst) {
    // First: Vertical cuts across entire height
    for (let i = 1; i < sortedX.length - 1; i++) {
      const x = sortedX[i];
      if (isVerticalCutNeeded(x, parts, minY, maxY)) {
        cutLines.push({
          x1: x,
          y1: minY,
          x2: x,
          y2: maxY,
          length: maxY - minY,
        });
      }
    }

    // Second: Horizontal cuts within vertical strips
    for (let i = 0; i < sortedX.length - 1; i++) {
      const xStart = sortedX[i];
      const xEnd = sortedX[i + 1];
      
      for (let j = 1; j < sortedY.length - 1; j++) {
        const y = sortedY[j];
        if (isHorizontalCutNeeded(y, parts, xStart, xEnd)) {
          cutLines.push({
            x1: xStart,
            y1: y,
            x2: xEnd,
            y2: y,
            length: xEnd - xStart,
          });
        }
      }
    }
  } else {
    // First: Horizontal cuts across entire width
    for (let i = 1; i < sortedY.length - 1; i++) {
      const y = sortedY[i];
      if (isHorizontalCutNeeded(y, parts, minX, maxX)) {
        cutLines.push({
          x1: minX,
          y1: y,
          x2: maxX,
          y2: y,
          length: maxX - minX,
        });
      }
    }

    // Second: Vertical cuts within horizontal strips
    for (let i = 0; i < sortedY.length - 1; i++) {
      const yStart = sortedY[i];
      const yEnd = sortedY[i + 1];
      
      for (let j = 1; j < sortedX.length - 1; j++) {
        const x = sortedX[j];
        if (isVerticalCutNeeded(x, parts, yStart, yEnd)) {
          cutLines.push({
            x1: x,
            y1: yStart,
            x2: x,
            y2: yEnd,
            length: yEnd - yStart,
          });
        }
      }
    }
  }

  return cutLines;
}

// Check if a vertical cut at position x is needed between yStart and yEnd
function isVerticalCutNeeded(x: number, parts: PlacedPart[], yStart: number, yEnd: number): boolean {
  // A vertical cut is needed if there are parts on different sides of this line
  let hasLeft = false;
  let hasRight = false;

  for (const part of parts) {
    const partTop = part.y + part.dimensions.height;
    const partRight = part.x + part.dimensions.width;

    // Check if part overlaps with the Y range
    if (part.y < yEnd && partTop > yStart) {
      if (partRight <= x) {
        hasLeft = true;
      }
      if (part.x >= x) {
        hasRight = true;
      }
    }

    if (hasLeft && hasRight) return true;
  }

  return false;
}

// Check if a horizontal cut at position y is needed between xStart and xEnd
function isHorizontalCutNeeded(y: number, parts: PlacedPart[], xStart: number, xEnd: number): boolean {
  // A horizontal cut is needed if there are parts on different sides of this line
  let hasBottom = false;
  let hasTop = false;

  for (const part of parts) {
    const partTop = part.y + part.dimensions.height;
    const partRight = part.x + part.dimensions.width;

    // Check if part overlaps with the X range
    if (part.x < xEnd && partRight > xStart) {
      if (partTop <= y) {
        hasBottom = true;
      }
      if (part.y >= y) {
        hasTop = true;
      }
    }

    if (hasBottom && hasTop) return true;
  }

  return false;
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

