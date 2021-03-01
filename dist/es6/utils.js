// import {MagicsRewriter, RefSet, walk, parse, ControlFlowGraph, DataflowAnalyzer, DataflowAnalyzerOptions, slice, SliceDirection, LocationSet, SyntaxNode, Location}
import { MagicsRewriter } from "./rewrite-magics";
import { ControlFlowGraph } from './control-flow';
import { DataflowAnalyzer, RefSet, ApiUsageAnalysis } from './data-flow';
import { LocationSet, slice } from './slice';
import { DefaultSpecs } from './specs';
import fs from 'fs';
import * as ast from './python-parser';
// import { ApiCallAnalysisListener } from "./analysis-listener"
var NBCell = /** @class */ (function () {
    function NBCell(source, id) {
        this.source = source;
        this.id = id;
    }
    NBCell.prototype.getSource = function () { return this.source; };
    return NBCell;
}());
export { NBCell };
var Notebook = /** @class */ (function () {
    function Notebook(path) {
        var ipynb_json = JSON.parse(fs.readFileSync(path, 'utf8'));
        var magic_rewriter = new MagicsRewriter();
        var cell_no = [];
        this.cells = [];
        var count = 0;
        for (var _i = 0, _a = ipynb_json.cells; _i < _a.length; _i++) {
            var c = _a[_i];
            if (c.cell_type == 'code') {
                var codeList = [];
                var code = [];
                // case that ipynb cell is one long string
                if (typeof c.source == "string") {
                    codeList = c.source.split('\n');
                    for (var _b = 0, codeList_1 = codeList; _b < codeList_1.length; _b++) {
                        var s = codeList_1[_b];
                        if (s == "")
                            continue;
                        code.push(magic_rewriter.rewrite(s) + "\n");
                    }
                }
                else {
                    codeList = c.source;
                    for (var _c = 0, codeList_2 = codeList; _c < codeList_2.length; _c++) {
                        var s = codeList_2[_c];
                        code.push(magic_rewriter.rewrite(s));
                    }
                    code[code.length - 1] += "\n";
                }
                this.cells.push(new NBCell(code, count));
                count += 1;
            }
        }
        this.source = [];
        for (var _d = 0, _e = this.cells; _d < _e.length; _d++) {
            var c = _e[_d];
            this.source = this.source.concat(c.getSource());
        }
        this.tree = ast.parse(this.source.join(''));
        this.cfg = new ControlFlowGraph(this.tree);
        // TODO: more module options
        this.moduleMap = DefaultSpecs;
        this.analyzer = new DataflowAnalyzer(this.moduleMap);
    }
    Notebook.prototype.getCell = function (id) { return this.cells[id]; };
    Notebook.prototype.getSize = function () { return this.cells.length; };
    Notebook.prototype.getAllCode = function () { return this.source; };
    // *********** idx starts at 1 ***********
    Notebook.prototype.getLocsetByCell = function (cell_no) {
        // assert(cell_no < this.cells.length);
        var loc_set = new LocationSet();
        if (this.cells[cell_no].getSource().length == 0) {
            return loc_set;
        }
        // line start with 1
        var first_line = 1;
        for (var i = 0; i < cell_no; ++i) {
            first_line += this.cells[i].getSource().length;
        }
        var last_line = first_line + this.cells[cell_no].getSource().length - 1;
        loc_set.add({
            first_line: first_line,
            first_column: 0,
            last_line: last_line,
            last_column: 999
        });
        return loc_set;
    };
    Notebook.prototype.getFuncs = function (cell_no) {
        var code = this.cells[cell_no].getSource().join('');
        var tree = ast.parse(code);
        var cfg = new ControlFlowGraph(tree);
        var defsForMethodResolution = this.analyzer.analyze(cfg).statementDefs;
        var walker = new ApiUsageAnalysis(tree, this.analyzer.getSymbolTable(), defsForMethodResolution);
        ast.walk(tree, walker);
    };
    Notebook.prototype.getDefs = function (cell_no) {
        var _this = this;
        var code = this.cells[cell_no].getSource().join('');
        var mod = ast.parse(code);
        return mod.code.reduce(function (refSet, stmt) {
            var refs = _this.analyzer.getDefs(stmt, refSet);
            return refSet.union(refs);
        }, new RefSet());
        // return this.analyzer.getDefs(mod.code[0], new RefSet()).items;
    };
    Notebook.prototype.getUses = function (cell_no) {
        var _this = this;
        var code = this.cells[cell_no].getSource().join('');
        var mod = ast.parse(code);
        return mod.code.reduce(function (refSet, stmt) {
            var refs = _this.analyzer.getUses(stmt);
            return refSet.union(refs);
        }, new RefSet());
    };
    // number starts at 0
    Notebook.prototype.slice = function (cell_no, direction, sorted) {
        if (sorted == null) {
            sorted = true;
        }
        var seed = this.getLocsetByCell(cell_no);
        var loc_set = slice(this.tree, seed, undefined, direction);
        if (sorted) {
            var sorted_items = loc_set.items.sort(function (a, b) { return (a.first_line < b.first_line ? -1 : 1); });
            var sorted_locset = new LocationSet();
            sorted_locset.add.apply(sorted_locset, sorted_items);
            return sorted_locset;
        }
        else {
            return loc_set;
        }
    };
    Notebook.prototype.getCodeByLoc = function (loc, col_slicing) {
        console.log(loc);
        if (loc == undefined) {
            return [""];
        }
        if (col_slicing == null) {
            col_slicing = false;
        }
        var codes = this.source.slice(loc.first_line - 1, loc.last_line);
        if (col_slicing) {
            if (codes.length > 1) {
                codes[0] = codes[0].slice(loc.first_column, undefined);
                codes[codes.length - 1] = codes[codes.length - 1].slice(undefined, loc.last_column);
            }
            else if (codes.length == 1) {
                codes[0] = codes[0].slice(loc.first_column, loc.last_column);
            }
        }
        else {
            if (loc.last_column == 0) {
                // TODO: handle indent and multi-line case
                // special case of empty line:
                codes.pop();
            }
        }
        return codes;
    };
    return Notebook;
}());
export { Notebook };
export function parse_func(func) {
    var lib_name = "";
    var func_name = "";
    if (func.type == "dot") {
        if (func.value.type == "name") {
            lib_name = func.value.id;
        }
        func_name = func.name;
    }
    if (func.type == "name") {
        func_name = func.id;
    }
    return [lib_name, func_name];
}
//# sourceMappingURL=utils.js.map