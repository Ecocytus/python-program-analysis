import { ControlFlowGraph } from './control-flow';
import { DataflowAnalyzer, RefSet } from './data-flow';
import { LocationSet, SliceDirection } from './slice';
import { Location } from './python-parser';
import { JsonSpecs } from './specs';
import * as ast from './python-parser';
export declare class NBCell {
    source: string[];
    id: Number;
    constructor(source: string[], id: number);
    getSource(): string[];
}
export declare class Notebook {
    cells: NBCell[];
    source: string[];
    tree: ast.Module;
    cfg: ControlFlowGraph;
    analyzer: DataflowAnalyzer;
    moduleMap: JsonSpecs;
    constructor(path: string);
    getCell(id: number): NBCell;
    getSize(): number;
    getAllCode(): string[];
    getLocsetByCell(cell_no: number): LocationSet;
    getFuncs(cell_no: number): void;
    getDefs(cell_no: number): RefSet;
    getUses(cell_no: number): RefSet;
    slice(cell_no: number, direction?: SliceDirection, sorted?: boolean): LocationSet;
    getCodeByLoc(loc: Location | undefined, col_slicing?: boolean): string[];
}
export declare function parse_func(func: ast.SyntaxNode): string[];
