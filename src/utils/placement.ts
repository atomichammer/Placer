import { v4 as uuidv4 } from 'uuid';
import {
  Chipboard,
  ProjectPart,
  PlacedPart,
  ChipboardWithParts,
  PlacementResult,
  CutLine,
  Dimensions,
  PvcEdges,
} from '../types';

interface PartInstance {
  id: string;
  partId: string;
  name: string;
  dimensions: Dimensions;
  canRotate: boolean;
  pvcEdges?: PvcEdges;
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
        pvcEdges: part.pvcEdges,
      });
    }
  }

  // Sort parts by length first, then width (biggest first)
  // Length = width (horizontal placement), Width = height
  partInstances.sort((a, b) => {
    const lengthA = a.dimensions.width;
    const lengthB = b.dimensions.width;
    if (lengthA !== lengthB) {
      return lengthB - lengthA; // Longer first
    }
    return b.dimensions.height - a.dimensions.height; // Then wider first
  });

  const chipboards: ChipboardWithParts[] = [];
  const remainingParts = [...partInstances];
  const maxChipboards = 1000; // Safety limit to prevent excessive chipboard creation
  let chipboardCount = 0;

  // Process parts using horizontal guillotine algorithm
  while (remainingParts.length > 0 && chipboardCount < maxChipboards) {
    chipboardCount++;
    
    // Get the first (biggest) part
    const firstPart = remainingParts.shift()!;
    
    // Create a new chipboard with this part
    const result = createChipboardHorizontal(
      chipboard,
      firstPart,
      remainingParts,
      sawThickness
    );
    
    chipboards.push(result.chipboardWithParts);
    remainingParts.length = 0;
    remainingParts.push(...result.remainingParts);
  }
  
  // Safety check: if we hit max chipboards, log a warning
  if (chipboardCount >= maxChipboards) {
    console.warn(`Placement algorithm hit maximum chipboard limit (${maxChipboards}). ${remainingParts.length} parts remain unplaced.`);
  }

  const statistics = calculateStatistics(chipboards, partInstances.length, chipboard);

  return {
    chipboards,
    statistics,
  };
}

/**
 * Try to place a part in existing strips' remaining space
 * Returns placement info if successful, null otherwise
 */
function tryPlacePartInStrip(
  chipboardWithParts: ChipboardWithParts,
  part: PartInstance,
  chipboard: Chipboard,
  sawThickness: number
): { placedPart: PlacedPart; cutLines: CutLine[] } | null {
  const existingParts = chipboardWithParts.parts;
  
  // Analyze existing strips and try to fit part in remaining space
  const placement = tryFitInExistingStrips(
    chipboard,
    existingParts,
    part,
    sawThickness
  );
  
  if (placement) {
    const newParts = [...existingParts, placement.placedPart];
    const cutLines = generateCutLines(newParts, chipboard, sawThickness);
    return {
      placedPart: placement.placedPart,
      cutLines,
    };
  }

  return null;
}

/**
 * Create a new chipboard with horizontal placement only
 * Places parts left to right, top to bottom
 */
function createChipboardHorizontal(
  chipboard: Chipboard,
  firstPart: PartInstance,
  remainingParts: PartInstance[],
  sawThickness: number
): {
  chipboardWithParts: ChipboardWithParts;
  remainingParts: PartInstance[];
} {
  const placedParts: PlacedPart[] = [];
  const partsToProcess = [...remainingParts];

  // Validate first part fits within chipboard boundaries
  const firstPartRight = chipboard.margin + firstPart.dimensions.width;
  const firstPartBottom = chipboard.margin + firstPart.dimensions.height;
  const chipboardRight = chipboard.dimensions.width - chipboard.margin;
  const chipboardBottom = chipboard.dimensions.height - chipboard.margin;
  
  if (firstPartRight > chipboardRight || firstPartBottom > chipboardBottom) {
    // First part doesn't fit, return empty chipboard
    return {
      chipboardWithParts: {
        chipboard,
        parts: [],
        cutLines: [],
      },
      remainingParts: [firstPart, ...partsToProcess],
    };
  }

  // Place first part at top-left (no rotation for horizontal placement)
  const firstPlacedPart: PlacedPart = {
    id: firstPart.id,
    partId: firstPart.partId,
    name: firstPart.name,
    dimensions: {
      width: firstPart.dimensions.width,
      height: firstPart.dimensions.height,
    },
    x: chipboard.margin,
    y: chipboard.margin,
    rotated: false,
    canRotate: firstPart.canRotate,
    pvcEdges: firstPart.pvcEdges,
  };

  placedParts.push(firstPlacedPart);

  // Perform guillotine cut horizontally along the part's length (width)
  // Creates two free boards:
  // 1. Right of the part (same height as part, remaining width)
  // 2. Below the part (full width, remaining height)
  
  let freeBoards: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  // Track remainders (unused space) for debugging/analysis
  const remainders: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    area: number;
    createdFrom: string; // Which part created this remainder
  }> = [];

  // Board 1: Right of the part (same height as part)
  const rightX = chipboard.margin + firstPart.dimensions.width + sawThickness;
  const rightY = chipboard.margin;
  const rightWidth = chipboard.dimensions.width - rightX - chipboard.margin;
  const rightHeight = firstPart.dimensions.height;
  
  if (rightWidth > 0 && rightHeight > 0) {
    const rightBoard = {
      x: rightX,
      y: rightY,
      width: rightWidth,
      height: rightHeight,
    };
    freeBoards.push(rightBoard);
    remainders.push({
      ...rightBoard,
      area: rightWidth * rightHeight,
      createdFrom: `First part (${firstPart.name || `Part ${firstPart.id}`}) - Right`,
    });
  }

  // Board 2: Below the part (full width)
  const bottomX = chipboard.margin;
  const bottomY = chipboard.margin + firstPart.dimensions.height + sawThickness;
  const bottomWidth = chipboard.dimensions.width - 2 * chipboard.margin;
  const bottomHeight = chipboard.dimensions.height - bottomY - chipboard.margin;
  
  if (bottomWidth > 0 && bottomHeight > 0) {
    const bottomBoard = {
      x: bottomX,
      y: bottomY,
      width: bottomWidth,
      height: bottomHeight,
    };
    freeBoards.push(bottomBoard);
    remainders.push({
      ...bottomBoard,
      area: bottomWidth * bottomHeight,
      createdFrom: `First part (${firstPart.name || `Part ${firstPart.id}`}) - Bottom`,
    });
  }

  // Process remaining parts
  let maxIterations = 10000; // Safety limit to prevent infinite loops
  let iterationCount = 0;
  
  while (partsToProcess.length > 0 && iterationCount < maxIterations) {
    iterationCount++;
    
    // Filter out free boards that are too small to fit any remaining part
    if (partsToProcess.length > 0) {
      const minPartWidth = Math.min(...partsToProcess.map(p => Math.min(p.dimensions.width, p.canRotate ? p.dimensions.height : Infinity)));
      const minPartHeight = Math.min(...partsToProcess.map(p => Math.min(p.dimensions.height, p.canRotate ? p.dimensions.width : Infinity)));
      
      freeBoards = freeBoards.filter(board => 
        board.width >= minPartWidth && board.height >= minPartHeight
      );
    }
    
    // Limit the number of free boards to prevent memory issues
    // Keep only the largest ones (by area)
    const maxFreeBoards = 1000;
    if (freeBoards.length > maxFreeBoards) {
      freeBoards.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      freeBoards = freeBoards.slice(0, maxFreeBoards);
    }
    
    // If no free boards remain, break
    if (freeBoards.length === 0) {
      break;
    }
    
    // Sort free boards by length (width) first, then height
    freeBoards.sort((a, b) => {
      if (a.width !== b.width) {
        return b.width - a.width; // Longer first
      }
      return b.height - a.height; // Then taller first
    });

    let placed = false;

    // Try to place the first part from remaining list
    for (let i = 0; i < partsToProcess.length; i++) {
      const part = partsToProcess[i];
      let bestBoardIndex = -1;
      let bestRemainder = Infinity;
      let bestOrientation: { width: number; height: number; rotated: boolean } | null = null;

      // Try without rotation
      for (let j = 0; j < freeBoards.length; j++) {
        const board = freeBoards[j];
        if (part.dimensions.width <= board.width && part.dimensions.height <= board.height) {
          // Check boundaries
          const partRight = board.x + part.dimensions.width;
          const partBottom = board.y + part.dimensions.height;
          const chipboardRight = chipboard.dimensions.width - chipboard.margin;
          const chipboardBottom = chipboard.dimensions.height - chipboard.margin;
          
          if (partRight <= chipboardRight && partBottom <= chipboardBottom) {
            // Calculate remainder (unused space)
            const remainder = (board.width - part.dimensions.width) * board.height;
            if (remainder < bestRemainder) {
              bestRemainder = remainder;
              bestBoardIndex = j;
              bestOrientation = { width: part.dimensions.width, height: part.dimensions.height, rotated: false };
            }
          }
        }
      }

      // Try with rotation if allowed
      if (part.canRotate) {
        for (let j = 0; j < freeBoards.length; j++) {
          const board = freeBoards[j];
          // Treat rotated part's width as length
          if (part.dimensions.height <= board.width && part.dimensions.width <= board.height) {
            // Check boundaries
            const partRight = board.x + part.dimensions.height;
            const partBottom = board.y + part.dimensions.width;
            const chipboardRight = chipboard.dimensions.width - chipboard.margin;
            const chipboardBottom = chipboard.dimensions.height - chipboard.margin;
            
            if (partRight <= chipboardRight && partBottom <= chipboardBottom) {
              const remainder = (board.width - part.dimensions.height) * board.height;
              if (remainder < bestRemainder) {
                bestRemainder = remainder;
                bestBoardIndex = j;
                bestOrientation = { width: part.dimensions.height, height: part.dimensions.width, rotated: true };
              }
            }
          }
        }
      }

      // If we found a fit, place the part
      if (bestBoardIndex >= 0 && bestOrientation) {
        const board = freeBoards[bestBoardIndex];
        const placedPart: PlacedPart = {
          id: part.id,
          partId: part.partId,
          name: part.name,
          dimensions: {
            width: bestOrientation.width,
            height: bestOrientation.height,
          },
          x: board.x,
          y: board.y,
          rotated: bestOrientation.rotated,
          canRotate: part.canRotate,
          pvcEdges: bestOrientation.rotated && part.pvcEdges ? {
            top: part.pvcEdges.left,
            right: part.pvcEdges.top,
            bottom: part.pvcEdges.right,
            left: part.pvcEdges.bottom,
          } : part.pvcEdges,
        };

        placedParts.push(placedPart);
        partsToProcess.splice(i, 1);
        placed = true;

        // Remove the consumed board from free list
        freeBoards.splice(bestBoardIndex, 1);

        // Remove the consumed remainder from remainders list (if it exists)
        // Find and remove the remainder that matches this board
        const remainderIndex = remainders.findIndex(r => 
          r.x === board.x && 
          r.y === board.y && 
          r.width === board.width && 
          r.height === board.height
        );
        if (remainderIndex >= 0) {
          remainders.splice(remainderIndex, 1);
        }

        // Create new remainders based on how the part fits in the board
        const widthMatches = Math.abs(bestOrientation.width - board.width) < 0.01;
        const heightMatches = Math.abs(bestOrientation.height - board.height) < 0.01;

        // Case 1: Both dimensions match exactly - no remainders
        if (widthMatches && heightMatches) {
          // No remainders created
        }
        // Case 2: Width matches exactly, height is smaller - remainder below
        else if (widthMatches && !heightMatches) {
          const remainderBelowWidth = board.width;
          const remainderBelowHeight = board.height - bestOrientation.height - sawThickness;
          if (remainderBelowWidth > 0 && remainderBelowHeight > 0) {
            const remainder = {
              x: board.x,
              y: board.y + bestOrientation.height + sawThickness,
              width: remainderBelowWidth,
              height: remainderBelowHeight,
              area: remainderBelowWidth * remainderBelowHeight,
              createdFrom: part.name || `Part ${part.id}`,
            };
            
            remainders.push(remainder);
            freeBoards.push({
              x: remainder.x,
              y: remainder.y,
              width: remainder.width,
              height: remainder.height,
            });
          }
        }
        // Case 3: Height matches exactly, width is smaller - remainder to the right
        else if (!widthMatches && heightMatches) {
          const remainderRightWidth = board.width - bestOrientation.width - sawThickness;
          const remainderRightHeight = board.height;
          if (remainderRightWidth > 0 && remainderRightHeight > 0) {
            const remainder = {
              x: board.x + bestOrientation.width + sawThickness,
              y: board.y,
              width: remainderRightWidth,
              height: remainderRightHeight,
              area: remainderRightWidth * remainderRightHeight,
              createdFrom: part.name || `Part ${part.id}`,
            };
            
            remainders.push(remainder);
            freeBoards.push({
              x: remainder.x,
              y: remainder.y,
              width: remainder.width,
              height: remainder.height,
            });
          }
        }
        // Case 4: Both dimensions are smaller - two remainders (right and below)
        else {
          // Remainder to the right
          const remainderRightWidth = board.width - bestOrientation.width - sawThickness;
          const remainderRightHeight = bestOrientation.height;
          if (remainderRightWidth > 0 && remainderRightHeight > 0) {
            const remainderRight = {
              x: board.x + bestOrientation.width + sawThickness,
              y: board.y,
              width: remainderRightWidth,
              height: remainderRightHeight,
              area: remainderRightWidth * remainderRightHeight,
              createdFrom: part.name || `Part ${part.id}`,
            };
            
            remainders.push(remainderRight);
            freeBoards.push({
              x: remainderRight.x,
              y: remainderRight.y,
              width: remainderRight.width,
              height: remainderRight.height,
            });
          }

          // Remainder below
          const remainderBelowWidth = board.width;
          const remainderBelowHeight = board.height - bestOrientation.height - sawThickness;
          if (remainderBelowWidth > 0 && remainderBelowHeight > 0) {
            const remainderBelow = {
              x: board.x,
              y: board.y + bestOrientation.height + sawThickness,
              width: remainderBelowWidth,
              height: remainderBelowHeight,
              area: remainderBelowWidth * remainderBelowHeight,
              createdFrom: part.name || `Part ${part.id}`,
            };
            
            remainders.push(remainderBelow);
            freeBoards.push({
              x: remainderBelow.x,
              y: remainderBelow.y,
              width: remainderBelow.width,
              height: remainderBelow.height,
            });
          }
        }

        break; // Part placed, restart loop
      }
    }

    // If no part could be placed, break
    if (!placed) {
      break;
    }
  }
  
  // Safety check: if we hit max iterations, log a warning
  if (iterationCount >= maxIterations) {
    console.warn('Placement algorithm hit maximum iteration limit. Some parts may not be placed.');
  }

  const cutLines = generateCutLines(placedParts, chipboard, sawThickness);

  return {
    chipboardWithParts: {
      chipboard,
      parts: placedParts,
      cutLines,
      remainders,
    },
    remainingParts: partsToProcess,
  };
}

/**
 * Try placing the first part in a specific orientation and pack remaining parts
 */
function tryOrientation(
  chipboard: Chipboard,
  firstPart: PartInstance,
  remainingParts: PartInstance[],
  sawThickness: number,
  rotateFirst: boolean
): {
  chipboardWithParts: ChipboardWithParts;
  remainingParts: PartInstance[];
} {
  const placedParts: PlacedPart[] = [];
  const partsToProcess = [...remainingParts];

  // Determine part dimensions
  let partWidth: number;
  let partHeight: number;
  let rotated = rotateFirst;

  if (rotateFirst) {
    partWidth = firstPart.dimensions.height;
    partHeight = firstPart.dimensions.width;
  } else {
    partWidth = firstPart.dimensions.width;
    partHeight = firstPart.dimensions.height;
  }

  let rotatedPvcEdges = firstPart.pvcEdges;
  if (rotated && firstPart.pvcEdges) {
    rotatedPvcEdges = {
      top: firstPart.pvcEdges.left,
      right: firstPart.pvcEdges.top,
      bottom: firstPart.pvcEdges.right,
      left: firstPart.pvcEdges.bottom,
    };
  }

  // Validate first part fits within chipboard boundaries
  const firstPartRight = chipboard.margin + partWidth;
  const firstPartBottom = chipboard.margin + partHeight;
  const chipboardRight = chipboard.dimensions.width - chipboard.margin;
  const chipboardBottom = chipboard.dimensions.height - chipboard.margin;
  
  if (firstPartRight > chipboardRight || firstPartBottom > chipboardBottom) {
    // First part doesn't fit, return empty result
    return {
      chipboardWithParts: {
        chipboard,
        parts: [],
        cutLines: [],
      },
      remainingParts: [firstPart, ...remainingParts],
    };
  }

  const firstPlacedPart: PlacedPart = {
    id: firstPart.id,
    partId: firstPart.partId,
    name: firstPart.name,
    dimensions: {
      width: partWidth,
      height: partHeight,
    },
    x: chipboard.margin,
    y: chipboard.margin,
    rotated,
    canRotate: firstPart.canRotate,
    pvcEdges: rotatedPvcEdges,
  };

  placedParts.push(firstPlacedPart);

  // Create two virtual boards after guillotine cuts
  // First cut: along the longest side of the placed part
  // Second cut: along the shortest side of the placed part
  
  const useHorizontal = partWidth >= partHeight;
  const virtualBoards: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    area: number;
  }> = [];

  if (useHorizontal) {
    // First cut: horizontal (along longest side = width)
    // Second cut: vertical (along shortest side = height)
    // Creates: small board (right) and large board (bottom)
    
    // Small board (right): width = remaining width, height = part height (shortest side)
    const smallX = chipboard.margin + partWidth + sawThickness;
    const smallY = chipboard.margin;
    const smallWidth = Math.max(0, chipboard.dimensions.width - smallX - chipboard.margin);
    const smallHeight = partHeight;
    if (smallWidth > 0 && smallHeight > 0 && smallX + smallWidth <= chipboard.dimensions.width - chipboard.margin) {
      virtualBoards.push({
        x: smallX,
        y: smallY,
        width: smallWidth,
        height: smallHeight,
        area: smallWidth * smallHeight,
      });
    }

    // Large board (bottom): width = full width, height = remaining height
    const largeX = chipboard.margin;
    const largeY = chipboard.margin + partHeight + sawThickness;
    const largeWidth = chipboard.dimensions.width - 2 * chipboard.margin;
    const largeHeight = Math.max(0, chipboard.dimensions.height - largeY - chipboard.margin);
    if (largeWidth > 0 && largeHeight > 0 && largeY + largeHeight <= chipboard.dimensions.height - chipboard.margin) {
      virtualBoards.push({
        x: largeX,
        y: largeY,
        width: largeWidth,
        height: largeHeight,
        area: largeWidth * largeHeight,
      });
    }
  } else {
    // First cut: vertical (along longest side = height)
    // Second cut: horizontal (along shortest side = width)
    // Creates: small board (bottom) and large board (right)
    
    // Small board (bottom): width = part width (shortest side), height = remaining height
    const smallX = chipboard.margin;
    const smallY = chipboard.margin + partHeight + sawThickness;
    const smallWidth = partWidth;
    const smallHeight = Math.max(0, chipboard.dimensions.height - smallY - chipboard.margin);
    if (smallWidth > 0 && smallHeight > 0 && smallY + smallHeight <= chipboard.dimensions.height - chipboard.margin) {
      virtualBoards.push({
        x: smallX,
        y: smallY,
        width: smallWidth,
        height: smallHeight,
        area: smallWidth * smallHeight,
      });
    }

    // Large board (right): width = remaining width, height = full height
    const largeX = chipboard.margin + partWidth + sawThickness;
    const largeY = chipboard.margin;
    const largeWidth = Math.max(0, chipboard.dimensions.width - largeX - chipboard.margin);
    const largeHeight = chipboard.dimensions.height - 2 * chipboard.margin;
    if (largeWidth > 0 && largeHeight > 0 && largeX + largeWidth <= chipboard.dimensions.width - chipboard.margin) {
      virtualBoards.push({
        x: largeX,
        y: largeY,
        width: largeWidth,
        height: largeHeight,
        area: largeWidth * largeHeight,
      });
    }
  }

  // Sort virtual boards by area (smallest first)
  virtualBoards.sort((a, b) => a.area - b.area);

  // Try to place parts in virtual boards, starting with smallest
  for (const virtualBoard of virtualBoards) {
    const result = packVirtualBoard(
      chipboard,
      virtualBoard,
      partsToProcess,
      placedParts,
      sawThickness
    );
    
    // Remove placed parts from partsToProcess
    const placedIds = new Set(result.placedParts.map(p => p.id));
    for (let i = partsToProcess.length - 1; i >= 0; i--) {
      if (placedIds.has(partsToProcess[i].id)) {
        partsToProcess.splice(i, 1);
      }
    }
    
    placedParts.push(...result.placedParts);
  }

  const cutLines = generateCutLines(placedParts, chipboard, sawThickness);

  return {
    chipboardWithParts: {
      chipboard,
      parts: placedParts,
      cutLines,
    },
    remainingParts: partsToProcess,
  };
}

/**
 * Pack parts into a virtual board using recursive guillotine cuts
 * Tries both cut orientations and picks the one with better utilization
 */
function packVirtualBoard(
  chipboard: Chipboard,
  virtualBoard: { x: number; y: number; width: number; height: number },
  parts: PartInstance[],
  existingParts: PlacedPart[],
  sawThickness: number
): {
  placedParts: PlacedPart[];
} {
  if (parts.length === 0) return { placedParts: [] };

  // Try to find the best part to place and best orientation
  const candidates: Array<{
    part: PartInstance;
    partIndex: number;
    orientation: { width: number; height: number; rotated: boolean };
    utilization: number;
    waste: number;
  }> = [];

  // Evaluate all possible placements
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Try both orientations
    const orientations = [
      { width: part.dimensions.width, height: part.dimensions.height, rotated: false },
    ];
    
    if (part.canRotate) {
      orientations.push({
        width: part.dimensions.height,
        height: part.dimensions.width,
        rotated: true,
      });
    }

    for (const orientation of orientations) {
      if (orientation.width <= virtualBoard.width && 
          orientation.height <= virtualBoard.height) {
        // Check if this part fits and doesn't overlap
        const testPart: PlacedPart = {
          id: part.id,
          partId: part.partId,
          name: part.name,
          dimensions: {
            width: orientation.width,
            height: orientation.height,
          },
          x: virtualBoard.x,
          y: virtualBoard.y,
          rotated: orientation.rotated,
          canRotate: part.canRotate,
          pvcEdges: orientation.rotated && part.pvcEdges ? {
            top: part.pvcEdges.left,
            right: part.pvcEdges.top,
            bottom: part.pvcEdges.right,
            left: part.pvcEdges.bottom,
          } : part.pvcEdges,
        };

        // Check boundaries: part must fit within virtual board and chipboard
        const partRight = virtualBoard.x + orientation.width;
        const partBottom = virtualBoard.y + orientation.height;
        const chipboardRightBound = chipboard.dimensions.width - chipboard.margin;
        const chipboardBottomBound = chipboard.dimensions.height - chipboard.margin;
        
        if (partRight <= chipboardRightBound && partBottom <= chipboardBottomBound &&
            !checkOverlap(testPart.x, testPart.y, testPart.dimensions.width, testPart.dimensions.height, existingParts)) {
          // Calculate utilization score
          const partArea = orientation.width * orientation.height;
          const virtualBoardArea = virtualBoard.width * virtualBoard.height;
          const rightWidth = virtualBoard.width - orientation.width - sawThickness;
          const rightHeight = orientation.height;
          const bottomWidth = virtualBoard.width;
          const bottomHeight = virtualBoard.height - orientation.height - sawThickness;
          
          const rightArea = (rightWidth > 0 && rightHeight > 0) ? rightWidth * rightHeight : 0;
          const bottomArea = (bottomWidth > 0 && bottomHeight > 0) ? bottomWidth * bottomHeight : 0;
          const totalWaste = rightArea + bottomArea;
          
          // Utilization = part area / virtual board area (higher is better)
          // Also consider that smaller waste is better
          const utilization = partArea / virtualBoardArea;
          const wasteRatio = totalWaste / virtualBoardArea;
          
          // Calculate how well the part fits the virtual board dimensions
          const widthFit = orientation.width / virtualBoard.width;
          const heightFit = orientation.height / virtualBoard.height;
          const dimensionFit = Math.min(widthFit, heightFit); // Prefer parts that better fill dimensions
          
          // Score: prefer higher utilization, better dimension fit, lower waste ratio, and larger parts
          const score = utilization * 1000 + dimensionFit * 500 - wasteRatio * 100 + partArea / 10000;
          
          candidates.push({
            part,
            partIndex: i,
            orientation,
            utilization: score, // Use score instead of utilization
            waste: totalWaste,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { placedParts: [] };
  }

  // Sort by score (best first)
  candidates.sort((a, b) => b.utilization - a.utilization);

  // Place the best candidate
  const best = candidates[0];
  const placedParts: PlacedPart[] = [];
  const partsToProcess = [...parts];

  // Calculate chipboard boundaries once for reuse
  const chipboardRightBound = chipboard.dimensions.width - chipboard.margin;
  const chipboardBottomBound = chipboard.dimensions.height - chipboard.margin;

  // Validate part placement is within chipboard boundaries
  const partRight = virtualBoard.x + best.orientation.width;
  const partBottom = virtualBoard.y + best.orientation.height;
  
  if (partRight > chipboardRightBound || partBottom > chipboardBottomBound) {
    // Part would exceed boundaries, skip it
    return { placedParts: [] };
  }

  const newPart: PlacedPart = {
    id: best.part.id,
    partId: best.part.partId,
    name: best.part.name,
    dimensions: {
      width: best.orientation.width,
      height: best.orientation.height,
    },
    x: virtualBoard.x,
    y: virtualBoard.y,
    rotated: best.orientation.rotated,
    canRotate: best.part.canRotate,
    pvcEdges: best.orientation.rotated && best.part.pvcEdges ? {
      top: best.part.pvcEdges.left,
      right: best.part.pvcEdges.top,
      bottom: best.part.pvcEdges.right,
      left: best.part.pvcEdges.bottom,
    } : best.part.pvcEdges,
  };

  placedParts.push(newPart);
  partsToProcess.splice(best.partIndex, 1);

  // Create two new virtual boards from remaining space using guillotine cuts
  const newVirtualBoards: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    area: number;
  }> = [];

  // Right rectangle (remaining width after horizontal cut)
  const rightX = virtualBoard.x + best.orientation.width + sawThickness;
  const rightY = virtualBoard.y;
  const rightWidth = Math.max(0, virtualBoard.x + virtualBoard.width - rightX);
  const rightHeight = best.orientation.height;
  
  if (rightWidth > 0 && rightHeight > 0 && rightX + rightWidth <= chipboardRightBound && rightY + rightHeight <= chipboardBottomBound) {
    newVirtualBoards.push({
      x: rightX,
      y: rightY,
      width: rightWidth,
      height: rightHeight,
      area: rightWidth * rightHeight,
    });
  }

  // Bottom rectangle (remaining height after vertical cut)
  const bottomX = virtualBoard.x;
  const bottomY = virtualBoard.y + best.orientation.height + sawThickness;
  const bottomWidth = virtualBoard.width;
  const bottomHeight = Math.max(0, virtualBoard.y + virtualBoard.height - bottomY);
  
  if (bottomWidth > 0 && bottomHeight > 0 && bottomX + bottomWidth <= chipboardRightBound && bottomY + bottomHeight <= chipboardBottomBound) {
    newVirtualBoards.push({
      x: bottomX,
      y: bottomY,
      width: bottomWidth,
      height: bottomHeight,
      area: bottomWidth * bottomHeight,
    });
  }

  // Sort by area (smallest first) and recursively pack
  newVirtualBoards.sort((a, b) => a.area - b.area);
  for (const newVB of newVirtualBoards) {
    const result = packVirtualBoard(
      chipboard,
      newVB,
      partsToProcess,
      [...existingParts, ...placedParts],
      sawThickness
    );
    
    const placedIds = new Set(result.placedParts.map(p => p.id));
    for (let j = partsToProcess.length - 1; j >= 0; j--) {
      if (placedIds.has(partsToProcess[j].id)) {
        partsToProcess.splice(j, 1);
      }
    }
    
    placedParts.push(...result.placedParts);
  }

  return { placedParts };
}

/**
 * Try to fit a part into the current strip's remaining space
 * For horizontal strips: part width <= strip width AND part height <= remaining length
 * For vertical strips: part height <= strip height AND part width <= remaining length
 * Prefers parts with smaller difference between strip dimension and part dimension
 */
function tryFitInCurrentStrip(
  chipboard: Chipboard,
  existingParts: PlacedPart[],
  part: PartInstance,
  isHorizontal: boolean,
  currentX: number,
  currentY: number,
  stripDimension: number,
  sawThickness: number
): PlacedPart | null {
  const availableWidth = chipboard.dimensions.width - 2 * chipboard.margin;
  const availableHeight = chipboard.dimensions.height - 2 * chipboard.margin;

  if (isHorizontal) {
    // Horizontal strip:
    // - Strip width = stripDimension (height of parts in strip, e.g., 365mm)
    // - Remaining length = remaining horizontal space
    const remainingLength = chipboard.dimensions.width - chipboard.margin - currentX;
    
    const candidates: { part: PlacedPart; widthDiff: number }[] = [];
    
    // Try normal orientation
    if (part.dimensions.width <= stripDimension && 
        part.dimensions.height <= remainingLength) {
      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: part.dimensions,
        x: currentX,
        y: currentY,
        rotated: false,
        canRotate: part.canRotate,
        pvcEdges: part.pvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const widthDiff = stripDimension - part.dimensions.width;
        candidates.push({ part: newPart, widthDiff });
      }
    }

    // Try rotated orientation
    if (part.canRotate && 
        part.dimensions.height <= stripDimension && 
        part.dimensions.width <= remainingLength) {
      const rotatedPvcEdges = part.pvcEdges ? {
        top: part.pvcEdges.left,
        right: part.pvcEdges.top,
        bottom: part.pvcEdges.right,
        left: part.pvcEdges.bottom,
      } : undefined;

      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: {
          width: part.dimensions.height,
          height: part.dimensions.width,
        },
        x: currentX,
        y: currentY,
        rotated: true,
        canRotate: part.canRotate,
        pvcEdges: rotatedPvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const widthDiff = stripDimension - part.dimensions.height;
        candidates.push({ part: newPart, widthDiff });
      }
    }

    // Return the candidate with smallest width difference (best fit)
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.widthDiff - b.widthDiff);
      return candidates[0].part;
    }
  } else {
    // Vertical strip:
    // - Strip height = stripDimension (width of parts in strip, e.g., 500mm)
    // - Remaining length = remaining vertical space
    const remainingLength = chipboard.dimensions.height - chipboard.margin - currentY;
    
    const candidates: { part: PlacedPart; heightDiff: number }[] = [];
    
    // Try normal orientation
    if (part.dimensions.height <= stripDimension && 
        part.dimensions.width <= remainingLength) {
      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: part.dimensions,
        x: currentX,
        y: currentY,
        rotated: false,
        canRotate: part.canRotate,
        pvcEdges: part.pvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const heightDiff = stripDimension - part.dimensions.height;
        candidates.push({ part: newPart, heightDiff });
      }
    }

    // Try rotated orientation
    if (part.canRotate && 
        part.dimensions.width <= stripDimension && 
        part.dimensions.height <= remainingLength) {
      const rotatedPvcEdges = part.pvcEdges ? {
        top: part.pvcEdges.left,
        right: part.pvcEdges.top,
        bottom: part.pvcEdges.right,
        left: part.pvcEdges.bottom,
      } : undefined;

      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: {
          width: part.dimensions.height,
          height: part.dimensions.width,
        },
        x: currentX,
        y: currentY,
        rotated: true,
        canRotate: part.canRotate,
        pvcEdges: rotatedPvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const heightDiff = stripDimension - part.dimensions.width;
        candidates.push({ part: newPart, heightDiff });
      }
    }

    // Return the candidate with smallest height difference (best fit)
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.heightDiff - b.heightDiff);
      return candidates[0].part;
    }
  }

  return null;
}

/**
 * Try to fit a part into existing strips' remaining space
 */
function tryFitInExistingStrips(
  chipboard: Chipboard,
  existingParts: PlacedPart[],
  part: PartInstance,
  sawThickness: number
): { placedPart: PlacedPart } | null {
  if (existingParts.length === 0) return null;

  // Group parts into strips (by Y position for horizontal, by X for vertical)
  const horizontalStrips = new Map<number, { y: number; height: number; parts: PlacedPart[]; maxX: number }>();
  const verticalStrips = new Map<number, { x: number; width: number; parts: PlacedPart[]; maxY: number }>();

  for (const placedPart of existingParts) {
    // Check for horizontal strips (same Y and height)
    const hKey = `${placedPart.y}_${placedPart.dimensions.height}`;
    if (!horizontalStrips.has(placedPart.y)) {
      horizontalStrips.set(placedPart.y, {
        y: placedPart.y,
        height: placedPart.dimensions.height,
        parts: [],
        maxX: chipboard.margin,
      });
    }
    const hStrip = horizontalStrips.get(placedPart.y)!;
    hStrip.parts.push(placedPart);
    hStrip.maxX = Math.max(hStrip.maxX, placedPart.x + placedPart.dimensions.width);

    // Check for vertical strips (same X and width)
    const vKey = `${placedPart.x}_${placedPart.dimensions.width}`;
    if (!verticalStrips.has(placedPart.x)) {
      verticalStrips.set(placedPart.x, {
        x: placedPart.x,
        width: placedPart.dimensions.width,
        parts: [],
        maxY: chipboard.margin,
      });
    }
    const vStrip = verticalStrips.get(placedPart.x)!;
    vStrip.parts.push(placedPart);
    vStrip.maxY = Math.max(vStrip.maxY, placedPart.y + placedPart.dimensions.height);
  }

  // Try to fit in horizontal strips
  // For horizontal strips: part width <= strip width (height) AND part height <= remaining length
  const horizontalCandidates: { part: PlacedPart; widthDiff: number }[] = [];
  
  for (const strip of horizontalStrips.values()) {
    const remainingLength = chipboard.dimensions.width - chipboard.margin - strip.maxX;
    if (remainingLength <= 0) continue;
    
    const nextX = strip.maxX + sawThickness;

    // Try normal orientation
    if (part.dimensions.width <= strip.height && 
        part.dimensions.height <= remainingLength) {
      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: part.dimensions,
        x: nextX,
        y: strip.y,
        rotated: false,
        canRotate: part.canRotate,
        pvcEdges: part.pvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const widthDiff = strip.height - part.dimensions.width;
        horizontalCandidates.push({ part: newPart, widthDiff });
      }
    }

    // Try rotated orientation
    if (part.canRotate && 
        part.dimensions.height <= strip.height && 
        part.dimensions.width <= remainingLength) {
      const rotatedPvcEdges = part.pvcEdges ? {
        top: part.pvcEdges.left,
        right: part.pvcEdges.top,
        bottom: part.pvcEdges.right,
        left: part.pvcEdges.bottom,
      } : undefined;

      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: {
          width: part.dimensions.height,
          height: part.dimensions.width,
        },
        x: nextX,
        y: strip.y,
        rotated: true,
        canRotate: part.canRotate,
        pvcEdges: rotatedPvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const widthDiff = strip.height - part.dimensions.height;
        horizontalCandidates.push({ part: newPart, widthDiff });
      }
    }
  }

  // Select the best fit (smallest width difference)
  if (horizontalCandidates.length > 0) {
    horizontalCandidates.sort((a, b) => a.widthDiff - b.widthDiff);
    return { placedPart: horizontalCandidates[0].part };
  }

  // Try to fit in vertical strips
  // For vertical strips: part height <= strip height (width) AND part width <= remaining length
  const verticalCandidates: { part: PlacedPart; heightDiff: number }[] = [];
  
  for (const strip of verticalStrips.values()) {
    const remainingLength = chipboard.dimensions.height - chipboard.margin - strip.maxY;
    if (remainingLength <= 0) continue;
    
    const nextY = strip.maxY + sawThickness;

    // Try normal orientation
    if (part.dimensions.height <= strip.width && 
        part.dimensions.width <= remainingLength) {
      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: part.dimensions,
        x: strip.x,
        y: nextY,
        rotated: false,
        canRotate: part.canRotate,
        pvcEdges: part.pvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const heightDiff = strip.width - part.dimensions.height;
        verticalCandidates.push({ part: newPart, heightDiff });
      }
    }

    // Try rotated orientation
    if (part.canRotate && 
        part.dimensions.width <= strip.width && 
        part.dimensions.height <= remainingLength) {
      const rotatedPvcEdges = part.pvcEdges ? {
        top: part.pvcEdges.left,
        right: part.pvcEdges.top,
        bottom: part.pvcEdges.right,
        left: part.pvcEdges.bottom,
      } : undefined;

      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: {
          width: part.dimensions.height,
          height: part.dimensions.width,
        },
        x: strip.x,
        y: nextY,
        rotated: true,
        canRotate: part.canRotate,
        pvcEdges: rotatedPvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        const heightDiff = strip.width - part.dimensions.width;
        verticalCandidates.push({ part: newPart, heightDiff });
      }
    }
  }

  // Select the best fit (smallest height difference)
  if (verticalCandidates.length > 0) {
    verticalCandidates.sort((a, b) => a.heightDiff - b.heightDiff);
    return { placedPart: verticalCandidates[0].part };
  }

  // If part doesn't fit in existing strips, try to create a new strip in this chipboard
  return tryCreateNewStripInChipboard(chipboard, existingParts, part, sawThickness);
}

/**
 * Try to create a new strip in an existing chipboard for a part
 */
function tryCreateNewStripInChipboard(
  chipboard: Chipboard,
  existingParts: PlacedPart[],
  part: PartInstance,
  sawThickness: number
): { placedPart: PlacedPart } | null {
  if (existingParts.length === 0) return null;

  // Find the next available position for a new strip
  let maxY = chipboard.margin;
  let maxX = chipboard.margin;

  for (const placedPart of existingParts) {
    maxY = Math.max(maxY, placedPart.y + placedPart.dimensions.height);
    maxX = Math.max(maxX, placedPart.x + placedPart.dimensions.width);
  }

  // Try horizontal strip first
  const nextY = maxY + sawThickness;
  const longestDim = Math.max(part.dimensions.width, part.dimensions.height);
  const useHorizontal = part.dimensions.width >= part.dimensions.height;

  if (useHorizontal) {
    // Try horizontal strip
    const stripHeight = part.dimensions.height;
    const stripWidth = part.dimensions.width;

    if (nextY + stripHeight <= chipboard.dimensions.height - chipboard.margin &&
        stripWidth <= chipboard.dimensions.width - 2 * chipboard.margin) {
      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: part.dimensions,
        x: chipboard.margin,
        y: nextY,
        rotated: false,
        canRotate: part.canRotate,
        pvcEdges: part.pvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        return { placedPart: newPart };
      }
    }

    // Try rotated horizontal strip
    if (part.canRotate) {
      const rotatedHeight = part.dimensions.width;
      const rotatedWidth = part.dimensions.height;

      if (nextY + rotatedHeight <= chipboard.dimensions.height - chipboard.margin &&
          rotatedWidth <= chipboard.dimensions.width - 2 * chipboard.margin) {
        const rotatedPvcEdges = part.pvcEdges ? {
          top: part.pvcEdges.left,
          right: part.pvcEdges.top,
          bottom: part.pvcEdges.right,
          left: part.pvcEdges.bottom,
        } : undefined;

        const newPart: PlacedPart = {
          id: part.id,
          partId: part.partId,
          name: part.name,
          dimensions: {
            width: rotatedWidth,
            height: rotatedHeight,
          },
          x: chipboard.margin,
          y: nextY,
          rotated: true,
          canRotate: part.canRotate,
          pvcEdges: rotatedPvcEdges,
        };

        if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
          return { placedPart: newPart };
        }
      }
    }
  } else {
    // Try vertical strip
    const nextX = maxX + sawThickness;
    const stripWidth = part.dimensions.width;
    const stripHeight = part.dimensions.height;

    if (nextX + stripWidth <= chipboard.dimensions.width - chipboard.margin &&
        stripHeight <= chipboard.dimensions.height - 2 * chipboard.margin) {
      const newPart: PlacedPart = {
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: part.dimensions,
        x: nextX,
        y: chipboard.margin,
        rotated: false,
        canRotate: part.canRotate,
        pvcEdges: part.pvcEdges,
      };

      if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
        return { placedPart: newPart };
      }
    }

    // Try rotated vertical strip
    if (part.canRotate) {
      const rotatedWidth = part.dimensions.height;
      const rotatedHeight = part.dimensions.width;

      if (nextX + rotatedWidth <= chipboard.dimensions.width - chipboard.margin &&
          rotatedHeight <= chipboard.dimensions.height - 2 * chipboard.margin) {
        const rotatedPvcEdges = part.pvcEdges ? {
          top: part.pvcEdges.left,
          right: part.pvcEdges.top,
          bottom: part.pvcEdges.right,
          left: part.pvcEdges.bottom,
        } : undefined;

        const newPart: PlacedPart = {
          id: part.id,
          partId: part.partId,
          name: part.name,
          dimensions: {
            width: rotatedWidth,
            height: rotatedHeight,
          },
          x: nextX,
          y: chipboard.margin,
          rotated: true,
          canRotate: part.canRotate,
          pvcEdges: rotatedPvcEdges,
        };

        if (!checkOverlap(newPart.x, newPart.y, newPart.dimensions.width, newPart.dimensions.height, existingParts)) {
          return { placedPart: newPart };
        }
      }
    }
  }

  return null;
}

/**
 * Create the next strip when current strip is full
 */
function createNextStrip(
  chipboard: Chipboard,
  existingParts: PlacedPart[],
  remainingParts: PartInstance[],
  previousWasHorizontal: boolean,
  sawThickness: number,
  availableWidth: number,
  availableHeight: number
): { placedParts: PlacedPart[]; remainingParts: PartInstance[]; nextX: number; nextY: number; stripDimension: number } | null {
  // Find the next available position
  let nextX = chipboard.margin;
  let nextY = chipboard.margin;

  if (previousWasHorizontal) {
    // Find the bottom of the lowest strip
    for (const part of existingParts) {
      nextY = Math.max(nextY, part.y + part.dimensions.height);
    }
    nextY += sawThickness;
  } else {
    // Find the rightmost edge of the rightmost strip
    for (const part of existingParts) {
      nextX = Math.max(nextX, part.x + part.dimensions.width);
    }
    nextX += sawThickness;
  }

  // Find the longest remaining part to start the new strip
  if (remainingParts.length === 0) return null;

  // Sort to find the longest part
  const sortedParts = [...remainingParts].sort((a, b) => {
    const longestA = Math.max(a.dimensions.width, a.dimensions.height);
    const longestB = Math.max(b.dimensions.width, b.dimensions.height);
    return longestB - longestA;
  });

  const longestPart = sortedParts[0];
  const longestDim = Math.max(longestPart.dimensions.width, longestPart.dimensions.height);
  const useHorizontal = longestPart.dimensions.width >= longestPart.dimensions.height;

  let stripDimension: number;
  let partDimension: number;
  let rotated: boolean;

  if (useHorizontal) {
    stripDimension = longestPart.dimensions.width;
    partDimension = longestPart.dimensions.height;
    rotated = false;

    if (nextY + partDimension > chipboard.dimensions.height - chipboard.margin) {
      return null; // No space for new horizontal strip
    }
  } else {
    stripDimension = longestPart.dimensions.height;
    partDimension = longestPart.dimensions.width;
    rotated = true;

    if (nextX + partDimension > chipboard.dimensions.width - chipboard.margin) {
      return null; // No space for new vertical strip
    }
  }

  const placedParts: PlacedPart[] = [];
  let rotatedPvcEdges = longestPart.pvcEdges;
  if (rotated && longestPart.pvcEdges) {
    rotatedPvcEdges = {
      top: longestPart.pvcEdges.left,
      right: longestPart.pvcEdges.top,
      bottom: longestPart.pvcEdges.right,
      left: longestPart.pvcEdges.bottom,
    };
  }

  const firstPlacedPart: PlacedPart = {
    id: longestPart.id,
    partId: longestPart.partId,
    name: longestPart.name,
    dimensions: {
      width: useHorizontal ? stripDimension : partDimension,
      height: useHorizontal ? partDimension : stripDimension,
    },
    x: nextX,
    y: nextY,
    rotated,
    canRotate: longestPart.canRotate,
    pvcEdges: rotatedPvcEdges,
  };

  placedParts.push(firstPlacedPart);
  
  // Remove the longest part from remainingParts
  const longestPartIndex = remainingParts.findIndex(p => p.id === longestPart.id);
  if (longestPartIndex !== -1) {
    remainingParts.splice(longestPartIndex, 1);
  }

  // Update position for next part in strip
  let currentX = useHorizontal ? nextX + stripDimension + sawThickness : nextX;
  let currentY = useHorizontal ? nextY : nextY + stripDimension + sawThickness;

  // Try to fit more parts into this new strip
  for (let i = remainingParts.length - 1; i >= 0; i--) {
    const part = remainingParts[i];
    const placement = tryFitInCurrentStrip(
      chipboard,
      [...existingParts, ...placedParts],
      part,
      useHorizontal,
      currentX,
      currentY,
      stripDimension,
      sawThickness
    );

    if (placement) {
      placedParts.push(placement);
      remainingParts.splice(i, 1);

      if (useHorizontal) {
        currentX = placement.x + placement.dimensions.width + sawThickness;
      } else {
        currentY = placement.y + placement.dimensions.height + sawThickness;
      }
    }
  }

  return {
    placedParts,
    remainingParts,
    nextX: useHorizontal ? chipboard.margin : currentX,
    nextY: useHorizontal ? currentY : chipboard.margin,
    stripDimension,
  };
}

/**
 * Check if a rectangle overlaps with any existing parts
 */
function checkOverlap(
  x: number,
  y: number,
  width: number,
  height: number,
  existingParts: PlacedPart[]
): boolean {
  for (const part of existingParts) {
    // Check if rectangles overlap
    if (
      x < part.x + part.dimensions.width &&
      x + width > part.x &&
      y < part.y + part.dimensions.height &&
      y + height > part.y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Try to place a part in a horizontal strip (existing or new)
 */
function tryPlaceInHorizontalStrip(
  chipboard: Chipboard,
  existingParts: PlacedPart[],
  part: PartInstance,
  sawThickness: number,
  availableWidth: number,
  availableHeight: number
): { placedPart: PlacedPart } | null {
  // Analyze existing strips (group parts by Y position and height)
  // Parts in the same strip have the same Y position and height
  const strips = new Map<string, { y: number; height: number; parts: PlacedPart[] }>();
  
  for (const placedPart of existingParts) {
    const key = `${placedPart.y}_${placedPart.dimensions.height}`;
    if (!strips.has(key)) {
      strips.set(key, {
        y: placedPart.y,
        height: placedPart.dimensions.height,
        parts: [],
      });
    }
    strips.get(key)!.parts.push(placedPart);
  }

  // Try to place in existing strip with matching height
  const partHeights = [part.dimensions.height];
  if (part.canRotate) {
    partHeights.push(part.dimensions.width);
  }

  for (const stripHeight of partHeights) {
    for (const strip of strips.values()) {
      if (strip.height === stripHeight) {
        // Try to place in this strip
        const stripParts = strip.parts.sort((a, b) => a.x - b.x);
        
        // Find the rightmost X position in the strip (right edge of last part + saw thickness)
        let maxX = chipboard.margin;
        if (stripParts.length > 0) {
          const lastPart = stripParts[stripParts.length - 1];
          maxX = lastPart.x + lastPart.dimensions.width + sawThickness;
        }

        const partWidth = part.dimensions.height === stripHeight 
          ? part.dimensions.width 
          : part.dimensions.height;
        const rotated = part.canRotate && part.dimensions.height !== stripHeight;

        // Check if part fits and doesn't overlap with any existing part
        const newPartRight = maxX + partWidth;
        if (newPartRight <= chipboard.dimensions.width - chipboard.margin) {
          // Verify no overlap with any existing parts
          if (checkOverlap(maxX, strip.y, partWidth, stripHeight, existingParts)) {
            continue;
          }
          // Rotate PVC edges if needed
          let rotatedPvcEdges = part.pvcEdges;
          if (rotated && part.pvcEdges) {
            rotatedPvcEdges = {
              top: part.pvcEdges.left,
              right: part.pvcEdges.top,
              bottom: part.pvcEdges.right,
              left: part.pvcEdges.bottom,
            };
          }

          return {
            placedPart: {
              id: part.id,
              partId: part.partId,
              name: part.name,
              dimensions: {
                width: partWidth,
                height: stripHeight,
              },
              x: maxX,
              y: strip.y,
              rotated,
              pvcEdges: rotatedPvcEdges,
            },
          };
        }
      }
    }
  }

  // Try to create a new strip at the bottom
  let maxY = chipboard.margin;
  for (const placedPart of existingParts) {
    maxY = Math.max(maxY, placedPart.y + placedPart.dimensions.height);
  }

  // Add saw thickness if there are existing parts
  if (existingParts.length > 0) {
    maxY += sawThickness;
  }

  // Try each possible height
  for (const stripHeight of partHeights) {
    if (maxY + stripHeight <= chipboard.dimensions.height - chipboard.margin) {
      const partWidth = part.dimensions.height === stripHeight 
        ? part.dimensions.width 
        : part.dimensions.height;
      const rotated = part.canRotate && part.dimensions.height !== stripHeight;

      if (partWidth <= availableWidth) {
        // Check for overlap with existing parts
        if (checkOverlap(chipboard.margin, maxY, partWidth, stripHeight, existingParts)) {
          continue;
        }

        // Rotate PVC edges if needed
        let rotatedPvcEdges = part.pvcEdges;
        if (rotated && part.pvcEdges) {
          rotatedPvcEdges = {
            top: part.pvcEdges.left,
            right: part.pvcEdges.top,
            bottom: part.pvcEdges.right,
            left: part.pvcEdges.bottom,
          };
        }

        return {
          placedPart: {
            id: part.id,
            partId: part.partId,
            name: part.name,
            dimensions: {
              width: partWidth,
              height: stripHeight,
            },
            x: chipboard.margin,
            y: maxY,
            rotated,
            canRotate: part.canRotate,
            pvcEdges: rotatedPvcEdges,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Try to place a part in a vertical strip (existing or new)
 */
function tryPlaceInVerticalStrip(
  chipboard: Chipboard,
  existingParts: PlacedPart[],
  part: PartInstance,
  sawThickness: number,
  availableWidth: number,
  availableHeight: number
): { placedPart: PlacedPart } | null {
  // Analyze existing strips (group parts by X position and width)
  // Parts in the same strip have the same X position and width
  const strips = new Map<string, { x: number; width: number; parts: PlacedPart[] }>();
  
  for (const placedPart of existingParts) {
    const key = `${placedPart.x}_${placedPart.dimensions.width}`;
    if (!strips.has(key)) {
      strips.set(key, {
        x: placedPart.x,
        width: placedPart.dimensions.width,
        parts: [],
      });
    }
    strips.get(key)!.parts.push(placedPart);
  }

  // Try to place in existing strip with matching width
  const partWidths = [part.dimensions.width];
  if (part.canRotate) {
    partWidths.push(part.dimensions.height);
  }

  for (const stripWidth of partWidths) {
    for (const strip of strips.values()) {
      if (strip.width === stripWidth) {
        // Try to place in this strip
        const stripParts = strip.parts.sort((a, b) => a.y - b.y);
        
        // Find the bottommost Y position in the strip (bottom edge of last part + saw thickness)
        let maxY = chipboard.margin;
        if (stripParts.length > 0) {
          const lastPart = stripParts[stripParts.length - 1];
          maxY = lastPart.y + lastPart.dimensions.height + sawThickness;
        }

        const partHeight = part.dimensions.width === stripWidth 
          ? part.dimensions.height 
          : part.dimensions.width;
        const rotated = part.canRotate && part.dimensions.width !== stripWidth;

        // Check if part fits and doesn't overlap with any existing part
        const newPartBottom = maxY + partHeight;
        if (newPartBottom <= chipboard.dimensions.height - chipboard.margin) {
          // Verify no overlap with any existing parts
          if (checkOverlap(strip.x, maxY, stripWidth, partHeight, existingParts)) {
            continue;
          }
          // Rotate PVC edges if needed
          let rotatedPvcEdges = part.pvcEdges;
          if (rotated && part.pvcEdges) {
            rotatedPvcEdges = {
              top: part.pvcEdges.left,
              right: part.pvcEdges.top,
              bottom: part.pvcEdges.right,
              left: part.pvcEdges.bottom,
            };
          }

          return {
            placedPart: {
              id: part.id,
              partId: part.partId,
              name: part.name,
              dimensions: {
                width: stripWidth,
                height: partHeight,
              },
              x: strip.x,
              y: maxY,
              rotated,
              pvcEdges: rotatedPvcEdges,
            },
          };
        }
      }
    }
  }

  // Try to create a new strip on the right
  let maxX = chipboard.margin;
  for (const placedPart of existingParts) {
    maxX = Math.max(maxX, placedPart.x + placedPart.dimensions.width);
  }

  // Add saw thickness if there are existing parts
  if (existingParts.length > 0) {
    maxX += sawThickness;
  }

  // Try each possible width
  for (const stripWidth of partWidths) {
    if (maxX + stripWidth <= chipboard.dimensions.width - chipboard.margin) {
      const partHeight = part.dimensions.width === stripWidth 
        ? part.dimensions.height 
        : part.dimensions.width;
      const rotated = part.canRotate && part.dimensions.width !== stripWidth;

      if (partHeight <= availableHeight) {
        // Check for overlap with existing parts
        if (checkOverlap(maxX, chipboard.margin, stripWidth, partHeight, existingParts)) {
          continue;
        }

        // Rotate PVC edges if needed
        let rotatedPvcEdges = part.pvcEdges;
        if (rotated && part.pvcEdges) {
          rotatedPvcEdges = {
            top: part.pvcEdges.left,
            right: part.pvcEdges.top,
            bottom: part.pvcEdges.right,
            left: part.pvcEdges.bottom,
          };
        }

        return {
          placedPart: {
            id: part.id,
            partId: part.partId,
            name: part.name,
            dimensions: {
              width: stripWidth,
              height: partHeight,
            },
            x: maxX,
            y: chipboard.margin,
            rotated,
            pvcEdges: rotatedPvcEdges,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Pack chipboard using linear cut optimization (strip-based approach)
 * Parts are grouped into strips of the same height to minimize cuts
 */
function packChipboardLinear(
  chipboard: Chipboard,
  parts: PartInstance[],
  sawThickness: number
): {
  chipboardWithParts: ChipboardWithParts;
  remainingParts: PartInstance[];
} {
  const availableWidth = chipboard.dimensions.width - 2 * chipboard.margin;
  const availableHeight = chipboard.dimensions.height - 2 * chipboard.margin;

  // Try both horizontal and vertical strip orientations
  const horizontalResult = packWithHorizontalStrips(
    chipboard,
    parts,
    sawThickness,
    availableWidth,
    availableHeight
  );
  const verticalResult = packWithVerticalStrips(
    chipboard,
    parts,
    sawThickness,
    availableWidth,
    availableHeight
  );

  // Choose the better result (more parts placed or better efficiency)
  const horizontalPlaced = horizontalResult.chipboardWithParts.parts.length;
  const verticalPlaced = verticalResult.chipboardWithParts.parts.length;
  const horizontalEfficiency = horizontalPlaced / parts.length;
  const verticalEfficiency = verticalPlaced / parts.length;

  if (horizontalEfficiency > verticalEfficiency || 
      (horizontalEfficiency === verticalEfficiency && 
       horizontalPlaced > verticalPlaced)) {
    return horizontalResult;
  }
  return verticalResult;
}

/**
 * Pack parts using horizontal strips (rows)
 * All parts in a strip share the same height and are packed horizontally
 */
function packWithHorizontalStrips(
  chipboard: Chipboard,
  parts: PartInstance[],
  sawThickness: number,
  availableWidth: number,
  availableHeight: number
): {
  chipboardWithParts: ChipboardWithParts;
  remainingParts: PartInstance[];
} {
  const placedParts: PlacedPart[] = [];
  const remainingParts: PartInstance[] = [...parts];

  // Group parts by possible heights (considering rotation)
  // Each part can belong to multiple groups if it can be rotated
  const heightGroups = new Map<number, PartInstance[]>();
  
  for (const part of remainingParts) {
    // Add part to group for its normal height
    const normalHeight = part.dimensions.height;
    if (!heightGroups.has(normalHeight)) {
      heightGroups.set(normalHeight, []);
    }
    heightGroups.get(normalHeight)!.push(part);
    
    // If rotatable, also add to group for rotated height
    if (part.canRotate) {
      const rotatedHeight = part.dimensions.width;
      if (!heightGroups.has(rotatedHeight)) {
        heightGroups.set(rotatedHeight, []);
      }
      heightGroups.get(rotatedHeight)!.push(part);
    }
  }

  // Sort heights in descending order (larger strips first)
  const sortedHeights = Array.from(heightGroups.keys()).sort((a, b) => b - a);

  let currentY = chipboard.margin;

  // Process each height group
  for (const stripHeight of sortedHeights) {
    if (currentY + stripHeight > chipboard.dimensions.height - chipboard.margin) {
      break; // No more space for strips
    }

    const partsForHeight = heightGroups.get(stripHeight)!;
    // Filter to only parts that are still available
    const availablePartsForHeight = partsForHeight.filter(p => remainingParts.includes(p));
    
    if (availablePartsForHeight.length === 0) continue;
    
    const strip = createHorizontalStrip(
      availablePartsForHeight,
      stripHeight,
      availableWidth,
      sawThickness,
      remainingParts
    );

    if (strip.parts.length === 0) continue;

    // Place parts in the strip
    let currentX = chipboard.margin;
    for (let i = 0; i < strip.parts.length; i++) {
      const part = strip.parts[i];
      const partWidth = part.dimensions.width;
      const partHeight = part.dimensions.height;
      let rotated = false;

      // Determine if we need to rotate
      if (part.canRotate && partHeight !== stripHeight) {
        // Part needs to be rotated to match strip height
        if (part.dimensions.width === stripHeight) {
          rotated = true;
        }
      }

      const finalWidth = rotated ? partHeight : partWidth;
      const finalHeight = rotated ? partWidth : partHeight;

      if (currentX + finalWidth > chipboard.dimensions.width - chipboard.margin) {
        // This part doesn't fit, skip it
        continue;
      }

      // Rotate PVC edges if needed
      let rotatedPvcEdges = part.pvcEdges;
      if (rotated && part.pvcEdges) {
        rotatedPvcEdges = {
          top: part.pvcEdges.left,
          right: part.pvcEdges.top,
          bottom: part.pvcEdges.right,
          left: part.pvcEdges.bottom,
        };
      }

      placedParts.push({
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: {
          width: finalWidth,
          height: finalHeight,
        },
        x: currentX,
        y: currentY,
        rotated,
        pvcEdges: rotatedPvcEdges,
      });

      // Remove from remaining parts
      const index = remainingParts.indexOf(part);
      if (index !== -1) {
        remainingParts.splice(index, 1);
      }

      // Move X position: add part width + saw thickness (except for last part)
      currentX += finalWidth;
      if (i < strip.parts.length - 1) {
        currentX += sawThickness;
      }
    }

    // Move to next strip (add saw thickness only if we placed parts)
    if (strip.parts.length > 0) {
      currentY += stripHeight;
      // Add saw thickness for the cut between strips (if there's more space)
      if (currentY + sawThickness <= chipboard.dimensions.height - chipboard.margin) {
        currentY += sawThickness;
      }
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

/**
 * Pack parts using vertical strips (columns)
 * All parts in a strip share the same width and are packed vertically
 */
function packWithVerticalStrips(
  chipboard: Chipboard,
  parts: PartInstance[],
  sawThickness: number,
  availableWidth: number,
  availableHeight: number
): {
  chipboardWithParts: ChipboardWithParts;
  remainingParts: PartInstance[];
} {
  const placedParts: PlacedPart[] = [];
  const remainingParts: PartInstance[] = [...parts];

  // Group parts by possible widths (considering rotation)
  const widthGroups = new Map<number, PartInstance[]>();
  
  for (const part of remainingParts) {
    // Add part to group for its normal width
    const normalWidth = part.dimensions.width;
    if (!widthGroups.has(normalWidth)) {
      widthGroups.set(normalWidth, []);
    }
    widthGroups.get(normalWidth)!.push(part);
    
    // If rotatable, also add to group for rotated width
    if (part.canRotate) {
      const rotatedWidth = part.dimensions.height;
      if (!widthGroups.has(rotatedWidth)) {
        widthGroups.set(rotatedWidth, []);
      }
      widthGroups.get(rotatedWidth)!.push(part);
    }
  }

  // Sort widths in descending order
  const sortedWidths = Array.from(widthGroups.keys()).sort((a, b) => b - a);

  let currentX = chipboard.margin;

  // Process each width group
  for (const stripWidth of sortedWidths) {
    if (currentX + stripWidth > chipboard.dimensions.width - chipboard.margin) {
      break;
    }

    const partsForWidth = widthGroups.get(stripWidth)!;
    // Filter to only parts that are still available
    const availablePartsForWidth = partsForWidth.filter(p => remainingParts.includes(p));
    
    if (availablePartsForWidth.length === 0) continue;
    
    const strip = createVerticalStrip(
      availablePartsForWidth,
      stripWidth,
      availableHeight,
      sawThickness,
      remainingParts
    );

    if (strip.parts.length === 0) continue;

    // Place parts in the strip
    let currentY = chipboard.margin;
    for (let i = 0; i < strip.parts.length; i++) {
      const part = strip.parts[i];
      const partWidth = part.dimensions.width;
      const partHeight = part.dimensions.height;
      let rotated = false;

      // Determine if we need to rotate
      if (part.canRotate && partWidth !== stripWidth) {
        if (part.dimensions.height === stripWidth) {
          rotated = true;
        }
      }

      const finalWidth = rotated ? partHeight : partWidth;
      const finalHeight = rotated ? partWidth : partHeight;

      if (currentY + finalHeight > chipboard.dimensions.height - chipboard.margin) {
        continue;
      }

      // Rotate PVC edges if needed
      let rotatedPvcEdges = part.pvcEdges;
      if (rotated && part.pvcEdges) {
        rotatedPvcEdges = {
          top: part.pvcEdges.left,
          right: part.pvcEdges.top,
          bottom: part.pvcEdges.right,
          left: part.pvcEdges.bottom,
        };
      }

      placedParts.push({
        id: part.id,
        partId: part.partId,
        name: part.name,
        dimensions: {
          width: finalWidth,
          height: finalHeight,
        },
        x: currentX,
        y: currentY,
        rotated,
        pvcEdges: rotatedPvcEdges,
      });

      const index = remainingParts.indexOf(part);
      if (index !== -1) {
        remainingParts.splice(index, 1);
      }

      // Move Y position: add part height + saw thickness (except for last part)
      currentY += finalHeight;
      if (i < strip.parts.length - 1) {
        currentY += sawThickness;
      }
    }

    // Move to next strip (add saw thickness only if we placed parts)
    if (strip.parts.length > 0) {
      currentX += stripWidth;
      // Add saw thickness for the cut between strips (if there's more space)
      if (currentX + sawThickness <= chipboard.dimensions.width - chipboard.margin) {
        currentX += sawThickness;
      }
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

/**
 * Create a horizontal strip by selecting parts that fit the strip height
 * Uses bin packing (First Fit Decreasing) to maximize strip usage
 */
function createHorizontalStrip(
  candidates: PartInstance[],
  stripHeight: number,
  availableWidth: number,
  sawThickness: number,
  remainingParts: PartInstance[]
): { parts: PartInstance[] } {
  const strip: PartInstance[] = [];
  let usedWidth = 0;

  // Filter candidates to only those that are still available and can fit this strip
  const validCandidates = candidates.filter(part => {
    if (!remainingParts.includes(part)) return false;
    
    // Check if part can fit in this strip (normal or rotated)
    return part.dimensions.height === stripHeight || 
           (part.canRotate && part.dimensions.width === stripHeight);
  });

  // Sort by width (descending) for better packing
  const sorted = validCandidates.sort((a, b) => {
    const widthA = a.dimensions.height === stripHeight ? a.dimensions.width : a.dimensions.height;
    const widthB = b.dimensions.height === stripHeight ? b.dimensions.width : b.dimensions.height;
    return widthB - widthA;
  });

  for (const part of sorted) {
    // Determine part width for this strip
    const partWidth = part.dimensions.height === stripHeight 
      ? part.dimensions.width 
      : part.dimensions.height; // rotated

    // Account for saw thickness between parts
    const widthNeeded = usedWidth === 0 ? partWidth : partWidth + sawThickness;

    if (usedWidth + widthNeeded <= availableWidth) {
      strip.push(part);
      usedWidth += widthNeeded;
    }
  }

  return { parts: strip };
}

/**
 * Create a vertical strip by selecting parts that fit the strip width
 */
function createVerticalStrip(
  candidates: PartInstance[],
  stripWidth: number,
  availableHeight: number,
  sawThickness: number,
  remainingParts: PartInstance[]
): { parts: PartInstance[] } {
  const strip: PartInstance[] = [];
  let usedHeight = 0;

  // Filter candidates to only those that are still available and can fit this strip
  const validCandidates = candidates.filter(part => {
    if (!remainingParts.includes(part)) return false;
    
    // Check if part can fit in this strip (normal or rotated)
    return part.dimensions.width === stripWidth || 
           (part.canRotate && part.dimensions.height === stripWidth);
  });

  // Sort by height (descending) for better packing
  const sorted = validCandidates.sort((a, b) => {
    const heightA = a.dimensions.width === stripWidth ? a.dimensions.height : a.dimensions.width;
    const heightB = b.dimensions.width === stripWidth ? b.dimensions.height : b.dimensions.width;
    return heightB - heightA;
  });

  for (const part of sorted) {
    // Determine part height for this strip
    const partHeight = part.dimensions.width === stripWidth 
      ? part.dimensions.height 
      : part.dimensions.width; // rotated

    // Account for saw thickness between parts
    const heightNeeded = usedHeight === 0 ? partHeight : partHeight + sawThickness;

    if (usedHeight + heightNeeded <= availableHeight) {
      strip.push(part);
      usedHeight += heightNeeded;
    }
  }

  return { parts: strip };
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
  totalPvcLength: number;
} {
  let totalCutLength = 0;
  let totalCutOperations = 0;
  let totalUsedArea = 0;
  let totalPvcLength = 0;

  for (const board of chipboards) {
    totalCutOperations += board.cutLines.length;
    totalCutLength += board.cutLines.reduce((sum, cut) => sum + cut.length, 0);
    
    for (const part of board.parts) {
      totalUsedArea += part.dimensions.width * part.dimensions.height;
      
      // Calculate PVC edge length for this part
      if (part.pvcEdges) {
        if (part.pvcEdges.top) totalPvcLength += part.dimensions.width;
        if (part.pvcEdges.bottom) totalPvcLength += part.dimensions.width;
        if (part.pvcEdges.left) totalPvcLength += part.dimensions.height;
        if (part.pvcEdges.right) totalPvcLength += part.dimensions.height;
      }
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
    totalPvcLength: Math.round(totalPvcLength),
  };
}

