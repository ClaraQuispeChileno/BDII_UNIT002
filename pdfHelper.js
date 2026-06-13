const { jsPDF } = require("jspdf");

function convertMarkdownToPdf(markdownText) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });
    
    // Page dimensions
    const pageWidth = doc.internal.pageSize.width || 210;
    const pageHeight = doc.internal.pageSize.height || 297;
    const margin = 20;
    const maxContentWidth = pageWidth - (margin * 2); // 170 mm
    
    let y = margin + 5; // Initial Y offset after header
    const lines = markdownText.split('\n');
    
    // Auxiliary: Check if we need to add a page
    const checkPageHeight = (heightNeeded) => {
        if (y + heightNeeded > pageHeight - margin - 10) {
            doc.addPage();
            y = margin + 5; // Reset Y with spacing after header
            return true;
        }
        return false;
    };
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trimEnd();
        
        // Interceptar barra de progreso (estructura de corchetes con porcentaje final)
        const barMatch = line.match(/^\[(.*)\]\s*(\d+[\s\d]*)\s*%/);
        if (barMatch) {
            const rawPct = barMatch[2].replace(/\s+/g, '');
            const percentage = parseInt(rawPct) || 50;
            
            const barWidth = 100; // Ancho en mm
            const barHeight = 5;  // Alto en mm
            const barY = y + 2;
            
            checkPageHeight(barHeight + 8);
            
            // Fondo de la barra (gris claro)
            doc.setFillColor(229, 231, 235);
            doc.rect(margin, barY, barWidth, barHeight, "F");
            
            // Barra de progreso activa (azul)
            doc.setFillColor(30, 58, 138);
            const fillWidth = (percentage / 100) * barWidth;
            if (fillWidth > 0) {
                doc.rect(margin, barY, fillWidth, barHeight, "F");
            }
            
            // Texto del porcentaje
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(30, 58, 138);
            doc.text(`${percentage}%`, margin + barWidth + 4, barY + barHeight - 1);
            
            y += barHeight + 10;
            continue;
        }
        
        // Handle empty line
        if (line.trim().length === 0) {
            y += 4;
            continue;
        }
        
        // Handle markdown titles
        let isHeading = false;
        let headingLevel = 0;
        if (line.startsWith('## ')) {
            isHeading = true;
            headingLevel = 2;
            line = line.substring(3).trim();
        } else if (line.startsWith('### ')) {
            isHeading = true;
            headingLevel = 3;
            line = line.substring(4).trim();
        } else if (line.startsWith('# ')) {
            isHeading = true;
            headingLevel = 1;
            line = line.substring(2).trim();
        }
        
        if (isHeading) {
            let fontSize = 12;
            let color = [30, 58, 138]; // #1e3a8a (Navy)
            
            if (headingLevel === 1) {
                fontSize = 16;
            } else if (headingLevel === 2) {
                fontSize = 13;
            } else {
                fontSize = 11;
            }
            
            // Clean up possible bold markers from heading like ### **users** -> users
            line = line.replace(/\*\*/g, "").replace(/\*/g, "");
            
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(fontSize);
            doc.setTextColor(color[0], color[1], color[2]);
            
            const splitText = doc.splitTextToSize(line, maxContentWidth);
            const textHeight = splitText.length * (fontSize * 0.45) + 6;
            
            checkPageHeight(textHeight);
            doc.text(splitText, margin, y + (fontSize * 0.2));
            y += textHeight;
            continue;
        }
        
        // Handle Table
        if (line.startsWith('|')) {
            // Gather all rows of the table
            const tableRows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableRows.push(lines[i].trim());
                i++;
            }
            i--; // Adjust index back
            
            if (tableRows.length <= 1) continue; // Skip single | or empty table
            
            // Parse tableRows
            // Row 0: Header, Row 1: separator (e.g. |---|---|), Row 2+: body rows
            const headerRow = tableRows[0];
            const bodyRows = tableRows.slice(2);
            
            const parseRowCells = (rowStr) => {
                return rowStr
                    .split('|')
                    .map(c => c.trim())
                    .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            };
            
            const headers = parseRowCells(headerRow);
            const rows = bodyRows.map(parseRowCells).filter(r => r.length > 0);
            
            if (headers.length === 0) continue;
            
            // Draw Table
            const colWidth = maxContentWidth / headers.length;
            const cellHeight = 8;
            
            // Draw Header
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(17, 24, 39);
            
            checkPageHeight(cellHeight);
            
            // Draw Header cell backgrounds
            doc.setFillColor(243, 244, 246);
            doc.rect(margin, y - 4, maxContentWidth, cellHeight, "F");
            doc.setDrawColor(209, 213, 219);
            doc.rect(margin, y - 4, maxContentWidth, cellHeight, "S");
            
            for (let c = 0; c < headers.length; c++) {
                const cellText = headers[c].replace(/\*\*/g, "").replace(/\*/g, "");
                doc.text(cellText, margin + (c * colWidth) + 2, y + 1);
                
                // Draw vertical border line
                if (c > 0) {
                    doc.line(margin + (c * colWidth), y - 4, margin + (c * colWidth), y - 4 + cellHeight);
                }
            }
            y += cellHeight;
            
            // Draw Rows
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(55, 65, 81);
            
            for (let r = 0; r < rows.length; r++) {
                const rowData = rows[r];
                // Determine heights of cells in this row to see if we need wrap/pagebreak
                let maxLines = 1;
                const formattedCells = [];
                for (let c = 0; c < headers.length; c++) {
                    const cellVal = (rowData[c] || "").replace(/\*\*/g, "").replace(/\*/g, "");
                    const splitCell = doc.splitTextToSize(cellVal, colWidth - 4);
                    formattedCells.push(splitCell);
                    if (splitCell.length > maxLines) {
                        maxLines = splitCell.length;
                    }
                }
                
                const rowHeight = maxLines * 4 + 4;
                checkPageHeight(rowHeight);
                
                // Draw borders and background for alternate rows
                if (r % 2 === 1) {
                    doc.setFillColor(249, 250, 251); // Zebra striping
                    doc.rect(margin, y - 4, maxContentWidth, rowHeight, "F");
                }
                
                doc.setDrawColor(229, 231, 235);
                doc.rect(margin, y - 4, maxContentWidth, rowHeight, "S");
                
                for (let c = 0; c < headers.length; c++) {
                    doc.text(formattedCells[c], margin + (c * colWidth) + 2, y);
                    if (c > 0) {
                        doc.line(margin + (c * colWidth), y - 4, margin + (c * colWidth), y - 4 + rowHeight);
                    }
                }
                y += rowHeight;
            }
            
            y += 4; // Add spacing below table
            continue;
        }
        
        // Handle list item
        let isList = false;
        let listText = line;
        let indent = 0;
        
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            isList = true;
            indent = 5;
            listText = line.replace(/^\s*[-*]\s+/, "");
        } else if (line.trim().match(/^\d+\.\s/)) {
            isList = true;
            indent = 5;
            listText = line.replace(/^\s*\d+\.\s+/, "");
        }
        
        // Handle bolding in lists/normal text (like **[CRÍTICO]** or **bold**)
        let cleanText = listText.replace(/\*\*/g, "").replace(/\*/g, "");
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(55, 65, 81);
        
        const textWidth = maxContentWidth - indent;
        const splitText = doc.splitTextToSize(cleanText, textWidth);
        const textHeight = splitText.length * 4.5;
        
        checkPageHeight(textHeight + 2);
        
        if (isList) {
            // Draw bullet
            doc.setFont("Helvetica", "bold");
            doc.text("•", margin + 1, y + 1);
            doc.setFont("Helvetica", "normal");
        }
        
        doc.text(splitText, margin + indent, y + 1);
        y += textHeight + 2;
    }
    
    // Add page numbers and headers/footers to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        
        // Draw Header
        doc.setFontSize(8);
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(156, 163, 175); // Gray #9ca3af
        doc.text("Reporte de Análisis Estructural de Base de Datos", margin, 12);
        doc.setDrawColor(229, 231, 235); // Gray #e5e7eb
        doc.line(margin, 14, pageWidth - margin, 14);
        
        // Draw Footer
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        doc.text(`Generado automáticamente • Página ${p} de ${pageCount}`, margin, pageHeight - 10);
    }
    
    return Buffer.from(doc.output("arraybuffer"));
}

module.exports = { convertMarkdownToPdf };
