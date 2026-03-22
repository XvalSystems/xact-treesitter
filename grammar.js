/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "xact",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  rules: {
    source_file: ($) => repeat($._top_level_statement),

    _top_level_statement: ($) =>
      choice($.config_block, $.input_block, $.table_block, $.vtable_block, $.python_block),

    // ─── Config ────────────────────────────────────────────────────
    config_block: ($) =>
      seq("config", "{", repeat($.config_property), "}"),

    config_property: ($) =>
      seq($.config_key, ":", $._config_value, ";"),

    config_key: (_) =>
      choice(
        "out_dir",
        "out_ft",
        "audit",
        "write_all_vtables",
        "write_all_inputs",
        "input_dir",
        "out_name",
      ),

    _config_value: ($) => choice($.string, $.boolean, $.number),

    // ─── Input ─────────────────────────────────────────────────────
    input_block: ($) =>
      seq("input", $.identifier, "{", repeat($._input_property), "}"),

    _input_property: ($) =>
      choice($.type_property, $.columns_block),

    type_property: ($) => seq("type", ":", $.string, ";"),

    // ─── Table / VTable ────────────────────────────────────────────
    table_block: ($) =>
      seq("table", $.identifier, "{", repeat($._table_property), "}"),

    vtable_block: ($) =>
      seq("vtable", $.identifier, "{", repeat($._table_property), "}"),

    _table_property: ($) =>
      choice($.nrows_property, $.vtable_property, $.columns_block, $.params_block),

    nrows_property: ($) =>
      seq("nrows", ":", choice($.number, $.identifier), ";"),

    vtable_property: ($) =>
      seq("vtable", ":", "{", "source", ":", $.identifier, ";", "}"),

    params_block: ($) =>
      seq("params", ":", "{", repeat($.param_definition), "}"),

    param_definition: ($) =>
      seq(
        $.identifier,
        optional($.type_annotation),
        ";",
      ),

    // ─── Columns ───────────────────────────────────────────────────
    columns_block: ($) =>
      seq("columns", ":", "{", repeat($.column_definition), "}"),

    column_definition: ($) =>
      seq(
        $._column_name,
        optional($.type_annotation),
        optional(seq(":", $._expression)),
        ";",
      ),

    _column_name: ($) => choice($.identifier, $.nid, $.string),

    // ─── Python ──────────────────────────────────────────────────────
    python_block: ($) =>
      seq("python", $.identifier, "{", repeat($._python_property), "}"),

    _python_property: ($) =>
      choice($.python_path_property, $.source_property, $.script_block),

    python_path_property: ($) =>
      seq("python_path", ":", $.string, ";"),

    source_property: ($) =>
      seq("source", ":", $.string, ";"),

    script_block: (_) =>
      token(seq("```", /[^`]*(`{1,2}[^`]+)*/, "```")),

    // ─── Type annotations ──────────────────────────────────────────
    type_annotation: ($) =>
      seq(
        "<",
        $.type_name,
        optional($.informat_string),
        ">",
      ),

    type_name: (_) => choice("int", "float", "string", "date", "bool"),

    informat_string: ($) => $.string,

    // ─── Expressions ───────────────────────────────────────────────
    _expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.parenthesized_expression,
        $.dollar_function,
        $.column_reference,
        $.self_reference,
        $.number,
        $.string,
        $.boolean,
        $.time_variable,
        $.identifier,
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    binary_expression: ($) =>
      choice(
        prec.left(4, seq($._expression, "+", $._expression)),
        prec.left(4, seq($._expression, "-", $._expression)),
        prec.left(5, seq($._expression, "*", $._expression)),
        prec.left(5, seq($._expression, "/", $._expression)),
        prec.right(6, seq($._expression, "^", $._expression)),
        prec.left(3, seq($._expression, "==", $._expression)),
        prec.left(3, seq($._expression, "!=", $._expression)),
        prec.left(3, seq($._expression, "<", $._expression)),
        prec.left(3, seq($._expression, ">", $._expression)),
        prec.left(3, seq($._expression, "<=", $._expression)),
        prec.left(3, seq($._expression, ">=", $._expression)),
      ),

    unary_expression: ($) => prec(7, seq("-", $._expression)),

    // ─── Dollar functions ──────────────────────────────────────────
    dollar_function: ($) =>
      seq(
        "$",
        $.identifier,
        "(",
        optional($._argument_list),
        ")",
      ),

    _argument_list: ($) =>
      seq($._expression, repeat(seq(",", $._expression)), optional(",")),

    // ─── References ────────────────────────────────────────────────
    // table.column[index] or table.subtable.column[index] etc.
    column_reference: ($) =>
      seq(
        $._dotted_name,
        optional($.index_expression),
      ),

    _dotted_name: ($) =>
      prec.left(
        8,
        seq(
          $._name_component,
          repeat1(seq(".", $._name_component)),
        ),
      ),

    _name_component: ($) => choice($.identifier, $.nid, $.string),

    self_reference: ($) =>
      seq(
        "self",
        ".",
        $._name_component,
        optional($.index_expression),
      ),

    index_expression: ($) =>
      seq("[", $._index_args, "]"),

    _index_args: ($) =>
      seq($._index_value, repeat(seq(",", $._index_value))),

    _index_value: ($) =>
      choice(
        $.colon_index,
        $._expression,
      ),

    colon_index: (_) => ":",

    // ─── NID (name identifier: 'some name'n or "some name"n) ─────
    nid: (_) =>
      token(
        seq(
          choice(
            seq("'", /[^']*/, "'"),
            seq('"', /[^"]*/, '"'),
          ),
          "n",
        ),
      ),

    // ─── Literals ──────────────────────────────────────────────────
    time_variable: (_) => token(choice(/t[0-9]+/, "t")),

    number: (_) =>
      token(
        choice(
          /[0-9]+\.[0-9]*/,
          /[0-9]*\.[0-9]+/,
          /[0-9]+/,
        ),
      ),

    string: (_) =>
      token(
        choice(
          seq('"', /([^"\\]|\\.)*/, '"'),
          seq("'", /([^'\\]|\\.)*/, "'"),
        ),
      ),

    boolean: (_) => choice("true", "false"),

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // ─── Comments ──────────────────────────────────────────────────
    line_comment: (_) => token(seq("//", /[^\n]*/)),
    block_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});
