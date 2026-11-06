export const LAYOUT_OPTIONS = [
  { id: 'type', title: 'By type', example: 'Documents/report.pdf', blurb: 'One folder per kind of file.' },
  { id: 'type-month', title: 'By type, then month', example: 'Documents/2026-11/report.pdf', blurb: 'Type folders split by the month a file was last changed.' },
  { id: 'type-year', title: 'By type, then year', example: 'Documents/2026/report.pdf', blurb: 'Type folders split by year.' },
  { id: 'year', title: 'By year', example: '2026/report.pdf', blurb: 'Only years, whatever the file type.' },
  { id: 'month', title: 'By month', example: '2026-11/report.pdf', blurb: 'Only months, whatever the file type.' },
];
export const layoutTitle = (id) => LAYOUT_OPTIONS.find((o) => o.id === id)?.title || id;
