import { PlacedPart, Chipboard, Remainder } from '../types';

/**
 * Recalculate remainders based on current part positions
 * Follows realistic cutting pattern:
 * 1. First perform horizontal cuts (creating horizontal strips)
 * 2. For each horizontal strip, perform vertical cuts along part edges only within that strip
 * 3. Each strip is processed separately
 */
export function recalculateRemainders(
  parts: PlacedPart[],
  chipboard: Chipboard,
  sawThickness: number
): Remainder[] {
  if (parts.length === 0) {
    // If no parts, the entire usable area is one remainder
    const usableWidth = chipboard.dimensions.width - 2 * chipboard.margin;
    const usableHeight = chipboard.dimensions.height - 2 * chipboard.margin;
    if (usableWidth > 0 && usableHeight > 0) {
      return [{
        x: chipboard.margin,
        y: chipboard.margin,
        width: usableWidth,
        height: usableHeight,
        area: usableWidth * usableHeight,
        createdFrom: 'Empty board',
      }];
    }
    return [];
  }

  const remainders: Remainder[] = [];
  const margin = chipboard.margin;
  const maxX = chipboard.dimensions.width - margin;
  const maxY = chipboard.dimensions.height - margin;

  // Step 1: Collect all Y coordinates for horizontal cuts (strip boundaries)
  const yCoords = new Set<number>([margin, maxY]);
  for (const part of parts) {
    yCoords.add(part.y);
    yCoords.add(part.y + part.dimensions.height);
  }
  const sortedY = Array.from(yCoords).sort((a, b) => a - b);

  // Step 2: Process each horizontal strip separately
  for (let stripIdx = 0; stripIdx < sortedY.length - 1; stripIdx++) {
    const stripTop = sortedY[stripIdx];
    const stripBottom = sortedY[stripIdx + 1];
    const stripHeight = stripBottom - stripTop;

    // Skip if strip height is too small
    if (stripHeight <= 0) continue;

    // Find all parts that overlap with this horizontal strip
    const partsInStrip: PlacedPart[] = [];
    for (const part of parts) {
      const partTop = part.y;
      const partBottom = part.y + part.dimensions.height;
      
      // Check if part overlaps with this strip
      if (partTop < stripBottom && partBottom > stripTop) {
        partsInStrip.push(part);
      }
    }

    // Step 3: Collect X coordinates for vertical cuts within this strip only
    const xCoords = new Set<number>([margin, maxX]);
    for (const part of partsInStrip) {
      xCoords.add(part.x);
      xCoords.add(part.x + part.dimensions.width);
    }
    const sortedX = Array.from(xCoords).sort((a, b) => a - b);

    // Step 4: Process each vertical segment within this strip
    for (let segIdx = 0; segIdx < sortedX.length - 1; segIdx++) {
      const segLeft = sortedX[segIdx];
      const segRight = sortedX[segIdx + 1];
      const segWidth = segRight - segLeft;

      // Skip if segment width is too small
      if (segWidth <= 0) continue;

      // Check if this segment is free (not occupied by any part in this strip)
      let isFree = true;
      for (const part of partsInStrip) {
        const partLeft = part.x;
        const partRight = part.x + part.dimensions.width;

        // Check if part overlaps with this segment
        if (partLeft < segRight && partRight > segLeft) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        // Calculate remainder dimensions accounting for saw thickness
        const isLeftEdge = segLeft === margin;
        const isRightEdge = segRight === maxX;
        const isTopEdge = stripTop === margin;
        const isBottomEdge = stripBottom === maxY;

        let remainderX = segLeft;
        let remainderY = stripTop;
        let remainderWidth = segWidth;
        let remainderHeight = stripHeight;

        // Adjust for saw thickness on vertical cuts (between segments)
        if (!isLeftEdge) {
          remainderX += sawThickness;
          remainderWidth -= sawThickness;
        }
        if (!isRightEdge && remainderWidth > sawThickness) {
          remainderWidth -= sawThickness;
        }

        // Adjust for saw thickness on horizontal cuts (between strips)
        if (!isTopEdge) {
          remainderY += sawThickness;
          remainderHeight -= sawThickness;
        }
        if (!isBottomEdge && remainderHeight > sawThickness) {
          remainderHeight -= sawThickness;
        }

        if (remainderWidth > 0 && remainderHeight > 0) {
          remainders.push({
            x: remainderX,
            y: remainderY,
            width: remainderWidth,
            height: remainderHeight,
            area: remainderWidth * remainderHeight,
            createdFrom: 'Recalculated',
          });
        }
      }
    }
  }

  return remainders.filter(r => r.width > 0 && r.height > 0);
}

