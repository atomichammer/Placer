import { v4 as uuidv4 } from 'uuid';
import {
  Chipboard,
  ProjectPart,
  PlacedPart,
  ChipboardWithParts,
  PlacementResult,
  CutLine,
  Dimensions,
} from '../types';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PartInstance {
  id: string;
  partId: string;
  name: string;
  dimensions: Dimensions;
  canRotate: boolean;
}

export function optimizePlacement(
  chipboard: Chipboard,
  parts: ProjectPart[],
  sawThickness: number
): PlacementResult {
  // Expand parts based on count
  const partInstances: PartInstance[] = [];
  for (const part of parts) {
    for (let i = 0; i < part.count; i++) {
      partInstances.push({
        id: uuidv4(),
        partId: part.id,
        name: part.name || `Part ${part.id}`,
        dimensions: { ...part.dimensions },
        canRotate: part.canRotate,
      });
    }
  }

  // Sort parts by area (largest first) for better packing
  partInstances.sort((a, b) => {
    const areaA = a.dimensions.width * a.dimensions.height;
    const areaB = b.dimensions.width * b.dimensions.height;
    return areaB - areaA;
  });

  const chipboards: ChipboardWithParts[] = [];
  let remainingParts = [...partInstances];

  while (remainingParts.length > 0) {
    const result = packChipboard(chipboard, remainingParts, sawThickness);
    chipboards.push(result.chipboardWithParts);
    remainingParts = result.remainingParts;
  }

  const statistics = calculateStatistics(chipboards, partInstances.length, chipboard);

  return {
    chipboards,
    statistics,
  };
}

function packChipboard(
  chipboard: Chipboard,
  parts: PartInstance[],
  sawThickness: number
): {
  chipboardWithParts: ChipboardWithParts;
  remainingParts: PartInstance[];
} {
  const availableWidth = chipboard.dimensions.width - 2 * chipboard.margin;
  const availableHeight = chipboard.dimensions.height - 2 * chipboard.margin;

  const placedParts: PlacedPart[] = [];
  const remainingParts: PartInstance[] = [];
  
  // Track existing cut positions for alignment
  const horizontalCuts = new Set<number>([chipboard.margin]);
  const verticalCuts = new Set<number>([chipboard.margin]);
  
  // Free rectangles using guillotine algorithm
  const freeRectangles: Rectangle[] = [
    {
      x: chipboard.margin,
      y: chipboard.margin,
      width: availableWidth,
      height: availableHeight,
    },
  ];

  for (const part of parts) {
    const placement = findBestPlacement(
      part, 
      freeRectangles, 
      sawThickness,
      horizontalCuts,
      verticalCuts
    );
    
    if (placement) {
      placedParts.push({
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: placement.dimensions,
        x: placement.x,
        y: placement.y,
        rotated: placement.rotated,
      });

      // Add new cut positions
      horizontalCuts.add(placement.y);
      horizontalCuts.add(placement.y + placement.dimensions.height);
      verticalCuts.add(placement.x);
      verticalCuts.add(placement.x + placement.dimensions.width);

      // Split the used rectangle
      splitRectangle(freeRectangles, placement.rect, placement, sawThickness);
    } else {
      remainingParts.push(part);
    }
  }

  const cutLines = generateCutLines(placedParts, chipboard, sawThickness);

  return {
    chipboardWithParts: {
      chipboard,
      parts: placedParts,
      cutLines,
    },
    remainingParts,
  };
}

function findBestPlacement(
  part: PartInstance,
  freeRectangles: Rectangle[],
  _sawThickness: number,
  horizontalCuts: Set<number>,
  verticalCuts: Set<number>
): {
  x: number;
  y: number;
  dimensions: Dimensions;
  rotated: boolean;
  rect: Rectangle;
} | null {
  let bestPlacement: {
    x: number;
    y: number;
    dimensions: Dimensions;
    rotated: boolean;
    rect: Rectangle;
    score: number;
  } | null = null;

  const horizontalCutArray = Array.from(horizontalCuts).sort((a, b) => a - b);
  const verticalCutArray = Array.from(verticalCuts).sort((a, b) => a - b);

  for (const rect of freeRectangles) {
    // Try normal orientation
    if (
      part.dimensions.width <= rect.width &&
      part.dimensions.height <= rect.height
    ) {
      // Find aligned position within this rectangle
      const alignedPos = findAlignedPosition(
        rect,
        part.dimensions.width,
        part.dimensions.height,
        horizontalCutArray,
        verticalCutArray
      );
      
      const x = alignedPos.x;
      const y = alignedPos.y;
      
      // Score: prefer smaller rectangles and aligned positions
      const areaScore = rect.width * rect.height;
      const alignmentBonus = (alignedPos.alignmentScore * 1000);
      const score = areaScore - alignmentBonus;
      
      if (!bestPlacement || score < bestPlacement.score) {
        bestPlacement = {
          x,
          y,
          dimensions: { ...part.dimensions },
          rotated: false,
          rect,
          score,
        };
      }
    }

    // Try rotated orientation
    if (
      part.canRotate &&
      part.dimensions.height <= rect.width &&
      part.dimensions.width <= rect.height
    ) {
      // Find aligned position within this rectangle
      const alignedPos = findAlignedPosition(
        rect,
        part.dimensions.height,
        part.dimensions.width,
        horizontalCutArray,
        verticalCutArray
      );
      
      const x = alignedPos.x;
      const y = alignedPos.y;
      
      const areaScore = rect.width * rect.height;
      const alignmentBonus = (alignedPos.alignmentScore * 1000);
      const score = areaScore - alignmentBonus;
      
      if (!bestPlacement || score < bestPlacement.score) {
        bestPlacement = {
          x,
          y,
          dimensions: {
            width: part.dimensions.height,
            height: part.dimensions.width,
          },
          rotated: true,
          rect,
          score,
        };
      }
    }
  }

  return bestPlacement;
}

function findAlignedPosition(
  rect: Rectangle,
  partWidth: number,
  partHeight: number,
  horizontalCuts: number[],
  verticalCuts: number[]
): { x: number; y: number; alignmentScore: number } {
  let bestX = rect.x;
  let bestY = rect.y;
  let alignmentScore = 0;

  // Try to align X position to existing vertical cuts
  for (const cutX of verticalCuts) {
    if (cutX >= rect.x && cutX + partWidth <= rect.x + rect.width) {
      bestX = cutX;
      alignmentScore += 1;
      break;
    }
  }

  // Try to align Y position to existing horizontal cuts
  for (const cutY of horizontalCuts) {
    if (cutY >= rect.y && cutY + partHeight <= rect.y + rect.height) {
      bestY = cutY;
      alignmentScore += 1;
      break;
    }
  }

  return { x: bestX, y: bestY, alignmentScore };
}

function splitRectangle(
  freeRectangles: Rectangle[],
  usedRect: Rectangle,
  placement: { x: number; y: number; dimensions: Dimensions },
  sawThickness: number
): void {
  const index = freeRectangles.indexOf(usedRect);
  if (index === -1) return;

  freeRectangles.splice(index, 1);

  // Guillotine split - create two new rectangles
  const partWidth = placement.dimensions.width + sawThickness;
  const partHeight = placement.dimensions.height + sawThickness;

  // Right rectangle
  const rightWidth = usedRect.width - partWidth;
  if (rightWidth > 0) {
    freeRectangles.push({
      x: placement.x + partWidth,
      y: usedRect.y,
      width: rightWidth,
      height: usedRect.height,
    });
  }

  // Top rectangle
  const topHeight = usedRect.height - partHeight;
  if (topHeight > 0) {
    freeRectangles.push({
      x: usedRect.x,
      y: placement.y + partHeight,
      width: partWidth,
      height: topHeight,
    });
  }
}

function generateCutLines(
  parts: PlacedPart[],
  chipboard: Chipboard,
  _sawThickness: number
): CutLine[] {
  const cutLines: CutLine[] = [];
  const cuts = new Set<string>();

  for (const part of parts) {
    // Vertical cuts
    const leftCut = part.x;
    const rightCut = part.x + part.dimensions.width;

    // Horizontal cuts
    const bottomCut = part.y;
    const topCut = part.y + part.dimensions.height;

    // Add unique cuts
    addCut(cuts, cutLines, {
      x1: leftCut,
      y1: chipboard.margin,
      x2: leftCut,
      y2: chipboard.dimensions.height - chipboard.margin,
    });

    addCut(cuts, cutLines, {
      x1: rightCut,
      y1: chipboard.margin,
      x2: rightCut,
      y2: chipboard.dimensions.height - chipboard.margin,
    });

    addCut(cuts, cutLines, {
      x1: chipboard.margin,
      y1: bottomCut,
      x2: chipboard.dimensions.width - chipboard.margin,
      y2: bottomCut,
    });

    addCut(cuts, cutLines, {
      x1: chipboard.margin,
      y1: topCut,
      x2: chipboard.dimensions.width - chipboard.margin,
      y2: topCut,
    });
  }

  return cutLines;
}

function addCut(
  cuts: Set<string>,
  cutLines: CutLine[],
  line: { x1: number; y1: number; x2: number; y2: number }
): void {
  const key = `${line.x1},${line.y1}-${line.x2},${line.y2}`;
  if (!cuts.has(key)) {
    cuts.add(key);
    const length = Math.sqrt(
      Math.pow(line.x2 - line.x1, 2) + Math.pow(line.y2 - line.y1, 2)
    );
    cutLines.push({ ...line, length });
  }
}

function calculateStatistics(
  chipboards: ChipboardWithParts[],
  totalParts: number,
  chipboard: Chipboard
): {
  totalParts: number;
  totalChipboards: number;
  totalCutLength: number;
  totalCutOperations: number;
  efficiency: number;
} {
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

