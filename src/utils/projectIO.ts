import { Project, Chipboard, ProjectPart } from '../types';

export function exportProjectToCSV(project: Project): string {
  const lines: string[] = [];

  // Project metadata section
  lines.push('# PROJECT');
  lines.push(`Name,${escapeCsvValue(project.name)}`);
  lines.push(`SawThickness,${project.sawThickness}`);
  lines.push('');

  // Chipboard section
  lines.push('# CHIPBOARD');
  lines.push(`ID,${project.chipboard.id}`);
  lines.push(`Name,${escapeCsvValue(project.chipboard.name)}`);
  lines.push(`Width,${project.chipboard.dimensions.width}`);
  lines.push(`Height,${project.chipboard.dimensions.height}`);
  lines.push(`Thickness,${project.chipboard.thickness}`);
  lines.push(`Margin,${project.chipboard.margin}`);
  lines.push('');

  // Parts section
  lines.push('# PARTS');
  lines.push('ID,Name,Width,Height,CanRotate,Count');
  
  for (const part of project.parts) {
    lines.push([
      part.id,
      escapeCsvValue(part.name),
      part.dimensions.width,
      part.dimensions.height,
      part.canRotate ? 'true' : 'false',
      part.count,
    ].join(','));
  }

  return lines.join('\n');
}

export function importProjectFromCSV(csvContent: string, projectId: string): Project {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let section = '';
  const projectData: Partial<Project> = { id: projectId };
  const chipboardData: Partial<Chipboard> = {};
  const parts: ProjectPart[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for section headers
    if (line.startsWith('# ')) {
      section = line.substring(2);
      continue;
    }

    // Skip comments and empty lines
    if (line.startsWith('#') || line.length === 0) {
      continue;
    }

    const values = parseCsvLine(line);

    if (section === 'PROJECT') {
      if (values[0] === 'Name') projectData.name = values[1];
      if (values[0] === 'SawThickness') projectData.sawThickness = parseFloat(values[1]);
    } else if (section === 'CHIPBOARD') {
      if (values[0] === 'ID') chipboardData.id = values[1];
      if (values[0] === 'Name') chipboardData.name = values[1];
      if (values[0] === 'Width') {
        if (!chipboardData.dimensions) chipboardData.dimensions = { width: 0, height: 0 };
        chipboardData.dimensions.width = parseFloat(values[1]);
      }
      if (values[0] === 'Height') {
        if (!chipboardData.dimensions) chipboardData.dimensions = { width: 0, height: 0 };
        chipboardData.dimensions.height = parseFloat(values[1]);
      }
      if (values[0] === 'Thickness') chipboardData.thickness = parseFloat(values[1]);
      if (values[0] === 'Margin') chipboardData.margin = parseFloat(values[1]);
    } else if (section === 'PARTS') {
      // Skip header line
      if (values[0] === 'ID') continue;

      // Parse part data
      const part: ProjectPart = {
        id: values[0],
        name: values[1],
        dimensions: {
          width: parseFloat(values[2]),
          height: parseFloat(values[3]),
        },
        canRotate: values[4] === 'true',
        count: parseInt(values[5], 10),
      };
      parts.push(part);
    }
  }

  // Validate required fields
  if (!projectData.name || !projectData.sawThickness) {
    throw new Error('Invalid CSV: Missing project data');
  }

  if (!chipboardData.id || !chipboardData.name || !chipboardData.dimensions || 
      chipboardData.thickness === undefined || chipboardData.margin === undefined) {
    throw new Error('Invalid CSV: Missing chipboard data');
  }

  return {
    id: projectId,
    name: projectData.name,
    sawThickness: projectData.sawThickness,
    chipboard: chipboardData as Chipboard,
    parts,
  };
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string): string {
  // If value contains comma, newline, or quotes, wrap in quotes and escape internal quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current.trim());

  return values;
}

