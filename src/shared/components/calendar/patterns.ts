export type Pattern =
  'solid' | 'striped' | 'dotted' | 'crosshatch' | 'outline' | 'dashed' | 'faded';

/** The class that draws a pattern in the element's text colour (see theme.css). */
export function patternClass(pattern: Pattern): string {
  return `pattern-${pattern}`;
}
