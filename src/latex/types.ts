export type BlockAlignment = 'left' | 'center' | 'right' | 'justify';

export interface ParsedFigureItem {
  path: string;
  options?: string;
  width?: number;
  widthUnit?: string;
  height?: number;
  heightUnit?: string;
  angle?: number;
  containerWidth?: number;
  containerWidthUnit?: string;
  subfigure?: boolean;
  caption?: string;
}

export interface ParsedBlock {
  id: string;
  kind:
    | 'paragraph'
    | 'itemize'
    | 'block'
    | 'equation'
    | 'figure'
    | 'table'
    | 'vspace'
    | 'columns'
    | 'quote'
    | 'container'
    | 'break'
    | 'theorem'
    | 'comment'
    | 'commentblock'
    | 'tikz'
    | 'abstract'
    | 'raw';
  start: number;
  end: number;
  raw: string;
  title?: string;
  env?: string;
  text?: string;
  items?: string[];
  align?: BlockAlignment;
  hidden?: boolean;
  figurePath?: string;
  figureOptions?: string;
  figureWidth?: number;
  figureWidthUnit?: string;
  figureHeight?: number;
  figureHeightUnit?: string;
  figureCaption?: string;
  figureShortCaption?: string;
  figureAngle?: number;
  figureLabel?: string;
  figurePlacement?: string;
  figureCaptionPosition?: 'above' | 'below';
  figureAlign?: 'left' | 'center' | 'right';
  figureItems?: ParsedFigureItem[];
  figureLayout?: 'side-by-side' | 'stacked';
  tableColumns?: string[];
  tableRows?: string[][];
  tableCaption?: string;
  tableLabel?: string;
  tablePlacement?: string;
  tableCaptionPosition?: 'above' | 'below';
  tableSimple?: boolean;
  tableStyle?: 'plain' | 'booktabs' | 'grid' | 'custom';
  tableVerticalBorders?: boolean[];
  tableHorizontalBorders?: boolean[];
  tableSize?: '' | 'normalsize' | 'small' | 'footnotesize' | 'scriptsize' | 'tiny';
  spaceAmount?: string;
  spaceStarred?: boolean;
  columnCount?: number;
  columnTexts?: string[];
  breakCommand?: string;
  theoremEnv?: string;
  commentText?: string;
  commentNote?: boolean;
  commentTag?: 'TODO' | 'FIXME';
}
