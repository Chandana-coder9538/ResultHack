import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AnalysisPayload,
  SubjectAnalysis,
  AnalysisConfig,
  SemesterSummary,
  formatFacultyDisplay,
} from '../types/analyzer';
import {
  getUBDTLogoDataUrl,
  getVTULogoDataUrl,
  getIQACLogoDataUrl,
  UBDT_OFFICIAL_LOGO_DATAURL,
  VTU_OFFICIAL_LOGO_DATAURL,
  IQAC_OFFICIAL_LOGO_DATAURL,
} from './institutionalLogos';

import { College, Department } from '../types/auth';

type SubjectSummaryItem = SemesterSummary['subjectSummaries'][number];

export interface PdfBrandingInfo {
  collegeName?: string;
  universityName?: string;
  departmentName?: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
}

/**
 * Safely resolves and extracts effective multi-tenant institutional branding:
 * Priority:
 * 1. Explicitly passed branding or college/department objects
 * 2. Active authenticated department or college session from sessionStorage
 * 3. Payload configuration (semesterDetails)
 * 4. High-fidelity institutional fallbacks
 */
export function getEffectiveBranding(
  payload?: AnalysisPayload,
  college?: College | null,
  department?: Department | null,
  overrides?: PdfBrandingInfo
): {
  collegeName: string;
  universityName: string;
  departmentName: string;
  collegeLogoUrl: string;
  universityLogoUrl: string;
} {
  let storedCollege: College | null = college || null;
  let storedDepartment: Department | null = department || null;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    if (!storedDepartment) {
      try {
        const rawDept = sessionStorage.getItem('marks_analyzer_dept_auth');
        if (rawDept) {
          const parsed = JSON.parse(rawDept);
          if (parsed.department) storedDepartment = parsed.department;
          if (parsed.college && !storedCollege) storedCollege = parsed.college;
        }
      } catch {}
    }

    if (!storedCollege) {
      try {
        const rawCol = sessionStorage.getItem('marks_analyzer_college_auth');
        if (rawCol) {
          const parsed = JSON.parse(rawCol);
          if (parsed.college) storedCollege = parsed.college;
        }
      } catch {}
    }

    if (!storedCollege) {
      try {
        const rawSel = sessionStorage.getItem('marks_analyzer_selected_college');
        if (rawSel) {
          const parsed = JSON.parse(rawSel);
          if (parsed.name) storedCollege = parsed;
        }
      } catch {}
    }
  }

  const semDetails = payload?.config?.semesterDetails;

  const collegeName = (
    overrides?.collegeName ||
    storedCollege?.name ||
    semDetails?.college ||
    'University B.D.T. College of Engineering, Davangere'
  ).trim();

  const universityName = (
    overrides?.universityName ||
    storedCollege?.universityName ||
    semDetails?.university ||
    'Visvesvaraya Technological University, Belagavi'
  ).trim();

  const departmentName = (
    overrides?.departmentName ||
    storedDepartment?.name ||
    semDetails?.department ||
    semDetails?.branch ||
    'Academic Department'
  ).trim();

  // Uploaded college logo priority -> UBDT seal
  const collegeLogoUrl =
    overrides?.collegeLogoUrl ||
    storedCollege?.collegeLogoUrl ||
    semDetails?.collegeLogoUrl ||
    getUBDTLogoDataUrl();

  // Uploaded university logo priority -> VTU seal
  const universityLogoUrl =
    overrides?.universityLogoUrl ||
    storedCollege?.universityLogoUrl ||
    semDetails?.universityLogoUrl ||
    getVTULogoDataUrl();

  return {
    collegeName,
    universityName,
    departmentName,
    collegeLogoUrl,
    universityLogoUrl,
  };
}

/**
 * Safely renders a logo image onto a jsPDF canvas.
 * Supports PNG and JPEG data URLs, and gracefully falls back to institutional seal
 * if the provided logo is empty, corrupt, or unsupported (e.g. raw SVG).
 */
export function drawPdfLogoSafely(
  doc: jsPDF,
  logoUrl: string | undefined | null,
  fallbackUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const tryDraw = (url: string | undefined | null): boolean => {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:image/svg')) return false;
    if (!url.startsWith('data:image/')) return false;

    try {
      const format = (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) ? 'JPEG' : 'PNG';
      doc.addImage(url, format, x, y, w, h);
      return true;
    } catch {
      return false;
    }
  };

  if (tryDraw(logoUrl)) {
    return;
  }
  if (tryDraw(fallbackUrl)) {
    return;
  }
}

// Modern Executive Color Palette
const COLOR_NAVY = [15, 23, 42] as [number, number, number]; // Slate-900 (#0f172a)
const COLOR_PRIMARY = [30, 58, 138] as [number, number, number]; // Dark Navy (#1e3a8a)
const COLOR_TEXT_DARK = [15, 23, 42] as [number, number, number]; // Slate-900
const COLOR_TEXT_MUTED = [100, 116, 139] as [number, number, number]; // Slate-500
const COLOR_TEXT_LIGHT = [241, 245, 249] as [number, number, number]; // Slate-100
const COLOR_SUCCESS = [16, 185, 129] as [number, number, number]; // Emerald-600
const COLOR_INFO = [37, 99, 235] as [number, number, number]; // Blue-600
const COLOR_WARNING = [217, 119, 6] as [number, number, number]; // Amber-600
const COLOR_TEAL = [13, 148, 136] as [number, number, number]; // Teal-600
const COLOR_DANGER = [225, 29, 72] as [number, number, number]; // Rose-600
const COLOR_BORDER = [226, 232, 240] as [number, number, number]; // Slate-200
const COLOR_CARD_BG = [255, 255, 255] as [number, number, number]; // White
const COLOR_ZEBRA = [248, 250, 252] as [number, number, number]; // Slate-50

/**
 * 1. Header Band — Full-width dark navy bar with report title, subtitle, source, right metadata & pill badge
 */
function addDocHeaderBand(
  doc: jsPDF,
  title: string,
  subtitle: string,
  sourceText: string,
  metaRight: string[],
  pillBadgeText?: string,
  collegeLogoUrl?: string,
  universityLogoUrl?: string
) {
  const pageWidth = doc.internal.pageSize.width;
  const headerHeight = 25;

  // Dark Navy Header Bar
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Embed uploaded college and university logos in header band
  try {
    drawPdfLogoSafely(doc, collegeLogoUrl, getUBDTLogoDataUrl(), 12, 4, 17, 17);
    drawPdfLogoSafely(doc, universityLogoUrl, getVTULogoDataUrl(), pageWidth - 14 - 17, 4, 17, 17);
  } catch (e) {
    // Fail-safe in case of image rendering issues
  }

  // Title: Bold, Large, White (offset to 33mm for logo breathing room)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(title, 33, 9.5);

  // Subtitle Line (Subject/Entity + Owner)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(224, 231, 255); // Soft blue-white
  doc.text(subtitle, 33, 14.5);

  // Small source/reference line in a muted tone
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(sourceText, 33, 19.5);

  // Right-aligned Metadata (Date, Total Count)
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  const metaRightOffset = pageWidth - 14 - 20;
  metaRight.forEach((txt, idx) => {
    doc.text(txt, metaRightOffset, 8 + idx * 4, { align: 'right' });
  });

  // Small rounded "pill" badge for key allocation / split info
  if (pillBadgeText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    const pillW = doc.getTextWidth(pillBadgeText) + 8;
    const pillH = 4.8;
    const pillX = metaRightOffset - pillW;
    const pillY = 16.5;

    // Pill background
    doc.setFillColor(30, 58, 138); // Darker blue pill
    doc.roundedRect(pillX, pillY, pillW, pillH, 2.4, 2.4, 'F');
    doc.setDrawColor(96, 165, 250); // Light blue border
    doc.setLineWidth(0.3);
    doc.roundedRect(pillX, pillY, pillW, pillH, 2.4, 2.4, 'D');

    // Pill text
    doc.setTextColor(239, 246, 255);
    doc.text(pillBadgeText, pillX + pillW / 2, pillY + 3.4, { align: 'center' });
  }

  doc.setTextColor(...COLOR_TEXT_DARK);
}

/**
 * 2. KPI Card Row — 3-5 equal-width white cards with thin colored accent bar on left edge
 */
interface KPICardItem {
  label: string;
  value: string;
  sub: string;
  accentColor: [number, number, number]; // [r, g, b]
}

function drawKPICardRow(doc: jsPDF, cards: KPICardItem[], yPos: number): number {
  const pageWidth = doc.internal.pageSize.width;
  const leftMargin = 14;
  const rightMargin = 14;
  const availableWidth = pageWidth - leftMargin - rightMargin;
  const gap = 3;
  const cardWidth = (availableWidth - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 19;

  cards.forEach((card, idx) => {
    const x = leftMargin + idx * (cardWidth + gap);

    // Card white background + border
    doc.setFillColor(...COLOR_CARD_BG);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 1.5, 1.5, 'D');

    // Thin colored accent bar on left edge (1.2mm wide)
    doc.setFillColor(...card.accentColor);
    doc.roundedRect(x, yPos, 1.5, cardHeight, 0.7, 0.7, 'F');

    // Small uppercase label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(card.label.toUpperCase(), x + 4, yPos + 4.8);

    // Large bold headline number
    doc.setFontSize(11);
    doc.setTextColor(...card.accentColor);
    doc.text(card.value, x + 4, yPos + 11.2);

    // Small gray subtext underneath
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(card.sub, x + 4, yPos + 15.8);
  });

  return yPos + cardHeight + 6;
}

/**
 * 3. Section Title with Small Numbered Square Badge
 */
function drawNumberedSectionHeading(
  doc: jsPDF,
  numberText: string,
  title: string,
  yPos: number,
  badgeBgColor: [number, number, number] = COLOR_NAVY
): number {
  const badgeSize = 4.5;
  const leftMargin = 14;

  // Numbered Square Badge
  doc.setFillColor(...badgeBgColor);
  doc.roundedRect(leftMargin, yPos - 3.5, badgeSize, badgeSize, 0.8, 0.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(numberText, leftMargin + badgeSize / 2, yPos - 0.2, { align: 'center' });

  // Section Title
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TEXT_DARK);
  doc.text(title, leftMargin + badgeSize + 2.5, yPos);

  return yPos + 2.5;
}

/**
 * Standardized Page Footer with Divider Line, System Info & Page Count
 */
function addDocFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const footerY = pageHeight - 7.5;

    // Thin divider line
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, footerY - 2.5, pageWidth - 14, footerY - 2.5);

    // Footer Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`Generated by Semester Marks Analyzer System | ${dateStr} at ${timeStr}`, 14, footerY + 0.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, footerY + 0.5, { align: 'right' });
  }
}

/**
 * Generates a clean, transparent-background Grade Distribution Chart (Matplotlib style)
 */
function generateSubjectGradeChartImage(analysis: SubjectAnalysis, config: AnalysisConfig): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const scale = 2; // high-dpi crispness
  canvas.width = 460 * scale;
  canvas.height = 200 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);
  const width = 460;
  const height = 200;

  // Transparent / ultra-soft background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Bordered card style
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Chart Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
  ctx.fillText('Grade Band Distribution (Count & Ratio)', 14, 18);

  const gs = analysis.gradeSummary;
  const total = gs.totalStudents || 1;

  const categories = [
    { label: 'FCD', sub: `≥${config.gradingBands.fcdMin}%`, count: gs.fcdCount, color: '#10b981' },
    { label: 'FC', sub: `≥${config.gradingBands.fcMin}%`, count: gs.fcCount, color: '#2563eb' },
    { label: 'SC', sub: `≥${config.gradingBands.scMin}%`, count: gs.scCount, color: '#0284c7' },
    { label: 'Pass', sub: `≥${config.gradingBands.passMin}%`, count: gs.passCount, color: '#d97706' },
    { label: 'Fail', sub: `<${config.gradingBands.passMin}%`, count: gs.failCount, color: '#e11d48' },
  ];

  const maxCount = Math.max(...categories.map((c) => c.count), 1);
  const chartLeft = 24;
  const chartWidth = width - 40;
  const chartTop = 38;
  const chartHeight = 120;
  const barWidth = 48;
  const gap = (chartWidth - barWidth * categories.length) / (categories.length - 1);

  // Minimal Gridlines (Matplotlib style)
  const gridSteps = 4;
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 0.8;

  for (let i = 0; i <= gridSteps; i++) {
    const y = chartTop + chartHeight - (i / gridSteps) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartLeft + chartWidth, y);
    ctx.stroke();

    const val = Math.round((i / gridSteps) * maxCount);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(val), chartLeft - 4, y + 3);
  }

  // Draw Bars with values above bars
  categories.forEach((cat, idx) => {
    const x = chartLeft + idx * (barWidth + gap);
    const barH = Math.max((cat.count / maxCount) * chartHeight, cat.count > 0 ? 4 : 0);
    const y = chartTop + chartHeight - barH;

    // Bar Fill with soft rounded top
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    const r = Math.min(3, barH / 2);
    ctx.moveTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + barWidth - r, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
    ctx.lineTo(x + barWidth, chartTop + chartHeight);
    ctx.lineTo(x, chartTop + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Value label above bar
    const pct = ((cat.count / total) * 100).toFixed(0);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${cat.count} (${pct}%)`, x + barWidth / 2, Math.max(y - 4, chartTop + 8));

    // Category Label below bar
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 8.5px Helvetica, Arial, sans-serif';
    ctx.fillText(cat.label, x + barWidth / 2, chartTop + chartHeight + 13);

    ctx.fillStyle = '#64748b';
    ctx.font = '7.5px Helvetica, Arial, sans-serif';
    ctx.fillText(cat.sub, x + barWidth / 2, chartTop + chartHeight + 23);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Generates an Internal, External, and Total Marks Component Comparison Chart
 * Specifically included in each subject analysis!
 */
function generateSubjectInternalExternalTotalChart(analysis: SubjectAnalysis): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = 760 * scale;
  canvas.height = 145 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);
  const width = 760;
  const height = 145;

  // Background card
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
  ctx.fillText('Assessment Component Breakdown (Internal IA vs External SEE vs Total Marks)', 14, 18);

  ctx.fillStyle = '#64748b';
  ctx.font = '8.5px Helvetica, Arial, sans-serif';
  ctx.fillText(
    `Scheme Maximums — Internal (IA): ${analysis.maxInternal} | External (SEE): ${analysis.maxExternal} | Total: ${analysis.maxTotal}`,
    14,
    30
  );

  // Calculate statistics for IA, SEE, and Total
  const students = analysis.allStudents;
  const count = students.length || 1;

  const iaMarks = students.map((s) => s.internalMarks);
  const extMarks = analysis.isInternalOnly ? [] : students.map((s) => s.externalMarks);
  const totMarks = students.map((s) => s.totalMarks);

  const iaMax = Math.max(...iaMarks, 0);
  const extMax = analysis.isInternalOnly ? 0 : Math.max(...extMarks, 0);
  const totMax = Math.max(...totMarks, 0);

  const iaMin = Math.min(...iaMarks, 0);
  const extMin = analysis.isInternalOnly ? 0 : Math.min(...extMarks, 0);
  const totMin = Math.min(...totMarks, 0);

  const metrics = [
    {
      title: 'INTERNAL (IA) PERFORMANCE',
      maxScheme: analysis.maxInternal,
      peakText: `${iaMax} / ${analysis.maxInternal}`,
      highest: `${iaMax}`,
      lowest: `${iaMin}`,
      color: '#2563eb', // Blue
      pct: analysis.maxInternal > 0 ? (Number(iaMax) / analysis.maxInternal) * 100 : 0,
    },
    {
      title: analysis.isInternalOnly ? 'EXTERNAL (SEE) — N/A' : 'EXTERNAL (SEE) PERFORMANCE',
      maxScheme: analysis.maxExternal,
      peakText: analysis.isInternalOnly ? 'Internal Only' : `${extMax} / ${analysis.maxExternal}`,
      highest: analysis.isInternalOnly ? '-' : `${extMax}`,
      lowest: analysis.isInternalOnly ? '-' : `${extMin}`,
      color: '#0d9488', // Teal
      pct: !analysis.isInternalOnly && analysis.maxExternal > 0 ? (Number(extMax) / analysis.maxExternal) * 100 : 0,
    },
    {
      title: 'OVERALL TOTAL MARKS',
      maxScheme: analysis.maxTotal,
      peakText: `${totMax} / ${analysis.maxTotal}`,
      highest: `${totMax}`,
      lowest: `${totMin}`,
      color: '#10b981', // Emerald
      pct: analysis.maxTotal > 0 ? (Number(totMax) / analysis.maxTotal) * 100 : 0,
    },
  ];

  const colW = (width - 28 - 20) / 3;
  const topY = 44;
  const colH = 88;

  metrics.forEach((m, idx) => {
    const x = 14 + idx * (colW + 10);

    // Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, topY, colW, colH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(x, topY, colW, colH);

    // Top color strip
    ctx.fillStyle = m.color;
    ctx.fillRect(x, topY, colW, 3);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px Helvetica, Arial, sans-serif';
    ctx.fillText(m.title, x + 8, topY + 16);

    // Peak score
    ctx.fillStyle = '#64748b';
    ctx.font = '8px Helvetica, Arial, sans-serif';
    ctx.fillText('Peak Score:', x + 8, topY + 30);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillText(m.peakText, x + 70, topY + 30);

    // Progress Bar showing percentage of max scheme
    const barX = x + 8;
    const barY = topY + 38;
    const barW = colW - 16;
    const barH = 7;

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = m.color;
    const fillW = Math.min(barW, (m.pct / 100) * barW);
    ctx.fillRect(barX, barY, fillW, barH);

    // Highest & Lowest
    ctx.fillStyle = '#64748b';
    ctx.font = '8px Helvetica, Arial, sans-serif';
    ctx.fillText(`Lowest: ${m.lowest}  |  Highest: ${m.highest}`, x + 8, topY + 58);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 8px Helvetica, Arial, sans-serif';
    ctx.fillText(`Top Attainment: ${m.pct.toFixed(1)}% of Component Max`, x + 8, topY + 72);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Generates Semester Comparative Subject Pass Rate Chart
 */
function generateSemesterComparisonChartImage(
  subjectSummaries: SubjectSummaryItem[],
  overallPassPct: number
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = 460 * scale;
  canvas.height = 200 * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);
  const width = 460;
  const height = 200;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  // Sharp rectangle border with minimal bold (not more bold)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.0;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
  ctx.fillText('Subject Clearance Pass Rate (%) Comparison', 14, 18);

  const chartLeft = 24;
  const chartWidth = width - 40;
  const chartTop = 38;
  const chartHeight = 120;

  const count = subjectSummaries.length;
  if (count === 0) return canvas.toDataURL('image/png');

  const barWidth = Math.min(46, (chartWidth - 20) / count - 8);
  const totalSpacing = chartWidth - barWidth * count;
  const gap = totalSpacing / (count + 1);

  // Gridlines
  const steps = [0, 25, 50, 75, 100];
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 0.8;

  steps.forEach((step) => {
    const y = chartTop + chartHeight - (step / 100) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartLeft + chartWidth, y);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '7.5px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${step}%`, chartLeft - 4, y + 2.5);
  });

  // Benchmark line at 70%
  const targetY = chartTop + chartHeight - (70 / 100) * chartHeight;
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(chartLeft, targetY);
  ctx.lineTo(chartLeft + chartWidth, targetY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Bars
  subjectSummaries.forEach((sub, idx) => {
    const x = chartLeft + gap + idx * (barWidth + gap);
    const passPct = sub.passPercentage;
    const barH = Math.max((passPct / 100) * chartHeight, 4);
    const y = chartTop + chartHeight - barH;

    let barColor = '#2563eb'; // Blue
    if (passPct >= 70) barColor = '#10b981'; // Green
    else if (passPct < 40) barColor = '#e11d48'; // Rose

    ctx.fillStyle = barColor;
    ctx.fillRect(x, y, barWidth, barH);

    // Value above bar
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 8.5px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${passPct}%`, x + barWidth / 2, Math.max(y - 4, chartTop + 8));

    // Label below bar
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 7.5px Helvetica, Arial, sans-serif';
    ctx.fillText(sub.subjectCode, x + barWidth / 2, chartTop + chartHeight + 12);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Generates official University BDT College of Engineering seal as PNG data URL
 */
export function generateUBDTCollegeLogoDataUrl(): string {
  return getUBDTLogoDataUrl();
}

/**
 * Generates official VTU seal as PNG data URL
 */
export function generateVTULogoDataUrl(): string {
  return getVTULogoDataUrl();
}

export interface UBDTOfficialBreakdown {
  totalStudents: number;
  passedStudents: number;
  passPercentage: number;
  maxInternal: number;
  maxExternal: number;
  maxTotal: number;

  intFCD: number; intFCDPct: number;
  intFC: number;  intFCPct: number;
  intSC: number;  intSCPct: number;
  intPass: number;intPassPct: number;
  intFail: number;intFailPct: number;

  extFCD: number; extFCDPct: number;
  extFC: number;  extFCPct: number;
  extSC: number;  extSCPct: number;
  extPass: number;extPassPct: number;
  extFail: number;extFailPct: number;

  totFCD: number; totFCDPct: number;
  totFC: number;  totFCPct: number;
  totSC: number;  totSCPct: number;
  totPass: number;totPassPct: number;
  totFail: number;totFailPct: number;
}

/**
 * Calculates exact internal, external, and total grade distribution
 * following the VTU / UBDT evaluation framework (FCD >= 70%, FC: 60-69%, SC: 50-59%, Pass: 40-49%, Fail: <40%)
 */
export function calculateUBDTOfficialBreakdown(
  analysis: SubjectAnalysis,
  config?: AnalysisConfig
): UBDTOfficialBreakdown {
  const students = analysis.allStudents || [];
  const totalStudents = students.length;
  const maxInternal = analysis.maxInternal || 50;
  const maxExternal = analysis.maxExternal || (analysis.isInternalOnly ? 0 : 50);
  const maxTotal = analysis.maxTotal || (maxInternal + maxExternal);

  let intFCD = 0, intFC = 0, intSC = 0, intPass = 0, intFail = 0;
  let extFCD = 0, extFC = 0, extSC = 0, extPass = 0, extFail = 0;
  let totFCD = 0, totFC = 0, totSC = 0, totPass = 0, totFail = 0;

  students.forEach((s) => {
    // 1. Internal Marks
    const intPct = maxInternal > 0 ? (s.internalMarks / maxInternal) * 100 : 0;
    if (intPct >= 70) intFCD++;
    else if (intPct >= 60) intFC++;
    else if (intPct >= 50) intSC++;
    else if (intPct >= 40) intPass++;
    else intFail++;

    // 2. External Marks (if applicable)
    if (maxExternal > 0) {
      const extPct = (s.externalMarks / maxExternal) * 100;
      const hasExtFailReason = s.failReasons?.some((r) => r.toLowerCase().includes('external'));
      if (extPct < 35 || hasExtFailReason) {
        extFail++;
      } else if (extPct >= 70) {
        extFCD++;
      } else if (extPct >= 60) {
        extFC++;
      } else if (extPct >= 50) {
        extSC++;
      } else if (extPct >= 40) {
        extPass++;
      } else {
        extFail++;
      }
    }

    // 3. Total Marks
    if (s.computedResult === 'Fail') {
      totFail++;
    } else {
      const totPct = maxTotal > 0 ? (s.totalMarks / maxTotal) * 100 : 0;
      if (totPct >= 70) totFCD++;
      else if (totPct >= 60) totFC++;
      else if (totPct >= 50) totSC++;
      else if (totPct >= 40) totPass++;
      else totFail++;
    }
  });

  const passedStudents = totalStudents - totFail;
  const passPercentage = totalStudents > 0 ? Number(((passedStudents / totalStudents) * 100).toFixed(1)) : 0;

  const calcPct = (cnt: number) => (totalStudents > 0 ? Number(((cnt / totalStudents) * 100).toFixed(1)) : 0);

  return {
    totalStudents,
    passedStudents,
    passPercentage,
    maxInternal,
    maxExternal,
    maxTotal,

    intFCD, intFCDPct: calcPct(intFCD),
    intFC,  intFCPct: calcPct(intFC),
    intSC,  intSCPct: calcPct(intSC),
    intPass,intPassPct: calcPct(intPass),
    intFail,intFailPct: calcPct(intFail),

    extFCD, extFCDPct: calcPct(extFCD),
    extFC,  extFCPct: calcPct(extFC),
    extSC,  extSCPct: calcPct(extSC),
    extPass,extPassPct: calcPct(extPass),
    extFail,extFailPct: calcPct(extFail),

    totFCD, totFCDPct: calcPct(totFCD),
    totFC,  totFCPct: calcPct(totFC),
    totSC,  totSCPct: calcPct(totSC),
    totPass,totPassPct: calcPct(totPass),
    totFail,totFailPct: calcPct(totFail),
  };
}

/**
 * Generates the high-resolution official grouped bar chart image:
 * Grouped bars for FCD, FC, SC, Pass, Fail comparing Final CIE Marks, SEE Marks, and Final Marks
 */
export function generateOfficialUBDTResultChart(b: UBDTOfficialBreakdown): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 362;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Outer border box - sharp rectangle border with minimal bold (not rounded, not more bold)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.0;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Top header bar inside panel
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(1, 1, width - 2, 40);

  // Divider line below header - black border with minimal bold
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(1, 41);
  ctx.lineTo(width - 1, 41);
  ctx.stroke();

  // Chart Title in Header
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RESULT ANALYSIS: CIE, SEE AND FINAL MARKS IN %', width / 2, 21);

  // Plot Area Dimensions
  const plotLeft = 80;
  const plotRight = width - 40;
  const plotTop = 60;
  const plotBottom = 295;
  const plotHeight = plotBottom - plotTop;
  const plotWidth = plotRight - plotLeft;

  // Y-axis ticks and horizontal gridlines (0, 20, 40, 60, 80, 100)
  for (let v = 0; v <= 100; v += 20) {
    const y = plotBottom - (v / 100) * plotHeight;

    // Horizontal gridline
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.strokeStyle = v === 0 ? '#cbd5e1' : '#f8fafc';
    ctx.lineWidth = v === 0 ? 0.6 : 0.4;
    ctx.stroke();

    // Tick label
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(v), plotLeft - 10, y);
  }

  // Y-axis main vertical line - minimal strength
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop - 8);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Y-axis Label (% of Students, rotated -90 deg)
  ctx.save();
  ctx.translate(28, plotTop + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('% of Students', 0, 0);
  ctx.restore();

  // Categories definition
  const categories = [
    { name: 'FCD', intVal: b.intFCDPct, extVal: b.extFCDPct, totVal: b.totFCDPct },
    { name: 'FC',  intVal: b.intFCPct,  extVal: b.extFCPct,  totVal: b.totFCPct },
    { name: 'SC',  intVal: b.intSCPct,  extVal: b.extSCPct,  totVal: b.totSCPct },
    { name: 'Pass',intVal: b.intPassPct,extVal: b.extPassPct,totVal: b.totPassPct },
    { name: 'Fail',intVal: b.intFailPct,extVal: b.extFailPct,totVal: b.totFailPct },
  ];

  const colWidth = plotWidth / categories.length;
  const barWidth = 32;
  const barGap = 4;
  const totalGroupWidth = barWidth * 3 + barGap * 2;

  categories.forEach((cat, idx) => {
    const catCenterX = plotLeft + (idx + 0.5) * colWidth;

    // Category Name below X-axis
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(cat.name, catCenterX, plotBottom + 8);

    const startX = catCenterX - totalGroupWidth / 2;

    const drawBar = (x: number, pct: number, color: string) => {
      const h = (pct / 100) * plotHeight;
      const barY = plotBottom - h;

      if (h > 0) {
        ctx.fillStyle = color;
        // Clean rectangle bar
        ctx.fillRect(x, barY, barWidth, h);

        // Value label on top of bar
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${pct.toFixed(1)}%`, x + barWidth / 2, barY - 3);
      } else {
        // Even if 0%, show subtle baseline marker in the color and explicit '0.0%' label above it
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, plotBottom - 2.5, barWidth, 2.5);
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 10.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('0.0%', x + barWidth / 2, plotBottom - 3.5);
      }
    };

    // 1. Blue: Final CIE Marks (#1f77b4)
    drawBar(startX, cat.intVal, '#1f77b4');

    // 2. Orange: SEE Marks (#ff7f0e)
    drawBar(startX + barWidth + barGap, cat.extVal, '#ff7f0e');

    // 3. Green: Final Total Marks (#2ca02c)
    drawBar(startX + (barWidth + barGap) * 2, cat.totVal, '#2ca02c');
  });

  // Legend at bottom
  const legendY = 340;
  const legendItems = [
    { label: 'Final CIE Marks', color: '#1f77b4' },
    { label: 'SEE Marks', color: '#ff7f0e' },
    { label: 'Final Marks', color: '#2ca02c' },
  ];

  let currentLegendX = width / 2 - 210;
  legendItems.forEach((item) => {
    ctx.fillStyle = item.color;
    // Clean rectangle swatch
    ctx.fillRect(currentLegendX, legendY - 6, 16, 12);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, currentLegendX + 22, legendY);

    currentLegendX += 150;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Extracts course metadata with intelligent defaults matching the official UBDT sample pattern
 */
export function getSubjectOfficialMetadata(
  analysis: SubjectAnalysis,
  config?: AnalysisConfig,
  customDepartmentName?: string
) {
  const cfg = config?.subjectsConfig?.[analysis.subjectCode];

  // Auto-deduce semester from subject config or primary entered semester details (e.g. 6th Sem)
  let semester = cfg?.semester || config?.semesterDetails?.semester || analysis.semester;
  if (!semester) {
    const semMatch = analysis.subjectCode.match(/[A-Za-z]+(\d)/);
    if (semMatch && semMatch[1]) {
      const num = parseInt(semMatch[1], 10);
      semester = num === 1 ? '1st' : num === 2 ? '2nd' : num === 3 ? '3rd' : `${num}th`;
    } else {
      semester = '4th';
    }
  }

  // Course name
  let courseName = cfg?.courseName || analysis.courseName;
  if (!courseName) {
    if (analysis.displayName && analysis.displayName !== analysis.subjectCode) {
      courseName = analysis.displayName.toUpperCase();
    } else {
      courseName = analysis.subjectCode.toUpperCase();
    }
  }

  const actionPlan = (cfg?.actionPlan && cfg.actionPlan.length > 0)
    ? cfg.actionPlan
    : (analysis.actionPlan && analysis.actionPlan.length > 0)
      ? analysis.actionPlan
      : [
          'Counselling after tests for students needing improvement.',
          'Special assignments and additional practice for difficult topics.',
          'More attention and focused participation in class.',
        ];

  // Faculty name computation strictly following user rule:
  // "In the subject wise analysis whatever the pdf output given there you have to add the faculty name that's it not section separetely if suppose the two faculty handling the subject then you have to add the faultly names one by one like Nirmala(A Section) & Janavi(B Section) otherwise just faculty name and also remove designation column of the faculty"
  let facultyName = '';
  if (cfg) {
    facultyName = formatFacultyDisplay(cfg);
  }
  if (!facultyName || facultyName === 'Unassigned') {
    facultyName = formatFacultyDisplay({ facultyName: analysis.facultyName });
  }
  if (!facultyName || facultyName === 'Unassigned') {
    facultyName = analysis.facultyName || 'PAVITHRA M R';
  }

  // Branch (without section)
  const rawBranch =
    customDepartmentName ||
    config?.semesterDetails?.department ||
    config?.semesterDetails?.branch ||
    cfg?.branchSection ||
    analysis.branchSection ||
    'Academic Department';
  // Keep clean branch name, strip any trailing section info
  let branch = rawBranch.replace(/,\s*.*sec.*$/i, '').trim();
  if (branch.toLowerCase().startsWith('department of')) {
    branch = branch.replace(/^department of\s*/i, '').trim();
  }
  
  // Abbreviate common engineering branches cleanly or preserve clean department name
  if (branch.toLowerCase().includes('computer science')) {
    branch = 'CS&E';
  } else if (branch.toLowerCase().includes('electronics') && branch.toLowerCase().includes('communication')) {
    branch = 'E&CE';
  } else if (branch.toLowerCase().includes('electrical')) {
    branch = 'E&EE';
  } else if (branch.toLowerCase().includes('mechanical')) {
    branch = 'ME';
  } else if (branch.toLowerCase().includes('civil')) {
    branch = 'CV';
  } else if (branch.toLowerCase().includes('information science')) {
    branch = 'IS&E';
  } else if (branch.toLowerCase().includes('artificial intelligence')) {
    branch = 'AI&DS';
  }

  return {
    courseName: courseName.toUpperCase(),
    facultyName,
    courseCode: analysis.subjectCode,
    academicYear: cfg?.academicYear || config?.semesterDetails?.academicYear || analysis.academicYear || '2025-2026',
    branch: branch || 'Academic Branch',
    scheme: cfg?.scheme || analysis.scheme || config?.semesterDetails?.scheme || '2022',
    semester,
    batch: cfg?.batch || analysis.batch || '2024-2028',
    actionPlan,
  };
}

/**
 * Renders the EXACT Official UBDT Subject Analysis Report Page 1
 * Spacious, neat, and uncompacted layout with UI-friendly separation gaps:
 * 1. Uploaded College & University Logos + Institutional Header
 * 2. Course and Faculty Info Grid with comfortable cell padding
 * 3. Summary KPIs Row with soft lavender tint
 * 4. Result Analysis Breakdown Table
 * 5. High-resolution Grouped Bar Chart
 * 6. Structured Inference Drawn Card
 * 7. Structured Action Plan Card
 * 8. Official Signatures (Course Teacher & Chairman)
 */
export function renderUBDTOfficialSubjectAnalysisPage(
  doc: jsPDF,
  analysis: SubjectAnalysis,
  config?: AnalysisConfig,
  isNewPage: boolean = false,
  college?: College | null,
  department?: Department | null
) {
  if (isNewPage) {
    doc.addPage();
  }

  const branding = getEffectiveBranding(undefined, college, department, {
    collegeName: config?.semesterDetails?.college,
    departmentName: config?.semesterDetails?.department || config?.semesterDetails?.branch,
  });

  const meta = getSubjectOfficialMetadata(analysis, config, branding.departmentName);
  const b = calculateUBDTOfficialBreakdown(analysis, config);

  // 1. Emblems (Logos) - Uploaded College logo on left, Uploaded University logo on right
  drawPdfLogoSafely(doc, branding.collegeLogoUrl, generateUBDTCollegeLogoDataUrl(), 14, 11, 16.5, 16.5);
  drawPdfLogoSafely(doc, branding.universityLogoUrl, generateVTULogoDataUrl(), 179.5, 11, 16.5, 16.5);

  // 2. Institutional Header Lines with aesthetic vertical rhythm:
  // First write University Details -> then little font for college name & its information -> then department
  const deptName = branding.departmentName.toUpperCase().startsWith('DEPARTMENT OF')
    ? branding.departmentName.toUpperCase()
    : `DEPARTMENT OF ${branding.departmentName.toUpperCase()}`;

  // 1) University Details FIRST (Prominent, Bold, Stately)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    branding.universityName.toUpperCase(),
    105,
    12.5,
    { align: 'center' }
  );

  // 2) Then little font considered to the College Name & its information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    branding.collegeName,
    105,
    16.8,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `(A Constituent College of ${branding.universityName} | Recognized by AICTE, New Delhi)`,
    105,
    20.5,
    { align: 'center' }
  );

  // 3) Then as same for the Department and all stuff
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(deptName, 105, 24.5, {
    align: 'center',
  });

  // Subtle aesthetic separator line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(14, 27.5, 196, 27.5);

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RESULT ANALYSIS: CIE, SEE AND FINAL MARKS', 105, 32, { align: 'center' });

  let currentY = 35;

  // 3. Course and Faculty Information Table with minimal black grid (no shadow/shading)
  autoTable(doc, {
    startY: currentY,
    body: [
      [
        {
          content: `COURSE NAME : ${meta.courseName}`,
          colSpan: 4,
          styles: {
            fontStyle: 'bold',
            halign: 'left',
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          },
        },
      ],
      [
        { content: 'Name of Faculty', styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.facultyName, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'Course code', styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.courseCode, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
      [
        { content: 'Branch', styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.branch, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'Academic year', styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.academicYear, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
      [
        { content: 'Semester', styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.semester, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'Scheme', styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.scheme, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
    ],
    theme: 'grid',
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      font: 'helvetica',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 38, halign: 'left' },
      1: { cellWidth: 53, halign: 'left' },
      2: { cellWidth: 38, halign: 'left' },
      3: { cellWidth: 53, halign: 'left' },
    },
    margin: { left: 14, right: 14 },
  });

  // Spacious UI gap between Course Info and Summary KPIs
  currentY = (doc as any).lastAutoTable.finalY + 4.5;

  // 4. Summary KPIs Row Table with minimal black grid (no shadow/shading)
  autoTable(doc, {
    startY: currentY,
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    head: [['Students Appeared', 'Passed', 'Pass %', 'CIE Max', 'SEE Max', 'Final Max']],
    body: [
      [
        String(b.totalStudents),
        String(b.passedStudents),
        `${b.passPercentage}%`,
        String(b.maxInternal),
        String(b.maxExternal),
        String(b.maxTotal),
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      font: 'helvetica',
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 30.33, fontStyle: 'bold', textColor: [0, 0, 0] },
      1: { cellWidth: 30.33, fontStyle: 'bold', textColor: [0, 0, 0] },
      2: { cellWidth: 30.33, fontStyle: 'bold', textColor: [0, 0, 0] },
      3: { cellWidth: 30.33, textColor: [0, 0, 0] },
      4: { cellWidth: 30.33, textColor: [0, 0, 0] },
      5: { cellWidth: 30.35, fontStyle: 'bold', textColor: [0, 0, 0] },
    },
    margin: { left: 14, right: 14 },
  });

  // Spacious UI gap between KPIs and Breakdown Table
  currentY = (doc as any).lastAutoTable.finalY + 4.5;

  // 5. Result Analysis Breakdown Table with minimal black grid (no shadow/shading)
  autoTable(doc, {
    startY: currentY,
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    body: [
      // Row 1
      [
        { content: 'Max. Marks', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'INTERNAL MARKS', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'EXTERNAL MARKS', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'TOTAL MARKS', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
      // Row 2
      [
        { content: '', styles: { fillColor: [255, 255, 255], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'No. of Students', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: '% of Students', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'No. of Students', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: '% of Students', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'No. of Students', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: '% of Students', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
      // Row 3
      [
        { content: '', styles: { fillColor: [255, 255, 255], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: String(b.maxInternal), colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: String(b.maxExternal), colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: String(b.maxTotal), colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
      ],
      // Data Rows
      [
        { content: 'FCD', styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        String(b.intFCD), `${b.intFCDPct}%`,
        String(b.extFCD), `${b.extFCDPct}%`,
        String(b.totFCD), `${b.totFCDPct}%`,
      ],
      [
        { content: 'FC', styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        String(b.intFC), `${b.intFCPct}%`,
        String(b.extFC), `${b.extFCPct}%`,
        String(b.totFC), `${b.totFCPct}%`,
      ],
      [
        { content: 'SC', styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        String(b.intSC), `${b.intSCPct}%`,
        String(b.extSC), `${b.extSCPct}%`,
        String(b.totSC), `${b.totSCPct}%`,
      ],
      [
        { content: 'Pass', styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        String(b.intPass), `${b.intPassPct}%`,
        String(b.extPass), `${b.extPassPct}%`,
        String(b.totPass), `${b.totPassPct}%`,
      ],
      [
        { content: 'Fail', styles: { fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: String(b.intFail), styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: `${b.intFailPct}%`, styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: String(b.extFail), styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: `${b.extFailPct}%`, styles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: String(b.totFail), styles: { fontStyle: 'bold', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
        { content: `${b.totFailPct}%`, styles: { fontStyle: 'bold', textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, fillColor: [255, 255, 255] } },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      font: 'helvetica',
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', textColor: [0, 0, 0] },
      1: { cellWidth: 26, textColor: [0, 0, 0] },
      2: { cellWidth: 26, textColor: [0, 0, 0] },
      3: { cellWidth: 26, textColor: [0, 0, 0] },
      4: { cellWidth: 26, textColor: [0, 0, 0] },
      5: { cellWidth: 26, textColor: [0, 0, 0] },
      6: { cellWidth: 26, textColor: [0, 0, 0] },
    },
    margin: { left: 14, right: 14 },
  });

  // Spacious UI gap between Breakdown Table and Chart
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 6. High-Resolution Grouped Bar Chart
  const chartImg = generateOfficialUBDTResultChart(b);
  if (chartImg) {
    const chartW = 182;
    const chartH = 55;
    doc.addImage(chartImg, 'PNG', 14, currentY, chartW, chartH);
    // Sharp rectangle border with minimal bold (not rounded, not more bold)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(14, currentY, chartW, chartH, 'S');
    currentY += chartH + 5.5;
  }

  // 7. Inference Drawn from Result Analysis Container (Minimal black border, no shadow/fill)
  const inferenceBoxH = 22;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.rect(14, currentY, 182, inferenceBoxH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Inference Drawn from Result Analysis:', 19, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  // Column 1
  doc.text(`1) No. of Students Secured FCD & FC = ${b.totFCD + b.totFC} (${((b.totFCD + b.totFC) / Math.max(1, b.totalStudents) * 100).toFixed(1)}%)`, 19, currentY + 11.5);
  doc.text(`2) No. of Students Secured SC = ${b.totSC}`, 19, currentY + 16.5);
  // Column 2
  doc.text(`3) No. of Students Secured Pass Class = ${b.totPass}`, 110, currentY + 11.5);
  doc.text(`4) No. of Students Failed = ${b.totFail}`, 110, currentY + 16.5);

  currentY += inferenceBoxH + 4.5;

  // 8. Action Plan Container (Minimal black border, no shadow/fill)
  const actionBoxH = 22;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.rect(14, currentY, 182, actionBoxH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Action Plan for Continuous Improvement:', 19, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  meta.actionPlan.forEach((planItem, idx) => {
    if (idx < 3) {
      doc.text(`${idx + 1}. ${planItem}`, 19, currentY + 11 + idx * 4.5);
    }
  });

  currentY += actionBoxH + 6;

  // 9. Official Endorsement Signatures with generous breathing room
  const signatureY = Math.max(currentY + 6, 270);

  // Dotted guide lines
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1.5], 0);

  // Left signature line
  doc.line(20, signatureY - 6, 75, signatureY - 6);
  // Right signature line
  doc.line(135, signatureY - 6, 190, signatureY - 6);

  // Reset dash pattern
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Signature of the Course Teacher', 47.5, signatureY - 1, { align: 'center' });
  doc.text('Signature of Chairman / HOD', 162.5, signatureY - 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dept. of ${branding.departmentName}`, 47.5, signatureY + 3.2, { align: 'center' });
  doc.text(`Dept. of ${branding.departmentName}`, 162.5, signatureY + 3.2, { align: 'center' });
}

/**
 * Generates high-resolution bar charts for:
 * 1. Internal Marks (IA)
 * 2. External Marks (SEE)
 * 3. Total Marks
 * Matching the exact score distribution histograms from the console / dashboard.
 */
export function generateSubjectThreeDistributionCharts(analysis: SubjectAnalysis): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const width = 1500;
  const height = 420;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const isInternalOnly = analysis.isInternalOnly;
  const charts = [
    {
      title: 'Internal Evaluation (IA)',
      badge: `Max: ${analysis.maxInternal}`,
      bins: analysis.internalBins || [],
      barColor: '#059669', // Emerald-600
      accentColor: '#064e3b', // Emerald-900
      headerBg: '#f0fdf4', // Emerald-50
      badgeBg: '#dcfce7', // Emerald-100
      badgeText: '#166534', // Emerald-800
      borderColor: '#86efac', // Emerald-300
    },
    ...(isInternalOnly
      ? []
      : [
          {
            title: 'External Examination (SEE)',
            badge: `Max: ${analysis.maxExternal}`,
            bins: analysis.externalBins || [],
            barColor: '#ea580c', // Warm Orange/Amber-600
            accentColor: '#7c2d12', // Orange-900
            headerBg: '#fff7ed', // Orange-50
            badgeBg: '#ffedd5', // Orange-100
            badgeText: '#9a3412', // Orange-800
            borderColor: '#fdba74', // Orange-300
          },
        ]),
    {
      title: 'Total Aggregate Marks',
      badge: `Max: ${analysis.maxTotal}`,
      bins: analysis.totalBins || [],
      barColor: '#7c3aed', // Purple/Violet-600
      accentColor: '#4c1d95', // Purple-900
      headerBg: '#faf5ff', // Purple-50
      badgeBg: '#f3e8ff', // Purple-100
      badgeText: '#6b21a8', // Purple-800
      borderColor: '#d8b4fe', // Purple-300
    },
  ];

  const count = charts.length;
  const gap = 20;
  const marginX = 20;
  const chartWidth = (width - marginX * 2 - gap * (count - 1)) / count;
  const chartHeight = height - 16;
  const topY = 8;

  charts.forEach((ch, idx) => {
    const leftX = marginX + idx * (chartWidth + gap);

    // Box border & background - sharp rectangle border with minimal bold
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(leftX, topY, chartWidth, chartHeight);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(leftX + 0.5, topY + 0.5, chartWidth - 1, chartHeight - 1);

    // Header bar inside panel with subtle soft tint
    ctx.fillStyle = ch.headerBg;
    ctx.fillRect(leftX + 1, topY + 1, chartWidth - 2, 43);

    // Divider line below header
    ctx.beginPath();
    ctx.moveTo(leftX + 1, topY + 44);
    ctx.lineTo(leftX + chartWidth - 1, topY + 44);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Chart Title
    ctx.fillStyle = ch.accentColor;
    ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.title, leftX + 14, topY + 22);

    // Pill Badge
    const badgeW = 74;
    const badgeH = 22;
    const badgeX = leftX + chartWidth - badgeW - 12;
    const badgeY = topY + 11;
    ctx.fillStyle = ch.badgeBg;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8;
    const br = 6;
    ctx.beginPath();
    ctx.moveTo(badgeX + br, badgeY);
    ctx.lineTo(badgeX + badgeW - br, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + br);
    ctx.lineTo(badgeX + badgeW, badgeY + badgeH - br);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - br, badgeY + badgeH);
    ctx.lineTo(badgeX + br, badgeY + badgeH);
    ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - br);
    ctx.lineTo(badgeX, badgeY + br);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + br, badgeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ch.badgeText;
    ctx.font = 'bold 11px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.badge, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // Plot area within panel - spacious margins for axes naming
    const plotLeft = leftX + 54;
    const plotRight = leftX + chartWidth - 14;
    const plotTop = topY + 54;
    const plotBottom = topY + chartHeight - 56;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Y-Axis Title (Rotated -90 deg: "No. of Students")
    ctx.save();
    ctx.translate(leftX + 17, plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No. of Students', 0, 0);
    ctx.restore();

    // Determine max count for Y axis
    const maxVal = Math.max(1, ...ch.bins.map((b) => b.count));
    let yMax = Math.ceil(maxVal * 1.15);
    if (yMax < 5) yMax = 5;
    else if (yMax % 5 !== 0) yMax += 5 - (yMax % 5);

    // Draw horizontal grid lines
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const val = Math.round((yMax / steps) * s);
      const y = plotBottom - (val / yMax) * plotH;

      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.strokeStyle = s === 0 ? '#94a3b8' : '#f1f5f9';
      ctx.lineWidth = s === 0 ? 1.4 : 0.8;
      ctx.stroke();

      // Tick label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(val), plotLeft - 7, y);
    }

    // Y Axis vertical line
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop - 4);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Draw Bars
    const numBins = ch.bins.length;
    if (numBins > 0) {
      const slotW = plotW / numBins;
      const barW = Math.max(12, Math.min(32, slotW * 0.68));

      ch.bins.forEach((bin, bIdx) => {
        const slotCenterX = plotLeft + (bIdx + 0.5) * slotW;
        const barX = slotCenterX - barW / 2;
        const bH = (bin.count / yMax) * plotH;
        const barY = plotBottom - bH;

        if (bin.count > 0) {
          ctx.fillStyle = ch.barColor;
          const cornerR = Math.min(3, barW / 3);
          ctx.beginPath();
          ctx.moveTo(barX + cornerR, barY);
          ctx.lineTo(barX + barW - cornerR, barY);
          ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + cornerR);
          ctx.lineTo(barX + barW, plotBottom);
          ctx.lineTo(barX, plotBottom);
          ctx.lineTo(barX, barY + cornerR);
          ctx.quadraticCurveTo(barX, barY, barX + cornerR, barY);
          ctx.closePath();
          ctx.fill();

          // Value count above bar
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(bin.count), slotCenterX, barY - 3);
        } else {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(barX, plotBottom - 2, barW, 2);
        }

        // X-axis bin range tick label
        ctx.save();
        ctx.translate(slotCenterX, plotBottom + 6);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#475569';
        ctx.font = '10.5px monospace, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(bin.rangeLabel, 0, 0);
        ctx.restore();
      });
    }

    // X-Axis Title (Centered below plot area: "Marks Range")
    const plotCenterX = plotLeft + plotW / 2;
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Marks Range', plotCenterX, topY + chartHeight - 12);

    // Footer summary
    const totalScored = ch.bins.reduce((sum, b) => sum + b.count, 0);
    ctx.fillStyle = '#64748b';
    ctx.font = '10.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Total: ${totalScored} candidates`, plotRight, topY + chartHeight - 12);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Renders the SECOND PAGE of the Subject-Wise Analysis Report:
 * 1. Institutional Course Header & Metadata Grid with comfortable spacing
 * 2. Score Distribution Bar Charts (Internal, External, and Total Marks) as generated in the console
 * 3. Merit Rankers Table (Up to Rank 5, preserving all tied candidates) with spacious padding
 * 4. Remedial List: Failed Students with clear separation gap
 * 5. Official Endorsement Signatures (Course Teacher & Chairman)
 */
export function renderSubjectAnalysisSecondPage(
  doc: jsPDF,
  analysis: SubjectAnalysis,
  config?: AnalysisConfig,
  isNewPage: boolean = true,
  college?: College | null,
  department?: Department | null
) {
  if (isNewPage) {
    doc.addPage();
  }

  const branding = getEffectiveBranding(undefined, college, department, {
    collegeName: config?.semesterDetails?.college,
    departmentName: config?.semesterDetails?.department || config?.semesterDetails?.branch,
  });

  const meta = getSubjectOfficialMetadata(analysis, config, branding.departmentName);

  const collegeName = branding.collegeName;
  const deptName = branding.departmentName.toUpperCase().startsWith('DEPARTMENT OF')
    ? branding.departmentName.toUpperCase()
    : `DEPARTMENT OF ${branding.departmentName.toUpperCase()}`;

  // 1. Institutional & Course Header with aesthetic vertical rhythm:
  // First write University Details -> then little font for college name & info -> then department
  // 1) University Details FIRST
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    branding.universityName.toUpperCase(),
    105,
    11.5,
    { align: 'center' }
  );

  // 2) Then little font considered to the College Name & its information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    branding.collegeName,
    105,
    15.8,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `(A Constituent College of ${branding.universityName} | Recognized by AICTE, New Delhi)`,
    105,
    19.5,
    { align: 'center' }
  );

  // 3) Then as same for the Department and all stuff
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    deptName,
    105,
    23.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'SUBJECT PERFORMANCE ANALYSIS: DISTRIBUTIONS, MERIT RANKERS & REMEDIAL LIST',
    105,
    27.5,
    { align: 'center' }
  );

  // Subtle aesthetic separator divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(14, 29.5, 196, 29.5);

  // Course Details Banner Box with minimal black grid (no shadow/shading)
  autoTable(doc, {
    startY: 31,
    body: [
      [
        { content: 'COURSE', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: `${meta.courseName} (${meta.courseCode})`, styles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'FACULTY', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: meta.facultyName, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
      [
        { content: 'SEMESTER', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: `${meta.semester} Sem (Scheme: ${meta.scheme})`, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: 'ACADEMIC YEAR', styles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
        { content: `${meta.academicYear} | Branch: ${meta.branch}`, styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 } },
      ],
    ],
    theme: 'grid',
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      font: 'helvetica',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 65 },
      2: { cellWidth: 28 },
      3: { cellWidth: 63 },
    },
    margin: { left: 14, right: 14 },
  });

  // Spacious UI gap between Course Header and Section 1
  let currentY = (doc as any).lastAutoTable.finalY + 6.5;

  // 2. Score Distribution Histograms (Internal, External & Total Marks)
  currentY = drawNumberedSectionHeading(
    doc,
    '1',
    'Score Distribution Histograms (IA, SEE & Total)',
    currentY,
    [0, 0, 0]
  );
  currentY += 3.5;

  const distChartsImg = generateSubjectThreeDistributionCharts(analysis);
  if (distChartsImg) {
    const chartW = 182;
    const chartH = 51;
    doc.addImage(distChartsImg, 'PNG', 14, currentY, chartW, chartH);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(14, currentY, chartW, chartH, 'S');
    currentY += chartH + 6.5;
  }

  // 3. Merit Rankers (Top 5 Competition Ranks & Ties) with minimal black grid (no shadow/shading)
  currentY = drawNumberedSectionHeading(
    doc,
    '2',
    'Merit Rankers (Top 5 Competition Ranks & Ties)',
    currentY,
    [0, 0, 0]
  );
  currentY += 3.5;

  const rankerRows = (analysis.top5Students || []).map((st) => [
    st.isTied ? `#${st.rank} (Tied)` : `#${st.rank}`,
    st.studentId,
    st.studentName,
    String(st.internalMarks),
    analysis.isInternalOnly ? '-' : String(st.externalMarks),
    String(st.totalMarks),
    `${st.percentage}%`,
    st.gradeBand,
  ]);

  autoTable(doc, {
    startY: currentY,
    tableWidth: 182,
    margin: { left: 14, right: 14 },
    head: [[
      'Rank',
      'Student ID (USN)',
      'Candidate Name',
      `IA (${analysis.maxInternal})`,
      analysis.isInternalOnly ? 'SEE' : `SEE (${analysis.maxExternal})`,
      `Total (${analysis.maxTotal})`,
      '%',
      'Grade',
    ]],
    body: rankerRows.length > 0 ? rankerRows : [['-', 'No candidates enrolled', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      font: 'helvetica',
      valign: 'middle',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
      1: { cellWidth: 30, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      2: { cellWidth: 54, halign: 'left', textColor: [0, 0, 0] },
      3: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
      4: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
      5: { cellWidth: 18, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
      6: { cellWidth: 14, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
      7: { cellWidth: 18, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
    },
  });

  // Generous UI gap between Section 2 and Section 3
  currentY = (doc as any).lastAutoTable.finalY + 6.5;

  // 4. Failed Students (Remedial Candidates Register) with minimal black grid (no shadow/shading)
  currentY = drawNumberedSectionHeading(
    doc,
    '3',
    'Remedial Candidates Register: Failed Students',
    currentY,
    [0, 0, 0]
  );
  currentY += 3.5;

  if (!analysis.failedStudents || analysis.failedStudents.length === 0) {
    autoTable(doc, {
      startY: currentY,
      tableWidth: 182,
      margin: { left: 14, right: 14 },
      head: [[
        'Sl.',
        'Student ID (USN)',
        'Candidate Name',
        `IA (${analysis.maxInternal})`,
        analysis.isInternalOnly ? 'SEE' : `SEE (${analysis.maxExternal})`,
        `Total (${analysis.maxTotal})`,
        '%',
        'Result',
      ]],
      body: [[
        {
          content: `NIL REMEDIAL STUDENTS — 100% Pass Clearance in ${meta.courseCode} (All candidates passed)`,
          colSpan: 8,
          styles: { halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [255, 255, 255] },
        },
      ]],
      theme: 'grid',
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.2,
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        font: 'helvetica',
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: 'center',
      },
    });
    currentY = (doc as any).lastAutoTable.finalY;
  } else {
    const failedRows = analysis.failedStudents.map((st, idx) => [
      String(idx + 1),
      st.studentId,
      st.studentName,
      String(st.internalMarks),
      analysis.isInternalOnly ? '-' : String(st.externalMarks),
      String(st.totalMarks),
      `${st.percentage}%`,
      'Fail',
    ]);

    autoTable(doc, {
      startY: currentY,
      tableWidth: 182,
      margin: { left: 14, right: 14 },
      head: [[
        'Sl.',
        'Student ID (USN)',
        'Candidate Name',
        `IA (${analysis.maxInternal})`,
        analysis.isInternalOnly ? 'SEE' : `SEE (${analysis.maxExternal})`,
        `Total (${analysis.maxTotal})`,
        '%',
        'Result',
      ]],
      body: failedRows,
      theme: 'grid',
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.2,
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        font: 'helvetica',
        valign: 'middle',
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 14, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
        1: { cellWidth: 30, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
        2: { cellWidth: 54, halign: 'left', textColor: [0, 0, 0] },
        3: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
        4: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
        5: { cellWidth: 18, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
        6: { cellWidth: 14, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
        7: { cellWidth: 18, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY;
  }

  // 5. Official Endorsement Signatures with generous margin
  let tableBottom = currentY;
  if (tableBottom > 262) {
    doc.addPage();
    tableBottom = 30;
  }

  const signatureY = Math.max(tableBottom + 14, 268);

  // Dotted guide lines
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1.5], 0);

  // Left signature line
  doc.line(20, signatureY - 6, 75, signatureY - 6);
  // Right signature line
  doc.line(135, signatureY - 6, 190, signatureY - 6);

  // Reset dash pattern
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Signature of the Course Teacher', 47.5, signatureY - 1, { align: 'center' });
  doc.text('Signature of Chairman / HOD', 162.5, signatureY - 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Dept. of ${branding.departmentName}`, 47.5, signatureY + 3.2, { align: 'center' });
  doc.text(`Dept. of ${branding.departmentName}`, 162.5, signatureY + 3.2, { align: 'center' });
}

/**
 * Downloads official PDF for an individual subject (Page 1: Official UBDT Layout, Page 2: Distribution Charts, Rankers & Remedial List)
 */
export function downloadSubjectOfficialAnalysisPDF(
  analysis: SubjectAnalysis,
  config?: AnalysisConfig,
  fileName: string = 'Spreadsheet',
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const branding = getEffectiveBranding(undefined, college, department, {
    collegeName: config?.semesterDetails?.college,
    departmentName: config?.semesterDetails?.department || config?.semesterDetails?.branch,
  });

  // Page 1: Official Subject Analysis
  renderUBDTOfficialSubjectAnalysisPage(doc, analysis, config, false, college, department);

  // Page 2: Distribution Bar Charts, Merit Rankers & Failed Students
  renderSubjectAnalysisSecondPage(doc, analysis, config, true, college, department);

  const meta = getSubjectOfficialMetadata(analysis, config, branding.departmentName);
  const safeName = (meta.courseCode || 'Subject').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDept = branding.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}_${safeDept}_Official_Analysis.pdf`);
}

/**
 * Downloads all individual subjects in a single consolidated PDF,
 * where each subject has its own official page 1 and page 2 matching the exact pattern.
 */
export function downloadAllOfficialSubjectsPDF(
  payload: AnalysisPayload,
  fileName: string = 'All_Subjects',
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { detectedSubjects, subjectsAnalysis, config } = payload;
  const branding = getEffectiveBranding(payload, college, department);

  const activeCodes = detectedSubjects.filter((code) => {
    const cfg = config?.subjectsConfig?.[code];
    return !cfg || !cfg.excluded;
  });

  if (activeCodes.length === 0) {
    return;
  }

  activeCodes.forEach((code, index) => {
    const analysis = subjectsAnalysis[code];
    if (analysis) {
      // Page 1 of subject
      renderUBDTOfficialSubjectAnalysisPage(doc, analysis, config, index > 0, college, department);
      // Page 2 of subject
      renderSubjectAnalysisSecondPage(doc, analysis, config, true, college, department);
    }
  });

  const baseName = (fileName || 'All_Subjects')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDept = branding.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${baseName}_${safeDept}_All_Subjects_Official_Analysis.pdf`);
}

/**
 * Downloads a structured, neat Subject Analysis PDF Report.
 */
export function downloadSubjectAnalysisPDF(
  analysis: SubjectAnalysis,
  config: AnalysisConfig,
  fileName: string = 'Spreadsheet',
  college?: College | null,
  department?: Department | null
) {
  // Directly invoke the official subject pattern with consent department and college
  downloadSubjectOfficialAnalysisPDF(analysis, config, fileName, college, department);
}

export function downloadSubjectExtendedDossierPDF(
  analysis: SubjectAnalysis,
  config: AnalysisConfig,
  fileName: string = 'Spreadsheet',
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const branding = getEffectiveBranding(undefined, college, department, {
    collegeName: config?.semesterDetails?.college,
    departmentName: config?.semesterDetails?.department || config?.semesterDetails?.branch,
  });

  const subjectTitle = analysis.displayName || analysis.subjectCode;
  const isInternal = analysis.isInternalOnly;
  const pageWidth = doc.internal.pageSize.width;

  // 1. Header Band
  const pillText = isInternal
    ? `Internal Only | ${analysis.maxTotal} Marks Scheme`
    : `IA: ${analysis.maxInternal} | SEE: ${analysis.maxExternal} | Total: ${analysis.maxTotal}`;

  addDocHeaderBand(
    doc,
    'SUBJECT PERFORMANCE & EVALUATION DOSSIER',
    `Dept. of ${branding.departmentName} | Course: ${subjectTitle} | Faculty: ${analysis.facultyName || 'Unassigned'}`,
    `Source: ${fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName}`,
    [
      `Date: ${new Date().toLocaleDateString('en-GB')}`,
      `Total Cohort: ${analysis.gradeSummary.totalStudents} Candidates`,
    ],
    pillText,
    branding.collegeLogoUrl,
    branding.universityLogoUrl
  );

  let currentY = 28;

  // 2. KPI Card Row (4 equal-width white cards with colored left accent bars)
  const gs = analysis.gradeSummary;
  const kpiCards: KPICardItem[] = [
    {
      label: 'Pass Clearance',
      value: `${gs.passPercentage}%`,
      sub: `${gs.passCount + gs.fcdCount + gs.fcCount + gs.scCount} Passed / ${gs.totalStudents}`,
      accentColor: gs.passPercentage >= 70 ? COLOR_SUCCESS : COLOR_INFO,
    },
    {
      label: 'Distinction (FCD)',
      value: `${gs.fcdCount}`,
      sub: `${gs.totalStudents ? ((gs.fcdCount / gs.totalStudents) * 100).toFixed(1) : 0}% of Enrolled`,
      accentColor: COLOR_SUCCESS,
    },
    {
      label: 'Highest / Lowest',
      value: `${gs.highestMarks} / ${gs.lowestMarks}`,
      sub: `Range: ${gs.highestMarks - gs.lowestMarks} Marks`,
      accentColor: COLOR_WARNING,
    },
    {
      label: 'Fail / Remedial',
      value: `${gs.failCount}`,
      sub: gs.failCount === 0 ? 'Nil Backlogs (100% Clear)' : `${((gs.failCount / (gs.totalStudents || 1)) * 100).toFixed(1)}% Cohort Arrears`,
      accentColor: gs.failCount === 0 ? COLOR_TEAL : COLOR_DANGER,
    },
  ];

  currentY = drawKPICardRow(doc, kpiCards, currentY);

  // 3. Split Section: Left Chart + Right Summary Card
  const leftColW = 108;
  const rightColW = pageWidth - 28 - leftColW - 4;
  const splitTopY = currentY;

  // Left side: Clean Grade Distribution Chart inside bordered card
  const chartImg = generateSubjectGradeChartImage(analysis, config);
  if (chartImg) {
    doc.addImage(chartImg, 'PNG', 14, splitTopY, leftColW, 46);
  }

  // Right side: Stacked colored Summary Card with soft tint + key stats + compact breakdown table
  const rightX = 14 + leftColW + 4;
  const summaryBoxH = 46;
  const isHighPass = gs.passPercentage >= 70;

  // Soft Tint Background
  if (isHighPass) {
    doc.setFillColor(240, 253, 244); // Emerald-50
    doc.setDrawColor(187, 247, 208); // Emerald-200
  } else {
    doc.setFillColor(239, 246, 255); // Blue-50
    doc.setDrawColor(191, 219, 254); // Blue-200
  }
  doc.roundedRect(rightX, splitTopY, rightColW, summaryBoxH, 1.5, 1.5, 'F');
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, splitTopY, rightColW, summaryBoxH, 1.5, 1.5, 'D');

  // Summary Card Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(isHighPass ? 5 : 30, isHighPass ? 150 : 58, isHighPass ? 105 : 138);
  doc.text('EXECUTIVE PERFORMANCE SUMMARY', rightX + 3.5, splitTopY + 5);

  // Key stats rows
  const statsRows = [
    { label: 'Pass Rate:', value: `${gs.passPercentage}% (${gs.totalStudents - gs.failCount} Cleared)` },
    { label: 'FCD Distinction:', value: `${gs.fcdCount} Candidates` },
    { label: 'First Class (FC):', value: `${gs.fcCount} Candidates` },
    { label: 'Second / Pass Class:', value: `${gs.scCount + gs.passCount} Candidates` },
    { label: 'Remedial (Arrears):', value: `${gs.failCount} Candidates` },
  ];

  let statY = splitTopY + 11.5;
  doc.setFontSize(6.8);
  statsRows.forEach((st) => {
    // Colored dot marker
    doc.setFillColor(isHighPass ? 16 : 37, isHighPass ? 185 : 99, isHighPass ? 129 : 235);
    doc.circle(rightX + 4.5, statY - 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(st.label, rightX + 7, statY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(st.value, rightX + rightColW - 3.5, statY, { align: 'right' });

    statY += 6.5;
  });

  currentY = splitTopY + summaryBoxH + 5;

  // 4. Internal, External, and Total Marks Component Comparison Chart (Explicitly Included!)
  const compChartImg = generateSubjectInternalExternalTotalChart(analysis);
  if (compChartImg) {
    doc.addImage(compChartImg, 'PNG', 14, currentY, pageWidth - 28, 35);
    currentY += 35 + 5;
  }

  // 5. Data Tables with normal black table view
  currentY = drawNumberedSectionHeading(doc, '1', 'Top 5 Merit Honors List (Highest Aggregate Marks)', currentY, [0, 0, 0]);

  const topRows = analysis.top5Students.map((st) => [
    `#${st.rank}${st.isTied ? ' (Tied)' : ''}`,
    st.studentId,
    st.studentName,
    String(st.internalMarks),
    isInternal ? '-' : String(st.externalMarks),
    String(st.totalMarks),
    `${st.percentage}%`,
    st.gradeBand,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Student USN', 'Student Name', 'Internal', 'External', 'Total', 'Percent', 'Grade']],
    body: topRows.length > 0 ? topRows : [['-', 'No candidates enrolled', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: 'center',
    },
    tableWidth: 182,
    columnStyles: {
      0: { cellWidth: 14, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
      1: { cellWidth: 30, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
      2: { cellWidth: 54, halign: 'left', textColor: [0, 0, 0] },
      3: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
      4: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
      5: { cellWidth: 18, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
      6: { cellWidth: 14, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' },
      7: { cellWidth: 18, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 6. Remedial / Backlog Candidates Table with minimal black grid (no shadow/shading)
  if (analysis.failedStudents.length > 0) {
    // If not enough room on page 1, add page
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    currentY = drawNumberedSectionHeading(
      doc,
      '2',
      `Remedial / Backlog Candidates Register (${analysis.failedStudents.length} Students)`,
      currentY,
      [0, 0, 0]
    );

    const failRows = analysis.failedStudents.map((st, idx) => [
      String(idx + 1),
      st.studentId,
      st.studentName,
      String(st.internalMarks),
      isInternal ? '-' : String(st.externalMarks),
      String(st.totalMarks),
      `${st.percentage}%`,
      'Fail',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Sl.', 'Student USN', 'Candidate Name', 'Int', 'Ext', 'Total', '%', 'Result']],
      body: failRows,
      theme: 'grid',
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.2,
      tableWidth: 182,
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 7.5,
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 14, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0] },
        1: { cellWidth: 30, fontStyle: 'bold', halign: 'left', textColor: [0, 0, 0] },
        2: { cellWidth: 54, halign: 'left', textColor: [0, 0, 0] },
        3: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
        4: { cellWidth: 17, halign: 'center', textColor: [0, 0, 0] },
        5: { cellWidth: 18, halign: 'center', textColor: [0, 0, 0], fontStyle: 'bold' },
        6: { cellWidth: 14, halign: 'center', textColor: [0, 0, 0], fontStyle: 'bold' },
        7: { cellWidth: 18, halign: 'center', textColor: [0, 0, 0], fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer & Page numbering
  addDocFooter(doc);

  const safeName = (subjectTitle || 'Subject').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeName}_Academic_Dossier.pdf`);
}

/**
 * Downloads a structured, neat Semester Master Dossier PDF Report.
 * Contains:
 * - Header Band with pill badge
 * - KPI Card row
 * - Split Chart + Semester Overview card
 * - Subject-Wise Consolidated Performance Matrix
 * - Overall Semester Toppers (Top 5)
 * - Remedial & Backlog list (strict subject codes only)
 * - Master Candidate Performance Ledger (given in Semester Summary with total marks for each student)
 */
export function downloadSemesterSummaryPDF(
  payload: AnalysisPayload,
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { fileName, uploadedAt, config, subjectsAnalysis, semesterSummary, detectedSubjects } = payload;
  const branding = getEffectiveBranding(payload, college, department);
  const pageWidth = doc.internal.pageSize.width;

  // 1. Header Band with institutional branding and uploaded logos
  const pillText = `All-Module Clearance: ${semesterSummary.overallPassPercentage}%`;
  const semHeading = config?.semesterDetails?.semester
    ? `${config.semesterDetails.semester.toUpperCase()} PERFORMANCE & RESULT DOSSIER`
    : 'SEMESTER PERFORMANCE & RESULT DOSSIER';
  const collegeDeptPrefix = `${branding.collegeName} • ${branding.departmentName} | `;
  const semSub = config?.semesterDetails
    ? `${collegeDeptPrefix}${config.semesterDetails.semester} (${config.semesterDetails.semType}) | Exam: ${config.semesterDetails.examination} | ${config.semesterDetails.academicYear}`
    : `${collegeDeptPrefix}Master Academic Summary Report | Evaluated Subjects: ${detectedSubjects.length}`;

  addDocHeaderBand(
    doc,
    semHeading,
    semSub,
    `Source: ${fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName}`,
    [
      `Date: ${new Date(uploadedAt).toLocaleDateString('en-GB')}`,
      `Cohort Size: ${semesterSummary.totalUniqueStudents} Students`,
    ],
    pillText,
    branding.collegeLogoUrl,
    branding.universityLogoUrl
  );

  let currentY = 28;

  // 2. KPI Card Row
  const kpiCards: KPICardItem[] = [
    {
      label: 'Overall Pass Rate',
      value: `${semesterSummary.overallPassPercentage}%`,
      sub: `${semesterSummary.overallPassCount} Passed All Modules`,
      accentColor: semesterSummary.overallPassPercentage >= 70 ? COLOR_SUCCESS : COLOR_INFO,
    },
    {
      label: 'Cleared All Subjects',
      value: `${semesterSummary.overallPassCount} / ${semesterSummary.totalUniqueStudents}`,
      sub: `${((semesterSummary.overallPassCount / (semesterSummary.totalUniqueStudents || 1)) * 100).toFixed(1)}% Clearance`,
      accentColor: COLOR_INFO,
    },
    {
      label: 'Students with Arrears',
      value: `${semesterSummary.overallFailedStudents.length}`,
      sub: semesterSummary.overallFailedStudents.length === 0 ? '100% Clearance Rate' : 'Remedial Support Required',
      accentColor: semesterSummary.overallFailedStudents.length === 0 ? COLOR_TEAL : COLOR_DANGER,
    },
    {
      label: 'Courses Analyzed',
      value: `${detectedSubjects.length}`,
      sub: 'Evaluated Modules',
      accentColor: COLOR_PRIMARY,
    },
  ];

  currentY = drawKPICardRow(doc, kpiCards, currentY);

  // 3. Split Chart + Semester Summary Box
  const leftColW = 108;
  const rightColW = pageWidth - 28 - leftColW - 4;
  const splitTopY = currentY;

  const semChartImg = generateSemesterComparisonChartImage(
    semesterSummary.subjectSummaries,
    semesterSummary.overallPassPercentage
  );
  if (semChartImg) {
    doc.addImage(semChartImg, 'PNG', 14, splitTopY, leftColW, 46);
    // Sharp rectangle border with minimal bold (not more bold)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(14, splitTopY, leftColW, 46, 'S');
  }

  // Right side: Stacked Summary Card
  const rightX = 14 + leftColW + 4;
  const summaryBoxH = 46;
  const isHighPass = semesterSummary.overallPassPercentage >= 70;

  if (isHighPass) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
  } else {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
  }
  doc.roundedRect(rightX, splitTopY, rightColW, summaryBoxH, 1.5, 1.5, 'F');
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, splitTopY, rightColW, summaryBoxH, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(isHighPass ? 5 : 30, isHighPass ? 150 : 58, isHighPass ? 105 : 138);
  doc.text('SEMESTER ATTAINMENT OVERVIEW', rightX + 3.5, splitTopY + 5);

  const statsRows = [
    { label: 'Overall Pass Rate:', value: `${semesterSummary.overallPassPercentage}%` },
    { label: 'Cleared All Courses:', value: `${semesterSummary.overallPassCount} Students` },
    { label: 'Students with Backlogs:', value: `${semesterSummary.overallFailedStudents.length} Students` },
    { label: 'Total Modules Tested:', value: `${detectedSubjects.length} Courses` },
    { label: 'All-Clear Attainment:', value: `${((semesterSummary.overallPassCount / (semesterSummary.totalUniqueStudents || 1)) * 100).toFixed(1)}%` },
  ];

  let statY = splitTopY + 11.5;
  doc.setFontSize(6.8);
  statsRows.forEach((st) => {
    doc.setFillColor(isHighPass ? 16 : 37, isHighPass ? 185 : 99, isHighPass ? 129 : 235);
    doc.circle(rightX + 4.5, statY - 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(st.label, rightX + 7, statY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(st.value, rightX + rightColW - 3.5, statY, { align: 'right' });

    statY += 6.5;
  });

  currentY = splitTopY + summaryBoxH + 5;

  // 4. Data Table 1: Subject-Wise Consolidated Matrix
  currentY = drawNumberedSectionHeading(doc, '1', 'Subject-Wise Consolidated Performance Matrix', currentY);

  const matrixRows = semesterSummary.subjectSummaries.map((sub, idx) => [
    String(idx + 1),
    sub.displayName || sub.subjectCode,
    sub.facultyName || 'Unassigned',
    String(sub.fcdCount),
    String(sub.fcCount),
    String(sub.scCount),
    String(sub.passCount),
    String(sub.failCount),
    String(sub.totalStudents),
    `${sub.passPercentage}%`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Sl.', 'Subject', 'Faculty In-Charge', 'FCD', 'FC', 'SC', 'Pass', 'Fail', 'Total', 'Pass %']],
    body: matrixRows,
    theme: 'striped',
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.8, right: 1.5, bottom: 1.8, left: 1.5 },
      textColor: COLOR_TEXT_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLOR_ZEBRA,
    },
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 36, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 40, halign: 'left' },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 12 },
      6: { cellWidth: 12 },
      7: { cellWidth: 12, fontStyle: 'bold', textColor: COLOR_DANGER },
      8: { cellWidth: 14 },
      9: { cellWidth: 24, fontStyle: 'bold', textColor: COLOR_SUCCESS },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 5. Data Table 2: Overall Semester Toppers (Top 5)
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  currentY = drawNumberedSectionHeading(doc, '2', 'Overall Semester Toppers (Top 5 Aggregate Total)', currentY);

  const topperRows = semesterSummary.overallToppers.map((st) => [
    `#${st.rank}${st.isTied ? ' (Tied)' : ''}`,
    st.studentId,
    st.studentName,
    `${st.totalMarksObtained} / ${st.maxSemesterMarks}`,
    `${st.overallPercentage}%`,
    st.allSubjectsPassed ? 'ALL CLEARED' : `${st.failedSubjectsCount} ARREAR(S)`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Student USN', 'Student Name', 'Aggregate Marks', 'Overall %', 'Academic Standing']],
    body: topperRows.length > 0 ? topperRows : [['-', 'No candidates', '-', '-', '-', '-']],
    theme: 'striped',
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
      textColor: COLOR_TEXT_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLOR_ZEBRA,
    },
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 30, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 32, fontStyle: 'bold' },
      4: { cellWidth: 22, fontStyle: 'bold', textColor: COLOR_SUCCESS },
      5: { cellWidth: 32 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        if (data.cell.raw === 'ALL CLEARED') {
          data.cell.styles.textColor = COLOR_SUCCESS;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = COLOR_DANGER;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 6. Flag / Exception Table for Remedial / Backlog Candidates (Strictly Subject Codes Only)
  if (semesterSummary.overallFailedStudents.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    currentY = drawNumberedSectionHeading(
      doc,
      '3',
      `Remedial / Backlog Candidates Register (${semesterSummary.overallFailedStudents.length} Students)`,
      currentY,
      COLOR_DANGER
    );

    const backlogRows = semesterSummary.overallFailedStudents.map((st, idx) => [
      String(idx + 1),
      st.studentId,
      st.studentName,
      `${st.failedCount} / ${st.totalSubjects}`,
      st.failedSubjects.map((s) => s.subjectCode).join(', '),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Sl.', 'Student USN', 'Candidate Name', 'Backlogs', 'Failed Subject Code(s)']],
      body: backlogRows,
      theme: 'striped',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
        textColor: COLOR_TEXT_DARK,
        lineColor: COLOR_BORDER,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242], // Light Rose
      },
      headStyles: {
        fillColor: COLOR_DANGER,
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 50 },
        3: { cellWidth: 20, halign: 'center', textColor: COLOR_DANGER, fontStyle: 'bold' },
        4: { cellWidth: 'auto', fontStyle: 'bold', textColor: [159, 18, 57] },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Official Institutional Endorsement Signatures Block
  const sigH = 24;
  if (currentY + sigH > 275) {
    doc.addPage();
    currentY = 25;
  } else {
    currentY += 8;
  }

  const leftSigX = 38;
  const centerSigX = 105;
  const rightSigX = 172;
  const rawDeptName = branding?.departmentName || config?.semesterDetails?.department || config?.semesterDetails?.branch || 'Academic Department';
  const cleanDeptName = rawDeptName.replace(/^department of\s*/i, '').trim();

  doc.setDrawColor(75, 85, 99);
  doc.setLineWidth(0.35);
  doc.line(leftSigX - 22, currentY + 12, leftSigX + 22, currentY + 12);
  doc.line(centerSigX - 26, currentY + 12, centerSigX + 26, currentY + 12);
  doc.line(rightSigX - 22, currentY + 12, rightSigX + 22, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Result Analysis Coordinator', leftSigX, currentY + 16, { align: 'center' });
  doc.text('Signature of HOD of the Department', centerSigX, currentY + 16, { align: 'center' });
  doc.text('Principal / Dean Academic', rightSigX, currentY + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Member, Analysis Committee', leftSigX, currentY + 20, { align: 'center' });
  doc.text(`Dept. of ${cleanDeptName}`, centerSigX, currentY + 20, { align: 'center' });
  doc.text(branding?.collegeName || config?.semesterDetails?.college || 'Institution / College', rightSigX, currentY + 20, { align: 'center' });

  // 7. Master Candidate Performance Ledger (Given in Semester Summary with total marks for each student)
  doc.addPage();
  currentY = 20;

  currentY = drawNumberedSectionHeading(
    doc,
    '4',
    'Master Candidate Performance Ledger (All Evaluated Subjects)',
    currentY
  );

  const studentMap = new Map<string, { name: string; subjects: Record<string, any> }>();

  detectedSubjects.forEach((subCode) => {
    const analysis = subjectsAnalysis[subCode];
    if (analysis) {
      analysis.allStudents.forEach((st) => {
        if (!studentMap.has(st.studentId)) {
          studentMap.set(st.studentId, { name: st.studentName, subjects: {} });
        }
        studentMap.get(st.studentId)!.subjects[subCode] = st;
      });
    }
  });

  const headers = [
    'Sl.',
    'Student USN',
    'Student Name',
    ...detectedSubjects.map((s) => {
      const cfg = config.subjectsConfig[s];
      return cfg?.displayName || s;
    }),
    'Total',
    'Overall %',
    'Status',
  ];

  let slCounter = 1;
  const studentMasterRows = Array.from(studentMap.entries()).map(([studentId, data]) => {
    let totalObtained = 0;
    let maxPossible = 0;
    let failedCount = 0;

    const subMarks = detectedSubjects.map((s) => {
      const stSub = data.subjects[s];
      const cfg = config.subjectsConfig[s];
      const maxSubTotal = cfg?.maxTotal || (cfg?.maxInternal || 0) + (cfg?.maxExternal || 0) || 100;
      maxPossible += maxSubTotal;

      if (stSub) {
        totalObtained += stSub.totalMarks;
        if (stSub.computedResult === 'Fail') failedCount++;
        return `${stSub.totalMarks}`;
      }
      return '-';
    });

    const overallPct = maxPossible > 0 ? ((totalObtained / maxPossible) * 100).toFixed(1) : '0';

    const row = [
      String(slCounter++),
      studentId,
      data.name,
      ...subMarks,
      `${totalObtained} / ${maxPossible}`,
      `${overallPct}%`,
      failedCount === 0 ? 'PASS' : `FAIL (${failedCount})`,
    ];
    return row;
  });

  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: studentMasterRows,
    theme: 'striped',
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.8, right: 1.5, bottom: 1.8, left: 1.5 },
      textColor: COLOR_TEXT_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLOR_ZEBRA,
    },
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 34, halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === headers.length - 1) {
        if (typeof data.cell.raw === 'string' && data.cell.raw.startsWith('FAIL')) {
          data.cell.styles.textColor = COLOR_DANGER;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = COLOR_SUCCESS;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer & Page numbering
  addDocFooter(doc);

  const semPrefix = config?.semesterDetails?.semester
    ? `${config.semesterDetails.semester.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
    : '';
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDept = branding.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeDept}_${semPrefix}${baseName}_Semester_Master_Report.pdf`);
}

/**
 * Downloads the Semester Performance Dossier containing strictly the data
 * up to the Remedial / Backlog student details, endorsed with official signatures
 * including the Signature of HOD of the Department, Result Analysis Coordinator,
 * and Principal / Dean Academic.
 */
export function downloadSemesterDossierUptoRemedialPDF(
  payload: AnalysisPayload,
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { fileName, config, detectedSubjects, semesterSummary } = payload;
  const branding = getEffectiveBranding(payload, college, department);
  const semDetails = config?.semesterDetails;
  const semText = semDetails?.semester || 'Semester';
  const examText = semDetails?.examination || 'Academic Session';
  const ayText = semDetails?.academicYear || '2025 - 2026';
  const deptName = branding.departmentName;
  const pageWidth = doc.internal.pageSize.width;

  // 1. Header Band with institutional logos
  addDocHeaderBand(
    doc,
    `${semText.toUpperCase()} PERFORMANCE DOSSIER`,
    `Dept. of ${deptName} | ${branding.collegeName} | Exam: ${examText} (${ayText})`,
    `Source: ${fileName.length > 32 ? fileName.substring(0, 32) + '...' : fileName}`,
    [
      `Date: ${new Date().toLocaleDateString('en-GB')}`,
      `Total Cohort: ${semesterSummary.totalUniqueStudents} Candidates`,
    ],
    `Overall Pass: ${semesterSummary.overallPassPercentage}%`,
    branding.collegeLogoUrl,
    branding.universityLogoUrl
  );

  let currentY = 28;

  // 2. Executive KPI Cards Row
  const kpiCards: KPICardItem[] = [
    {
      label: 'Semester Pass Rate',
      value: `${semesterSummary.overallPassPercentage}%`,
      sub: `${semesterSummary.overallPassCount} Passed / ${semesterSummary.totalUniqueStudents}`,
      accentColor: semesterSummary.overallPassPercentage >= 70 ? COLOR_SUCCESS : COLOR_INFO,
    },
    {
      label: 'Cleared All',
      value: `${semesterSummary.overallPassCount}`,
      sub: `${((semesterSummary.overallPassCount / (semesterSummary.totalUniqueStudents || 1)) * 100).toFixed(1)}% Clear Rate`,
      accentColor: COLOR_SUCCESS,
    },
    {
      label: 'Average Score',
      value: `${semesterSummary.averageSemesterPercentage}%`,
      sub: 'Aggregate Cohort Mean',
      accentColor: COLOR_WARNING,
    },
    {
      label: 'Remedial / Arrears',
      value: `${semesterSummary.overallFailedStudents.length}`,
      sub: semesterSummary.overallFailedStudents.length === 0 ? '100% Clearance Rate' : 'Remedial Support Required',
      accentColor: semesterSummary.overallFailedStudents.length === 0 ? COLOR_TEAL : COLOR_DANGER,
    },
    {
      label: 'Evaluated Modules',
      value: `${detectedSubjects.length}`,
      sub: 'Distinct Courses',
      accentColor: COLOR_PRIMARY,
    },
  ];

  currentY = drawKPICardRow(doc, kpiCards, currentY);

  // 3. Split Chart + Semester Attainment Summary Box
  const leftColW = 108;
  const rightColW = pageWidth - 28 - leftColW - 4;
  const splitTopY = currentY;

  const semChartImg = generateSemesterComparisonChartImage(
    semesterSummary.subjectSummaries,
    semesterSummary.overallPassPercentage
  );
  if (semChartImg) {
    doc.addImage(semChartImg, 'PNG', 14, splitTopY, leftColW, 46);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(14, splitTopY, leftColW, 46, 'S');
  }

  // Right side: Stacked Summary Card
  const rightX = 14 + leftColW + 4;
  const summaryBoxH = 46;
  const isHighPass = semesterSummary.overallPassPercentage >= 70;

  if (isHighPass) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
  } else {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
  }
  doc.roundedRect(rightX, splitTopY, rightColW, summaryBoxH, 1.5, 1.5, 'F');
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, splitTopY, rightColW, summaryBoxH, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(isHighPass ? 5 : 30, isHighPass ? 150 : 58, isHighPass ? 105 : 138);
  doc.text('SEMESTER ATTAINMENT OVERVIEW', rightX + 3.5, splitTopY + 5);

  const statsRows = [
    { label: 'Overall Pass Rate:', value: `${semesterSummary.overallPassPercentage}%` },
    { label: 'Cleared All Courses:', value: `${semesterSummary.overallPassCount} Students` },
    { label: 'Students with Backlogs:', value: `${semesterSummary.overallFailedStudents.length} Students` },
    { label: 'Total Modules Tested:', value: `${detectedSubjects.length} Courses` },
    { label: 'All-Clear Attainment:', value: `${((semesterSummary.overallPassCount / (semesterSummary.totalUniqueStudents || 1)) * 100).toFixed(1)}%` },
  ];

  let statY = splitTopY + 11.5;
  doc.setFontSize(6.8);
  statsRows.forEach((st) => {
    doc.setFillColor(isHighPass ? 16 : 37, isHighPass ? 185 : 99, isHighPass ? 129 : 235);
    doc.circle(rightX + 4.5, statY - 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(st.label, rightX + 7, statY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT_DARK);
    doc.text(st.value, rightX + rightColW - 3.5, statY, { align: 'right' });

    statY += 6.5;
  });

  currentY = splitTopY + summaryBoxH + 5;

  // 4. Data Table 1: Subject-Wise Consolidated Performance Matrix
  currentY = drawNumberedSectionHeading(doc, '1', 'Subject-Wise Consolidated Performance Matrix', currentY);

  const matrixRows = semesterSummary.subjectSummaries.map((sub, idx) => [
    String(idx + 1),
    sub.displayName || sub.subjectCode,
    sub.facultyName || 'Unassigned',
    String(sub.fcdCount),
    String(sub.fcCount),
    String(sub.scCount),
    String(sub.passCount),
    String(sub.failCount),
    String(sub.totalStudents),
    `${sub.passPercentage}%`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Sl.', 'Subject', 'Faculty In-Charge', 'FCD', 'FC', 'SC', 'Pass', 'Fail', 'Total', 'Pass %']],
    body: matrixRows,
    theme: 'striped',
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.8, right: 1.5, bottom: 1.8, left: 1.5 },
      textColor: COLOR_TEXT_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLOR_ZEBRA,
    },
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 36, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 40, halign: 'left' },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 12 },
      6: { cellWidth: 12 },
      7: { cellWidth: 12, fontStyle: 'bold', textColor: COLOR_DANGER },
      8: { cellWidth: 14 },
      9: { cellWidth: 24, fontStyle: 'bold', textColor: COLOR_SUCCESS },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 5. Data Table 2: Overall Semester Toppers (Top 5)
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  currentY = drawNumberedSectionHeading(doc, '2', 'Overall Semester Toppers (Top 5 Aggregate Total)', currentY);

  const topperRows = semesterSummary.overallToppers.map((st) => [
    `#${st.rank}${st.isTied ? ' (Tied)' : ''}`,
    st.studentId,
    st.studentName,
    `${st.totalMarksObtained} / ${st.maxSemesterMarks}`,
    `${st.overallPercentage}%`,
    st.allSubjectsPassed ? 'ALL CLEARED' : `${st.failedSubjectsCount} ARREAR(S)`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Rank', 'Student USN', 'Student Name', 'Aggregate Marks', 'Overall %', 'Academic Standing']],
    body: topperRows.length > 0 ? topperRows : [['-', 'No candidates', '-', '-', '-', '-']],
    theme: 'striped',
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
      textColor: COLOR_TEXT_DARK,
      lineColor: COLOR_BORDER,
      lineWidth: 0.2,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLOR_ZEBRA,
    },
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 30, fontStyle: 'bold', halign: 'left' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 32, fontStyle: 'bold' },
      4: { cellWidth: 22, fontStyle: 'bold', textColor: COLOR_SUCCESS },
      5: { cellWidth: 32 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        if (data.cell.raw === 'ALL CLEARED') {
          data.cell.styles.textColor = COLOR_SUCCESS;
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = COLOR_DANGER;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 6. Remedial / Backlog Candidates Table
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  currentY = drawNumberedSectionHeading(
    doc,
    '3',
    `Remedial / Backlog Candidates Register (${semesterSummary.overallFailedStudents.length} Students)`,
    currentY,
    COLOR_DANGER
  );

  if (semesterSummary.overallFailedStudents.length > 0) {
    const backlogRows = semesterSummary.overallFailedStudents.map((st, idx) => [
      String(idx + 1),
      st.studentId,
      st.studentName,
      `${st.failedCount} / ${st.totalSubjects}`,
      st.failedSubjects.map((s) => s.subjectCode).join(', '),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Sl.', 'Student USN', 'Candidate Name', 'Backlogs', 'Failed Subject Code(s)']],
      body: backlogRows,
      theme: 'striped',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.8, right: 2.5, bottom: 1.8, left: 2.5 },
        textColor: COLOR_TEXT_DARK,
        lineColor: COLOR_BORDER,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242],
      },
      headStyles: {
        fillColor: COLOR_DANGER,
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30, fontStyle: 'bold' },
        2: { cellWidth: 50 },
        3: { cellWidth: 20, halign: 'center', textColor: COLOR_DANGER, fontStyle: 'bold' },
        4: { cellWidth: 'auto', fontStyle: 'bold', textColor: [159, 18, 57] },
      },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  } else {
    // Nil Backlogs Banner
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'F');
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text('NIL BACKLOGS — 100% CLEARANCE ACHIEVED ACROSS ALL COHORT CANDIDATES', pageWidth / 2, currentY + 8.5, { align: 'center' });
    currentY += 20;
  }

  // 7. OFFICIAL INSTITUTIONAL ENDORSEMENT SIGNATURE BLOCK (HOD of the Department, Coordinator, Principal)
  const sigHeight = 24;
  if (currentY + sigHeight > 275) {
    doc.addPage();
    currentY = 25;
  } else {
    currentY += 6;
  }

  const leftSigX = 38;
  const centerSigX = 105;
  const rightSigX = 172;

  // Signature rule line
  doc.setDrawColor(75, 85, 99);
  doc.setLineWidth(0.35);
  doc.line(leftSigX - 22, currentY + 12, leftSigX + 22, currentY + 12);
  doc.line(centerSigX - 26, currentY + 12, centerSigX + 26, currentY + 12);
  doc.line(rightSigX - 22, currentY + 12, rightSigX + 22, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Result Analysis Coordinator', leftSigX, currentY + 16, { align: 'center' });
  doc.text('Signature of HOD of the Department', centerSigX, currentY + 16, { align: 'center' });
  doc.text('Principal / Dean Academic', rightSigX, currentY + 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Member, Analysis Committee', leftSigX, currentY + 20, { align: 'center' });
  doc.text(`Dept. of ${branding.departmentName}`, centerSigX, currentY + 20, { align: 'center' });
  doc.text(branding.collegeName, rightSigX, currentY + 20, { align: 'center' });

  // 8. Footer & Page numbering
  addDocFooter(doc);

  const semPrefix = config?.semesterDetails?.semester
    ? `${config.semesterDetails.semester.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
    : '';
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDept = branding.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeDept}_${semPrefix}${baseName}_Semester_Dossier_Upto_Remedial.pdf`);
}

/**
 * Helper to convert integer rank (1-10) to Roman numerals
 */
function toRomanNumeral(num: number): string {
  const romanMap: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX',
    10: 'X',
  };
  return romanMap[num] || String(num);
}

/**
 * EXACT VTU OFFICIAL INSTITUTIONAL TEMPLATE (2-Page Landscape PDF)
 * Page 1:
 *  - Dual Logos (VTU Crest Left, IQAC Emblem Right)
 *  - University Header & Jnana Sangama Belagavi address
 *  - Department Title & Dashed Separator
 *  - Semester Result Analysis & Academic Year Subheading
 *  - Master Subject-Wise Result Analysis Grid Table (10 standard columns)
 *  - Tri-Signatory Line (Result Analysis Coordinator, Program Coordinator, Chairperson)
 * Page 2:
 *  - Dual Logos & Institutional Header
 *  - "Toppers Details" Subheading
 *  - Side-by-Side Dual Analysis Tables:
 *      1. Overall Result Summary (Strength, Passed, FCD, FC, SC, Fail, Passing %)
 *      2. Toppers Details (Sl. No, USN, Name, Obtained Marks, Percentage, Position I-V)
 *  - Tri-Signatory Line
 */
export function downloadVTUSemesterSummaryPDF(
  payload: AnalysisPayload,
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const { fileName, config, subjectsAnalysis, semesterSummary } = payload;
  const branding = getEffectiveBranding(payload, college, department);
  const semDetails = config?.semesterDetails;

  const semText = semDetails?.semester ? semDetails.semester.toUpperCase() : '4th SEMESTER';
  const examText = semDetails?.examination ? semDetails.examination.toUpperCase() : 'May/June-2026';
  const ayText = semDetails?.academicYear || '2025-2026';
  const semTypeText = semDetails?.semType ? semDetails.semType.toUpperCase() : 'EVEN';
  const deptText = branding.departmentName;

  // Helper to draw common institutional header
  const drawInstitutionalHeader = (pageNumber: number) => {
    // 1. Logos - Uploaded College logo on left, Uploaded University logo on right
    drawPdfLogoSafely(doc, branding.collegeLogoUrl, getVTULogoDataUrl(), 14, 8, 22, 22);
    drawPdfLogoSafely(doc, branding.universityLogoUrl, getIQACLogoDataUrl(), 261, 8, 22, 22);

    // 1) University Details FIRST (Prominent, Royal Navy serif)
    doc.setFont('times', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 58, 138); // #1e3a8a
    doc.text(branding.universityName.toUpperCase(), 148.5, 13.5, { align: 'center' });

    // 2) Then little font considered to the College Name & its information
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(branding.collegeName, 148.5, 18, { align: 'center' });

    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);
    doc.text(`(A Constituent College of ${branding.universityName} | Recognized by AICTE, New Delhi)`, 148.5, 22, { align: 'center' });

    // 3) Then as same for the Department and all stuff
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    const formattedDept = deptText.toUpperCase().startsWith('DEPARTMENT OF')
      ? deptText.toUpperCase()
      : `DEPARTMENT OF ${deptText.toUpperCase()}`;
    doc.text(formattedDept, 148.5, 26.5, { align: 'center' });

    // 5. Dashed Separator Line
    doc.setDrawColor(90, 90, 90);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(14, 30.5, 283, 30.5);
    doc.setLineDashPattern([], 0);
  };

  // Helper to draw the three bottom signatory designations
  const drawSignatures = () => {
    const sigY = 197;
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Result Analysis Coordinator', 20, sigY);
    doc.text('Program Coordinator', 148.5, sigY, { align: 'center' });
    const formattedDept = deptText.toUpperCase().startsWith('DEPARTMENT OF')
      ? deptText.toUpperCase()
      : `DEPARTMENT OF ${deptText.toUpperCase()}`;
    doc.text(`HOD / Chairperson - ${formattedDept}`, 277, sigY, { align: 'right' });
  };

  // ==========================================
  // PAGE 1: MASTER SUBJECT-WISE RESULT ANALYSIS
  // ==========================================
  drawInstitutionalHeader(1);

  // Result Analysis Subheading
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  const resultTitle = `RESULT ANALYSIS OF ${semText} ( ${examText} EXAMINATION)`;
  doc.text(resultTitle, 148.5, 36, { align: 'center' });

  // Academic Year Subheading
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  const ayTitle = `ACADEMIC YEAR – ${ayText} (${semTypeText})`;
  doc.text(ayTitle, 148.5, 41, { align: 'center' });
  const textWidth = doc.getTextWidth(ayTitle);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(148.5 - textWidth / 2, 42, 148.5 + textWidth / 2, 42);

  // Build rows for Subject-Wise Analysis Table with rowSpan for multi-faculty/sections
  const semSections = config?.semesterDetails?.sections?.trim() || 'A&B';
  const tableRows: any[] = [];
  semesterSummary.subjectSummaries.forEach((sub, idx) => {
    const cfg = config?.subjectsConfig?.[sub.subjectCode];
    const assignments = cfg?.facultyAssignments && cfg.facultyAssignments.length > 0
      ? cfg.facultyAssignments
      : [{ facultyName: sub.facultyName || 'Staff', section: cfg?.section || semSections }];

    const absenteesCount = subjectsAnalysis[sub.subjectCode]?.gradeSummary?.absentCount || 0;
    const span = assignments.length;
    // Correct total passed students calculation (Total students minus failed students)
    const passedStudentsCount = sub.passedStudentsCount ?? Math.max(0, sub.totalStudents - sub.failCount);

    assignments.forEach((assignment, aIdx) => {
      // Determine Section text:
      // If one faculty is handling the whole subject, display all sections name like A&B
      let sectionText = assignment.section?.trim() || cfg?.section?.trim() || '';
      if (span <= 1) {
        if (!sectionText || sectionText.toUpperCase() === 'A' || sectionText.toUpperCase() === 'ALL') {
          sectionText = semSections;
        }
      } else if (!sectionText) {
        sectionText = aIdx === 0 ? 'A' : aIdx === 1 ? 'B' : String.fromCharCode(65 + aIdx);
      }

      if (aIdx === 0) {
        tableRows.push([
          { content: String(idx + 1).padStart(2, '0'), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
          { content: sub.displayName || sub.subjectCode, rowSpan: span, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: cfg?.courseName || sub.displayName || sub.subjectCode, rowSpan: span, styles: { halign: 'left', valign: 'middle' } },
          { content: assignment.facultyName, styles: { halign: 'left', valign: 'middle' } },
          { content: sectionText, styles: { halign: 'center', valign: 'middle' } },
          { content: String(sub.totalStudents), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
          { content: String(absenteesCount), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
          { content: String(passedStudentsCount), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
          { content: String(sub.failCount), rowSpan: span, styles: { halign: 'center', valign: 'middle' } },
          { content: `${sub.passPercentage.toFixed(2)}%`, rowSpan: span, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
        ]);
      } else {
        tableRows.push([
          { content: assignment.facultyName, styles: { halign: 'left', valign: 'middle' } },
          { content: sectionText, styles: { halign: 'center', valign: 'middle' } },
        ]);
      }
    });
  });

  autoTable(doc, {
    startY: 45,
    head: [[
      'Sl.\nNO',
      'SUBJECT\nCODE',
      'SUBJECT NAME',
      'FACULTY',
      'Sec',
      'Total No.\nStudents',
      'No. of\nAbsentees',
      'No. of Students\nPassed',
      'No. of Students\nFailed',
      'Percentage',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 8.5,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: 8.5,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 62, halign: 'left' },
      3: { cellWidth: 54, halign: 'left' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 21, halign: 'center' },
      9: { cellWidth: 22, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  drawSignatures();

  // ==========================================
  // PAGE 2: TOPPERS DETAILS & RESULT BREAKDOWN
  // ==========================================
  doc.addPage('a4', 'landscape');
  drawInstitutionalHeader(2);

  // Section Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Toppers Details', 148.5, 39, { align: 'center' });

  // Fallback division calculations if not provided directly
  const fcdFallback = semesterSummary.fcdCount ?? (
    semesterSummary.overallToppers ? semesterSummary.overallToppers.filter(t => t.overallPercentage >= 70 && t.allSubjectsPassed).length : 0
  );
  const fcFallback = semesterSummary.fcCount ?? (
    semesterSummary.overallToppers ? semesterSummary.overallToppers.filter(t => t.overallPercentage >= 60 && t.overallPercentage < 70 && t.allSubjectsPassed).length : 0
  );
  const scFallback = semesterSummary.scCount ?? (
    semesterSummary.overallToppers ? semesterSummary.overallToppers.filter(t => t.overallPercentage >= 50 && t.overallPercentage < 60 && t.allSubjectsPassed).length : 0
  );

  // 1. Left Table: Overall Result Summary
  const summaryRows = [
    ['STRENGTH', String(semesterSummary.totalUniqueStudents)],
    ['PASSED', String(semesterSummary.overallPassCount)],
    ['FCD', String(semesterSummary.fcdCount ?? fcdFallback)],
    ['FC', String(semesterSummary.fcCount ?? fcFallback)],
    ['SC', String(semesterSummary.scCount ?? scFallback)],
    ['FAIL', String(semesterSummary.overallFailedStudents.length)],
    ['PERCENTAGE OF PASSING', `${semesterSummary.overallPassPercentage.toFixed(2)}%`],
  ];

  autoTable(doc, {
    startY: 45,
    margin: { left: 14 },
    tableWidth: 70,
    body: summaryRows,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9.5,
      cellPadding: { top: 2.8, right: 3, bottom: 2.8, left: 3 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold', halign: 'left' },
      1: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
    },
  });

  // 2. Right Table: Toppers Details Table (Top 5-10 Candidates)
  const toppers = (semesterSummary.overallToppers || []).slice(0, 10);
  const topperRows = toppers.map((st, idx) => [
    String(idx + 1),
    st.studentId,
    st.studentName.toUpperCase(),
    `${st.totalMarksObtained}/${st.maxSemesterMarks}`,
    `${st.overallPercentage.toFixed(2)}%`,
    toRomanNumeral(st.rank),
  ]);

  autoTable(doc, {
    startY: 45,
    margin: { left: 88 },
    tableWidth: 195,
    head: [[
      'Sl. No',
      'USN',
      'Name',
      'Obtained Marks',
      'Percentage',
      'Position Obtained',
    ]],
    body: topperRows.length > 0 ? topperRows : [['-', '-', 'NO TOPPERS DATA AVAILABLE', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9,
      cellPadding: { top: 2.8, right: 2.5, bottom: 2.8, left: 2.5 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: 9,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 34, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 65, halign: 'left', fontStyle: 'bold' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
    },
  });

  drawSignatures();

  const semFilePrefix = semDetails?.semester
    ? `${semDetails.semester.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
    : '';
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDept = branding.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeDept}_${semFilePrefix}${baseName}_VTU_Official_Semester_Summary.pdf`);
}

/**
 * Dedicated Official Institutional PDF for Overall Semester Remedial / Arrears Students.
 * Aligned with VTU Institutional Format:
 * - Visvesvaraya Technological University header with VTU & IQAC logos and dashed divider
 * - Subheading: REMEDIAL / FAIL CANDIDATES RECORD & Academic Year
 * - Student-based table with separate column for Failed Subject Code(s) (no faculty column, no subject name column)
 *   (Sl. No, Student USN, Student Name, Failed Subject Code(s), CIE/IA, SEE/Ext, Total Marks, Result)
 * - Two official signatories: Result Analysis Coordinator and HOD of the Department
 */
export function downloadOverallRemedialStudentsPDF(
  payload: AnalysisPayload,
  college?: College | null,
  department?: Department | null
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const { fileName, config, semesterSummary, subjectsAnalysis } = payload;
  const branding = getEffectiveBranding(payload, college, department);
  const semDetails = config?.semesterDetails;

  const semText = semDetails?.semester ? semDetails.semester.toUpperCase() : '4th SEMESTER';
  const examText = semDetails?.examination ? semDetails.examination.toUpperCase() : 'May/June-2026';
  const ayText = semDetails?.academicYear || '2025-2026';
  const semTypeText = semDetails?.semType ? semDetails.semType.toUpperCase() : 'EVEN';
  const deptText = branding.departmentName;

  // Helper to draw common institutional header (matching Semester Summary PDF)
  const drawInstitutionalHeader = () => {
    // 1. Logos - Uploaded college logo on left, uploaded university logo on right
    drawPdfLogoSafely(doc, branding.collegeLogoUrl, getVTULogoDataUrl(), 14, 8, 22, 22);
    drawPdfLogoSafely(doc, branding.universityLogoUrl, getIQACLogoDataUrl(), 261, 8, 22, 22);

    // 1) University Details FIRST (Prominent, Royal Navy serif)
    doc.setFont('times', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 58, 138); // #1e3a8a
    doc.text(branding.universityName.toUpperCase(), 148.5, 13.5, { align: 'center' });

    // 2) Then little font considered to the College Name & its information
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(branding.collegeName, 148.5, 18, { align: 'center' });

    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);
    doc.text(`(A Constituent College of ${branding.universityName} | Recognized by AICTE, New Delhi)`, 148.5, 22, { align: 'center' });

    // 3) Then as same for the Department and all stuff
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    const formattedDept = deptText.toUpperCase().startsWith('DEPARTMENT OF')
      ? deptText.toUpperCase()
      : `DEPARTMENT OF ${deptText.toUpperCase()}`;
    doc.text(formattedDept, 148.5, 26.5, { align: 'center' });

    // 5. Dashed Separator Line
    doc.setDrawColor(90, 90, 90);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(14, 30.5, 283, 30.5);
    doc.setLineDashPattern([], 0);
  };

  // Draw Page 1 header
  drawInstitutionalHeader();

  // Subheading - Remedial / Fail Candidates Record
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  const resultTitle = `REMEDIAL / FAIL CANDIDATES RECORD - ${semText} ( ${examText} EXAMINATION)`;
  doc.text(resultTitle, 148.5, 36, { align: 'center' });

  // Academic Year (underlined)
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  const ayTitle = `ACADEMIC YEAR – ${ayText} (${semTypeText})`;
  doc.text(ayTitle, 148.5, 41, { align: 'center' });
  const textWidth = doc.getTextWidth(ayTitle);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(148.5 - textWidth / 2, 42, 148.5 + textWidth / 2, 42);

  // Build table rows BASED ON THE STUDENT
  // Each student in overallFailedStudents has their own row
  // Columns: Sl. No, Student USN, Student Name, Failed Subject Code(s), CIE / IA, SEE / Ext, Total Marks, Result
  // NO FACULTY column, NO SUBJECT NAME column
  const failedStudents = semesterSummary.overallFailedStudents || [];

  let tableBody: any[] = [];
  if (failedStudents.length > 0) {
    tableBody = failedStudents.map((st, idx) => {
      // Gather failed subject details for this student
      const subCodes: string[] = [];
      const cieMarks: string[] = [];
      const seeMarks: string[] = [];
      const totalMarksList: string[] = [];
      const results: string[] = [];

      st.failedSubjects.forEach((fs) => {
        const subAnalysis = subjectsAnalysis[fs.subjectCode];
        const fullStudentRec = subAnalysis?.allStudents?.find((s) => s.studentId === st.studentId);
        const isInternalOnly = subAnalysis?.isInternalOnly || false;

        const rawRes = fullStudentRec?.sheetResult ? String(fullStudentRec.sheetResult).trim() : '';
        let displayRes = 'FAIL';
        if (['ab', 'absent'].includes(rawRes.toLowerCase())) {
          displayRes = 'ABSENT';
        } else if (rawRes) {
          displayRes = rawRes.toUpperCase();
        }

        subCodes.push(subAnalysis?.displayName || fs.subjectCode);
        cieMarks.push(fullStudentRec !== undefined ? String(fullStudentRec.internalMarks) : '-');
        seeMarks.push(isInternalOnly ? '-' : (fullStudentRec !== undefined ? String(fullStudentRec.externalMarks) : '-'));
        totalMarksList.push(fullStudentRec !== undefined ? String(fullStudentRec.totalMarks) : String(fs.totalMarks));
        results.push(displayRes);
      });

      return [
        String(idx + 1).padStart(2, '0'),
        st.studentId,
        st.studentName.toUpperCase(),
        subCodes.join('\n'),
        cieMarks.join('\n'),
        seeMarks.join('\n'),
        totalMarksList.join('\n'),
        results.join('\n'),
      ];
    });
  } else {
    tableBody = [[
      {
        content: 'NIL REMEDIAL STUDENTS — No Fail result recorded in any subject. 100% pass clearance achieved across all courses.',
        colSpan: 8,
        styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [22, 101, 52] },
      },
    ]];
  }

  // Draw Student-Based Minimal Remedial Table (8 columns)
  autoTable(doc, {
    startY: 45,
    head: [[
      'Sl.\nNO',
      'STUDENT USN',
      'STUDENT NAME',
      'FAILED SUBJECT\nCODE',
      'CIE / IA',
      'SEE / Ext',
      'TOTAL\nMARKS',
      'RESULT',
    ]],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 8.5,
      cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: 8.5,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', valign: 'middle' },
      1: { cellWidth: 38, halign: 'center', fontStyle: 'bold', valign: 'middle' },
      2: { cellWidth: 65, halign: 'left', fontStyle: 'bold', valign: 'middle' },
      3: { cellWidth: 44, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28], valign: 'middle' },
      4: { cellWidth: 27, halign: 'center', valign: 'middle' },
      5: { cellWidth: 27, halign: 'center', valign: 'middle' },
      6: { cellWidth: 27, halign: 'center', fontStyle: 'bold', valign: 'middle' },
      7: { cellWidth: 27, halign: 'center', fontStyle: 'bold', textColor: [185, 28, 28], valign: 'middle' },
    },
    margin: { top: 45, bottom: 32, left: 14, right: 14 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawInstitutionalHeader();
        doc.setFont('times', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text(`REMEDIAL / FAIL CANDIDATES RECORD (CONTINUED - PAGE ${data.pageNumber})`, 148.5, 36, { align: 'center' });
      }
    },
  });

  // Footer: Result analysis coordinator and HOD of the department
  const lastTableFinalY = (doc as any).lastAutoTable?.finalY || 150;

  // If table ended too low on the page, add page for signatures
  if (lastTableFinalY > 175) {
    doc.addPage();
    drawInstitutionalHeader();
  }

  // Draw the two official signatures:
  // Left: Result analysis coordinator
  // Right: HOD of the department
  const sigY = 196;
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // Left Signatory: Result Analysis Coordinator
  doc.text('Result Analysis Coordinator', 20, sigY);

  // Right Signatory: HOD of the department
  const formattedDept = deptText.toUpperCase().startsWith('DEPARTMENT OF')
    ? deptText.toUpperCase()
    : `DEPARTMENT OF ${deptText.toUpperCase()}`;
  doc.text(`HOD / Chairperson - ${formattedDept}`, 277, sigY, { align: 'right' });

  // Add clean page numbers at bottom of each page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, 148.5, 204, { align: 'center' });
  }

  const semFilePrefix = semDetails?.semester
    ? `${semDetails.semester.replace(/[^a-zA-Z0-9_-]/g, '_')}_`
    : '';
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDept = branding.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${safeDept}_${semFilePrefix}${baseName}_Remedial_Students_Record.pdf`);
}
