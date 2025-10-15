export interface Dimensions {
  width: number;
  height: number;
}

export interface Chipboard {
  id: string;
  name: string;
  dimensions: Dimensions;
  thickness: number;
  margin: number; // Margin to be cut from edges
}

export interface PartTemplate {
  id: string;
  name: string;
  dimensions: Dimensions;
  canRotate: boolean; // Whether orientation lock is disabled
}

export interface PartGroup {
  id: string;
  name: string;
  parts: PartTemplate[];
}

export interface PvcEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface ProjectPart {
  id: string;
  templateId?: string;
  name: string;
  dimensions: Dimensions;
  canRotate: boolean;
  count: number;
  pvcEdges?: PvcEdges;
}

export interface PlacedPart {
  id: string;
  partId: string;
  name: string;
  dimensions: Dimensions;
  x: number;
  y: number;
  rotated: boolean;
  pvcEdges?: PvcEdges;
}

export interface ChipboardWithParts {
  chipboard: Chipboard;
  parts: PlacedPart[];
  cutLines: CutLine[];
}

export interface CutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
}

export interface PlacementResult {
  chipboards: ChipboardWithParts[];
  statistics: PlacementStatistics;
}

export interface PlacementStatistics {
  totalParts: number;
  totalChipboards: number;
  totalCutLength: number;
  totalCutOperations: number;
  efficiency: number; // Percentage of material used
  totalPvcLength: number; // Total PVC edge banding required in mm
}

export interface Project {
  id: string;
  name: string;
  sawThickness: number;
  chipboard: Chipboard;
  parts: ProjectPart[];
  placementResult?: PlacementResult;
}

