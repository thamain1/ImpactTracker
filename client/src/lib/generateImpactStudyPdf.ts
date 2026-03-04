import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ProgramData {
  name: string;
  description?: string | null;
  type?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  targetPopulation?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  goals?: string | null;
  costPerParticipant?: string | null;
  locations?: string | null;
  metrics: { name: string; unit: string; countsAsParticipant?: boolean }[];
}

interface OrgData {
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  mission?: string | null;
  vision?: string | null;
}

interface StatEntry {
  geographyLevel: string;
  geographyValue: string;
  metrics: Record<string, number>;
}

interface CensusEntry {
  geographyLevel: string;
  geographyValue: string;
  totalPopulation: number | null;
  povertyRate: number | null;
  medianIncome: number | null;
  isApproximate: boolean;
  dataYear: number;
}

interface AgeGroupEntry {
  geographyLevel: string;
  geographyValue: string;
  totalPopulation: number | null;
  targetAgePopulation: number | null;
  isApproximate: boolean;
  dataYear: number;
}

interface ImpactEntry {
  date: string;
  geographyLevel: string;
  geographyValue: string;
  metricValues: Record<string, number>;
  zipCode?: string | null;
  demographics?: string | null;
  outcomes?: string | null;
  geoContext?: { spa?: string; city?: string; county?: string; state?: string } | null;
}

interface AiNarrative {
  executiveSummary?: string;
  communityNeed?: string;
  programDesign?: string;
  outcomesImpact?: string;
  lessonsLearned?: string;
  callToAction?: string;
}

interface ReportData {
  program: ProgramData;
  org: OrgData;
  stats: StatEntry[];
  censusData: CensusEntry[];
  ageGroupData: AgeGroupEntry[];
  entries: ImpactEntry[];
  aiNarrative?: AiNarrative | null;
  totalParticipants?: number;
  metricTotals?: Record<string, number>;
}

const COLORS = {
  primary: [30, 64, 120] as [number, number, number],
  primaryLight: [45, 90, 160] as [number, number, number],
  accent: [52, 152, 219] as [number, number, number],
  dark: [33, 37, 41] as [number, number, number],
  medium: [108, 117, 125] as [number, number, number],
  light: [248, 249, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableBorder: [222, 226, 230] as [number, number, number],
  tableHeader: [30, 64, 120] as [number, number, number],
  tableAlt: [241, 245, 249] as [number, number, number],
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(n: number): string {
  if (n < 0.01) return "<0.01%";
  return n.toFixed(2) + "%";
}

export function generateImpactStudyPdf(data: ReportData) {
  const { program, org, stats, censusData, ageGroupData, entries, aiNarrative } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const participantMetrics = program.metrics.filter(m => m.countsAsParticipant !== false);
  const participantMetricSet = new Set(
    participantMetrics.length > 0
      ? participantMetrics.map(m => m.name)
      : program.metrics.length > 0 ? [program.metrics[0].name] : []
  );
  const primaryMetric = Array.from(participantMetricSet).join(", ") || "Participants";

  let totalPrimary = entries.reduce((sum, e) => {
    const mv = e.metricValues as Record<string, number>;
    let t = 0;
    participantMetricSet.forEach(name => { t += Number(mv[name] || 0); });
    return sum + t;
  }, 0);
  // Use survey-inclusive total when provided by caller
  if (data.totalParticipants != null) totalPrimary = data.totalParticipants;

  let secondaryMetrics: Record<string, number> = {};
  program.metrics.filter(m => !participantMetricSet.has(m.name)).forEach(m => {
    secondaryMetrics[m.name] = entries.reduce((sum, e) => {
      const mv = e.metricValues as Record<string, number>;
      return sum + Number(mv[m.name] || 0);
    }, 0);
  });
  // Override secondary metrics with survey-inclusive totals when provided
  if (data.metricTotals) {
    program.metrics.filter(m => !participantMetricSet.has(m.name)).forEach(m => {
      if (data.metricTotals![m.name] != null) secondaryMetrics[m.name] = data.metricTotals![m.name];
    });
  }

  let goalTarget: number | null = null;
  if (program.goals) {
    const match = program.goals.match(/(\d[\d,]*)/);
    if (match) goalTarget = parseInt(match[1].replace(/,/g, ""), 10);
  }

  const costPerParticipant = program.costPerParticipant ? parseFloat(program.costPerParticipant) : null;
  const totalCost = costPerParticipant && totalPrimary ? costPerParticipant * totalPrimary : null;

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }
  }

  function drawSectionHeader(title: string) {
    checkPageBreak(18);
    y += 6;
    doc.setFillColor(...COLORS.primary);
    doc.rect(margin, y, contentWidth, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.text(title, margin + 4, y + 6.5);
    y += 14;
    doc.setTextColor(...COLORS.dark);
  }

  function drawSubHeader(title: string) {
    checkPageBreak(12);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.text(title, margin, y);
    y += 2;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth * 0.4, y);
    y += 5;
    doc.setTextColor(...COLORS.dark);
  }

  function drawParagraph(text: string, fontSize: number = 10) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLORS.dark);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * (fontSize * 0.45) + 4);
    doc.text(lines, margin, y);
    y += lines.length * (fontSize * 0.45) + 4;
  }

  function drawBullet(text: string, indent: number = 6) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    const bulletX = margin + indent;
    const textX = bulletX + 4;
    const lines = doc.splitTextToSize(text, contentWidth - indent - 4);
    checkPageBreak(lines.length * 4.5 + 2);
    doc.setFillColor(...COLORS.primary);
    doc.circle(bulletX + 1, y - 1.2, 0.8, "F");
    doc.text(lines, textX, y);
    y += lines.length * 4.5 + 1;
  }

  function drawBarChart(
    data: { label: string; value: number }[],
    title: string,
    barColor: [number, number, number] = COLORS.primary,
  ) {
    if (data.every(d => d.value === 0)) return;
    const plotHeight = 50;
    const xLabelH = 10;
    const yLabelW = 22;
    const plotW = contentWidth - yLabelW;
    const totalH = plotHeight + xLabelH + 14; // title + plot + labels
    checkPageBreak(totalH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text(title, margin, y);
    y += 6;

    const maxVal = Math.max(...data.map(d => d.value), 1);
    const chartLeft = margin + yLabelW;
    const chartTop = y;

    // Background
    doc.setFillColor(248, 250, 252);
    doc.rect(chartLeft, chartTop, plotW, plotHeight, "F");

    // Gridlines + Y-axis labels
    const gridCount = 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    for (let i = 1; i <= gridCount; i++) {
      const gy = chartTop + plotHeight - (plotHeight * i / gridCount);
      doc.line(chartLeft, gy, chartLeft + plotW, gy);
      const labelVal = Math.round(maxVal * i / gridCount);
      const labelStr = labelVal >= 1000 ? (labelVal / 1000).toFixed(0) + "k" : labelVal.toString();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.medium);
      doc.text(labelStr, chartLeft - 2, gy + 1.5, { align: "right" });
    }

    // Bars + X labels
    const barGroupW = plotW / data.length;
    const barW = Math.min(barGroupW * 0.55, 12);
    data.forEach((d, i) => {
      const cx = chartLeft + i * barGroupW + barGroupW / 2;
      if (d.value > 0) {
        const barH = plotHeight * (d.value / maxVal);
        doc.setFillColor(...barColor);
        doc.rect(cx - barW / 2, chartTop + plotHeight - barH, barW, barH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.medium);
      doc.text(d.label, cx, chartTop + plotHeight + 6, { align: "center" });
    });

    // X-axis line
    doc.setDrawColor(...COLORS.medium);
    doc.setLineWidth(0.3);
    doc.line(chartLeft, chartTop + plotHeight, chartLeft + plotW, chartTop + plotHeight);

    y += plotHeight + xLabelH + 4;
  }

  function drawGoalActualChart(goal: number, actual: number, metricName: string) {
    const chartH = 40;
    const totalH = chartH + 22;
    checkPageBreak(totalH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text("Goal vs. Actual — " + metricName, margin, y);
    y += 6;

    const maxVal = Math.max(goal, actual, 1);
    const barW = 30;
    const gap = 20;
    const startX = margin + 24;

    // Goal bar (slate)
    const goalH = chartH * (goal / maxVal);
    doc.setFillColor(148, 163, 184);
    doc.rect(startX, y + chartH - goalH, barW, goalH, "F");

    // Actual bar (primary)
    const actualH = chartH * (actual / maxVal);
    doc.setFillColor(...COLORS.primary);
    doc.rect(startX + barW + gap, y + chartH - actualH, barW, actualH, "F");

    // X-axis
    doc.setDrawColor(...COLORS.medium);
    doc.setLineWidth(0.3);
    doc.line(startX, y + chartH, startX + barW * 2 + gap, y + chartH);

    // Labels under bars
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    doc.text(`Goal`, startX + barW / 2, y + chartH + 5, { align: "center" });
    doc.text(formatNumber(goal), startX + barW / 2, y + chartH + 10, { align: "center" });
    doc.text(`Actual`, startX + barW + gap + barW / 2, y + chartH + 5, { align: "center" });
    doc.text(formatNumber(actual), startX + barW + gap + barW / 2, y + chartH + 10, { align: "center" });

    // Progress callout
    const pct = ((actual / goal) * 100).toFixed(1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.text(`${pct}% of goal`, startX + barW * 2 + gap + 8, y + chartH / 2 + 1);

    y += chartH + 18;
  }

  // =========== COVER PAGE ===========
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, pageHeight * 0.45, "F");

  doc.setFillColor(...COLORS.primaryLight);
  doc.rect(0, pageHeight * 0.35, pageWidth, pageHeight * 0.1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.white);
  const titleLines = doc.splitTextToSize(program.name, contentWidth);
  const titleY = 50;
  doc.text(titleLines, pageWidth / 2, titleY, { align: "center" });

  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text("Impact Study Report", pageWidth / 2, titleY + titleLines.length * 14 + 8, { align: "center" });

  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.5);
  const dividerY = titleY + titleLines.length * 14 + 18;
  doc.line(pageWidth * 0.3, dividerY, pageWidth * 0.7, dividerY);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(org.name, pageWidth / 2, dividerY + 12, { align: "center" });

  const detailsY = pageHeight * 0.52;
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "normal");

  const currentYear = new Date().getFullYear();
  let reportPeriod: string;
  if (program.startDate && program.endDate) {
    const startYear = new Date(program.startDate + "T00:00:00").getFullYear();
    const endYear = new Date(program.endDate + "T00:00:00").getFullYear();
    reportPeriod = startYear === endYear ? startYear.toString() : `${startYear}-${endYear}`;
  } else if (entries.length > 0) {
    const dates = entries.map(e => new Date(e.date + "T00:00:00").getFullYear());
    const minYear = Math.min(...dates);
    const maxYear = Math.max(...dates);
    reportPeriod = minYear === maxYear ? minYear.toString() : `${minYear}-${maxYear}`;
  } else {
    reportPeriod = program.startDate
      ? new Date(program.startDate + "T00:00:00").getFullYear().toString()
      : currentYear.toString();
  }

  const coverDetails = [
    { label: "Report Period:", value: reportPeriod },
    { label: "Program Type:", value: program.type || "General" },
    { label: "Status:", value: program.status.charAt(0).toUpperCase() + program.status.slice(1) },
  ];
  if (program.startDate) coverDetails.push({ label: "Start Date:", value: formatDate(program.startDate) });
  if (program.endDate) coverDetails.push({ label: "End Date:", value: formatDate(program.endDate) });
  if (program.locations) coverDetails.push({ label: "Location:", value: program.locations });

  let detY = detailsY;
  coverDetails.forEach(d => {
    doc.setFont("helvetica", "bold");
    doc.text(d.label, margin + 10, detY);
    doc.setFont("helvetica", "normal");
    doc.text(d.value, margin + 50, detY);
    detY += 7;
  });

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.medium);
  doc.text("Generated by ImpactTracker", pageWidth / 2, pageHeight - 20, { align: "center" });
  doc.text(`Report Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, pageWidth / 2, pageHeight - 14, { align: "center" });

  // =========== PAGE 2: EXECUTIVE SUMMARY + ABOUT ===========
  doc.addPage();
  y = margin;

  drawSectionHeader("Executive Summary");

  if (aiNarrative?.executiveSummary) {
    drawParagraph(aiNarrative.executiveSummary);
  } else {
    const geographyNames = stats.map(s => s.geographyValue).filter((v, i, a) => a.indexOf(v) === i);
    const geoListStr = geographyNames.length > 0 ? geographyNames.join(", ") : (program.locations || "the service area");

    let summaryText = `${org.name} delivered the ${program.name} program`;
    if (program.type) summaryText += ` (${program.type})`;
    summaryText += `, serving ${formatNumber(totalPrimary)} ${primaryMetric.toLowerCase()} across ${geoListStr}.`;

    Object.entries(secondaryMetrics).forEach(([name, val]) => {
      if (val > 0) summaryText += ` The program also distributed ${formatNumber(val)} ${name.toLowerCase()}.`;
    });

    if (goalTarget) {
      const pctGoal = ((totalPrimary / goalTarget) * 100).toFixed(1);
      summaryText += ` This represents ${pctGoal}% of the program goal of ${formatNumber(goalTarget)} ${primaryMetric.toLowerCase()}.`;
    }

    if (censusData.length > 0) {
      const directGeos = censusData.filter(c => stats.some(s => s.geographyLevel === c.geographyLevel && s.geographyValue === c.geographyValue));
      const highPoverty = directGeos.filter(c => c.povertyRate && c.povertyRate > 15);
      if (highPoverty.length > 0) {
        summaryText += ` The program operates in areas with significant economic need, where poverty rates range from ${highPoverty.map(h => (h.povertyRate || 0).toFixed(1) + "%").join(" to ")}.`;
      }
    }

    drawParagraph(summaryText);
  }

  // About Organization
  drawSectionHeader(`About ${org.name}`);

  if (org.mission) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    checkPageBreak(10);
    doc.text("Mission:", margin, y);
    y += 5;
    drawParagraph(org.mission);
  }

  if (org.vision) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    checkPageBreak(10);
    doc.text("Vision:", margin, y);
    y += 5;
    drawParagraph(org.vision);
  }

  if (org.address || org.website || org.contactEmail || org.phone) {
    const contactInfo: string[] = [];
    if (org.address) contactInfo.push(`Address: ${org.address}`);
    if (org.phone) contactInfo.push(`Phone: ${org.phone}`);
    if (org.website) contactInfo.push(`Website: ${org.website}`);
    if (org.contactEmail) contactInfo.push(`Email: ${org.contactEmail}`);
    contactInfo.forEach(line => drawBullet(line));
  }

  // =========== PROGRAM CONTEXT AND COMMUNITY NEED ===========
  drawSectionHeader("Program Context and Community Need");

  if (aiNarrative?.communityNeed) {
    drawParagraph(aiNarrative.communityNeed);
  } else if (program.description) {
    drawParagraph(program.description);
  }

  if (program.targetPopulation) {
    drawSubHeader("Target Population");
    drawParagraph(program.targetPopulation);
    if (program.targetAgeMin != null || program.targetAgeMax != null) {
      const ageRange = program.targetAgeMin != null && program.targetAgeMax != null
        ? `Ages ${program.targetAgeMin}-${program.targetAgeMax}`
        : program.targetAgeMin != null ? `Ages ${program.targetAgeMin}+` : `Ages up to ${program.targetAgeMax}`;
      drawParagraph(`Age Focus: ${ageRange}`);
    }
  }

  // Program Design (AI section)
  if (aiNarrative?.programDesign) {
    drawSubHeader("Program Design");
    drawParagraph(aiNarrative.programDesign);
  }

  if (program.goals) {
    drawSubHeader("Program Goals");
    drawParagraph(program.goals);
  }

  // Census / Economic Context table
  if (censusData.length > 0) {
    drawSubHeader("Geographic and Economic Context");
    drawParagraph("The following table shows economic indicators for the service areas based on U.S. Census ACS data.");

    const censusTableData = censusData.map(c => [
      `${c.geographyValue} (${c.geographyLevel})`,
      c.povertyRate != null ? c.povertyRate.toFixed(1) + "%" : "N/A",
      c.medianIncome != null ? formatCurrency(c.medianIncome) : "N/A",
      c.totalPopulation != null ? formatNumber(c.totalPopulation) : "N/A",
    ]);

    checkPageBreak(15 + censusTableData.length * 8);
    autoTable(doc, {
      startY: y,
      head: [["Geography", "Poverty Rate", "Median Income", "Total Population"]],
      body: censusTableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.tableAlt },
      tableLineColor: COLORS.tableBorder,
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.medium);
    const censusYear = censusData[0]?.dataYear || 2023;
    checkPageBreak(6);
    doc.text(`Source: U.S. Census Bureau, American Community Survey (${censusYear})`, margin, y);
    y += 6;
    doc.setTextColor(...COLORS.dark);
  }

  // Target Age Population table
  if (ageGroupData.length > 0 && (program.targetAgeMin != null || program.targetAgeMax != null)) {
    const ageRange = program.targetAgeMin != null && program.targetAgeMax != null
      ? `${program.targetAgeMin}-${program.targetAgeMax}`
      : program.targetAgeMin != null ? `${program.targetAgeMin}+` : `up to ${program.targetAgeMax}`;

    drawSubHeader(`Target Age Population (Ages ${ageRange})`);

    const ageTableData = ageGroupData.map(a => {
      const agePop   = a.targetAgePopulation ?? null;
      const totalPop = a.totalPopulation ?? null;
      // If age pop is < 5% of total, Census API returned implausibly small data — suppress it
      const agePopDisplay = (agePop && totalPop && agePop > totalPop * 0.05)
        ? formatNumber(agePop)
        : "N/A";
      return [
        `${a.geographyValue} (${a.geographyLevel})`,
        agePopDisplay,
        totalPop != null ? formatNumber(totalPop) : "N/A",
      ];
    });

    checkPageBreak(15 + ageTableData.length * 8);
    autoTable(doc, {
      startY: y,
      head: [["Geography", `Target Age Pop (${ageRange})`, "Total Population"]],
      body: ageTableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.tableAlt },
      tableLineColor: COLORS.tableBorder,
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // =========== KEY PERFORMANCE INDICATORS ===========
  doc.addPage();
  y = margin;

  drawSectionHeader("Key Performance Indicators");

  const kpiData: string[][] = [];
  kpiData.push([primaryMetric, formatNumber(totalPrimary), goalTarget ? `Goal: ${formatNumber(goalTarget)}` : "Primary metric"]);
  Object.entries(secondaryMetrics).forEach(([name, val]) => {
    if (val > 0) kpiData.push([name, formatNumber(val), "Secondary metric"]);
  });

  const uniqueGeos = new Set<string>();
  stats.forEach(s => uniqueGeos.add(s.geographyValue));
  kpiData.push(["Geographies Served", uniqueGeos.size.toString(), `Across ${new Set(stats.map(s => s.geographyLevel)).size} levels`]);

  if (totalCost) {
    kpiData.push(["Estimated Total Cost", formatCurrency(totalCost), `Based on ${formatCurrency(costPerParticipant!)} per ${primaryMetric.toLowerCase().replace(/s$/, "")}`]);
  }
  if (costPerParticipant) {
    kpiData.push([`Cost per ${primaryMetric.replace(/s$/, "")}`, formatCurrency(costPerParticipant), "Unit cost"]);
  }
  if (goalTarget) {
    const pctGoal = ((totalPrimary / goalTarget) * 100).toFixed(1);
    kpiData.push(["Goal Progress", `${pctGoal}%`, `${formatNumber(totalPrimary)} of ${formatNumber(goalTarget)}`]);
  }

  checkPageBreak(15 + kpiData.length * 8);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value", "Notes"]],
    body: kpiData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.tableAlt },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55 },
      1: { halign: "right", cellWidth: 40 },
    },
    tableLineColor: COLORS.tableBorder,
    tableLineWidth: 0.1,
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // =========== CHARTS ===========
  drawSectionHeader("Visual Summary");

  // Participants by Month bar chart
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthCountsChart: Record<number, number> = {};
  entries.forEach(entry => {
    const month = new Date(entry.date + "T00:00:00").getMonth();
    const mv = entry.metricValues as Record<string, number>;
    let t = 0;
    participantMetricSet.forEach(name => { t += Number(mv[name] || 0); });
    monthCountsChart[month] = (monthCountsChart[month] || 0) + t;
  });
  const monthChartData = monthNamesShort.map((label, i) => ({ label, value: monthCountsChart[i] || 0 }));
  drawBarChart(monthChartData, `${primaryMetric} by Month`);

  // Goal vs. Actual chart (only if goal target is set)
  if (goalTarget && goalTarget > 0) {
    drawGoalActualChart(goalTarget, totalPrimary, primaryMetric);
  }

  // =========== PROGRAM REACH BY GEOGRAPHY ===========
  drawSectionHeader("Program Reach by Geography");

  const reachData = stats.map(s => {
    let val = 0;
    participantMetricSet.forEach(name => { val += Number(s.metrics[name] || 0); });
    const census = censusData.find(c => c.geographyLevel === s.geographyLevel && c.geographyValue === s.geographyValue);
    const agePop = ageGroupData.find(a => a.geographyLevel === s.geographyLevel && a.geographyValue === s.geographyValue);

    const rawAgePop = agePop?.targetAgePopulation ?? null;
    const totalPop  = census?.totalPopulation ?? null;
    // Guard: if age-group population is implausibly small (< 5% of total census pop),
    // the Census API returned bad data — fall back to total population.
    const usePop = (rawAgePop && totalPop && rawAgePop > totalPop * 0.05)
      ? rawAgePop
      : (totalPop ?? rawAgePop);
    const reachPct = usePop ? (val / usePop) * 100 : null;

    return [
      `${s.geographyValue} (${s.geographyLevel})`,
      formatNumber(val),
      usePop ? formatNumber(usePop) : "N/A",
      reachPct != null ? formatPercent(reachPct) : "N/A",
    ];
  });

  if (reachData.length > 0) {
    const hasAgeTargets = program.targetAgeMin != null || program.targetAgeMax != null;
    const popLabel = hasAgeTargets ? "Population *" : "Total Population";

    checkPageBreak(15 + reachData.length * 8);
    autoTable(doc, {
      startY: y,
      head: [["Geography", primaryMetric, popLabel, "% Reached"]],
      body: reachData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.tableAlt },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      tableLineColor: COLORS.tableBorder,
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    if (hasAgeTargets) {
      const ageRange = program.targetAgeMin != null && program.targetAgeMax != null
        ? `${program.targetAgeMin}–${program.targetAgeMax}`
        : program.targetAgeMin != null ? `${program.targetAgeMin}+` : `up to ${program.targetAgeMax}`;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.medium);
      checkPageBreak(5);
      doc.text(`* Population = target age group (${ageRange}) where available; total census population otherwise.`, margin, y);
      y += 6;
      doc.setTextColor(...COLORS.dark);
    } else {
      y += 2;
    }

    drawParagraph("The program achieved its strongest penetration in the immediate service areas where community trust and presence are established.");
  }

  // =========== IMPACT DATA OVER TIME ===========
  drawSectionHeader("Impact Over Time");

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthCounts: Record<string, number> = {};
  entries.forEach(entry => {
    const d = new Date(entry.date + "T00:00:00");
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const mv = entry.metricValues as Record<string, number>;
    let t = 0;
    participantMetricSet.forEach(name => { t += Number(mv[name] || 0); });
    monthCounts[key] = (monthCounts[key] || 0) + t;
  });

  const monthlyData = Object.entries(monthCounts).map(([month, count]) => [month, formatNumber(count)]);

  if (monthlyData.length > 0) {
    checkPageBreak(15 + monthlyData.length * 8);
    autoTable(doc, {
      startY: y,
      head: [["Month", primaryMetric]],
      body: monthlyData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.tableAlt },
      columnStyles: { 1: { halign: "right" } },
      tableLineColor: COLORS.tableBorder,
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    drawParagraph("No monthly data available for this program.");
  }

  // =========== FINANCIAL SNAPSHOT (if cost data available) ===========
  if (costPerParticipant || totalCost) {
    drawSectionHeader("Financial Snapshot");

    const finData: string[][] = [];
    if (totalCost) finData.push(["Estimated Total Program Cost", formatCurrency(totalCost)]);
    if (costPerParticipant) finData.push([`Cost per ${primaryMetric.replace(/s$/, "")} Served`, formatCurrency(costPerParticipant)]);
    if (totalPrimary) finData.push([`Total ${primaryMetric} Served`, formatNumber(totalPrimary)]);

    Object.entries(secondaryMetrics).forEach(([name, val]) => {
      if (val > 0 && costPerParticipant) {
        const unitCost = totalCost ? totalCost / val : 0;
        finData.push([`Cost per ${name}`, unitCost > 0 ? formatCurrency(unitCost) : "N/A"]);
      }
    });

    checkPageBreak(15 + finData.length * 8);
    autoTable(doc, {
      startY: y,
      head: [["Category", "Amount"]],
      body: finData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.tableAlt },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 100 },
        1: { halign: "right" },
      },
      tableLineColor: COLORS.tableBorder,
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    if (costPerParticipant && totalPrimary) {
      drawParagraph(`Donor Impact: Every ${formatCurrency(costPerParticipant)} invested serves one ${primaryMetric.toLowerCase().replace(/s$/, "")} through the ${program.name} program.`);
    }
  }

  // =========== OUTCOMES AND IMPACT (AI) ===========
  if (aiNarrative?.outcomesImpact) {
    drawSectionHeader("Outcomes and Community Impact");
    drawParagraph(aiNarrative.outcomesImpact);
  }

  // =========== OUTCOMES AND DEMOGRAPHICS ===========
  const outcomeEntries = entries.filter(e => e.outcomes && e.outcomes.trim());
  const demographicEntries = entries.filter(e => e.demographics && e.demographics.trim());

  if (outcomeEntries.length > 0 || demographicEntries.length > 0) {
    drawSectionHeader("Outcomes and Demographics");

    if (demographicEntries.length > 0) {
      drawSubHeader("Demographics Served");
      const demoCounts: Record<string, number> = {};
      demographicEntries.forEach(e => {
        const demo = e.demographics!.trim();
        demoCounts[demo] = (demoCounts[demo] || 0) + 1;
      });
      const demoRows = Object.entries(demoCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([demo, count]) => [demo, count.toString()]);

      checkPageBreak(15 + demoRows.length * 7);
      autoTable(doc, {
        startY: y,
        head: [["Demographic Group", "Entries"]],
        body: demoRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
        alternateRowStyles: { fillColor: COLORS.tableAlt },
        columnStyles: { 1: { halign: "right", cellWidth: 30 } },
        tableLineColor: COLORS.tableBorder,
        tableLineWidth: 0.1,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (outcomeEntries.length > 0) {
      drawSubHeader("Reported Outcomes");
      const outcomeCounts: Record<string, number> = {};
      outcomeEntries.forEach(e => {
        const outcome = e.outcomes!.trim();
        outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
      });
      const outcomeRows = Object.entries(outcomeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([outcome, count]) => [outcome, count.toString()]);

      checkPageBreak(15 + outcomeRows.length * 7);
      autoTable(doc, {
        startY: y,
        head: [["Outcome", "Occurrences"]],
        body: outcomeRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
        alternateRowStyles: { fillColor: COLORS.tableAlt },
        columnStyles: { 1: { halign: "right", cellWidth: 30 } },
        tableLineColor: COLORS.tableBorder,
        tableLineWidth: 0.1,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // =========== IMPACT ENTRIES DETAIL ===========
  if (entries.length > 0) {
    drawSectionHeader("Detailed Impact Entries");

    const detailRows = entries.slice(0, 50).map(e => {
      const mv = e.metricValues as Record<string, number>;
      const metricStr = Object.entries(mv).map(([k, v]) => `${k}: ${formatNumber(Number(v))}`).join(", ");
      const ctx = e.geoContext;
      const geoLabel = ctx?.city
        ? `${ctx.city} (${e.geographyLevel})`
        : `${e.geographyValue} (${e.geographyLevel})`;
      return [
        formatDate(e.date),
        geoLabel,
        e.zipCode || "-",
        metricStr,
      ];
    });

    checkPageBreak(15 + Math.min(detailRows.length, 20) * 7);
    autoTable(doc, {
      startY: y,
      head: [["Date", "Geography", "ZIP", "Metrics"]],
      body: detailRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.tableAlt },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 45 },
        2: { cellWidth: 20 },
      },
      tableLineColor: COLORS.tableBorder,
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    if (entries.length > 50) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.medium);
      checkPageBreak(6);
      doc.text(`Showing 50 of ${entries.length} entries. Export CSV for complete data.`, margin, y);
      y += 6;
      doc.setTextColor(...COLORS.dark);
    }
  }

  // =========== LESSONS LEARNED (AI) ===========
  if (aiNarrative?.lessonsLearned) {
    drawSectionHeader("Lessons Learned and Future Plans");
    drawParagraph(aiNarrative.lessonsLearned);
  }

  // =========== CALL TO ACTION (AI) ===========
  if (aiNarrative?.callToAction) {
    drawSectionHeader("Call to Action");
    drawParagraph(aiNarrative.callToAction);
  }

  // =========== CONTACT / FOOTER ===========
  doc.addPage();
  y = margin;

  drawSectionHeader("Contact Information");

  const contactLines: string[] = [];
  contactLines.push(org.name);
  if (org.address) contactLines.push(org.address);
  if (org.phone) contactLines.push(`Phone: ${org.phone}`);
  if (org.website) contactLines.push(`Website: ${org.website}`);
  if (org.contactEmail) contactLines.push(`Email: ${org.contactEmail}`);

  contactLines.forEach(line => {
    checkPageBreak(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(line, margin, y);
    y += 5;
  });

  y += 10;

  doc.setFillColor(...COLORS.light);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.medium);
  doc.text(
    "Report generated by ImpactTracker - Empowering nonprofits to demonstrate",
    pageWidth / 2, y + 6, { align: "center" }
  );
  doc.text(
    "community impact through data-driven storytelling.",
    pageWidth / 2, y + 11, { align: "center" }
  );

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.medium);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    if (i > 1) {
      doc.text(program.name + " - Impact Study", margin, pageHeight - 8);
    }
  }

  const slug = program.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  doc.save(`${slug}_Impact_Study.pdf`);
}
