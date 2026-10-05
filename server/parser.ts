import * as XLSX from 'xlsx';
import {
  DataQualityWarning,
  SubjectBlockType,
  SubjectConfig,
} from '../src/types/analyzer.js';

export interface RawParsedRow {
  rowNumber: number;
  studentId: string;
  studentName: string;
  subjectCode: string;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  sheetResult?: string;
  raw: Record<string, any>;
}

export interface DetectedModuleColumn {
  colIdx: number;
  headerName: string;
  metric: string;
  maxMarks: number;
}

export interface DiscoveredSubjectBlock {
  subjectLabel: string;
  blockType: SubjectBlockType;
  hasInternal: boolean;
  hasExternal: boolean;
  hasTotal: boolean;
  hasResult: boolean;
  internalCol?: number;
  externalCol?: number;
  totalCol?: number;
  resultCol?: number;
  moduleColumns?: DetectedModuleColumn[];
  detectedModuleCount?: number;
  expectedMarksPerModule?: number;
  computedTotalMaxMarks?: number;
  formulaCheck?: string;
  hasModuleMismatch?: boolean;
  mismatchWarning?: string;
}

export interface ParseResult {
  validRows: RawParsedRow[];
  detectedSubjects: string[];
  subjectBlocks: Record<string, DiscoveredSubjectBlock>;
  warnings: DataQualityWarning[];
  totalRows: number;
  isWideFormat: boolean;
  error?: string;
}

const normalizeHeader = (h: string): string => {
  return String(h || '').trim().toLowerCase().replace(/[\s_\-\.]+/g, '');
};

export function extractMaxMarksFromHeader(h: string): number | null {
  if (!h) return null;
  const match = h.match(/(?:[\(\/\[]|max\s*:?\s*)(\d{1,3})(?:\s*marks)?[\)\]]?/i) ||
                h.match(/(\d{1,3})\s*marks/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num <= 1000) {
      return num;
    }
  }
  return null;
}

// Regex to capture "{SUBJECT_LABEL} - {METRIC}"
// Supports various dash styles (hyphen, en-dash, em-dash), underscores, colons, metrics (including module/mod/cie/ia numbers, result, status, pass/fail), and optional parenthesized max marks
const SUBJECT_HEADER_REGEX = /^(.*?)\s*(?:[\-\–\—\_:]\s*|\s+)(INTERNAL\s*(?:MARKS)?|EXTERNAL\s*(?:MARKS)?|TOTAL\s*(?:MARKS)?|RESULT|STATUS|GRADE|IA\s*\d*|SEE|CIE\s*\d*|THEORY|MODULE\s*\d+|MOD\s*\d+|M\d+|COMPONENT\s*\d+|ASSIGNMENT\s*\d+|QUIZ\s*\d+|PASS[\s\/_-]*FAIL|REMARKS?)(?:\s*(?:[\(\/\[]\s*\d{1,3}\s*(?:marks)?[\)\]]?))?$/i;

export function parseExcelBuffer(
  buffer: any,
  config?: {
    roundingTolerance?: number;
    subjectsConfig?: Record<string, SubjectConfig>;
  }
): ParseResult {
  const tolerance = config?.roundingTolerance ?? 1.0;
  const warnings: DataQualityWarning[] = [];
  const validRows: RawParsedRow[] = [];
  const detectedSubjectsSet = new Set<string>();
  const subjectBlocks: Record<string, DiscoveredSubjectBlock> = {};
  const seenStudentSubjectPairs = new Map<string, number>();

  let workbook: XLSX.WorkBook;
  try {
    const isNodeBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(buffer);
    workbook = XLSX.read(buffer, { type: isNodeBuffer ? 'buffer' : 'array' });
  } catch (err: any) {
    return {
      validRows: [],
      detectedSubjects: [],
      subjectBlocks: {},
      warnings: [],
      totalRows: 0,
      isWideFormat: false,
      error: `Failed to parse Excel file format: ${err.message || 'Corrupted or unreadable spreadsheet'}`,
    };
  }

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    return {
      validRows: [],
      detectedSubjects: [],
      subjectBlocks: {},
      warnings: [],
      totalRows: 0,
      isWideFormat: false,
      error: 'The uploaded Excel workbook contains no worksheets.',
    };
  }

  // Prioritize "Form Responses 1" or first sheet with data
  let targetSheetName = sheetNames[0];
  const formRespSheet = sheetNames.find((s) => s.toLowerCase().includes('form responses') || s.toLowerCase().includes('responses'));
  if (formRespSheet) {
    targetSheetName = formRespSheet;
  }

  const sheet = workbook.Sheets[targetSheetName];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawData || rawData.length === 0) {
    return {
      validRows: [],
      detectedSubjects: [],
      subjectBlocks: {},
      warnings: [],
      totalRows: 0,
      isWideFormat: false,
      error: `The worksheet "${targetSheetName}" is completely empty.`,
    };
  }

  // Identify header row (first non-empty row)
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some((cell: any) => String(cell || '').trim().length > 0)) {
      headers = row.map((cell: any) => String(cell || '').trim());
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || headers.length === 0) {
    return {
      validRows: [],
      detectedSubjects: [],
      subjectBlocks: {},
      warnings: [],
      totalRows: 0,
      isWideFormat: false,
      error: 'Could not find a valid table header row in the Excel sheet.',
    };
  }

  // Check if this is Google Forms wide format
  // Discover columns matching "{SUBJECT_LABEL} - {METRIC}"
  interface TempSubjectBlock {
    label: string;
    internalCol?: number;
    externalCol?: number;
    totalCol?: number;
    resultCol?: number;
    moduleColumns: DetectedModuleColumn[];
  }

  const tempBlocks = new Map<string, TempSubjectBlock>();
  let colTimestamp = -1;
  let colName = -1;
  let colUsn = -1;
  const recognizedColIndices = new Set<number>();

  headers.forEach((h, colIdx) => {
    const norm = normalizeHeader(h);
    if (!h) return;

    if (['timestamp', 'time', 'date'].includes(norm)) {
      colTimestamp = colIdx;
      recognizedColIndices.add(colIdx);
      return;
    }

    if (['name', 'studentname', 'candidatename', 'student', 'fullname', 'nameofstudent'].includes(norm)) {
      if (colName === -1) {
        colName = colIdx;
        recognizedColIndices.add(colIdx);
        return;
      }
    }

    if (['usn', 'studentid', 'rollno', 'rollnumber', 'regno', 'registerno', 'universityseatnumber', 'id'].includes(norm)) {
      if (colUsn === -1) {
        colUsn = colIdx;
        recognizedColIndices.add(colIdx);
        return;
      }
    }

    // Try matching subject block regex: "{SUBJECT_LABEL} - {METRIC}"
    const match = h.match(SUBJECT_HEADER_REGEX);
    if (match) {
      const subjectLabel = match[1].trim();
      const metricTypeRaw = match[2].trim().toUpperCase();
      const metricNorm = normalizeHeader(metricTypeRaw);

      if (!tempBlocks.has(subjectLabel)) {
        tempBlocks.set(subjectLabel, { label: subjectLabel, moduleColumns: [] });
      }
      const blk = tempBlocks.get(subjectLabel)!;

      const extractedMax = extractMaxMarksFromHeader(h);

      if (
        metricNorm.includes('module') ||
        metricNorm.includes('mod') ||
        /^m\d+$/.test(metricNorm) ||
        metricNorm.includes('cie') ||
        metricNorm.includes('ia') ||
        metricNorm.includes('component')
      ) {
        blk.moduleColumns.push({
          colIdx,
          headerName: h,
          metric: metricNorm,
          maxMarks: extractedMax || 100,
        });
      }

      if (metricNorm.includes('internal') || metricNorm.includes('ia') || metricNorm.includes('cie')) {
        blk.internalCol = colIdx;
      } else if (metricNorm.includes('external') || metricNorm.includes('see') || metricNorm.includes('theory')) {
        blk.externalCol = colIdx;
      } else if (metricNorm.includes('total') || metricNorm.includes('final') || metricNorm.includes('aggregate')) {
        blk.totalCol = colIdx;
      } else if (
        metricNorm.includes('result') ||
        metricNorm.includes('status') ||
        metricNorm.includes('grade') ||
        metricNorm.includes('remark') ||
        metricNorm.includes('passfail') ||
        metricNorm.includes('outcome')
      ) {
        blk.resultCol = colIdx;
      }

      recognizedColIndices.add(colIdx);
    }
  });

  const isWideFormat = tempBlocks.size > 0;

  // Handle Trailing non-data columns (Google Forms junk columns, e.g. "Column 38", "Untitled Question", etc.)
  const dataRowsStart = headerRowIndex + 1;
  headers.forEach((h, colIdx) => {
    if (!recognizedColIndices.has(colIdx)) {
      // Check if all data rows for this column are empty / blank / NaN
      let hasData = false;
      for (let r = dataRowsStart; r < rawData.length; r++) {
        const cell = rawData[r]?.[colIdx];
        if (cell !== undefined && cell !== null && String(cell).trim().length > 0) {
          hasData = true;
          break;
        }
      }

      if (!hasData) {
        // Drop empty trailing / junk column
        if (!warnings.some((w) => w.type === 'trailing_junk_dropped')) {
          warnings.push({
            type: 'trailing_junk_dropped',
            severity: 'info',
            message: `Empty or unassigned trailing columns were automatically dropped from analysis.`,
          });
        }
      } else {
        // Non-empty unknown column: flag in warnings panel
        warnings.push({
          type: 'ambiguous_column',
          severity: 'info',
          message: `Ambiguous column "${h || `Column ${colIdx + 1}`}" (Col #${colIdx + 1}) contains non-empty data but did not match standard subject block format "{SUBJECT} - {METRIC}". Column was skipped.`,
        });
      }
    }
  });

  // ==========================================
  // 1. PROCESS GOOGLE FORMS WIDE-FORMAT EXPORT
  // ==========================================
  if (isWideFormat) {
    if (colUsn === -1 && colName === -1) {
      return {
        validRows: [],
        detectedSubjects: [],
        subjectBlocks: {},
        warnings: [],
        totalRows: rawData.length - (headerRowIndex + 1),
        isWideFormat: true,
        error: 'Could not find required USN or Student Name columns in Google Forms export headers.',
      };
    }

    // Classify each subject block
    tempBlocks.forEach((blk, subjectLabel) => {
      const hasInternal = blk.internalCol !== undefined;
      const hasExternal = blk.externalCol !== undefined;
      const hasTotal = blk.totalCol !== undefined;
      const hasResult = blk.resultCol !== undefined;

      // Check if external column is absent OR completely 0 across all data rows (e.g. seminar / mini-project)
      let externalAlwaysZeroOrAbsent = !hasExternal;
      if (hasExternal) {
        let allZero = true;
        for (let r = dataRowsStart; r < rawData.length; r++) {
          const val = rawData[r]?.[blk.externalCol!];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            const num = Number(val);
            if (!isNaN(num) && num > 0) {
              allZero = false;
              break;
            }
          }
        }
        if (allZero) {
          externalAlwaysZeroOrAbsent = true;
        }
      }

      let blockType: SubjectBlockType = 'complete';
      if (externalAlwaysZeroOrAbsent && hasInternal) {
        blockType = 'internal_only';
        warnings.push({
          type: 'internal_only',
          severity: 'info',
          subjectCode: subjectLabel,
          message: `Subject "${subjectLabel}": Detected as Internal-Only / Continuous Evaluation block (External marks absent or all zero). External marks chart will be omitted.`,
        });
      } else if (!hasTotal || !hasResult) {
        blockType = 'incomplete_no_total';
        warnings.push({
          type: 'incomplete_block',
          severity: 'warning',
          subjectCode: subjectLabel,
          message: `Subject "${subjectLabel}": Total/Result not available in source data — compute Total from Internal+External if you want it analyzed, or exclude this subject.`,
        });
      }

      // Dynamically detect module columns and sum their individual maximum marks
      let detectedModuleCount = blk.moduleColumns.length;
      let computedTotalMaxMarks = 100;
      let expectedMarksPerModule = 100;
      let hasModuleMismatch = false;
      let mismatchWarning: string | undefined = undefined;
      let formulaCheck = '1 module × 100 marks = 100 total';

      if (detectedModuleCount > 0) {
        // Sum individual maximum marks of detected module columns
        computedTotalMaxMarks = blk.moduleColumns.reduce((sum, mod) => sum + mod.maxMarks, 0);
        expectedMarksPerModule = blk.moduleColumns[0]?.maxMarks || 100;
        const expectedSum = detectedModuleCount * expectedMarksPerModule;
        formulaCheck = `${detectedModuleCount} modules × ${expectedMarksPerModule} marks = ${computedTotalMaxMarks} total`;
        if (computedTotalMaxMarks !== expectedSum) {
          hasModuleMismatch = true;
          mismatchWarning = `Total maximum marks mismatch: Detected ${detectedModuleCount} modules totaling ${computedTotalMaxMarks} marks, but expected ${expectedSum} total marks (${detectedModuleCount} × ${expectedMarksPerModule}). Please verify column headers.`;
          warnings.push({
            type: 'mismatch',
            severity: 'warning',
            subjectCode: subjectLabel,
            message: mismatchWarning,
          });
        }
      } else if (blockType === 'internal_only') {
        detectedModuleCount = 1;
        expectedMarksPerModule = 100;
        computedTotalMaxMarks = 100;
        formulaCheck = '1 module × 100 marks = 100 total';
      } else {
        detectedModuleCount = 1;
        expectedMarksPerModule = 100;
        computedTotalMaxMarks = 100;
        formulaCheck = '1 module × 100 marks = 100 total';
      }

      subjectBlocks[subjectLabel] = {
        subjectLabel,
        blockType,
        hasInternal,
        hasExternal,
        hasTotal,
        hasResult,
        internalCol: blk.internalCol,
        externalCol: blk.externalCol,
        totalCol: blk.totalCol,
        resultCol: blk.resultCol,
        moduleColumns: blk.moduleColumns,
        detectedModuleCount,
        expectedMarksPerModule,
        computedTotalMaxMarks,
        formulaCheck,
        hasModuleMismatch,
        mismatchWarning,
      };

      detectedSubjectsSet.add(subjectLabel);
    });

    let totalDataRows = 0;

    // Parse each student row
    for (let r = dataRowsStart; r < rawData.length; r++) {
      const row = rawData[r];
      const excelRowNumber = r + 1;

      // Skip completely empty rows
      if (!row || !row.some((cell: any) => String(cell ?? '').trim().length > 0)) {
        continue;
      }

      totalDataRows++;

      const rawStudentId = colUsn !== -1 ? String(row[colUsn] ?? '').trim() : '';
      const rawStudentName = colName !== -1 ? String(row[colName] ?? '').trim() : '';

      // If both USN and Name are missing, skip row
      if (!rawStudentId && !rawStudentName) {
        warnings.push({
          type: 'coercion',
          severity: 'warning',
          rowNumber: excelRowNumber,
          message: `Row ${excelRowNumber} has missing USN and Student Name and was skipped.`,
        });
        continue;
      }

      const studentId = rawStudentId || rawStudentName;
      const studentName = rawStudentName || rawStudentId;

      // Extract marks for each discovered subject block
      tempBlocks.forEach((blk, subjectLabel) => {
        const blkMeta = subjectBlocks[subjectLabel];
        const isInternalOnly = blkMeta.blockType === 'internal_only';

        // Check duplicate
        const pairKey = `${studentId.toUpperCase()}:::${subjectLabel.toUpperCase()}`;
        if (seenStudentSubjectPairs.has(pairKey)) {
          const prevRow = seenStudentSubjectPairs.get(pairKey);
          warnings.push({
            type: 'duplicate',
            severity: 'warning',
            rowNumber: excelRowNumber,
            studentId,
            subjectCode: subjectLabel,
            message: `Duplicate entry for USN "${studentId}" in subject "${subjectLabel}" (first seen on row ${prevRow}). Overriding with latest entry.`,
          });
        }
        seenStudentSubjectPairs.set(pairKey, excelRowNumber);

        // Coerce metric values
        const parseMetric = (colIdx: number | undefined, fieldName: string): { val: number; coerced: boolean; isBlank: boolean } => {
          if (colIdx === undefined) {
            return { val: 0, coerced: false, isBlank: true };
          }
          const rawVal = row[colIdx];
          if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
            // If it's a regular subject and cell is blank within row, flag coercion warning
            if (!isInternalOnly || fieldName !== 'External Marks') {
              warnings.push({
                type: 'coercion',
                severity: 'warning',
                rowNumber: excelRowNumber,
                studentId,
                subjectCode: subjectLabel,
                message: `Row ${excelRowNumber} (${studentId} - ${subjectLabel}): Blank value in ${fieldName} coerced to 0.`,
              });
            }
            return { val: 0, coerced: true, isBlank: true };
          }
          const num = Number(rawVal);
          if (isNaN(num)) {
            warnings.push({
              type: 'coercion',
              severity: 'warning',
              rowNumber: excelRowNumber,
              studentId,
              subjectCode: subjectLabel,
              message: `Row ${excelRowNumber} (${studentId} - ${subjectLabel}): Non-numeric value "${rawVal}" in ${fieldName} coerced to 0.`,
            });
            return { val: 0, coerced: true, isBlank: false };
          }
          return { val: num, coerced: false, isBlank: false };
        };

        const intRes = parseMetric(blk.internalCol, 'Internal Marks');
        const extRes = isInternalOnly ? { val: 0, coerced: false, isBlank: true } : parseMetric(blk.externalCol, 'External Marks');

        const internalMarks = Math.max(0, intRes.val);
        const externalMarks = Math.max(0, extRes.val);

        let totalMarks = 0;
        if (blk.totalCol !== undefined) {
          const totRes = parseMetric(blk.totalCol, 'Total Marks');
          totalMarks = Math.max(0, totRes.val);

          // Cross-check Total ≈ Internal + External (when Total column exists)
          const computedSum = internalMarks + externalMarks;
          const diff = Math.abs(totalMarks - computedSum);

          if (diff > tolerance) {
            warnings.push({
              type: 'mismatch',
              severity: 'warning',
              rowNumber: excelRowNumber,
              studentId,
              subjectCode: subjectLabel,
              message: `Row ${excelRowNumber} (${studentName} - ${subjectLabel}): Sheet total (${totalMarks}) does not equal Internal (${internalMarks}) + External (${externalMarks}) = ${computedSum} (diff: ${diff.toFixed(1)} > tolerance ±${tolerance}). Using sheet total.`,
            });
          }
        } else {
          // Total column missing from source sheet -> Auto-compute Total = Internal + External
          totalMarks = internalMarks + externalMarks;
        }

        const sheetResult = blk.resultCol !== undefined && row[blk.resultCol] !== undefined
          ? String(row[blk.resultCol]).trim()
          : undefined;

        validRows.push({
          rowNumber: excelRowNumber,
          studentId,
          studentName,
          subjectCode: subjectLabel,
          internalMarks,
          externalMarks,
          totalMarks,
          sheetResult,
          raw: {
            rawInternal: blk.internalCol !== undefined ? row[blk.internalCol] : undefined,
            rawExternal: blk.externalCol !== undefined ? row[blk.externalCol] : undefined,
            rawTotal: blk.totalCol !== undefined ? row[blk.totalCol] : undefined,
            rawResult: sheetResult,
          },
        });
      });
    }

    if (validRows.length === 0) {
      return {
        validRows: [],
        detectedSubjects: [],
        subjectBlocks: {},
        warnings,
        totalRows: totalDataRows,
        isWideFormat: true,
        error: 'Zero valid student subject records could be extracted from the Google Forms wide-format spreadsheet.',
      };
    }

    return {
      validRows,
      detectedSubjects: Array.from(detectedSubjectsSet).sort(),
      subjectBlocks,
      warnings,
      totalRows: totalDataRows,
      isWideFormat: true,
    };
  }

  // ==========================================
  // 2. FALLBACK: LONG-FORMAT TIDY SPREADSHEET
  // ==========================================
  let colStudentId = -1;
  let colStudentName = -1;
  let colSubjectCode = -1;
  let colInternal = -1;
  let colExternal = -1;
  let colTotal = -1;
  let colResult = -1;

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (['studentid', 'usn', 'rollno', 'rollnumber', 'regno', 'registerno', 'id'].includes(norm)) {
      if (colStudentId === -1) colStudentId = idx;
    } else if (['studentname', 'name', 'candidatename', 'student'].includes(norm)) {
      if (colStudentName === -1) colStudentName = idx;
    } else if (['subjectcode', 'subcode', 'coursecode', 'subject', 'course', 'sub'].includes(norm)) {
      if (colSubjectCode === -1) colSubjectCode = idx;
    } else if (['internalmarks', 'internalmark', 'internal', 'ia', 'cie', 'internals'].includes(norm)) {
      if (colInternal === -1) colInternal = idx;
    } else if (['externalmarks', 'externalmark', 'external', 'see', 'externals', 'theory', 'semmarks'].includes(norm)) {
      if (colExternal === -1) colExternal = idx;
    } else if (['totalmarks', 'totalmark', 'total', 'grandtotal', 'finalmarks', 'sum'].includes(norm)) {
      if (colTotal === -1) colTotal = idx;
    } else if (['result', 'status', 'gradestatus', 'remarks', 'passfail'].includes(norm)) {
      if (colResult === -1) colResult = idx;
    }
  });

  const missingColumns: string[] = [];
  if (colStudentId === -1 && colStudentName === -1) missingColumns.push('student_id or USN');
  if (colSubjectCode === -1) missingColumns.push('subject_code');
  if (colInternal === -1 && colExternal === -1 && colTotal === -1) missingColumns.push('marks columns');

  if (missingColumns.length > 0) {
    return {
      validRows: [],
      detectedSubjects: [],
      subjectBlocks: {},
      warnings: [],
      totalRows: rawData.length - (headerRowIndex + 1),
      isWideFormat: false,
      error: `Zero valid subject blocks detected. Headers must follow Google Forms wide format '{SUBJECT} - INTERNAL MARKS / EXTERNAL MARKS / TOTAL MARKS / RESULT' or standard columns (${missingColumns.join(', ')} missing).`,
    };
  }

  let totalDataRows = 0;

  for (let r = dataRowsStart; r < rawData.length; r++) {
    const row = rawData[r];
    const excelRowNumber = r + 1;

    if (!row || !row.some((cell: any) => String(cell ?? '').trim().length > 0)) {
      continue;
    }

    totalDataRows++;

    const rawStudentId = colStudentId !== -1 ? String(row[colStudentId] ?? '').trim() : '';
    const rawStudentName = colStudentName !== -1 ? String(row[colStudentName] ?? '').trim() : '';
    const rawSubjectCode = colSubjectCode !== -1 ? String(row[colSubjectCode] ?? '').trim().toUpperCase() : '';
    const rawInternal = colInternal !== -1 ? row[colInternal] : 0;
    const rawExternal = colExternal !== -1 ? row[colExternal] : 0;
    const rawTotal = colTotal !== -1 ? row[colTotal] : undefined;
    const rawResult = colResult !== -1 ? String(row[colResult] ?? '').trim() : undefined;

    if ((!rawStudentId && !rawStudentName) || !rawSubjectCode) {
      warnings.push({
        type: 'coercion',
        severity: 'warning',
        rowNumber: excelRowNumber,
        studentId: rawStudentId || undefined,
        subjectCode: rawSubjectCode || undefined,
        message: `Row ${excelRowNumber} has missing student ID or subject code and was skipped.`,
      });
      continue;
    }

    const studentId = rawStudentId || rawStudentName;
    const studentName = rawStudentName || rawStudentId;

    const pairKey = `${studentId.toUpperCase()}:::${rawSubjectCode.toUpperCase()}`;
    if (seenStudentSubjectPairs.has(pairKey)) {
      const prevRow = seenStudentSubjectPairs.get(pairKey);
      warnings.push({
        type: 'duplicate',
        severity: 'warning',
        rowNumber: excelRowNumber,
        studentId,
        subjectCode: rawSubjectCode,
        message: `Duplicate record for student ${studentId} in subject ${rawSubjectCode} (first seen on row ${prevRow}). Overriding with latest entry.`,
      });
    }
    seenStudentSubjectPairs.set(pairKey, excelRowNumber);

    const parseNum = (val: any, fieldName: string): number => {
      if (val === null || val === undefined || val === '') {
        warnings.push({
          type: 'coercion',
          severity: 'warning',
          rowNumber: excelRowNumber,
          studentId,
          subjectCode: rawSubjectCode,
          message: `Row ${excelRowNumber}: Blank value in ${fieldName} coerced to 0.`,
        });
        return 0;
      }
      const num = Number(val);
      if (isNaN(num)) {
        warnings.push({
          type: 'coercion',
          severity: 'warning',
          rowNumber: excelRowNumber,
          studentId,
          subjectCode: rawSubjectCode,
          message: `Row ${excelRowNumber}: Non-numeric value "${val}" in ${fieldName} coerced to 0.`,
        });
        return 0;
      }
      return num;
    };

    const internalMarks = Math.max(0, parseNum(rawInternal, 'internal_marks'));
    const externalMarks = Math.max(0, parseNum(rawExternal, 'external_marks'));
    let totalMarks = rawTotal !== undefined ? Math.max(0, parseNum(rawTotal, 'total_marks')) : internalMarks + externalMarks;

    if (rawTotal !== undefined) {
      const computedSum = internalMarks + externalMarks;
      const diff = Math.abs(totalMarks - computedSum);

      if (diff > tolerance) {
        warnings.push({
          type: 'mismatch',
          severity: 'warning',
          rowNumber: excelRowNumber,
          studentId,
          subjectCode: rawSubjectCode,
          message: `Row ${excelRowNumber} (${studentName} - ${rawSubjectCode}): Sheet total (${totalMarks}) does not equal Internal (${internalMarks}) + External (${externalMarks}) = ${computedSum} (diff: ${diff.toFixed(1)} > tolerance ±${tolerance}). Using sheet total.`,
        });
      }
    }

    detectedSubjectsSet.add(rawSubjectCode);
    if (!subjectBlocks[rawSubjectCode]) {
      const isInternalOnly = colExternal === -1;
      subjectBlocks[rawSubjectCode] = {
        subjectLabel: rawSubjectCode,
        blockType: isInternalOnly ? 'internal_only' : 'complete',
        hasInternal: colInternal !== -1,
        hasExternal: colExternal !== -1,
        hasTotal: colTotal !== -1,
        hasResult: colResult !== -1,
        detectedModuleCount: 1,
        expectedMarksPerModule: 100,
        computedTotalMaxMarks: 100,
        formulaCheck: '1 module × 100 marks = 100 total',
      };
    }

    validRows.push({
      rowNumber: excelRowNumber,
      studentId,
      studentName,
      subjectCode: rawSubjectCode,
      internalMarks,
      externalMarks,
      totalMarks,
      sheetResult: rawResult,
      raw: {
        rawInternal,
        rawExternal,
        rawTotal,
        rawResult,
      },
    });
  }

  return {
    validRows,
    detectedSubjects: Array.from(detectedSubjectsSet).sort(),
    subjectBlocks,
    warnings,
    totalRows: totalDataRows,
    isWideFormat: false,
  };
}

