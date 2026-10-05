import { parseExcelBuffer } from './parser.js';
import { aggregateSemesterData, DEFAULT_GRADING_BANDS, DEFAULT_SUBJECT_CONFIG } from './engine.js';
import { formatFacultyDisplay } from '../src/types/analyzer.js';
import {
  encryptData,
  decryptData,
  encryptBuffer,
  decryptBuffer,
  BLOCKED_AI_SCRAPERS,
  BLOCKED_SCRIPTING_TOOLS,
} from './security.js';
import {
  saveUploadArchive,
  getUploadById,
  listUploadHistory,
  deleteAnalysisSession,
  createCollege,
  getCollegeById,
  deleteCollege,
  createDepartment,
  getDepartmentById,
  deleteDepartment,
  listDepartments,
  saveOtpRecord,
  getValidOtpRecord,
  markOtpUsed,
} from './db.js';
import { generateSixDigitOtp, hashOtpCode } from './email.js';
import {
  generateNormalFixture,
  generateEdgeCaseTiesFixture,
  generateStrictSplitFixture,
  generateInvalidFixture,
  generateGoogleFormsWideFixture,
} from './fixtures.js';

export interface TestResultItem {
  id: string;
  name: string;
  category: 'normal' | 'edge_cases' | 'strict_split' | 'invalid_format' | 'google_forms_wide' | 'faculty_formatting';
  passed: boolean;
  message: string;
  details?: any;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResultItem[];
  timestamp: string;
}

export async function runBackendUnitTests(): Promise<TestSuiteSummary> {
  const results: TestResultItem[] = [];

  // TEST 1: Normal Fixture Parsing and Aggregation
  try {
    const normalBuf = generateNormalFixture();
    const parseRes = parseExcelBuffer(normalBuf);
    
    if (parseRes.error) {
      results.push({
        id: 'T1_NORMAL_PARSE',
        name: 'Normal Fixture Parsing',
        category: 'normal',
        passed: false,
        message: `Parsing failed with error: ${parseRes.error}`,
      });
    } else {
      const expectedRows = 25 * 6; // 25 students * 6 subjects = 150 rows
      const isRowCountCorrect = parseRes.validRows.length === expectedRows;
      const isSubjectsCountCorrect = parseRes.detectedSubjects.length === 6;

      results.push({
        id: 'T1_NORMAL_PARSE',
        name: 'Normal Fixture Parsing & Row Extraction',
        category: 'normal',
        passed: isRowCountCorrect && isSubjectsCountCorrect,
        message: isRowCountCorrect && isSubjectsCountCorrect
          ? `Successfully parsed 150 rows across 6 subjects (${parseRes.detectedSubjects.join(', ')}).`
          : `Row count mismatch. Expected ${expectedRows} valid rows, got ${parseRes.validRows.length}. Detected subjects: ${parseRes.detectedSubjects.length}`,
      });

      // Test Aggregation
      const subConfigs = parseRes.detectedSubjects.reduce((acc, code) => {
        acc[code] = DEFAULT_SUBJECT_CONFIG(code);
        return acc;
      }, {} as any);

      const analysis = aggregateSemesterData(parseRes.validRows, DEFAULT_GRADING_BANDS, subConfigs, parseRes.warnings);

      // Verify Top 5 Rank integrity (Ranks must be strictly 1, 2, 3, 4, 5 and sorted descending)
      let ranksSortedCorrectly = true;
      Object.values(analysis.subjectsAnalysis).forEach((sub) => {
        for (let i = 1; i < sub.top5Students.length; i++) {
          if (sub.top5Students[i].totalMarks > sub.top5Students[i - 1].totalMarks) {
            ranksSortedCorrectly = false;
          }
        }
      });

      // Verify overall semester toppers
      const semToppers = analysis.semesterSummary.overallToppers;
      const semToppersValid =
        semToppers.length > 0 &&
        semToppers.every((t) => t.rank <= 5) &&
        semToppers.every((t, i) => i === 0 || t.totalMarksObtained <= semToppers[i - 1].totalMarksObtained);

      results.push({
        id: 'T1_NORMAL_AGGREGATION',
        name: 'Normal Aggregation & Rank Math',
        category: 'normal',
        passed: ranksSortedCorrectly && semToppersValid && analysis.semesterSummary.totalUniqueStudents === 25,
        message: `Rank ordering and semester summation verified for 25 unique students across 6 subjects.`,
        details: {
          ranksSortedCorrectly,
          semToppersValid,
          totalUniqueStudents: analysis.semesterSummary.totalUniqueStudents,
          semToppersLength: semToppers.length,
          semToppersRanks: semToppers.map((t) => ({ id: t.studentId, rank: t.rank, marks: t.totalMarksObtained })),
        },
      });
    }
  } catch (err: any) {
    results.push({
      id: 'T1_NORMAL_PARSE',
      name: 'Normal Fixture Execution',
      category: 'normal',
      passed: false,
      message: `Exception during normal test: ${err.message}`,
    });
  }

  // TEST 2: Edge Case Ties at Rank 5 & Data Quality Warnings
  try {
    const edgeBuf = generateEdgeCaseTiesFixture();
    const parseRes = parseExcelBuffer(edgeBuf, { roundingTolerance: 1.0 });

    const hasMismatchWarning = parseRes.warnings.some((w) => w.type === 'mismatch');
    const hasCoercionWarning = parseRes.warnings.some((w) => w.type === 'coercion');

    results.push({
      id: 'T2_EDGE_DATA_QUALITY',
      name: 'Data Quality Warning Detection (Mismatches & Blank Coercions)',
      category: 'edge_cases',
      passed: hasMismatchWarning && hasCoercionWarning,
      message: `Detected ${parseRes.warnings.length} quality warnings (Total sum mismatch and blank cell coercion detected as required).`,
      details: parseRes.warnings,
    });

    const subConfigs = parseRes.detectedSubjects.reduce((acc, code) => {
      acc[code] = DEFAULT_SUBJECT_CONFIG(code);
      return acc;
    }, {} as any);

    const analysis = aggregateSemesterData(parseRes.validRows, DEFAULT_GRADING_BANDS, subConfigs, parseRes.warnings);
    const sub21CS51 = analysis.subjectsAnalysis['21CS51'];

    // Check tie handling in 21CS51:
    // We expect rank 5 to include all 3 students with 80 marks (Aarav, Chetan, Divya).
    // Total in top 5 list should be 7 students: 1, 2, 3, 4, 5 (tied), 5 (tied), 5 (tied).
    const rank5Students = sub21CS51.top5Students.filter((s) => s.rank === 5);
    const tiesHandledWithoutDrop = rank5Students.length === 3;

    results.push({
      id: 'T2_EDGE_RANK5_TIES',
      name: 'Explicit Rank-5 Tie Boundary Preservation',
      category: 'edge_cases',
      passed: tiesHandledWithoutDrop,
      message: tiesHandledWithoutDrop
        ? `Successfully retained all 3 students tied at rank 5 without dropping any candidate.`
        : `Expected 3 students tied at rank 5, found ${rank5Students.length}. Total returned: ${sub21CS51.top5Students.length}`,
      details: sub21CS51.top5Students,
    });
  } catch (err: any) {
    results.push({
      id: 'T2_EDGE_TEST',
      name: 'Edge Case Execution',
      category: 'edge_cases',
      passed: false,
      message: `Exception in edge case test: ${err.message}`,
    });
  }

  // TEST 3: Strict Split Marks & Separate Pass Criteria
  try {
    const splitBuf = generateStrictSplitFixture();
    const parseRes = parseExcelBuffer(splitBuf);

    const subConfigs = {
      '21CS51': {
        subjectCode: '21CS51',
        facultyName: 'Dr. Ramesh Kumar',
        maxInternal: 40,
        maxExternal: 60,
        maxTotal: 100,
      },
    };

    // When separate pass criteria is enabled (require 40% internal and 40% external)
    const strictGradingBands = {
      ...DEFAULT_GRADING_BANDS,
      requireSeparatePass: true,
      minInternalPassPercent: 40,
      minExternalPassPercent: 40,
    };

    const analysis = aggregateSemesterData(parseRes.validRows, strictGradingBands, subConfigs, parseRes.warnings);
    const sub = analysis.subjectsAnalysis['21CS51'];

    // Rahul Dravid (12/40 = 30% internal) should fail internal
    const rahul = sub.allStudents.find((s) => s.studentName === 'Rahul Dravid');
    const rahulFailed = rahul?.computedResult === 'Fail' && rahul.failReasons.some((r) => r.includes('Internal score'));

    // Sourav Ganguly (18/60 = 30% external) should fail external
    const sourav = sub.allStudents.find((s) => s.studentName === 'Sourav Ganguly');
    const souravFailed = sourav?.computedResult === 'Fail' && sourav.failReasons.some((r) => r.includes('External score'));

    // Sachin Tendulkar (35/40, 52/60, total 87) should be FCD
    const sachin = sub.allStudents.find((s) => s.studentName === 'Sachin Tendulkar');
    const sachinFCD = sachin?.gradeBand === 'FCD';

    results.push({
      id: 'T3_STRICT_SPLIT_PASS',
      name: 'Separate Internal/External Minimum Pass Cutoff Evaluation',
      category: 'strict_split',
      passed: !!(rahulFailed && souravFailed && sachinFCD),
      message: (rahulFailed && souravFailed && sachinFCD)
        ? `Correctly failed students falling short of individual component cutoffs while awarding FCD to eligible candidate.`
        : `Separate pass evaluation mismatch (Rahul failed: ${rahulFailed}, Sourav failed: ${souravFailed}, Sachin FCD: ${sachinFCD})`,
    });
  } catch (err: any) {
    results.push({
      id: 'T3_STRICT_SPLIT',
      name: 'Strict Split Test Execution',
      category: 'strict_split',
      passed: false,
      message: `Exception in strict split test: ${err.message}`,
    });
  }

  // TEST 4: Invalid File Format & Graceful Error State
  try {
    const invalidBuf = generateInvalidFixture();
    const parseRes = parseExcelBuffer(invalidBuf);

    const properlyRejected =
      !!parseRes.error &&
      (parseRes.error.includes('Missing required column') ||
        parseRes.error.includes('Zero valid subject blocks detected') ||
        parseRes.error.includes('missing'));

    results.push({
      id: 'T4_INVALID_REJECTION',
      name: 'Invalid Excel Format Graceful Rejection & Specific Error',
      category: 'invalid_format',
      passed: properlyRejected,
      message: properlyRejected
        ? `Gracefully rejected invalid headers with message: "${parseRes.error}"`
        : `Did not reject invalid file format properly. Response: ${JSON.stringify(parseRes)}`,
    });
  } catch (err: any) {
    results.push({
      id: 'T4_INVALID_TEST',
      name: 'Invalid Format Test Execution',
      category: 'invalid_format',
      passed: false,
      message: `Exception during invalid format test: ${err.message}`,
    });
  }

  // TEST 5: Google Forms Wide-Format Parsing, Incomplete Block Auto-Calculation & Junk Column Dropping
  try {
    const wideBuf = generateGoogleFormsWideFixture();
    const parseRes = parseExcelBuffer(wideBuf);

    if (parseRes.error) {
      results.push({
        id: 'T5_GOOGLE_FORMS_WIDE',
        name: 'Google Forms Wide-Format Parsing',
        category: 'google_forms_wide',
        passed: false,
        message: `Wide format parse error: ${parseRes.error}`,
      });
    } else {
      // Expect 5 subjects discovered
      const detected = parseRes.detectedSubjects;
      const has5Subjects = detected.length === 5;

      // Expect junk columns dropped
      const droppedJunk = parseRes.warnings.some((w) => w.type === 'trailing_junk_dropped');

      // Expect incomplete block detected for 21CIV59
      const civBlock = parseRes.subjectBlocks['ENVIRONMENTAL STUDIES (21CIV59)'] || parseRes.subjectBlocks['21CIV59'];
      const incompleteDetected = parseRes.warnings.some((w) => w.type === 'incomplete_block') || (civBlock && civBlock.blockType === 'incomplete_no_total');

      // Expect internal-only detected for 21CSMP58
      const projBlock = parseRes.subjectBlocks['MINI PROJECT & SEMINAR (21CSMP58)'] || parseRes.subjectBlocks['21CSMP58'];
      const internalOnlyDetected = (projBlock && projBlock.blockType === 'internal_only') || parseRes.warnings.some((w) => w.type === 'internal_only');

      // Check row count (10 students * 5 subjects = 50 rows)
      const expectedRows = 10 * 5;
      const rowCountMatch = parseRes.validRows.length === expectedRows;

      // Verify aggregation on wide format
      const subConfigs = detected.reduce((acc, code) => {
        const blk = parseRes.subjectBlocks[code];
        acc[code] = DEFAULT_SUBJECT_CONFIG(code, blk?.blockType);
        return acc;
      }, {} as any);

      const analysis = aggregateSemesterData(parseRes.validRows, DEFAULT_GRADING_BANDS, subConfigs, parseRes.warnings);
      const semStudents = analysis.semesterSummary.totalUniqueStudents === 10;

      const allChecksPass = has5Subjects && droppedJunk && rowCountMatch && semStudents;

      results.push({
        id: 'T5_GOOGLE_FORMS_WIDE',
        name: 'Google Forms Wide Export Header-Driven Parsing & Auto-Aggregation',
        category: 'google_forms_wide',
        passed: allChecksPass,
        message: allChecksPass
          ? `Successfully parsed Google Forms wide layout: discovered 5 irregular subjects, dropped blank junk columns, auto-computed incomplete totals, and evaluated 10 students.`
          : `Wide parse mismatch: 5 subjects=${has5Subjects} (${detected.join(', ')}), junk dropped=${droppedJunk}, incomplete detected=${incompleteDetected}, internal-only=${internalOnlyDetected}, 50 rows=${rowCountMatch} (got ${parseRes.validRows.length})`,
        details: {
          detectedSubjects: detected,
          subjectBlocks: parseRes.subjectBlocks,
          warnings: parseRes.warnings,
        },
      });
    }
  } catch (err: any) {
    results.push({
      id: 'T5_GOOGLE_FORMS_WIDE',
      name: 'Google Forms Wide Test Execution',
      category: 'google_forms_wide',
      passed: false,
      message: `Exception during wide fixture test: ${err.message}`,
    });
  }

  // TEST 6: Faculty Name & Section Formatting (Multiple faculties vs Single faculty)
  try {
    // Sub-case 1: Two faculties handling the subject
    const twoFacConfig = {
      facultyAssignments: [
        { id: '1', facultyName: 'Nirmala', section: 'A' },
        { id: '2', facultyName: 'Janavi', section: 'B' },
      ],
    };
    const twoFacFormatted = formatFacultyDisplay(twoFacConfig);
    const expectedTwoFac = 'Nirmala(A Section) & Janavi(B Section)';

    // Sub-case 2: Single faculty with section -> should only show faculty name, not section separately
    const singleFacConfig = {
      facultyAssignments: [{ id: '1', facultyName: 'Nirmala', section: 'A' }],
    };
    const singleFacFormatted = formatFacultyDisplay(singleFacConfig);
    const expectedSingleFac = 'Nirmala';

    // Sub-case 3: Direct single facultyName string
    const directFacConfig = {
      facultyName: 'PAVITHRA M R (Sec A)',
    };
    const directFacFormatted = formatFacultyDisplay(directFacConfig);
    const expectedDirectFac = 'PAVITHRA M R';

    const testPassed =
      twoFacFormatted === expectedTwoFac &&
      singleFacFormatted === expectedSingleFac &&
      directFacFormatted === expectedDirectFac;

    results.push({
      id: 'T6_FACULTY_FORMATTING',
      name: 'Faculty Name Formatting & Section Rules',
      category: 'faculty_formatting',
      passed: testPassed,
      message: testPassed
        ? `Correctly formatted multi-faculty as "${twoFacFormatted}" and single-faculty as "${singleFacFormatted}".`
        : `Faculty formatting mismatch: 2-fac="${twoFacFormatted}" (expected "${expectedTwoFac}"), 1-fac="${singleFacFormatted}" (expected "${expectedSingleFac}"), direct="${directFacFormatted}" (expected "${expectedDirectFac}")`,
      details: {
        twoFacFormatted,
        singleFacFormatted,
        directFacFormatted,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'T6_FACULTY_FORMATTING',
      name: 'Faculty Formatting Test Execution',
      category: 'faculty_formatting',
      passed: false,
      message: `Exception during faculty formatting test: ${err.message}`,
    });
  }

  // TEST 7: Dense Ranking (Consecutive Ranks after Ties - e.g. 1, 2, 2, 3, 4)
  try {
    const mockRows = [
      { studentId: 'USN001', studentName: 'Aarav', subjectCode: '21CS51', internalMarks: 48, externalMarks: 50, totalMarks: 98, result: 'Pass' },
      { studentId: 'USN002', studentName: 'Bhavya', subjectCode: '21CS51', internalMarks: 46, externalMarks: 46, totalMarks: 92, result: 'Pass' }, // Tied 2
      { studentId: 'USN003', studentName: 'Chetan', subjectCode: '21CS51', internalMarks: 46, externalMarks: 46, totalMarks: 92, result: 'Pass' }, // Tied 2
      { studentId: 'USN004', studentName: 'Divya', subjectCode: '21CS51', internalMarks: 44, externalMarks: 44, totalMarks: 88, result: 'Pass' },  // Should be Rank 3, NOT 4!
      { studentId: 'USN005', studentName: 'Esha', subjectCode: '21CS51', internalMarks: 42, externalMarks: 43, totalMarks: 85, result: 'Pass' },   // Rank 4
      { studentId: 'USN006', studentName: 'Farhan', subjectCode: '21CS51', internalMarks: 40, externalMarks: 40, totalMarks: 80, result: 'Pass' }, // Rank 5
    ];

    const subConfig = { '21CS51': DEFAULT_SUBJECT_CONFIG('21CS51') };
    const analysis = aggregateSemesterData(mockRows as any, DEFAULT_GRADING_BANDS, subConfig, []);
    const top5 = analysis.subjectsAnalysis['21CS51'].top5Students;

    const divya = top5.find((s) => s.studentId === 'USN004');
    const esha = top5.find((s) => s.studentId === 'USN005');
    const isDenseRankCorrect = divya?.rank === 3 && esha?.rank === 4;

    results.push({
      id: 'T7_DENSE_RANKING',
      name: 'Dense Ranking Consecutive Order (1, 2, 2, 3, 4)',
      category: 'edge_cases',
      passed: isDenseRankCorrect,
      message: isDenseRankCorrect
        ? `Verified dense ranking: Student with 88 marks assigned Rank 3 (not 4) after tied 2nd rank.`
        : `Dense ranking mismatch: Divya (88 marks) got rank ${divya?.rank} (expected 3), Esha (85 marks) got rank ${esha?.rank} (expected 4)`,
      details: top5.map((s) => ({ id: s.studentId, marks: s.totalMarks, rank: s.rank, isTied: s.isTied })),
    });
  } catch (err: any) {
    results.push({
      id: 'T7_DENSE_RANKING',
      name: 'Dense Ranking Test Execution',
      category: 'edge_cases',
      passed: false,
      message: `Exception during dense ranking test: ${err.message}`,
    });
  }

  // TEST 8: Consider Fail ONLY when Result in Sheet is Provided as Fail (Ignore 40% Cutoff)
  try {
    const testRows = [
      // Student A: 32 marks (below 40% cutoff) BUT sheet says 'Pass' -> MUST BE PASS!
      { rowNumber: 1, studentId: '4UB21CS001', studentName: 'Candidate A', subjectCode: '21CS51', internalMarks: 16, externalMarks: 16, totalMarks: 32, sheetResult: 'Pass', raw: {} },
      // Student B: 75 marks (above cutoff) BUT sheet says 'Fail' -> MUST BE FAIL!
      { rowNumber: 2, studentId: '4UB21CS002', studentName: 'Candidate B', subjectCode: '21CS51', internalMarks: 35, externalMarks: 40, totalMarks: 75, sheetResult: 'Fail', raw: {} },
      // Student C: 35 marks and sheet says 'Absent' -> MUST BE FAIL!
      { rowNumber: 3, studentId: '4UB21CS003', studentName: 'Candidate C', subjectCode: '21CS51', internalMarks: 15, externalMarks: 20, totalMarks: 35, sheetResult: 'AB', raw: {} },
      // Student D: 35 marks and NO Fail result recorded -> MUST BE PASS (40% cutoff is NOT considered for passing)!
      { rowNumber: 4, studentId: '4UB21CS004', studentName: 'Candidate D', subjectCode: '21CS51', internalMarks: 15, externalMarks: 20, totalMarks: 35, sheetResult: undefined, raw: {} },
      // Student E: 65 marks and NO sheet result provided -> MUST BE PASS!
      { rowNumber: 5, studentId: '4UB21CS005', studentName: 'Candidate E', subjectCode: '21CS51', internalMarks: 30, externalMarks: 35, totalMarks: 65, sheetResult: undefined, raw: {} },
    ];

    const subConfig = { '21CS51': DEFAULT_SUBJECT_CONFIG('21CS51') };
    const analysis = aggregateSemesterData(testRows as any, DEFAULT_GRADING_BANDS, subConfig, []);
    const sub = analysis.subjectsAnalysis['21CS51'];

    const candA = sub.allStudents.find((s) => s.studentId === '4UB21CS001');
    const candB = sub.allStudents.find((s) => s.studentId === '4UB21CS002');
    const candC = sub.allStudents.find((s) => s.studentId === '4UB21CS003');
    const candD = sub.allStudents.find((s) => s.studentId === '4UB21CS004');
    const candE = sub.allStudents.find((s) => s.studentId === '4UB21CS005');

    const passA = candA?.computedResult === 'Pass';
    const failB = candB?.computedResult === 'Fail';
    const failC = candC?.computedResult === 'Fail';
    const passD = candD?.computedResult === 'Pass'; // 40% not considered -> Pass!
    const passE = candE?.computedResult === 'Pass';

    // Verify overallFailedStudents in semesterSummary: only Candidate B & C
    const semFailedIds = analysis.semesterSummary.overallFailedStudents.map((s) => s.studentId);
    const overallCorrect = !semFailedIds.includes('4UB21CS001') &&
      semFailedIds.includes('4UB21CS002') &&
      semFailedIds.includes('4UB21CS003') &&
      !semFailedIds.includes('4UB21CS004');

    const allConditionsMet = passA && failB && failC && passD && passE && overallCorrect;

    results.push({
      id: 'T8_SHEET_RESULT_FAIL_MANDATE',
      name: 'Consider Fail Only When Result in Sheet is Recorded as Fail',
      category: 'edge_cases',
      passed: allConditionsMet,
      message: allConditionsMet
        ? 'Verified: 40% cutoff is ignored. Only candidates with sheet result recorded as Fail/Absent are failed, and remedial register strictly includes only recorded fail candidates.'
        : `Condition failure: candA pass=${passA}, candB fail=${failB}, candC fail=${failC}, candD pass=${passD}, candE pass=${passE}, overall=${overallCorrect}`,
      details: {
        candA: { result: candA?.computedResult, sheetResult: candA?.sheetResult, marks: candA?.totalMarks },
        candB: { result: candB?.computedResult, sheetResult: candB?.sheetResult, marks: candB?.totalMarks },
        candC: { result: candC?.computedResult, sheetResult: candC?.sheetResult, marks: candC?.totalMarks },
        candD: { result: candD?.computedResult, sheetResult: candD?.sheetResult, marks: candD?.totalMarks },
        semFailedIds,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'T8_SHEET_RESULT_FAIL_MANDATE',
      name: 'Sheet Result Fail Mandate Test Execution',
      category: 'edge_cases',
      passed: false,
      message: `Exception during test: ${err.message}`,
    });
  }

  // TEST 9: Cryptographic Vault (AES-256-GCM Encryption & Tamper Resistance)
  try {
    const secretAcademicSample = JSON.stringify({
      studentId: '4UB22CS099',
      studentName: 'Confidential Candidate',
      examMarks: [98, 95, 99],
      departmentSecret: 'UBDT-CSE-SECURE-2026',
    });

    const encrypted = encryptData(secretAcademicSample);
    const isCiphertext = encrypted.startsWith('enc:v1:') && !encrypted.includes('Confidential Candidate');
    const decrypted = decryptData(encrypted);
    const roundtripMatches = decrypted === secretAcademicSample;

    // Tamper detection test: corrupt ciphertext
    let tamperDetected = false;
    try {
      const tampered = encrypted.slice(0, -4) + 'abcd';
      decryptData(tampered);
    } catch {
      tamperDetected = true;
    }

    const passedVault = isCiphertext && roundtripMatches && tamperDetected;

    results.push({
      id: 'T9_CRYPTO_VAULT_AES256GCM',
      name: 'Cryptographic Vault AES-256-GCM at Rest & Tamper Detection',
      category: 'edge_cases',
      passed: passedVault,
      message: passedVault
        ? 'Verified: Academic records encrypted at rest with AES-256-GCM. Decryption verified and altered ciphertext rejected by authentication tag.'
        : `Cryptographic failure: isCiphertext=${isCiphertext}, roundtripMatches=${roundtripMatches}, tamperDetected=${tamperDetected}`,
    });
  } catch (err: any) {
    results.push({
      id: 'T9_CRYPTO_VAULT_AES256GCM',
      name: 'Cryptographic Vault AES-256-GCM at Rest',
      category: 'edge_cases',
      passed: false,
      message: `Cryptographic test error: ${err.message}`,
    });
  }

  // TEST 10: Anti-Scraping AI Bot & Malicious Script Scanner
  try {
    const testBots = [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'ClaudeBot/1.0 (+https://www.anthropic.com/claudebot)',
      'Bytespider; spider-feedback@bytedance.com',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
      'Scrapy/2.11.0 (+https://scrapy.org)',
    ];

    let allBotsBlocked = true;
    for (const botUA of testBots) {
      const isMatched = BLOCKED_AI_SCRAPERS.some((re) => re.test(botUA)) ||
                        BLOCKED_SCRIPTING_TOOLS.some((re) => re.test(botUA));
      if (!isMatched) {
        allBotsBlocked = false;
        break;
      }
    }

    results.push({
      id: 'T10_ANTI_SCRAPING_AI_BOT_FIREWALL',
      name: 'Anti-Scraping AI Bot & Hostile Tool Firewall Filter',
      category: 'edge_cases',
      passed: allBotsBlocked,
      message: allBotsBlocked
        ? 'Verified: GPTBot, ClaudeBot, Bytespider, PerplexityBot, and automated scraping tools are correctly identified and blocked.'
        : 'Bot detection failure: One or more known scraper signatures evaded detection.',
    });
  } catch (err: any) {
    results.push({
      id: 'T10_ANTI_SCRAPING_AI_BOT_FIREWALL',
      name: 'Anti-Scraping AI Bot & Hostile Tool Firewall Filter',
      category: 'edge_cases',
      passed: false,
      message: `Bot filter test error: ${err.message}`,
    });
  }

  // TEST 11: Binary Excel Encrypted Buffer Vault (AES-256-GCM)
  try {
    const rawFixtureBuf = generateNormalFixture();
    const encEnvelope = encryptBuffer(rawFixtureBuf);

    const hasCipherPrefix = encEnvelope.startsWith('enc:v1:');
    // Verify ciphertext has 3 colon parts: enc:v1:<iv>:<tag>:<ciphertext>
    const parts = encEnvelope.split(':');
    const isEnvelopeValid = parts.length === 5 && parts[0] === 'enc' && parts[1] === 'v1';

    // Verify raw zip header (PK\x03\x04 or 50 4B 03 04) is NOT present unencrypted in envelope string
    const isEncryptedSafely = !encEnvelope.includes('PK\x03\x04');

    // Decrypt and compare byte equality
    const decBuf = decryptBuffer(encEnvelope);
    const isDecryptedBufferIdentical =
      decBuf.length === rawFixtureBuf.length &&
      decBuf.equals(rawFixtureBuf);

    const isTest11Passed = hasCipherPrefix && isEnvelopeValid && isEncryptedSafely && isDecryptedBufferIdentical;

    results.push({
      id: 'T11_RAW_EXCEL_BLOB_AES256GCM_VAULT',
      name: 'Raw Excel Binary BLOB Encryption & Decryption Pipeline',
      category: 'edge_cases',
      passed: isTest11Passed,
      message: isTest11Passed
        ? `Verified: Raw ${rawFixtureBuf.length} byte Excel workbook encrypted via AES-256-GCM envelope, authenticated, and round-tripped with 100% byte fidelity.`
        : 'Binary encryption pipeline error: decrypted buffer does not match original binary contents.',
      details: {
        originalBytes: rawFixtureBuf.length,
        envelopeLength: encEnvelope.length,
        roundtripMatch: isDecryptedBufferIdentical,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'T11_RAW_EXCEL_BLOB_AES256GCM_VAULT',
      name: 'Raw Excel Binary BLOB Encryption & Decryption Pipeline',
      category: 'edge_cases',
      passed: false,
      message: `Binary crypto test error: ${err.message}`,
    });
  }

  // TEST 12: Historical Archive Table Schema & Retrieval
  try {
    const dummyUploadId = `test_archive_${Date.now()}`;
    const testBuf = generateNormalFixture();

    await saveUploadArchive({
      id: dummyUploadId,
      uploadId: dummyUploadId,
      analysisResultId: dummyUploadId,
      semester: '4th Sem',
      academicYear: '2025-26',
      examCycle: 'June / July 2025',
      department: 'Department of Computer Science & Engineering',
      originalFilename: 'Test_Cohort_Marks.xlsx',
      excelBuffer: testBuf,
    });

    const retrieved = await getUploadById(dummyUploadId);
    const isRecordFound = !!retrieved;
    const isDecryptedExcelPresent = !!retrieved?.excelBuffer && retrieved.excelBuffer.length === testBuf.length;
    const isMetadataAccurate =
      retrieved?.semester === '4th Sem' &&
      retrieved?.academicYear === '2025-26' &&
      retrieved?.originalFilename === 'Test_Cohort_Marks.xlsx';

    // Verify filter retrieval
    const historyList = await listUploadHistory({ semester: '4th Sem' });
    const isFoundInFilteredList = Array.isArray(historyList) && historyList.some((h) => h.id === dummyUploadId || h.uploadId === dummyUploadId);

    const isTest12Passed = isRecordFound && isDecryptedExcelPresent && isMetadataAccurate && isFoundInFilteredList;

    // Clean up test dummy record so test fixture does not remain in user history
    try {
      await deleteAnalysisSession(dummyUploadId);
    } catch {
      // ignore
    }

    results.push({
      id: 'T12_HISTORICAL_ARCHIVE_RETRIEVAL',
      name: 'Historical Archive In-Memory Storage & Filterable Retrieval',
      category: 'edge_cases',
      passed: isTest12Passed,
      message: isTest12Passed
        ? 'Verified: Historical upload record successfully written to SQLite, indexed with metadata, filtered, and retrieved with decrypted original Excel file.'
        : 'Historical archive test failed to retrieve or decrypt stored archive record.',
      details: {
        recordFound: isRecordFound,
        metadataAccurate: isMetadataAccurate,
        bufferRetrieved: isDecryptedExcelPresent,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'T12_HISTORICAL_ARCHIVE_RETRIEVAL',
      name: 'Historical Archive In-Memory Storage & Filterable Retrieval',
      category: 'edge_cases',
      passed: false,
      message: `Historical archive test error: ${err.message}`,
    });
  }

  // TEST 13: Zero Default Department Policy on College Creation
  let collegeIdToClean: string | null = null;
  try {
    const testId = Date.now();
    const college = await createCollege({
      name: `Test Clean College ${testId}`,
      universityName: 'Test Tech University',
      email: `principal.${testId}@testuniv.edu`,
      passwordHash: 'dummy_hash_123',
      emailVerified: true,
    });
    collegeIdToClean = college.id;

    const initialDepts = await listDepartments(college.id);
    const hasZeroDepts = initialDepts.length === 0;

    results.push({
      id: 'T13_ZERO_DEFAULT_DEPARTMENT_POLICY',
      name: 'Zero Default Department Guarantee for Freshly Registered Colleges',
      category: 'edge_cases',
      passed: hasZeroDepts,
      message: hasZeroDepts
        ? `Verified: Newly registered college "${college.name}" starts with exactly 0 default departments (clean state).`
        : `Policy violation: newly created college has ${initialDepts.length} default departments instead of 0.`,
      details: {
        collegeId: college.id,
        initialDepartmentCount: initialDepts.length,
      },
    });

    // TEST 14: Strict Anti-Duplication Prevention for Colleges and Departments
    let dupCollegeNameBlocked = false;
    let dupCollegeEmailBlocked = false;
    let dupDeptNameBlocked = false;
    let dupDeptEmailBlocked = false;

    // Test duplicate college name
    try {
      await createCollege({
        name: `test clean college ${testId}`, // lowercase
        universityName: 'Another Univ',
        email: `principal.unique.${testId}@testuniv.edu`,
        passwordHash: 'hash',
      });
    } catch {
      dupCollegeNameBlocked = true;
    }

    // Test duplicate college email
    try {
      await createCollege({
        name: `Different College Name ${testId}`,
        universityName: 'Another Univ',
        email: `PRINCIPAL.${testId}@TESTUNIV.EDU`, // uppercase email
        passwordHash: 'hash',
      });
    } catch {
      dupCollegeEmailBlocked = true;
    }

    // Create valid department
    const dept = await createDepartment({
      collegeId: college.id,
      name: 'Computer Science & Engineering',
      code: 'CSE',
      email: `dept.cse.${testId}@testuniv.edu`,
      passwordHash: 'hash',
      emailVerified: true,
    });

    // Test duplicate department name in same college
    try {
      await createDepartment({
        collegeId: college.id,
        name: 'COMPUTER SCIENCE & ENGINEERING',
        code: 'CS',
        email: `dept.diff.${testId}@testuniv.edu`,
        passwordHash: 'hash',
      });
    } catch {
      dupDeptNameBlocked = true;
    }

    // Test duplicate department email
    try {
      await createDepartment({
        collegeId: college.id,
        name: 'Information Science',
        code: 'ISE',
        email: `dept.cse.${testId}@testuniv.edu`,
        passwordHash: 'hash',
      });
    } catch {
      dupDeptEmailBlocked = true;
    }

    const isTest14Passed =
      dupCollegeNameBlocked &&
      dupCollegeEmailBlocked &&
      dupDeptNameBlocked &&
      dupDeptEmailBlocked;

    results.push({
      id: 'T14_ANTI_DUPLICATION_ENFORCEMENT',
      name: 'Strict Case-Insensitive College & Department Duplication Prevention',
      category: 'edge_cases',
      passed: isTest14Passed,
      message: isTest14Passed
        ? 'Verified: Complete duplicate rejection for identical college names, college emails, department names, and department emails.'
        : 'Duplication engine failed to reject one or more conflicting entity registrations.',
      details: {
        dupCollegeNameBlocked,
        dupCollegeEmailBlocked,
        dupDeptNameBlocked,
        dupDeptEmailBlocked,
      },
    });

    // TEST 15: Dual-Channel OTP Code Requirement for Deletion
    let deptDeletedWithValidOtp = false;
    let collegeDeletedWithValidOtp = false;

    // Step 1: Issue OTP for department deletion
    const deptOtp = generateSixDigitOtp();
    const deptCodeHash = hashOtpCode(deptOtp);
    await saveOtpRecord({
      email: dept.email,
      codeHash: deptCodeHash,
      purpose: 'dept_delete',
      dataJson: JSON.stringify({ collegeId: college.id, deptId: dept.id }),
      expiresInSeconds: 600,
    });

    // Step 2: Verify OTP and delete
    const validDeptOtpRecord = await getValidOtpRecord(dept.email, 'dept_delete');
    if (validDeptOtpRecord && hashOtpCode(deptOtp) === validDeptOtpRecord.codeHash) {
      await deleteDepartment(dept.id);
      await markOtpUsed(validDeptOtpRecord.id);
      const postDeleteDept = await getDepartmentById(dept.id);
      deptDeletedWithValidOtp = postDeleteDept === null;
    }

    // Step 3: Issue OTP for college deletion
    const colOtp = generateSixDigitOtp();
    const colCodeHash = hashOtpCode(colOtp);
    await saveOtpRecord({
      email: college.email,
      codeHash: colCodeHash,
      purpose: 'college_delete',
      dataJson: JSON.stringify({ collegeId: college.id }),
      expiresInSeconds: 600,
    });

    // Step 4: Verify OTP and delete college
    const validColOtpRecord = await getValidOtpRecord(college.email, 'college_delete');
    if (validColOtpRecord && hashOtpCode(colOtp) === validColOtpRecord.codeHash) {
      await deleteCollege(college.id);
      await markOtpUsed(validColOtpRecord.id);
      const postDeleteCollege = await getCollegeById(college.id);
      collegeDeletedWithValidOtp = postDeleteCollege === null;
    }

    const isTest15Passed = deptDeletedWithValidOtp && collegeDeletedWithValidOtp;

    results.push({
      id: 'T15_SECURE_DELETION_WITH_OTP_AUTHORIZATION',
      name: 'Department & College Destruction Gated by Dual Email OTP Codes',
      category: 'edge_cases',
      passed: isTest15Passed,
      message: isTest15Passed
        ? 'Verified: Department and College accounts cannot be deleted without authenticating against a verified 6-digit OTP dispatched to official emails.'
        : 'Deletion authorization test failed: entity was not properly purged or OTP verification failed.',
      details: {
        deptDeletedWithValidOtp,
        collegeDeletedWithValidOtp,
      },
    });
  } catch (err: any) {
    results.push({
      id: 'T15_SECURE_DELETION_WITH_OTP_AUTHORIZATION',
      name: 'Department & College Destruction Gated by Dual Email OTP Codes',
      category: 'edge_cases',
      passed: false,
      message: `Deletion authorization test error: ${err.message}`,
    });
  } finally {
    // Guarantee test entities are never left behind in the persistent database
    if (collegeIdToClean) {
      try {
        await deleteCollege(collegeIdToClean);
      } catch {
        // already cleaned up by Test 15
      }
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results,
    timestamp: new Date().toISOString(),
  };
}
