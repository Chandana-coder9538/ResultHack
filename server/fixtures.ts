import * as XLSX from 'xlsx';

export interface FixtureSpec {
  name: string;
  description: string;
  buffer: any;
  suggestedFaculty: Record<string, string>;
  subjects: string[];
}

function writeWorkbook(wb: XLSX.WorkBook): any {
  if (typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function') {
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function generateNormalFixture(): any {
  const subjects = ['21CS51', '21CS52', '21CS53', '21CS54', '21CS55', '21CSL56'];
  const students = [
    { id: '1MS21CS001', name: 'Aarav Sharma' },
    { id: '1MS21CS002', name: 'Aditi Rao' },
    { id: '1MS21CS003', name: 'Ananya Deshmukh' },
    { id: '1MS21CS004', name: 'Arjun Patel' },
    { id: '1MS21CS005', name: 'Bhavya Hegde' },
    { id: '1MS21CS006', name: 'Chetan Kumar' },
    { id: '1MS21CS007', name: 'Deepak Verma' },
    { id: '1MS21CS008', name: 'Divya Nair' },
    { id: '1MS21CS009', name: 'Gautam Menon' },
    { id: '1MS21CS010', name: 'Harini Sundaram' },
    { id: '1MS21CS011', name: 'Ishaan Kulkarni' },
    { id: '1MS21CS012', name: 'Kavya Iyer' },
    { id: '1MS21CS013', name: 'Manish Reddy' },
    { id: '1MS21CS014', name: 'Neha Joshi' },
    { id: '1MS21CS015', name: 'Pooja Bhat' },
    { id: '1MS21CS016', name: 'Pranav Saxena' },
    { id: '1MS21CS017', name: 'Rahul Shenoy' },
    { id: '1MS21CS018', name: 'Rhea Sen' },
    { id: '1MS21CS019', name: 'Rohit Shenoy' },
    { id: '1MS21CS020', name: 'Siddharth Rao' },
    { id: '1MS21CS021', name: 'Sneha Shetty' },
    { id: '1MS21CS022', name: 'Tarun Varma' },
    { id: '1MS21CS023', name: 'Varun Joshi' },
    { id: '1MS21CS024', name: 'Vidya Murthy' },
    { id: '1MS21CS025', name: 'Yashwanth Gowda' },
  ];

  const rows: any[] = [];
  rows.push(['student_id', 'student_name', 'subject_code', 'internal_marks', 'external_marks', 'total_marks', 'result']);

  // Deterministic marks generation
  students.forEach((student, sIdx) => {
    subjects.forEach((subject, subIdx) => {
      // Base talent
      const base = 40 + ((sIdx * 7 + subIdx * 13) % 48);
      // Split 50/50
      const internal = Math.min(50, Math.max(12, Math.round(base * 0.45 + (sIdx % 6))));
      const external = Math.min(50, Math.max(10, Math.round(base * 0.55 - (subIdx % 5))));
      const total = internal + external;
      const result = total >= 40 ? 'Pass' : 'Fail';

      rows.push([
        student.id,
        student.name,
        subject,
        internal,
        external,
        total,
        result,
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Semester Marks');
  return writeWorkbook(wb);
}

export function generateEdgeCaseTiesFixture(): any {
  const subjects = ['21CS51', '21CS52', '21CS53'];
  const rows: any[] = [];
  rows.push(['student_id', 'student_name', 'subject_code', 'internal_marks', 'external_marks', 'total_marks', 'result']);

  // Intentional ties at rank 5 for 21CS51:
  // Rank 1: 98
  // Rank 2: 92
  // Rank 3: 88
  // Rank 4: 85
  // Rank 5 (Tied 3 students): 80 (Aarav, Divya, Chetan)
  // Rank 8: 72
  // Also include boundary 40, edge 39.5/Fail, total mismatch, and blank cell coercion
  const specificData = [
    // 21CS51 Top ranks & ties
    ['1MS21CS001', 'Aarav Sharma', '21CS51', 40, 40, 80, 'Pass'], // Tied 5th
    ['1MS21CS002', 'Aditi Rao', '21CS51', 48, 50, 98, 'Pass'],    // Rank 1
    ['1MS21CS003', 'Ananya Deshmukh', '21CS51', 46, 46, 92, 'Pass'], // Rank 2
    ['1MS21CS004', 'Arjun Patel', '21CS51', 44, 44, 88, 'Pass'],  // Rank 3
    ['1MS21CS005', 'Bhavya Hegde', '21CS51', 42, 43, 85, 'Pass'], // Rank 4
    ['1MS21CS006', 'Chetan Kumar', '21CS51', 38, 42, 80, 'Pass'], // Tied 5th
    ['1MS21CS007', 'Divya Nair', '21CS51', 39, 41, 80, 'Pass'],   // Tied 5th
    ['1MS21CS008', 'Deepak Verma', '21CS51', 35, 37, 72, 'Pass'], // Rank 8
    ['1MS21CS009', 'Gautam Menon', '21CS51', 20, 20, 40, 'Pass'], // Exact boundary 40
    ['1MS21CS010', 'Harini Sundaram', '21CS51', 15, 20, 35, 'Fail'], // Failed total < 40
    ['1MS21CS011', 'Ishaan Kulkarni', '21CS51', 30, 45, 78, 'Pass'], // Total mismatch intentional: 30+45 = 75 != 78
    ['1MS21CS012', 'Kavya Iyer', '21CS51', '', 25, 25, 'Fail'],   // Blank internal cell coercion
    
    // 21CS52
    ['1MS21CS001', 'Aarav Sharma', '21CS52', 45, 45, 90, 'Pass'],
    ['1MS21CS002', 'Aditi Rao', '21CS52', 49, 49, 98, 'Pass'],
    ['1MS21CS003', 'Ananya Deshmukh', '21CS52', 40, 45, 85, 'Pass'],
    ['1MS21CS004', 'Arjun Patel', '21CS52', 35, 35, 70, 'Pass'],
    ['1MS21CS005', 'Bhavya Hegde', '21CS52', 38, 38, 76, 'Pass'],
    ['1MS21CS006', 'Chetan Kumar', '21CS52', 25, 25, 50, 'Pass'],
    ['1MS21CS007', 'Divya Nair', '21CS52', 15, 18, 33, 'Fail'],
    ['1MS21CS008', 'Deepak Verma', '21CS52', 10, 15, 25, 'Fail'],
    ['1MS21CS009', 'Gautam Menon', '21CS52', 30, 32, 62, 'Pass'],
    ['1MS21CS010', 'Harini Sundaram', '21CS52', 12, 14, 26, 'Fail'],
    ['1MS21CS011', 'Ishaan Kulkarni', '21CS52', 33, 34, 67, 'Pass'],
    ['1MS21CS012', 'Kavya Iyer', '21CS52', 22, 24, 46, 'Pass'],

    // 21CS53
    ['1MS21CS001', 'Aarav Sharma', '21CS53', 42, 44, 86, 'Pass'],
    ['1MS21CS002', 'Aditi Rao', '21CS53', 48, 48, 96, 'Pass'],
    ['1MS21CS003', 'Ananya Deshmukh', '21CS53', 43, 44, 87, 'Pass'],
    ['1MS21CS004', 'Arjun Patel', '21CS53', 38, 40, 78, 'Pass'],
    ['1MS21CS005', 'Bhavya Hegde', '21CS53', 36, 38, 74, 'Pass'],
    ['1MS21CS006', 'Chetan Kumar', '21CS53', 20, 18, 38, 'Fail'],
    ['1MS21CS007', 'Divya Nair', '21CS53', 22, 22, 44, 'Pass'],
    ['1MS21CS008', 'Deepak Verma', '21CS53', 12, 10, 22, 'Fail'],
    ['1MS21CS009', 'Gautam Menon', '21CS53', 28, 30, 58, 'Pass'],
    ['1MS21CS010', 'Harini Sundaram', '21CS53', 10, 12, 22, 'Fail'],
    ['1MS21CS011', 'Ishaan Kulkarni', '21CS53', 40, 42, 82, 'Pass'],
    ['1MS21CS012', 'Kavya Iyer', '21CS53', 31, 33, 64, 'Pass'],
  ];

  specificData.forEach((row) => rows.push(row));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Edge Cases');
  return writeWorkbook(wb);
}

export function generateGoogleFormsWideFixture(): any {
  const headers = [
    'Timestamp',
    'NAME',
    'USN',
    '21CS51 - INTERNAL MARKS',
    '21CS51 - EXTERNAL MARKS',
    '21CS51 - TOTAL MARKS',
    '21CS51 - RESULT',
    '21CS52 - INTERNAL MARKS',
    '21CS52 - EXTERNAL MARKS',
    '21CS52 - TOTAL MARKS',
    '21CS52 - RESULT',
    'ELECTIVE (BPEK459/BYOK459/BNSK459) - INTERNAL MARKS',
    'ELECTIVE (BPEK459/BYOK459/BNSK459) - EXTERNAL MARKS',
    'ELECTIVE (BPEK459/BYOK459/BNSK459) - TOTAL MARKS',
    'ELECTIVE (BPEK459/BYOK459/BNSK459) - RESULT',
    'MINI PROJECT & SEMINAR (21CSMP58) - INTERNAL MARKS',
    'MINI PROJECT & SEMINAR (21CSMP58) - EXTERNAL MARKS',
    'MINI PROJECT & SEMINAR (21CSMP58) - TOTAL MARKS',
    'MINI PROJECT & SEMINAR (21CSMP58) - RESULT',
    'ENVIRONMENTAL STUDIES (21CIV59) - INTERNAL MARKS',
    'ENVIRONMENTAL STUDIES (21CIV59) - EXTERNAL MARKS',
    'Column 38',
    'Untitled Question',
    'Feedback',
  ];

  const students = [
    { usn: '4UB24CS001', name: 'Aarav Sharma', ts: '2024-05-10 10:14:02' },
    { usn: '4UB24CS002', name: 'Aditi Rao', ts: '2024-05-10 10:15:30' },
    { usn: '4UB24CS003', name: 'Ananya Deshmukh', ts: '2024-05-10 10:18:11' },
    { usn: '4UB24CS004', name: 'Arjun Patel', ts: '2024-05-10 10:20:45' },
    { usn: '4UB24CS005', name: 'Bhavya Hegde', ts: '2024-05-10 10:22:19' },
    { usn: '4UB23CS012', name: 'Chetan Kumar (Repeater)', ts: '2024-05-10 10:25:00' },
    { usn: '4UB24CS007', name: 'Deepak Verma', ts: '2024-05-10 10:28:44' },
    { usn: '4UB24CS008', name: 'Divya Nair', ts: '2024-05-10 10:31:02' },
    { usn: '4UB24CS029', name: 'Gautam Menon (Lateral)', ts: '2024-05-10 10:35:18' },
    { usn: '4UB24CS010', name: 'Harini Sundaram', ts: '2024-05-10 10:40:55' },
  ];

  const rows: any[] = [headers];

  students.forEach((st, idx) => {
    // 21CS51
    const int1 = 35 + (idx % 12);
    const ext1 = 30 + ((idx * 3) % 18);
    const tot1 = int1 + ext1;
    const res1 = tot1 >= 40 ? 'Pass' : 'Fail';

    // 21CS52
    const int2 = 32 + (idx % 14);
    const ext2 = 28 + ((idx * 4) % 19);
    const tot2 = int2 + ext2;
    const res2 = tot2 >= 40 ? 'Pass' : 'Fail';

    // Elective (BPEK459/BYOK459/BNSK459)
    const intElec = 38 + (idx % 10);
    const extElec = 35 + ((idx * 2) % 14);
    const totElec = intElec + extElec;
    const resElec = totElec >= 40 ? 'Pass' : 'Fail';

    // Seminar (Internal Only: 0 external)
    const intProj = 42 + (idx % 8);
    const extProj = 0;
    const totProj = intProj;
    const resProj = 'Pass';

    // Incomplete block (Civ59 - internal & external only, no total/result columns!)
    const intCiv = 36 + (idx % 10);
    const extCiv = 34 + ((idx * 3) % 12);

    rows.push([
      st.ts,
      st.name,
      st.usn,
      int1, ext1, tot1, res1,
      int2, ext2, tot2, res2,
      intElec, extElec, totElec, resElec,
      intProj, extProj, totProj, resProj,
      intCiv, extCiv,
      '', '', '', // Blank junk columns
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Form Responses 1');
  return writeWorkbook(wb);
}

export function generateStrictSplitFixture(): any {
  // Max Internal = 40, Max External = 60, Total = 100 (no sheet result column provided)
  const rows: any[] = [];
  rows.push(['student_id', 'student_name', 'subject_code', 'internal_marks', 'external_marks', 'total_marks']);

  const data = [
    // Passes overall (55/100) but fails separate internal cutoff (12/40 is 30% < 40%)
    ['1MS21CS101', 'Rahul Dravid', '21CS51', 12, 43, 55],
    // Passes overall (52/100) but fails separate external cutoff (18/60 is 30% < 40%)
    ['1MS21CS102', 'Sourav Ganguly', '21CS51', 34, 18, 52],
    // Clear Pass in both (30/40 = 75%, 45/60 = 75%, total 75/100) -> FCD
    ['1MS21CS103', 'Sachin Tendulkar', '21CS51', 35, 52, 87],
    // FC grade (28/40, 38/60 = 66%)
    ['1MS21CS104', 'VVS Laxman', '21CS51', 28, 38, 66],
    // SC grade (22/40, 32/60 = 54%)
    ['1MS21CS105', 'Anil Kumble', '21CS51', 22, 32, 54],
    // Low pass (18/40, 26/60 = 44%)
    ['1MS21CS106', 'Javagal Srinath', '21CS51', 18, 26, 44],
    // Clear Fail in both (10/40, 15/60 = 25%)
    ['1MS21CS107', 'Zaheer Khan', '21CS51', 10, 15, 25],
  ];

  data.forEach((r) => rows.push(r));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Theory 40-60 Split');
  return writeWorkbook(wb);
}

export function generateInvalidFixture(): any {
  const rows = [
    ['random_header_1', 'random_header_2', 'random_header_3'],
    ['abc', '123', 'xyz'],
    ['def', '456', 'uvw'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Corrupted Sheet');
  return writeWorkbook(wb);
}
