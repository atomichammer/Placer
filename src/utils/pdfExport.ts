import jsPDF from 'jspdf';
import { PlacementResult, ProjectPart, ChipboardWithParts } from '../types';

function drawChipboardLayout(
  pdf: jsPDF,
  chipboardData: ChipboardWithParts,
  chipboardNumber: number,
  projectName: string
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const { chipboard, parts, cutLines } = chipboardData;

  // Project name in small heading
  pdf.setFontSize(10);
  pdf.text(`${projectName} - Chipboard #${chipboardNumber}`, margin, margin - 5);

  // Calculate scale to fit chipboard on page
  const availableWidth = pageWidth - 2 * margin;
  const availableHeight = pageHeight - 2 * margin;
  const scaleX = availableWidth / chipboard.dimensions.width;
  const scaleY = availableHeight / chipboard.dimensions.height;
  const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some space

  const chipboardWidth = chipboard.dimensions.width * scale;
  const chipboardHeight = chipboard.dimensions.height * scale;
  const offsetX = (pageWidth - chipboardWidth) / 2;
  const offsetY = (pageHeight - chipboardHeight) / 2;

  // Draw chipboard outline
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.5);
  pdf.rect(offsetX, offsetY, chipboardWidth, chipboardHeight);

  // Draw margin area (dashed)
  if (chipboard.margin > 0) {
    pdf.setDrawColor(150);
    pdf.setLineWidth(0.3);
    const marginScaled = chipboard.margin * scale;
    
    // Dashed lines for margins - simulate with small segments
    const dashLength = 2;
    const gapLength = 2;
    
    // Top margin line
    for (let x = offsetX + marginScaled; x < offsetX + chipboardWidth - marginScaled; x += dashLength + gapLength) {
      pdf.line(x, offsetY + marginScaled, Math.min(x + dashLength, offsetX + chipboardWidth - marginScaled), offsetY + marginScaled);
    }
    // Bottom margin line
    for (let x = offsetX + marginScaled; x < offsetX + chipboardWidth - marginScaled; x += dashLength + gapLength) {
      pdf.line(x, offsetY + chipboardHeight - marginScaled, Math.min(x + dashLength, offsetX + chipboardWidth - marginScaled), offsetY + chipboardHeight - marginScaled);
    }
    // Left margin line
    for (let y = offsetY + marginScaled; y < offsetY + chipboardHeight - marginScaled; y += dashLength + gapLength) {
      pdf.line(offsetX + marginScaled, y, offsetX + marginScaled, Math.min(y + dashLength, offsetY + chipboardHeight - marginScaled));
    }
    // Right margin line
    for (let y = offsetY + marginScaled; y < offsetY + chipboardHeight - marginScaled; y += dashLength + gapLength) {
      pdf.line(offsetX + chipboardWidth - marginScaled, y, offsetX + chipboardWidth - marginScaled, Math.min(y + dashLength, offsetY + chipboardHeight - marginScaled));
    }
  }

  // Draw cut lines (solid black)
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.4);
  for (const cutLine of cutLines) {
    pdf.line(
      offsetX + cutLine.x1 * scale,
      offsetY + cutLine.y1 * scale,
      offsetX + cutLine.x2 * scale,
      offsetY + cutLine.y2 * scale
    );
  }

  // Draw parts (solid black outline)
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  
  for (const part of parts) {
    const x = offsetX + part.x * scale;
    const y = offsetY + part.y * scale;
    const w = part.dimensions.width * scale;
    const h = part.dimensions.height * scale;
    
    // Draw part outline
    pdf.rect(x, y, w, h);
    
    // Draw part name and dimensions inside (centered)
    const textX = x + w / 2;
    const centerY = y + h / 2;
    
    // Part name (bold)
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text(part.name, textX, centerY - 1.5, { align: 'center', baseline: 'middle' });
    
    // Dimensions (normal)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    const dimensionsText = `${Math.round(part.dimensions.width)}×${Math.round(part.dimensions.height)}`;
    pdf.text(dimensionsText, textX, centerY + 1.5, { align: 'center', baseline: 'middle' });
  }
}

export async function exportToPDF(
  result: PlacementResult,
  _projectParts: ProjectPart[],
  projectName: string,
  _sawThickness: number
) {
  // Calculate total pages
  const allParts: Array<{ name: string; id: string; dimensions: { width: number; height: number }; chipboard: number }> = [];
  
  result.chipboards.forEach((chipboard, chipboardIndex) => {
    chipboard.parts.forEach(part => {
      allParts.push({
        name: part.name,
        id: part.id,
        dimensions: part.dimensions,
        chipboard: chipboardIndex + 1,
      });
    });
  });
  
  const stickersPerPage = 24; // 3x8 grid
  const stickerPages = Math.ceil(allParts.length / stickersPerPage);
  const totalPages = result.chipboards.length + stickerPages;

  // Start with landscape orientation for chipboards
  const pdf = new jsPDF('l', 'mm', 'a4');
  let currentPage = 1;

  // Draw each chipboard on its own page
  result.chipboards.forEach((chipboardData, index) => {
    if (index > 0) {
      pdf.addPage('l');
      currentPage++;
    }
    drawChipboardLayout(pdf, chipboardData, index + 1, projectName);
    
    // Add page number
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - 35, 10, { align: 'right' });
    pdf.setTextColor(0);
  });

  // Parts list for stickers (portrait orientation)
  pdf.addPage('p');
  currentPage++;
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  pdf.setFontSize(12);
  pdf.text(`${projectName} - Parts Stickers`, margin, margin + 5);

  pdf.setFontSize(8);
  pdf.text('Cut along grid lines', margin, margin + 10);
  
  // Add page number
  pdf.setTextColor(100);
  pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - 35, margin + 5, { align: 'right' });
  pdf.setTextColor(0);

  // Sort by name for easier finding
  allParts.sort((a, b) => a.name.localeCompare(b.name));

  // Grid layout parameters
  const cols = 3;
  const rows = 8;
  const stickerWidth = (pageWidth - 2 * margin) / cols;
  const stickerHeight = (pageHeight - 2 * margin - 15) / rows; // 15mm for header
  const gridStartY = margin + 15;

  let partIndex = 0;
  
  while (partIndex < allParts.length) {
    if (partIndex > 0 && partIndex % stickersPerPage === 0) {
      pdf.addPage('p');
      currentPage++;
      
      pdf.setFontSize(12);
      pdf.text(`${projectName} - Parts Stickers (cont.)`, margin, margin + 5);
      
      // Add page number
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`Page ${currentPage} of ${totalPages}`, pageWidth - 35, margin + 5, { align: 'right' });
      pdf.setTextColor(0);
    }

    const localIndex = partIndex % stickersPerPage;
    const row = Math.floor(localIndex / cols);
    const col = localIndex % cols;
    
    const xPosition = margin + col * stickerWidth;
    const yPosition = gridStartY + row * stickerHeight;
    const part = allParts[partIndex];

    // Draw sticker border (solid for grid cutting)
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.2);
    pdf.rect(xPosition, yPosition, stickerWidth, stickerHeight);

    // Part info inside sticker
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    const nameText = part.name.length > 25 ? part.name.slice(0, 22) + '...' : part.name;
    pdf.text(nameText, xPosition + 2, yPosition + 5);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `${Math.round(part.dimensions.width)} × ${Math.round(part.dimensions.height)} mm`,
      xPosition + 2,
      yPosition + 10
    );

    pdf.text(`Chipboard #${part.chipboard}`, xPosition + 2, yPosition + 15);

    pdf.setFontSize(6);
    pdf.setTextColor(100);
    pdf.text(`ID: ${part.id.slice(0, 8)}`, xPosition + 2, yPosition + 19);
    pdf.setTextColor(0);

    partIndex++;
  }

  // Save the PDF
  const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_cutting_plan.pdf`;
  pdf.save(fileName);
}

