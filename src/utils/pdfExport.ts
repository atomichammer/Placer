import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PlacementResult, ProjectPart } from '../types';

export async function exportToPDF(
  result: PlacementResult,
  _projectParts: ProjectPart[],
  projectName: string,
  sawThickness: number
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Title page
  pdf.setFontSize(20);
  pdf.text('Cutting Project Report', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(12);
  pdf.text(`Project: ${projectName}`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Saw thickness: ${sawThickness}mm`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Total chipboards: ${result.chipboards.length}`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Total parts: ${result.statistics.totalParts}`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Material efficiency: ${result.statistics.efficiency}%`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Total cut length: ${result.statistics.totalCutLength}mm`, margin, yPosition);
  yPosition += 7;
  pdf.text(`Total cut operations: ${result.statistics.totalCutOperations}`, margin, yPosition);
  yPosition += 15;

  // Chipboard visualizations
  pdf.setFontSize(14);
  pdf.text('Chipboard Layouts', margin, yPosition);
  yPosition += 10;

  // Capture each chipboard visualization
  const chipboardElements = document.querySelectorAll('[data-chipboard-canvas]');
  
  for (let i = 0; i < chipboardElements.length; i++) {
    const element = chipboardElements[i] as HTMLElement;
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check if we need a new page
      if (yPosition + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;

    } catch (error) {
      console.error('Error capturing chipboard:', error);
    }
  }

  // Parts list for stickers
  pdf.addPage();
  yPosition = margin;

  pdf.setFontSize(16);
  pdf.text('Parts List - For Making Stickers', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(9);
  pdf.text('Cut along dotted lines to create labels for each part', margin, yPosition);
  yPosition += 10;

  // Create sticker-like layout for parts
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

  // Sort by name for easier finding
  allParts.sort((a, b) => a.name.localeCompare(b.name));

  const stickerWidth = (pageWidth - 3 * margin) / 2;
  const stickerHeight = 25;
  const gapX = margin;
  let column = 0;

  for (const part of allParts) {
    // Check if we need a new page
    if (yPosition + stickerHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin + 20;
      column = 0;
    }

    const xPosition = margin + column * (stickerWidth + gapX);

    // Draw sticker border with rounded corners effect
    pdf.setDrawColor(150);
    pdf.setLineWidth(0.3);
    pdf.rect(xPosition, yPosition, stickerWidth, stickerHeight);
    pdf.setLineWidth(0.2);

    // Part info inside sticker
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(part.name, xPosition + 3, yPosition + 6);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `${Math.round(part.dimensions.width)} × ${Math.round(part.dimensions.height)} mm`,
      xPosition + 3,
      yPosition + 11
    );

    pdf.text(`Chipboard #${part.chipboard}`, xPosition + 3, yPosition + 16);

    pdf.setFontSize(7);
    pdf.setTextColor(100);
    pdf.text(`ID: ${part.id.slice(0, 8)}`, xPosition + 3, yPosition + 21);
    pdf.setTextColor(0);

    column++;
    if (column >= 2) {
      column = 0;
      yPosition += stickerHeight + 3;
    }
  }

  // Summary table
  pdf.addPage();
  yPosition = margin;

  pdf.setFontSize(16);
  pdf.text('Parts Summary Table', margin, yPosition);
  yPosition += 10;

  // Table headers
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  const colX1 = margin;
  const colX2 = margin + 50;
  const colX3 = margin + 95;
  const colX4 = margin + 135;
  const colX5 = margin + 160;

  pdf.text('Part Name', colX1, yPosition);
  pdf.text('Dimensions', colX2, yPosition);
  pdf.text('Position', colX3, yPosition);
  pdf.text('Chipboard', colX4, yPosition);
  pdf.text('Rotated', colX5, yPosition);
  yPosition += 2;

  pdf.setDrawColor(0);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  for (const chipboard of result.chipboards) {
    for (const part of chipboard.parts) {
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.text(part.name.length > 20 ? part.name.slice(0, 20) + '...' : part.name, colX1, yPosition);
      pdf.text(`${Math.round(part.dimensions.width)}×${Math.round(part.dimensions.height)}`, colX2, yPosition);
      pdf.text(`(${Math.round(part.x)}, ${Math.round(part.y)})`, colX3, yPosition);
      pdf.text(`#${result.chipboards.indexOf(chipboard) + 1}`, colX4, yPosition);
      pdf.text(part.rotated ? 'Yes' : 'No', colX5, yPosition);

      yPosition += 5;
    }
  }

  // Save the PDF
  const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_')}_cutting_plan.pdf`;
  pdf.save(fileName);
}

