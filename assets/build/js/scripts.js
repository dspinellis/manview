
/**
 * Jroff 0.0.1 <http://roperzh.github.io/jroff.js>
 * Copyright (c)2015 Roberto Dip <http://roperzh.com>
 * @license Distributed under MIT license
 * @module Jroff
 */

(function (root, factory) {
    if(typeof define === 'function' && define.amd) {
      define([], factory);
    } else if(typeof module === 'object' && module.exports) {
      module.exports = factory();
    } else {
      root.Jroff = factory();
    }
  }(this, function () { //eslint-disable-line max-statements
    "use strict";

var COMMENT = 1,
  MACRO = 2,
  IMACRO = 3,
  BREAK = 4,
  TEXT = 5,
  EMPTY = 6,
  ESCAPE = 7;

var callableMacros = [
  'Ac', 'Ao', 'Bc', 'Bo', 'Brc', 'Bro', 'Dc', 'Do', 'Ec', 'Eo', 'Fc',
  'Oc', 'Oo', 'Pc', 'Po', 'Qc', 'Qo', 'Sc', 'So', 'Xc', 'Xo', 'Aq',
  'Bq', 'Brq', 'Dq', 'Op', 'Pq', 'Ql', 'Qq', 'Sq', 'Vt', 'Ta', 'Ad',
  'An', 'Ap', 'Ar', 'At', 'Bsx', 'Bx', 'Cd', 'Cm', 'Dv', 'Dx', 'Em',
  'Er', 'Ev', 'Fa', 'Fl', 'Fn', 'Ft', 'Fx', 'Ic', 'Li', 'Lk', 'Ms',
  'Mt', 'Nm', 'Ns', 'Nx', 'Ox', 'Pa', 'Pf', 'Sx', 'Sy', 'Tn', 'Ux',
  'Va', 'Vt', 'Xr'
];

/**
 * Wrap all common regexp patterns
 *
 * @namespace
 * @alias patterns
 * @since 0.0.1
 *
 */
var patterns = {
  macro: /^\./,
  macroStart: /^.\s*/,
  lexeme: /(\n|\s+|^\.\s+\S+)/g,
  comment: /(\.)?\\\"|\\#/,
  arguments: /"(.*?)"|\S+/g,
  number: /[\d]/,
  realNumber: /(^[\-|\+]?\d)/,
  escape: /(\\[^\"])/g,
  wrappingQuotes: /^\s*?\"([^\"]*)\"\s*?$/g,
  noWhiteSpace: /\S/,
  newLine: /[ \t]*\n/
};

/**
 * Create a new object with all the properties present in an array of n
 * objects.
 *
 * @argument {array} objects to be combined
 *
 * @returns {object}
 *
 * @since 0.0.1
 *
 */
var mergeObjects = function (objects) {
  return objects.reduce(function (memo, object) {
    for(var key in object) {
      if(object.hasOwnProperty(key)) {
        memo[key] = object[key];
      }
    }

    return memo;
  }, {});
};

/**
 * Returns a boolean describing if the token can have nodes
 *
 * @argument {token} token
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
var canHaveNodes = function (token) {
  return [MACRO, IMACRO, ESCAPE].indexOf(token.kind) !== -1
};

var macros = {},
  macroLib = null;

/**
 * Represents a single token, encapsulates common behavior useful
 * to parse and manipulate tokens
 *
 * @constructor
 * @alias Token
 *
 * @property {string} value
 *
 * @property {number} kind of the token, used to know if the token
 * represents a macro, break, inline macro, etc.
 *
 * @property {array} nodes is a collection of sub tokens, useful while
 * parsing ( for example a macro with inline macros ).
 *
 * @since 0.0.1
 *
 */
var Token = function (value, kind) {
  this.value = value || '';
  this.kind = kind || EMPTY;
  this.nodes = [];
};

/**
 * Class method used to know wheter a string represents a comment
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isComment = function (str) {
  return patterns.comment.test(str);
};

/**
 * Class method used to know wheter a string represents an empty line
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isEmptyLine = function (str) {
  return patterns.newLine.test(str);
};

/**
 * Class method used to know wheter a string represents an inline
 * macro
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isInlineMacro = function (str) {
  return callableMacros.indexOf(str) !== -1 && macroLib === 'doc';
};

/**
 * Class method used to know wheter a string represents a macro
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isMacro = function (str) {
  return patterns.macro.test(str);
};

/**
 * Class method used to know wheter a string represents a escape sequence
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isEscape = function (str) {
  return str.charAt(0) === '\\';
};

/**
 * Add a given token into the nodes array
 *
 * @param {Token} token
 *
 * @returns {Token} the token instance itself, useful for method
 * chaining
 *
 * @since 0.0.1
 *
 */
Token.prototype.addNode = function (token) {
  this.nodes.push(token);

  return this;
};

/**
 * Return the last node in the nodes array, if the array is empty,
 * safely return a new token of kind EMPTY
 *
 * @returns {Token}
 *
 * @since 0.0.1
 *
 */
Token.prototype.lastNode = function () {
  return this.nodes[this.nodes.length - 1] || new Token();
};

/**
 * Mix the given token with the current token instance.
 *
 * Mixing two tokens means to concatenate their values
 *
 * @param {Token} token
 *
 * @returns {Token} the token instance itself, useful for method
 * chaining
 *
 * @todo clarify the documentation and add examples
 *
 * @since 0.0.1
 *
 */
Token.prototype.mix = function (token) {
  this.value = this.value + token.value;

  if(this.kind === EMPTY) {
    this.kind = token.kind;
  }

  return this;
};

/**
 * Supplies an interface to create new Token instances based on a
 * string representation of the token, and returns a Token instance
 * with the correct `kind` attribute.
 * This constructor is meant to be instantiated.
 *
 * @constructor
 * @alias TokenFactory
 * @since 0.0.1
 *
 */
var TokenFactory = function () {};

/**
 * Creates a new Token with the correct kind based on a raw
 * representation of the token
 *
 * @param {string} [rawToken]
 *
 * @returns {Token} a new instance of the Token class
 *
 * @example
 * var factory = new TokenFactory();
 * var token = factory.create('.SH TITLE');
 * token.kind === MACRO; //=> true
 * token.value; //=> 'TITLE'
 *
 * @since 0.0.1
 *
 */
TokenFactory.prototype.create = function (rawToken) {
  var kind = TEXT;

  if(typeof rawToken === 'undefined') {
    kind = EMPTY;
  } else if(Token.isComment(rawToken)) {
    kind = COMMENT;
  } else if(Token.isMacro(rawToken)) {
    kind = MACRO;
  } else if(Token.isInlineMacro(rawToken)) {
    kind = IMACRO;
  } else if(Token.isEmptyLine(rawToken)) {
    kind = BREAK;
  } else if(Token.isEscape(rawToken)) {
    kind = ESCAPE;
  }

  return new Token(rawToken, kind);
};

/**
 * Takes charge of the process of converting a sequence of characters
 * (string) into a sequence of tokens. Also keeps track of useful
 * information like current column and line number during the process
 *
 * @constructor
 *
 * @property {array} source the source string, splitted by withespaces
 *
 * @property {array} tokens buffer to store the parsed tokens
 *
 * @property {integer} sourceIdx current token index
 *
 * @property {col} current column being parsed
 *
 * @property {line} current line being parsed
 *
 * @property {TokenFactory} factory used to create tokens
 *
 */
var Lexer = function (source) {
  this.source = this.cleanSource(source)
    .split(patterns.lexeme);
  this.tokens = [];
  this.sourceIdx = 0;
  this.col = 0;
  this.line = 1;
  this.factory = new TokenFactory();
};

/**
 * Performs the following tasks to the source string:
 * - Replaces < and > symbols with their HTML escape equivalents
 * - Adds whitespaces between escape sequences
 *
 * @argument {string} source
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
Lexer.prototype.cleanSource = function (source) {
  return source
    .replace(patterns.escape, ' $1 ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Does the tokenization of the source given in the constructor,
 * and returns an array of tokens.
 *
 * @returns {array} array of tokens
 *
 * @example
 * var lexer = new Lexer(string);
 * lexer.lex() //=> [...]
 */
Lexer.prototype.lex = function () {
  var lexeme;

  /* This check is here because empty strings can break the loop */
  while(typeof (lexeme = this.next()) !== 'undefined') {
    this.tokens.push(this.factory.create(lexeme));
  }

  return this.tokens;
};

/**
 * Manages the current token being parsed,
 * and the state of this.col and this.line.
 *
 * @returns {string} the next lexeme in the source, if there is no
 * more lexemes returns `undefined`
 *
 */
Lexer.prototype.next = function () {
  var lexeme = this.source[this.sourceIdx++];

  if(lexeme === '\n') {
    this.col = 0;
    this.line += 1;
  } else if(lexeme) {
    this.col += lexeme.length;
  }

  return lexeme;
};

/**
 * Works out the grammatical structure of the token array provided
 * by the Lexer and generates an AST ready to be transformed, this
 * AST could be consumed by the HTML generator but it's not limited
 * to that.
 *
 * @constructor
 * @alias Parser
 *
 * @property {string} input raw contents of the man page
 *
 * @since 0.0.1
 *
 */
var Parser = function (input) {
  this.ast = [];
  this.scope = this.ast;
  this.lexer = new Lexer(input);
  this.tokens = this.lexer.lex();
  this.lastTok = new Token('', BREAK);
  this.escapeWithArguments = ['\\f', '\\s', '\\m', '\\('];

  this.mappings = {};
  this.mappings[MACRO] = 'handleMacro';
  this.mappings[IMACRO] = 'setNewScope';
  this.mappings[TEXT] = 'handleText';
  this.mappings[ESCAPE] = 'handleEscape';
  this.mappings[BREAK] = 'handleBreak';
  this.mappings[COMMENT] = 'ignore';
  this.mappings[EMPTY] = 'ignore';
};

/**
 * Return the next token in the lexer queue
 *
 * @returns {Token}
 *
 * @since 0.0.1
 *
 */
Parser.prototype.next = function () {
  return this.tokens.shift();
};

/**
 * Add the last token into the scope, and set it as the last parsed
 * token
 *
 * @returns {Token}
 *
 * @since 0.0.1
 *
 */
Parser.prototype.addToScope = function (token) {
  this.scope.push(token);
  this.lastTok = token;
};

/**
 * Go through all tokens in the lexer queue and return an AST
 * describing the relationship between them.
 *
 * @returns {array}
 *
 * @since 0.0.1
 *
 */
Parser.prototype.buildAST = function () {
  var token;

  while((token = this.next())) {
    this[this.mappings[token.kind]](token);
  }

  return this.ast;
};

/**
 * Handle macro tokens, if the last parsed token is a line break,
 * the token is a macro and it should call 'setNewScope', otherwise
 * it's a false positive (example: a period in a sentence) and it
 * should call 'handleText'
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleMacro = function (token) {
  if(this.lastTok.kind === BREAK) {
    /* Remove the starting dot and any whitespace */
    token.value = token.value.replace(patterns.macroStart, '');
    this.setNewScope(token);
  } else {
    this.handleText(token);
  }
};

/**
 * Used by macros and inline macros; this function changes the current
 * scope to the 'nodes' property of the current token
 *
 * @since 0.0.1
 *
 */
Parser.prototype.setNewScope = function (token) {
  this.addToScope(token);
  this.scope = token.nodes;
};

/**
 * Handles line breaks:
 *
 * - If the last parsed token is another line break, we should add a
 * 'br' token in order to emulate the groff behavior
 * - Otherwise the line break resets the scope to the default scope
 * (this.ast)
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleBreak = function (token) {
  this.scope = this.ast;

  if(this.lastTok.kind === BREAK) {
    this.scope.push(new Token('br', MACRO));
  } else {
    this.scope.push(new Token('\n', TEXT));
  }

  this.lastTok = token;
};

/**
 * Handles escape sequences, since any scape sequence will be in the
 * form: ESCAPE + SPACING + ARGUMENT ( check Lexer.js ) we are just
 * pushing the next two following tokens into the 'nodes' array of
 * the current token
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleEscape = function (token) {
  if(this.escapeWithArguments.indexOf(token.value) !== -1) {
    var escapeParam;

    this.next();
    escapeParam = this.next();
    escapeParam.kind = TEXT;
    token.nodes.push(escapeParam);
  }

  this.addToScope(token);
};

/**
 * Handles text:
 *
 * - if the value of the token is an empty string, just return.
 * - if the last parsed token is another text token, mix both
 * - if the last parsed token isn't another text token, this is the
 * first text token in the chain, so just add it to the current scope
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleText = function (token) {
  if(!token.value) {
    return;
  }

  token.kind = TEXT;

  if(this.lastTok.kind === TEXT) {
    this.lastTok.mix(token);
  } else {
    if(canHaveNodes(this.lastTok)) {
      token.value = token.value.trim();
    }

    this.addToScope(token);
  }
};

/**
 * Create a ghost scope, so all the content pushed in it will be
 * ignored, useful for comments
 *
 * @since 0.0.1
 *
 */
Parser.prototype.ignore = function (token) {
  this.scope = [];
  this.lastTok = token;
};

/**
 * Group all `an` macros
 * @namespace
 * @alias macros.an
 * @since 0.0.1
 */
macros.an = {

  /**
   * This should be the first command in a man page, not only
   * creates the title of the page but also stores in the buffer
   * useful variables: `title`, `section`, `date`, `source`
   * and `manual`
   *
   * @param {string} args raw representation of the arguments
   * described below, in this version the TH function is in charge
   * to parse and store this arguments in the buffer
   *
   * @param {object} buffer
   *
   * @returns {string}
   *
   * @example
   * var args = 'FOO 1 "MARCH 1995" Linux "User Manuals"';
   * var buffer = {};
   *
   * TH(args, buffer);
   * buffer.title   //=> FOO
   * buffer.section //=> 1
   * buffer.date    //=> "MARCH 1995"
   *
   * @since 0.0.1
   *
   */
  TH: function (args) {
    var title;

    args = this.parseArguments(args);

    this.buffer.title = args[0] || '';
    this.buffer.section = args[1] || '';
    this.buffer.date = args[2] || '';
    this.buffer.source = args[3] || '';
    this.buffer.manual = args[4] || '';

    title = this.buffer.title + '(' + this.buffer.section + ')';

    return(
      '<p><span>' + title + '</span>' +
      '<span>' + this.buffer.manual + '</span>' +
      '<span>' + title + '</span></p>'
    );
  },

  /**
   * Represent a section in the manual, creates a title tag
   * with the contents of the `arg` variable
   *
   * @param {string} args section title, from 1 to n words.
   *
   * @returns {string} a semantic representation of a section title.
   *
   * @since 0.0.1
   *
   */
  SH: function (args) {
    var openingTag = '<section style="margin-left:' +
      this.buffer.style.indent + '%;">',
      preamble = '';

    this.buffer.section = args;

    preamble += this.closeAllTags(this.buffer.fontModes);
    preamble += this.closeAllTags(this.buffer.openTags);
    preamble += this.closeAllTags(this.buffer.sectionTags);

    this.buffer.sectionTags.push('section');

    return preamble + this.generateTag('h2', args) + openingTag;
  },

  /**
   * Represent a subsection inside a section, creates a subtitle tag
   * with the contents of the `arg` variable
   *
   * @param {string} args subtitle, from 1 to n words.
   *
   * @returns {string} a semantic representation of a section title.
   *
   * @since 0.0.1
   *
   */
  SS: function (args) {
    return this.generateTag('h3', args);
  },

  /**
   * Generate bold text
   *
   * @param {string} args the text to be presented as bold
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  B: function (args) {
    return this.generateTag('strong', args);
  },

  /**
   * Generate bold text alternated with italic text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  BI: function (args) {
    return this.generateAlternTag('strong', 'i', args);
  },

  /**
   * Generate bold text alternated with regular text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  BR: function (args) {
    return this.generateAlternTag('strong', 'span', args);
  },

  /**
   * Generate italic text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  I: function (args) {
    return this.generateTag('i', args);
  },

  /**
   * Generate italic text alternated with bold
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  IB: function (args) {
    return this.generateAlternTag('i', 'strong', args);
  },

  /**
   * Generate italic text alternated with regular text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  IR: function (args) {
    return this.generateAlternTag('i', 'span', args);
  },

  /**
   * Generate regular text alternated with bold text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  RB: function (args) {
    return this.generateAlternTag('span', 'strong', args);
  },

  /**
   * Generate regular text alternated with italic text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  RI: function (args) {
    return this.generateAlternTag('span', 'i', args);
  },

  /**
   * Generate small text alternated with bold text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  SB: function (args) {
    return this.generateAlternTag('small', 'strong', args);
  },

  /**
   * Generate small text
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  SM: function (args) {
    return this.generateTag('small', args);
  },

  /**
   * Generate a paragraph
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  P: function () {
    var result = '';

    result += this.closeAllTags(this.buffer.fontModes);
    result += this.closeTagsUntil('div', this.buffer.openTags);

    this.buffer.openTags.push('div');

    return result + '<div style="margin-bottom: 2%;">';
  },

  /**
   * Start an indented paragraph with the optional specified tag and
   * hanging indent.
   *
   * @param {string} args
   *
   * @since 0.0.1
   *
   */
  IP: function (args) {
    var result = '';

    args = this.parseArguments(args);
    var tag = args[0] || '';
    var indent = args[1] || this.buffer.style.indent;

    result += this.closeAllTags(this.buffer.fontModes);
    result += this.closeTagsUntil('div', this.buffer.openTags);

    result += '<div>';
    result += '<dl style="margin-bottom: 0;margin-top: 0;">';
    result += '<dt style="float: left; clear: left;">' + tag + '</dt>';
    result += '<dd style=" margin-left: ' + indent + '%;">';

    this.buffer.openTags.push('div');
    this.buffer.openTags.push('dl');
    this.buffer.openTags.push('dd');

    return result;
  },


  /**
   * Start relative margin indent: moves the left margin `indent` to
   * the right (if is omitted, the prevailing indent value is used).
   *
   * @param {string} indent
   *
   * @since 0.0.1
   *
   */
  RS: function (indent) {
    var result = '';

    indent = indent || this.buffer.style.indent;

    result += this.closeAllTags(this.buffer.fontModes);
    result += '<section style="margin-left:' + indent + '%">';

    this.buffer.openTags.push('section');

    return result;
  },

  /**
   * End relative margin indent and restores the previous value
   * of the prevailing indent.
   *
   * @since 0.0.1
   *
   */
  RE: function () {
    return this.closeTagsUntil('section', this.buffer.openTags);
  }
};

macros.an.LP = macros.an.P;
macros.an.PP = macros.an.P;

var fontMappings = {
  B: 'strong',
  C: 'code',
  I: 'i',
  R: 'span',
  S: 'small'
};

/**
 * Group all defautl groff macros
 * @namespace
 * @alias macros.defaults
 * @since 0.0.1
 */
macros.defaults = {
  /**
   * Adds a line break
   *
   * @returns {string}
   *
   * @since 0.0.1
   */
  br: function () {
    return '<br>';
  },

  /**
   * Sets the space-character size to N/36 em.
   *
   * @argument {integer} number
   *
   * @since 0.0.1
   *
   */
  ss: function (number) {
    this.buffer.openTags.push('span');

    return '<span style="word-spacing:' + (number / 36) + 'em;">';
  },

  /**
   * Change to font defined by fontType, possible values are R,I,B,S.
   * Behaves in the same way as \fx, \f(xx, \fN
   *
   * @argument {string} fontType
   *
   * @since 0.0.1
   *
   */
  ft: function (fontType) {
    var result = '',
      type;

    /* the font type can be a string with multiple arguments */
    fontType = this.parseArguments(fontType)[0];
    type = fontMappings[fontType.trim()];

    result += this.closeAllTags(this.buffer.fontModes);

    if(type !== fontMappings.R) {
      result += '<' + type + '> ';
      this.buffer.fontModes.push(type);
    }

    return result;
  },

  /**
   * Set the vertical spacing of the following paragraphs
   *
   * @argument {string} spacing
   *
   * @since 0.0.1
   *
   */
  vs: function (spacing) {
    spacing = spacing || 12;

    this.buffer.openTags.push('section');

    return '<section style="line-height:' + (spacing / 12) + 'em;">';
  },

  /**
   * No filling or adjusting of output lines.
   *
   * @since 0.0.1
   *
   */
  nf: function () {
    this.buffer.nf = 1;
    return '<div style="white-space: pre; display: block;">';
  },

  /**
   * Set the indent of the following paragraphs
   *
   * @argument {string} indent
   *
   * @since 0.0.1
   *
   */
  in : function (indent) {
    indent = indent || 3;

    this.buffer.openTags.push('section');

    return '<section style="margin-left:' + (indent / 3) + 'em;">';
  },

  /**
   * Italize the next `n` input lines
   *
   * In this implementation, the macro starts the italic mode, without
   * taking in consideration the number of lines provided.
   *
   * @since 0.0.1
   *
   */
  ul: function () {
    return macros.defaults.ft.call(this, 'I');
  },

  /**
   * Italize the next `n` input lines
   *
   * In this implementation, the macro starts the italic mode, without
   * taking in consideration the number of lines provided.
   *
   * @since 0.0.1
   *
   */
  cu: function () {
    return macros.defaults.ft.call(this, 'I');
  },

  /**
   * Space vertically in either direction.
   *
   * If `spacing` is negative, the motion is backward (upward) and is
   * limited to the distance to the top of the page
   *
   * If the no-space mode is on, no spacing occurs (see ns and rs)
   *
   * @argument {string} spacing
   *
   * @since 0.0.1
   *
   */
  sp: function (spacing) {
    spacing = spacing || '2';

    return '<hr style="margin-top:' + spacing + 'em;visibility:hidden;">';
  },

  /**
   * Used to manage conditionals, not supported in the current version
   *
   * @since 0.0.1
   *
   */
  'if': function () {
    return '';
  },

  /**
   * Used to manage conditionals, not supported in the current version
   *
   * @since 0.0.1
   *
   */
  ie: function () {
    return '';
  },

  /**
   * Used to manage conditionals, not supported in the current version
   *
   * @since 0.0.1
   *
   */
  el: function () {
    return '';
  },

  /**
   * Used to manage conditionals, not supported in the current version
   *
   * @since 0.0.1
   *
   */
  '\\}': function () {
    return '';
  },

  /**
   * Used to define new macros, not supported in the current version
   *
   * @since 0.0.1
   *
   */
  de: function () {
    return '';
  },

  /**
   * Need `number` vertical space, not supported in the current version
   *
   * @since 0.0.1
   *
   */
  ne: function () {
    return '';
  },

  /**
   * Custom pattern present in some man pages, does not produce any
   * output
   *
   * @since 0.0.1
   *
   */
  '.': function () {
    return '';
  },

  /**
   * Fill output lines
   * Works only in conjuction with a previous .nf
   *
   * @since 0.0.1
   *
   */
  fi: function () {
    if (this.buffer.nf) {
      this.buffer.nf = 0;
      return '</div>';
    } else
      return '';
  },

  /**
   * Disable hyphenation
   *
   * @since 0.0.1
   *
   */
  nh: function () {
    /* TODO: apply this property somewhere */
    this.buffer.style.hyphens = 'none';
  },

  /**
   * Adjust output lines with mode c; where c = l, r, c, b,none
   *
   * @since 0.0.1
   */
  ad: function (align) {
    /* TODO: apply this property somewhere */
    this.buffer.style.textAlign = align;
  },

  /**
   * Prevents or delays the interpretation of \, in this implementation
   * behaves exactly like `\e`
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  '\\\\': function () {
    return macros.defaults['\\e'].call(this);
  },

  /**
   * Print the escape character
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  '\\e': function () {
    return '\\ ';
  },

  /**
   * Print the minus sign (-) in the current font
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  '\\-': function () {
    return '&minus;';
  },

  /**
   * \fx Change to font named x, works as a shorthand of .ft
   *
   * @argument {string} args the word next to the escape sequence, due to the
   * current parser structure we must split the font type argument of the
   * escape secuence here.
   *
   * @returns {string}
   *
   * @since 0.0.1
   */
  '\\f': function (args) {
    var fontType;

    args = args.trim();
    fontType = args.charAt(0);

    return macros.defaults.ft.call(this, fontType) + ' ' + args.slice(1) + ' ';
  },

  /**
   * According to the roff spec, this sequence is used as a
   * "non-printing, zero width character", but for the purposes of this
   * implementation we can just ignore this behavior.
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  '\\&': function () {
    return '';
  },

  /**
   * Increase or decrease the font size by `n` units, negative values are
   * accepted.
   *
   * @argument {string} args the word next to the escape sequence, due to the
   * current parser structure we need to do extra work here to parse the
   * arguments
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  '\\s': function (args) {
    var txt;

    args = args.split(patterns.realNumber);
    txt = args[2] || '';

    this.buffer.style.fontSize += parseInt(args[1], 10);
    this.buffer.openTags.push('span');

    return(
      '<span style="font-size:' + this.buffer.style.fontSize + 'px;">' + txt
    );
  },

  /**
   * For the purposes of this implementation we can just ignore this sequence.
   *
   * @returns {string}
   *
   * @since 0.0.1
   +
   */
  '\\m': function () {
    return '';
  },

  /**
   * For the purposes of this implementation we can just ignore this sequence.
   *
   * @returns {string}
   *
   * @since 0.0.1
   +
   */
  '\\(': function () {
    return '';
  },

  /**
   * For the purposes of this implementation we can just ignore this sequence.
   *
   * @returns {string}
   *
   * @since 0.0.1
   +
   */
  '\\d': function () {
    return '';
  },

  /**
   * For the purposes of this implementation we can just ignore this sequence.
   *
   * @returns {string}
   *
   * @since 0.0.1
   +
   */
  '\\u': function () {
    return '';
  },

  '\\+': function () {
    return '&plus;';
  }
};

var docSections = {
  1: 'General Commands Manual',
  2: 'System Calls Manual',
  3: 'Library Functions Manual',
  4: 'Kernel Interfaces Manual',
  5: 'File Formats Manual',
  6: 'Games Manual',
  7: 'Miscellaneous Information Manual',
  8: 'System Manager\'s Manual',
  9: 'Kernel Developer\'s Manual'
};

var volumes = {
  'USD': 'User\'s Supplementary Documents',
  'PS1': 'Programmer\'s Supplementary Documents',
  'AMD': 'Ancestral Manual Documents',
  'SMM': 'System Manager\'s Manual',
  'URM': 'User\'s Reference Manual',
  'PRM': 'Programmer\'s Manual',
  'KM': 'Kernel Manual',
  'IND': 'Manual Master Index',
  'LOCAL': 'Local Manual',
  'CON': 'Contributed Software Manual'
};

var architectures = [
  'alpha', 'acorn26', 'acorn32', 'algor', 'amd64', 'amiga', 'arc', 'arm26',
  'arm32', 'atari', 'bebox', 'cats', 'cesfic', 'cobalt', 'dreamcast',
  'evbarm', 'evbmips', 'evbppc', 'evbsh3', 'hp300', 'hp700', 'hpcmips',
  'i386', 'luna68k', 'm68k', 'mac68k', 'macppc', 'mips', 'mmeye', 'mvme68k',
  'mvmeppc', 'netwinder', 'news68k', 'newsmips', 'next68k', 'ofppc',
  'pc532', 'pmax', 'pmppc', 'powerpc', 'prep', 'sandpoint', 'sgimips', 'sh3',
  'shark', 'sparc', 'sparc64', 'sun3', 'tahoe', 'vax', 'x68k', 'x86_64'
];

var fontModes = {
  '-emphasis': 'i',
  '-literal': 'span',
  '-symbolic': 'strong'
};

var abbreviations = {
  '-ansiC': 'ANSI X3.159-1989 (``ANSI C89\'\')',
  '-ansiC-89': 'ANSI X3.159-1989 (``ANSI C89\'\')',
  '-isoC': 'ISO/IEC 9899:1990 (``ISO C90\'\')',
  '-isoC-90': 'ISO/IEC 9899:1990 (``ISO C90\'\')',
  '-isoC-99': 'ISO/IEC 9899:1999 (``ISO C99\'\')',
  '-iso9945-1-90': 'ISO/IEC 9945-1:1990 (``POSIX.1\'\')',
  '-iso9945-1-96': 'ISO/IEC 9945-1:1996 (``POSIX.1\'\')',
  '-p1003.1': 'IEEE Std 1003.1 (``POSIX.1\'\')',
  '-p1003.1-88': 'IEEE Std 1003.1-1988 (``POSIX.1\'\')',
  '-p1003.1-90': 'ISO/IEC 9945-1:1990 (``POSIX.1\'\')',
  '-p1003.1-96': 'ISO/IEC 9945-1:1996 (``POSIX.1\'\')',
  '-p1003.1b-93': 'IEEE Std 1003.1b-1993 (``POSIX.1\'\')',
  '-p1003.1c-95': 'IEEE Std 1003.1c-1995 (``POSIX.1\'\')',
  '-p1003.1g-2000': 'IEEE Std 1003.1g-2000 (``POSIX.1\'\')',
  '-p1003.1i-95': 'IEEE Std 1003.1i-1995 (``POSIX.1\'\')',
  '-p1003.1-2001': 'IEEE Std 1003.1-2001 (``POSIX.1\'\')',
  '-p1003.1-2004': 'IEEE Std 1003.1-2004 (``POSIX.1\'\')',
  '-iso9945-2-93': 'ISO/IEC 9945-2:1993 (``POSIX.2\'\')',
  '-p1003.2': 'IEEE Std 1003.2 (``POSIX.2\'\')',
  '-p1003.2-92': 'IEEE Std 1003.2-1992 (``POSIX.2\'\')',
  '-p1003.2a-92': 'IEEE Std 1003.2a-1992 (``POSIX.2\'\')',
  '-susv2': 'Version 2 of the Single UNIX Specification (``SUSv2\'\')',
  '-susv3': 'Version 3 of the Single UNIX Specification (``SUSv3\'\')',
  '-svid4': 'System V Interface Definition, Fourth Edition (``SVID4\'\')',
  '-xbd5': 'X/Open System Interface Definitions Issue 5 (``XBD5\'\')',
  '-xcu5': 'X/Open Commands and Utilities Issue 5 (``XCU5\'\')',
  '-xcurses4.2': 'X/Open Curses Issue 4, Version 2 (``XCURSES4.2\'\')',
  '-xns5': 'X/Open Networking Services Issue 5 (``XNS5\'\')',
  '-xns5.2': 'X/Open Networking Services Issue 5.2 (``XNS5.2\'\')',
  '-xpg3': 'X/Open Portability Guide Issue 3 (``XPG3\'\')',
  '-xpg4': 'X/Open Portability Guide Issue 4 (``XPG4\'\')',
  '-xpg4.2': 'X/Open Portability Guide Issue 4, Version 2 (``XPG4.2\'\')',
  '-xsh5': 'X/Open System Interfaces and Headers Issue 5 (``XSH5\'\')',
  '-ieee754': 'IEEE Std 754-1985',
  '-iso8802-3': 'ISO/IEC 8802-3:1989'
};

/**
 * Group all `doc` macros
 * @namespace
 * @alias macros.doc
 * @since 0.0.1
 */
macros.doc = {

  /**
   * This should be the first command in a man page, not only
   * creates the title of the page but also stores in the buffer
   * useful variables: `title`, `section`, `date`, `source`
   * and `manual`
   *
   * @argument {string} args.title is the subject of the page,
   * traditionally in capitals due to troff limitations, but
   * capitals are not required in this implementation.
   * If ommited, 'UNTITLED' is used.
   *
   * @argument {string} args.section number, may be a number in the
   * range 1..9, mappings between numbers and section names are
   * defined in the 'docSections' namespace. The default value is
   * empty.
   *
   * @argument {string} args.volume name may be arbitrary or one of
   * the keys defined in the volumes namespace, defaults to LOCAL.
   *
   * If the section number is neither a numeric expression in the
   * range 1 to 9 nor one of the above described keywords, the third
   * parameter is used verbatim as the volume name.
   *
   * @returns {string} a representation of the header displayed by
   * groff
   *
   * @since 0.0.1
   *
   */
  Dt: function (args) {
    var sideText,
      midText,
      title,
      section,
      volume;

    /* Parse the arguments string */
    args = this.parseArguments(args);
    title = args[0];
    section = args[1];
    volume = args[2];

    /* Store arguments with default values in the buffer */
    this.buffer.title = title || 'UNTITLED';
    this.buffer.section = section || '';
    this.buffer.volume = volume || 'LOCAL';

    sideText = this.buffer.title;
    midText = this.buffer.volume;

    if(section) {
      sideText = this.buffer.title + '(' + this.buffer.section + ')';

      if(volumes[volume]) {
        midText = volumes[volume];
      } else if(architectures.indexOf(volume) !== -1) {
        midText = 'BSD/' + volume + docSections[this.buffer.section];
      } else if(docSections[this.buffer.section]) {
        midText = 'BSD' + docSections[this.buffer.section];
      }
    }

    return(
      '<p><span>' + sideText + '</span>' +
      '<span>' + midText + '</span>' +
      '<span>' + sideText + '</span></p><section>'
    );
  },

  /**
   * Store the document date in the buffer,
   * since this macro is neither callable nor parsed
   * we just store the verbatim value
   *
   * @param {string} date
   *
   * @since 0.0.1
   *
   */
  Dd: function (date) {
    this.buffer.date = date;
  },

  /**
   * Store a value for the operating system in the buffer,
   * this value is used in the bottom left corner of the
   * parsed manpage.
   *
   * This macro is neither callable nor parsed.
   *
   * @param {string} os
   *
   * @since 0.0.1
   *
   */
  Os: function (os) {
    this.buffer.os = os;
  },

  /**
   * The address macro identifies an address construct,
   * it's generally printed as a italic text.
   *
   * @param {string} address
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ad: function (args) {
    return this.generateTag('i', args);
  },

  /**
   * The `.An' macro is used to specify the name of the author
   * of the item being documented, or the name of the author of
   * the actual manual page.
   *
   * Generally prints text in regular format
   *
   * @param {string} author
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  An: function (author) {
    return this.generateTag('span', author);
  },

  /**
   * The .Ar argument macro may be used whenever an argument
   * is referenced. If called without arguments,
   * the `file ...' string is output.
   *
   * Generally prints text in italic format
   *
   * @param {string} argument
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ar: function (args) {
    args = args || 'file...';

    return this.generateTag('i', args);
  },

  /**
   * The `.Cd' macro is used to demonstrate a config
   * declaration for a device interface in a section four manual.
   *
   * In the SYNOPSIS section a `.Cd' command causes a line break
   * before and after its arguments are printed.
   *
   * Generally prints text in bold format
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Cd: function (args) {
    var tag = this.isInsideOfSection('SYNOPSIS') ? 'p>strong' : 'strong';

    return this.generateTag(tag, args);
  },

  /**
   * Defines a variable, in practical terms, it only returns the text
   * in normal format
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Dv: function (args) {
    return this.generateTag('span', args);
  },

  /**
   * Especifies an environment variable,
   * in practical terms, it only returns the text in normal format
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ev: function (args) {
    return this.generateTag('span', args);
  },

  /**
   * The `.Fl' macro handles command line flags, it prepends
   * a dash, `-', to the flag and makes it bold.
   *
   * A call without any arguments results in a dash representing
   * stdin/stdout
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Fl: function (args) {
    return this.generateTag('strong', '-' + args);
  },

  /**
   * The command modifier is identical to the `.Fl' (flag) command
   * with the exception that the `.Cm' macro does not assert a dash
   * in front of every argument.
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Cm: function (args) {
    return this.generateTag('strong', args);
  },

  /**
   * The `.Nm' macro is used for the document title or subject name.
   * It has the peculiarity of remembering the first argument it
   * was called with, which should always be the subject name of
   * the page.  When called without arguments, `.Nm' regurgitates
   * this initial name for the sole purpose of making less work
   * for the author.
   *
   * @param {string} args name
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Nm: function (args) {
    var result;

    this.buffer.name = this.buffer.name || args;
    result = args || this.buffer.name;

    return this.generateTag('strong', result);
  },

  /**
   * `.Nd' first prints `--', then all its arguments.
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Nd: function (args) {
    return this.generateTag('span', '-- ' + args);
  },

  /**
   * Defines a section header and a wrapper for the content that
   * comes next ( section tag ) indented with the default indent.
   *
   * Also stores in the buffer the current section name.
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Sh: function (args) {
    var openingTag = '<section style="margin-left:' +
      this.buffer.style.indent + '%;">';

    this.buffer.section = args;

    return '</section>' + this.generateTag('h2', args) + openingTag;
  },

  /**
   * The `.Op' macro places option brackets around any remaining
   * arguments on the command line
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Op: function (args) {
    return this.generateTag('span', '[' + args + ']');
  },

  /**
   * The `.Xr' macro expects the first argument to be a manual page
   * name. The optional second argument, if a string
   * (defining the manual section), is put into parentheses.
   *
   * @argument {string} args.name name of the manual page
   *
   * @argument {string} args.number
   *
   * @argument {string} text the remaining text in the line
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Xr: function (args) {
    var name,
      number,
      text;

    args = this.parseArguments(args);

    name = args.shift() || '';
    number = args[0] ? '(' + args.shift() + ')' : '';
    text = args.join(' ') || '';

    return this.generateTag('span', name + number + text);
  },

  /**
   * Initiates several types of lists, they may be
   * nested within themselves and within displays.
   *
   * The list type is specified with the first argument provided
   *
   * In addition, several list attributes may be specified
   * such as the width of a tag, the list offset, and compactness.
   *
   * In this implementation, the macro stores in the buffer the
   * list type for later use within the It tag
   *
   * @param {string} args.type the type of the list,
   * for example -enum
   *
   * @returns {string}
   *
   *
   * @since 0.0.1
   *
   */
  Bl: function (args) {
    var indent;

    args = this.parseArguments(args);

    this.buffer.lists.unshift({
      flags: args,
      prevTag: '',
      isOpen: false
    });

    indent = (
      this.buffer.style.indent / 4) * (this.buffer.lists.length - 1);

    return(
      '<ul style="list-style:none;padding:0 0 0 ' + indent + '%;">'
    );
  },

  /**
   * Items within the list are specified with the `.It'
   * item macro.
   *
   * Depending on the list type the macro could receive extra args
   *
   * @argument {string} args exact meaning depends on list type
   *
   * @returns {string}
   *
   * @todo complete this documentation explain how the text and the
   * styles work.
   *
   * @since 0.0.1
   *
   */
  It: function (args) {
    var list = this.buffer.lists[0],
      pre = list.isOpen ? '</span></li>' : '',
      tagStyles = '',
      tag = '',
      contentStyles = 'margin-bottom:2%;';

    list.isOpen = true;

    for(var i = list.flags.length - 1; i >= 0; i--) {
      switch(list.flags[i]) {
      case '-bullet':
        tag = '&compfn;';
        contentStyles += 'margin-left:2%;';
        break;

      case '-dash':
        tag = '&minus;';
        contentStyles += 'margin-left:2%;';
        break;

      case '-enum':
        list.prevTag = list.prevTag || 1;
        tag = (list.prevTag++) + '.';
        contentStyles += 'margin-left:2%;';
        break;

      case '-item':
        tag = '';
        contentStyles += 'margin-left:2%;';
        break;

      case '-tag':
        tag = args;
        tagStyles += 'display:inline-block;';
        contentStyles += 'margin-left:2%;';
        break;

      case '-hang':
        tag = this.generateTag('i', args);
        tagStyles += 'width:8%;display:inline-block;';
        contentStyles += 'margin-left:2%;';
        break;

      case '-ohang':
        tag = this.generateTag('strong', args);
        tagStyles += 'display:block;';
        contentStyles += 'display:inline-block';
        break;

      case '-inset':
        tag = this.generateTag('i', args);
        contentStyles += 'display:inline-block;';
        break;

      case '-compact':
        tagStyles += 'margin-bottom: 0;';
        contentStyles += 'margin-bottom:0;';
      }
    }

    return(
      pre + '<li><span style="' + tagStyles + '">' +
      tag + '</span><span style="' + contentStyles + '">'
    );
  },

  /**
   * Defines the end of a list
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  El: function () {
    this.buffer.lists.shift();

    return '</span></li></ul>';
  },

  /**
   * The `.Pp' paragraph command may be used to specify a line space
   * where necessary.
   *
   * Since raw text is just added to the stream, this function
   * only opens the paragraph, the closing is handled in the
   * generator
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Pp: function () {
    this.buffer.openTags.push('p');

    return '<p>';
  },

  /**
   * Prints an opening bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Oo: function () {
    return '[';
  },

  /**
   * Prints a closing bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Oc: function () {
    return ']';
  },

  /**
   * Encloses in angle brackets the given text
   *
   * @argument {string} args text to be enclosed
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Aq: function (args) {
    return this.generateTag('span', '&lt;' + args + '&gt;');
  },

  /**
   * Prints an opening angle bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Ao: function () {
    return this.generateTag('span', '&lt;');
  },

  /**
   * Prints a closing angle bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Ac: function () {
    return this.generateTag('span', '&gt;');
  },

  /**
   * Encloses in brackets the given text
   *
   * @argument {string} args text to be enclosed
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bq: function (args) {
    return this.generateTag('span', '[' + args + ']');
  },

  /**
   * Prints an opening bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bo: function () {
    return this.generateTag('span', '[');
  },

  /**
   * Prints a closing bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bc: function () {
    return this.generateTag('span', ']');
  },

  /**
   * Encloses in braces the given text
   *
   * @argument {string} args text to be enclosed
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Brq: function (args) {
    return this.generateTag('span', '{' + args + '}');
  },

  /**
   * Prints an opening brace
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bro: function () {
    return this.generateTag('span', '{');
  },

  /**
   * Prints a closing brace
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Brc: function () {
    return this.generateTag('span', '}');
  },

  /**
   * Encloses in double quotes a given text
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Dq: function (args) {
    return this.generateTag('span', '``' + args + '\'\'');
  },

  /**
   * Prints an opening double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Do: function () {
    return this.generateTag('span', '``');
  },

  /**
   * Prints a closing double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Dc: function () {
    return this.generateTag('span', '\'\'');
  },

  /**
   * Encloses a given text in XX
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Eq: function (args) {
    return this.generateTag('span', 'XX' + args + 'XX');
  },

  /**
   * Prints XX
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Eo: function () {
    return this.generateTag('span', 'XX');
  },

  /**
   * Prints XX
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Ec: function () {
    return this.generateTag('span', 'XX');
  },

  /**
   * Encloses the given text in parenthesis
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Pq: function (args) {
    return this.generateTag('span', '(' + args + ')');
  },

  /**
   * Prints an open parenthesis
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Po: function () {
    return this.generateTag('span', '(');
  },

  /**
   * Prints a closing parenthesis
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Pc: function () {
    return this.generateTag('span', ')');
  },

  /**
   * Encloses a text in straight double quotes
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Qq: function (args) {
    return this.generateTag('span', '"' + args + '"');
  },

  /**
   * Prints a straight double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Qo: function () {
    return this.generateTag('span', '"');
  },

  /**
   * Prints a straight double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Qc: function () {
    return this.generateTag('span', '"');
  },

  /**
   * Encloses text in straight single quotes
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Sq: function (args) {
    return this.generateTag('span', '`' + args + '\'');
  },

  /**
   * Prints a straight single qoute
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  So: function () {
    return this.generateTag('span', '`');
  },

  /**
   * Prints a straight single quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Sc: function () {
    return this.generateTag('span', '\'');
  },

  /**
   * Replaces standard abbreviations with their formal names.
   * Mappings between abbreviations and formal names can be found in
   * the 'abbreviations' object
   *
   * If the abbreviation is invalid, nothing is printed.
   *
   * @arguments {string} args abbreviation
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  St: function (args) {
    var cont = '';

    args = args;

    if(abbreviations[args]) {
      cont = this.generateTag('abbr', abbreviations[args]);
    }

    return cont;
  },

  /**
   * Prints 'AT&T UNIX' and prepends the version number if provided
   *
   * @argument {string} version the version number
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  At: function (version) {
    var base = ' AT&amp;T UNIX',
      preamble;

    version = version.match(patterns.number);
    preamble = version ? 'Version ' + version[0] : '';

    return this.generateTag('span', preamble + base);
  },

  /**
   * Prints 'BSD' and prepends the version number if provided, also
   * if the -devel flag is provided, print a default text
   *
   * @argument {string} version the version number
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Bx: function (version) {
    var base,
      out;

    base = 'BSD';
    version = version;

    if(version === '-devel') {
      out = base + '(currently under development)';
    } else {
      out = version + base;
    }

    return this.generateTag('span', out);
  },

  /**
   * Prints NetBSD and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Nx: function (version) {
    return this.generateTag('span', 'NetBSD ' + version);
  },

  /**
   * Prints FreeBSD and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Fx: function (version) {
    return this.generateTag('span', 'FreeBSD ' + version);
  },

  /**
   * Prints DragonFly and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Dx: function (version) {
    return this.generateTag('span', 'DragonFly ' + version);
  },

  /**
   * Prints OpenBSD and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Ox: function (version) {
    return this.generateTag('span', 'OpenBSD ' + version);
  },

  /**
   * Prints BSD/OS and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Osx: function (version) {
    return this.generateTag('span', 'BSD/OS ' + version);
  },

  /**
   * Prints UNIX
   *
   * @since 0.0.1
   *
   */
  Ux: function () {
    return this.generateTag('span', 'UNIX');
  },

  /**
   * Suppresses the whitespace between its first and second argument
   *
   * @argument {string} args
   *
   * @since 0.0.1
   *
   */
  Pf: function (args) {
    args = this.parseArguments(args);

    return args.shift() + args.shift() + args.join(' ');
  },

  /**
   * Formats path or file names.  If called without arguments,
   * the `~' string is output, which represents the current user's
   * home directory.
   *
   * @arguments {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Pa: function (args) {
    args = args || '~';

    return this.generateTag('i', args);
  },

  /**
   * Quotes the argument literally
   * @arguments {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ql: function (args) {
    return this.generateTag('span', '`' + args + '\'');
  },

  /**
   * Reference start. Causes a line break in the SEE ALSO section
   * and begins collection of reference information until
   * the reference end macro is read.
   *
   * In practice, defines the references namespace in the buffer
   *
   * @since 0.0.1
   *
   */
  Rs: function () {
    this.buffer.references = {
      authors: [],
      bookTitle: '',
      date: '',
      publisherName: '',
      journalName: '',
      issueNumber: '',
      optionalInformation: '',
      pageNumber: '',
      corporate: '',
      reportName: '',
      articleTitle: '',
      volume: ''
    };
  },

  /**
   * Reference author name; one name per invocation.
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%A': function (name) {
    this.buffer.references.authors.push(name);
  },

  /**
   * Reference book title
   *
   * @arguments {string} title
   *
   * @since 0.0.1
   *
   */
  '%B': function (title) {
    this.buffer.references.bookTitle += ' ' + title;
  },

  /**
   * Reference date asa raw string
   *
   * @arguments {string} date
   *
   * @since 0.0.1
   *
   */
  '%D': function (date) {
    this.buffer.references.date += ' ' + date;
  },

  /**
   * Reference issue/publisher name
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%I': function (name) {
    this.buffer.references.publisherName += ' ' + name;
  },

  /**
   * Reference journal name
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%J': function (name) {
    this.buffer.references.journalName += ' ' + name;
  },

  /**
   * Reference issue number
   *
   * @arguments {string} issue
   *
   * @since 0.0.1
   *
   */
  '%N': function (issue) {
    this.buffer.references.issueNumber += ' ' + issue;
  },

  /**
   * Reference optional information
   *
   * @arguments {string} args
   *
   * @since 0.0.1
   *
   */
  '%O': function (args) {
    this.buffer.references.optionalInformation += ' ' + args;
  },

  /**
   * Reference page number
   *
   * @arguments {string} page
   *
   * @since 0.0.1
   *
   */
  '%P': function (page) {
    this.buffer.references.pageNumber += ' ' + page;
  },

  /**
   * Reference corporate author
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%Q': function (name) {
    this.buffer.references.corporate += ' ' + name;
  },

  /**
   * Reference report name
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%R': function (name) {
    this.buffer.references.reportName += ' ' + name;
  },

  /**
   * Reference title of article
   *
   * @arguments {string} title
   *
   * @since 0.0.1
   *
   */
  '%T': function (title) {
    this.buffer.references.articleTitle += ' ' + title;
  },

  /**
   * Reference volume
   *
   * @arguments {string} volume
   *
   * @since 0.0.1
   *
   */
  '%V': function (volume) {
    this.buffer.references.volume += ' ' + volume;
  },

  /**
   * Reference end, prints all the references. Uses special
   * treatement with author names, joining them with '&'
   *
   * @return {string}
   *
   * @since 0.0.1
   *
   */
  Re: function () {
    var references = [];

    this.buffer.references.authors =
      this.buffer.references.authors.join(' and ');

    for(var key in this.buffer.references) {
      if(this.buffer.references[key]) {
        references.push(this.buffer.references[key]);
      }
    }

    return this.generateTag('p', references.join(', '));
  },

  /**
   * Prints its arguments in a smaller font.
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Tn: function (args) {
    return this.generateTag('small', args);
  },

  /**
   * Represents symbolic emphasis, prints the provided arguments
   * in boldface
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Sy: function (args) {
    return this.generateTag('strong', args);
  },

  /**
   * References variables, print the provided arguments in italics
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Va: function (args) {
    return this.generateTag('i', args);
  },

  /**
   * May be used for special characters, variable con-
   * stants, etc. - anything which should be displayed
   * as it would be typed.
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @todo check this implementation once we handle escaped chars
   *
   * @since 0.0.1
   *
   */
  Li: function (args) {
    return this.generateTag('span', args);
  },

  /**
   * Start the font mode until .Ef is reached, receives a font mode
   * flag as a parameter; valid font modes are:
   *
   * - `-emphasis` Same as .Em macro
   * - `-literal`  Same as .Li macro
   * - `-symbolic` Same as .Sy macro
   *
   * Font modes and their tags are listed in the `fontModes` object.
   *
   * @argument {string} mode mode to be used
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Bf: function (mode) {
    var tag;

    mode = this.parseArguments(mode)[0];
    tag = fontModes[mode] || 'span';

    this.buffer.activeFontModes.push(tag);

    return '<' + tag + '>';
  },

  /**
   * Stop the font mode started with .Bf
   *
   * @since 0.0.1
   *
   */
  Ef: function () {
    var tag = this.buffer.activeFontModes.pop();

    return '</' + tag + '>';
  },

  /**
   * Represent a subsection inside a section, creates a subtitle tag
   * with the contents of the `arg` variable
   *
   * @param {string} subtitle, from 1 to n words.
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ss: function (subtitle) {
    return this.generateTag('h3', subtitle);
  },

  /**
   * Prints a function signature, with the function name in bold
   * if no arguments are provided, returns an empty string
   *
   * @argument {string} args.name function name
   *
   * @argument {string} args.params function params
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Fn: function (args) {
    var type,
      name,
      params,
      storedType;

    args = this.parseArguments(args);

    if(!args[0]) {
      return '';
    }

    storedType = this.buffer.functionType;
    type = storedType ? this.generateTag('i', storedType) : '';
    name = this.generateTag('strong', args[0]);
    params = args[1] || '';

    this.buffer.functionType = '';

    return this.generateTag('span', type + name + '(' + params + ')');
  },

  /**
   * Stores in the buffer a function type to be used later on for
   * others macros (for example Fn)
   *
   * @since 0.0.1
   *
   */
  Ft: function (type) {
    this.buffer.functionType = type;
  },

  /**
   * Opens a multi parameter function definition
   *
   * In practice initializes the functionArgs array and stores in the
   * buffer the function name provided as argument
   *
   * @argument {string} name of the function
   *
   * @since 0.0.1
   *
   */
  Fo: function (name) {
    this.buffer.functionArgs = [];
    this.buffer.functionName = name;
  },

  /**
   * Stores in the buffer a function argument
   *
   * @since 0.0.1
   *
   */
  Fa: function (arg) {
    if (this.buffer.functionArgs)
      this.buffer.functionArgs.push(arg);
    else
      return this.generateTag('span', arg);
  },

  /**
   * Closes the multi parameter funcion definition and prints the
   * result
   *
   * Behind the covers this function only formats the params and then
   * calls .Ft
   *
   * @return {string}
   *
   * @since 0.0.1
   *
   */
  Fc: function () {
    var args = this.buffer.functionArgs.join(', '),
      callParams = this.buffer.functionName + ' "' + args + '"';

    return macros.doc.Fn.call(this, callParams);
  },

  /**
   * Preprocessor directive, in particular for listing it in the SYNOPSIS.
   *
   * @argument {string} args.name preprocessor directive
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Fd: function (args) {

    args = this.parseArguments(args);

    return this.generateTag('strong', args.join(' ')) + '<br>';
  },

  /**
   * Prints the provided text in italics, if its called inside of the
   * SYNOPSIS section it also adds a line break
   *
   * @argument {string}
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Vt: function (args) {
    var base = this.generateTag('i', args),
      postamble = this.isInsideOfSection('SYNOPSIS') ? '<br>' : '';

    return base + postamble;
  },

  /**
   * Text may be stressed or emphasized with this macro, in practice,
   * the macro prints italic text
   *
   * @argument {string} text to be italized
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Em: function (text) {
    return this.generateTag('i', text);
  }
};

var HTMLGenerator = function () {};

HTMLGenerator.prototype.generate = function (source, lib) {
  var parser,
    ast;

  if(!source) {
    return '';
  }

  parser = new Parser(source);
  ast = parser.buildAST();
  lib = lib || 'doc';

  this.macros = mergeObjects([macros.defaults, macros[lib]]);

  /* Global variable, used to define if a token is imacro */
  macroLib = lib;

  this.buffer = {
    style: {
      indent: 8,
      fontSize: 16
    },
    references: [],
    lists: [],
    openTags: [],
    fontModes: [],
    sectionTags: [],
    activeFontModes: [],
    section: ''
  };

  return this.recurse(ast);
};

/**
 * Fires the recursive generation of the HTML based on the
 * AST hierarchy, uses the native reduce function
 *
 * @param {array} arr of tokens
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.recurse = function (arr) {
  return arr.reduce(this.reduceRecursive.bind(this), '');
};

/**
 * Meant to be used as an auxiliar function for the reduce call
 * in 'this.recurse'
 *
 * @param {string} result
 *
 * @param {token} node
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.reduceRecursive = function (result, node) {
  var func,
    args;

  if(canHaveNodes(node)) {
    if(node.value === 'Sh' || node.value === 'SH') {
      result += this.closeAllTags(this.buffer.fontModes);
      result += this.closeAllTags(this.buffer.openTags);
    }

    func = this.macros[node.value] || this.undefMacro;
    args = node.nodes.length ? this.recurse(node.nodes) : '';
    result += func.call(this, args, node) || '';
  } else {
    result += this.cleanQuotes(node.value);
  }

  return result;
};

/**
 * Fallback function for undefined macros
 *
 * @param {string} args
 *
 * @param {token} node
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.undefMacro = function (args, node) {
  console.warn('Unsupported macro:', node.value);
  return args;
};

/**
 * Remove wrapping double quotes from a string
 *
 * @param {string} str
 *
 * @returns {string} the given argument without wrapping quotes
 *
 * @example
 * cleanQuotes('"Lorem Ipsum"'); //-> 'Lorem Ipsum'
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.cleanQuotes = function (str) {
  return str.replace(patterns.wrappingQuotes, '$1');
};

/**
 * Generate valid HTML tags
 *
 * @param {string} name tag name, this can also be a nested tag
 * definition, so 'p>a' is a valid name and denotes a `p` tag
 * wrapping an `a` tag.
 *
 * @param {string} content the content inside the tag
 *
 * @param {object} properties valid HTML properties
 *
 * @returns {string}
 *
 * @alias generateTag
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.generateTag = function (name, content) {
  var tags = name.split('>'),
    i = -1,
    openingTags = '',
    closingTags = '';

  while(tags[++i]) {
    openingTags += '<' + tags[i] + '>';
  }

  while(tags[--i]) {
    closingTags += '</' + tags[i] + '>';
  }

  return openingTags + content + closingTags;
};

/**
 * Given two tags names, this function generates a chunk of HTML
 * with the content splitted between the two tags.
 *
 * This is specially useful for macros like BI, BR, etc.
 *
 * @param {string} tag1
 *
 * @param {string} tag2
 *
 * @param {string} c
 *
 * @returns {string}
 *
 * @alias generateAlternTag
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.generateAlternTag = function (tag1, tag2, c) {
  var i = -1,
    result = '',
    currentTag = tag2;

  c = this.parseArguments(c);

  while(c[++i]) {
    currentTag = currentTag === tag1 ? tag2 : tag1;
    result += this.generateTag(currentTag, c[i]);
  }

  return result;
};

/**
 * Create HTML markup to close a specific tag
 *
 * @argument {string} tag name of the tag
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.closeTag = function (tag) {
  return '</' + tag + '>';
};

/**
 * Create HTML markup to close a list of tags
 *
 * @argument {array} tags
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.closeAllTags = function (tags) {
  return this.closeTagsUntil(tags[0], tags);
};

/**
 * Create HTML markup to close a list of tags until a given tag is
 * reached
 *
 * @argument {string} limitTag to be reached, if empty it closes all
 *
 * @argument {array} tags
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.closeTagsUntil = function (limitTag, tags) {
  var result = '',
    tag;

  if(tags.indexOf(limitTag) !== -1) {
    while((tag = tags.pop())) {
      result += this.closeTag(tag);

      if(tag === limitTag) {
        break;
      }
    }
  }

  return result;
};

/**
 * Transform a raw string in an array of arguments, in groff
 * arguments are delimited by spaces and double quotes can
 * be used to specify an argument which contains spaces.
 *
 * @argument {string} args
 *
 * @returns {array}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.parseArguments = function (args) {
  args = args.match(patterns.arguments) || [];

  return args.map(function (arg) {
    return this.cleanQuotes(arg)
      .trim();
  }.bind(this));
};

/**
 * Useful for macros that require specific behavior inside of a section
 *
 * @argument {string} section name
 *
 * @returns {boolean} wether the value of this.buffer.section is equal to
 * the argument
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.isInsideOfSection = function (section) {
  return this.buffer.section.toLowerCase() === section.toLowerCase();
};

  return {
    HTMLGenerator: HTMLGenerator,
    Lexer: Lexer,
    Token: Token,
    TokenFactory: TokenFactory,
    macros: macros,
    patterns: patterns,
    Parser: Parser,
    COMMENT: COMMENT,
    MACRO: MACRO,
    IMACRO: IMACRO,
    BREAK: BREAK,
    TEXT: TEXT,
    EMPTY: EMPTY
  };

  }));
;//     EssentialJS v0.5.0
//     Copyright (c)2014 Roberto Dip
//     Distributed under MIT license
//     http://roperzh.github.io/essential.js

window.Essential = {

  rootElement: document,

  Core: {},

  // Start
  // -----
  //
  // since v0.1.0
  //
  // A wrapper of  `#Essential.loadBehaviors`, this method is deprecated
  // direct usage of `loadBehaviors` is encouraged.
  //
  // Param application[`Object`] an object containing behaviors names as a key
  // and behaviors objects as a value.

  start: function(application) {
    this.loadBehaviors({
      application: application
    });
  },

  // Load Behaviors
  // --------------
  //
  // since v0.5.0
  //
  // Wakes up the engine, searching and attaching
  // behaviors with their proper elements
  //
  // Param options[`Object`] allows the follwing values:
  //  - `application`[`Object`] an object containing behaviors names as a key
  //    and behaviors objects as a value
  //  - `context` [`DOMElement`] context to look for behaviors.
  //     If no context is provided the default is `Essential.rootElement`
  //
  // **Example**
  //
  // ```javascript
  // MyApp = {};
  // MyApp.Carousel = Essential.Behaviors.extend();
  // Essential.loadBehaviors({ application: MyApp, context: document });
  // // will attach the carousel behavior to proper elements
  // ```

  loadBehaviors: function(options) {
    options.context = options.context || this.rootElement;

    var initializedBehaviors =
      this.initializeBehaviors(options.application, options.context);

    this.launchBehaviors(initializedBehaviors);
  },

  // Initialize Behaviors
  // --------------------
  //
  // Crawls an element looking for behaviors and call `#new` on every behavior
  // found with `lateStart = true`, so the behaviors are initialized, but
  // there is no event delegation
  //
  // param application [`Object`] object containing behaviors to be initialized
  //
  // param element [`DomeElement`] context to look for declared behaviors

  initializeBehaviors: function(application, element) {
    var behaviorsInDOM = this.Core.crawl(element),
      rawBehaviorsNames = Object.keys(behaviorsInDOM),
      initializedBehaviors = [],
      i = -1;

    while(rawBehaviorsNames[++i]) {
      var rawName = rawBehaviorsNames[i],
        name = this.Core.camelize(rawName),
        behavior = application[name];

      if(typeof behavior !== "undefined") {
        var elementsWithBehavior = behaviorsInDOM[rawName],
          j = -1;

        while(elementsWithBehavior[++j]) {
          var initializedBehavior = behavior.new(elementsWithBehavior[j], true);
          initializedBehaviors.push(initializedBehavior);
        }
      }
    }

    return initializedBehaviors;
  },

  // Launch Behaviors
  // ----------------
  //
  // Given a list of behaviors, this method sort these based on their
  // `priority` value, and then call `#start` on every one
  //
  // param behaviorList[`Array<Object>`] an array containing behaviors already
  // initialized

  launchBehaviors: function(behaviorList) {
    var sortedBehaviors = behaviorList.sort(this.Core.SortMethods.byPriority),
      i = -1;

    while(sortedBehaviors[++i]) {
      sortedBehaviors[i].start();
    }
  }
};
/*!
 * Includes proto-js by Axel Rauschmayer
 * https://github.com/rauschma/proto-js
 */

if (!Object.getOwnPropertyDescriptors) {
  Object.getOwnPropertyDescriptors = function (obj) {
    var descs = {};
    Object.getOwnPropertyNames(obj).forEach(function (propName) {
      descs[propName] = Object.getOwnPropertyDescriptor(obj, propName);
    });
    return descs;
  };
}

var Proto = {
  new: function () {
    var instance = Object.create(this);
    if (instance.constructor) {
      instance.constructor.apply(instance, arguments);
    }
    return instance;
  },

  extend: function (subProps) {
    var subProto = Object.create(this, Object.getOwnPropertyDescriptors(subProps));
    subProto.super = this;
    return subProto;
  },
};

Function.prototype.extend = function (subProps) {
  var constrFunc = this;
  var tmpClass = Proto.extend.call(constrFunc.prototype, Proto);
  return tmpClass.extend(subProps);
};
// Custom Event Polyfill
// ---------------------
//
// since 0.5.0
//
// source: https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
//
// Allows the usage of custom events on IE 9 - 10

function CustomEvent ( event, params ) {
  params = params || { bubbles: false, cancelable: false, detail: undefined };
  var evt = document.createEvent( 'CustomEvent' );
  evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
  return evt;
 };

CustomEvent.prototype = window.Event.prototype;

window.CustomEvent = CustomEvent;
// Behavior
// --------
//
// Represents a behavior of some element or group of elements.
// The objetive is define a set of rules and events which
// can be associated to an element and reutilized later on
//
// When a behavior is defined, a hash of events must be defined too,
// and on initialization a DOM element must be provided
//
// Also you can define an `init` function, which is always called when the
// behavior is initialized
//
// **Example**
// ```javascript
// Carousel = Essential.Behavior.extend({
//   events: {
//     "click .next": "goToNextSlide"
//   },
//
//  init: function() {
//    // Called on behavior initialization
//  },
//
//   goToNextSlide: function(e) {
//     //...
//   }
// });
//
// var carousel = Carousel.new(domElement);
// ```

Essential.Behavior = Proto.extend({
  constructor: function(domElement, lateStart) {
    this.el = domElement;

    // A behavior can be initialized without attaching events with the `lateStart`
    // flag, if it is present the methods `delegateEvents` and `ìnit` are omitted
    // but can be called later with `start`
    //
    // **Example**
    // ```javascript
    // carousel = new Carousel(domElement, true);
    // // delegateEvents and init not called
    //
    // carousel.start();
    // // delegateEvents and init called
    // ```

    if(!lateStart) {
      this.start();
    }
  },

  start: function() {
    this.delegateEvents();
    this.listenChannels();

    if(typeof this.init === "function") {
      this.init();
    }
  },

  // Delegate Events
  // ---------------
  //
  // since v0.1.0
  //
  // Delegates events declared in `this.events`, using `this.el` as a context

  delegateEvents: function() {
    Essential.Core.mapEvents.call(this, this.events, this.el);
  },

  // Listen Channels
  // ---------------
  //
  // since v0.5.0
  //
  // Attach event handlers to channels declared in `this.channels using
  // `document` as a context

  listenChannels: function() {
    Essential.Core.mapEvents.call(this, this.channels, document);
  },

  // Emit
  // ----
  //
  // Facilitates the emission of custom events through the CustomEvent
  // Interface. IE9 and IE10 are supported via polyfill
  //
  // since v0.5.0
  //
  // param dataset[`Object`] valid dataset values are:
  //
  //   - channel: [`String`] name (identifier) of the channel
  //
  //   - context: [`DOMElement`] DOM context in which the event is triggered,
  //      this parameter can be ommited. Default value is `document`
  //
  //   - bubles: [`Boolean`] defines if this event should bubble or not,
  //     defaults to true
  //
  //   - cancelable: [`Boolean`] indecates whether the event is cancelable,
  //     defaults to false
  //
  //   - data: [`Object`] data to be included in the `"detail"` key of the
  //      event can be accesed later via `event.detail`
  //      (check the CustomEvent spec for more info)

  emit: function(dataset) {
    dataset.context = dataset.context || this.el;
    dataset.data = dataset.data || {};
    dataset.bubbles = dataset.bubbles || true;
    dataset.cancelable = dataset.cancelable || false;

    var customEvent = new CustomEvent(dataset.channel, {
      "bubbles": dataset.bubbles,
      "cancelable": dataset.cancelable,
      "detail": dataset.data
    });

    dataset.context.dispatchEvent(customEvent);
  },

  priority: 0
});
// Map Events
// ----------
//
// since v0.5.0
//
// Given a document context, maps a hash of events to all ocurrences
// in the context using the DOM Event Interface
//
// param events[`Object`] key-value map which follows some conventions:
//
//   - key: must be a String, containing the event name. Optionally after the event
//     name a valid CSS selector must be placed, for example `"click #element"`
//
//   - value: must be a name of a funciton pertaining to the current in which
//     `mapEvents` its executed
//
// param context[`DOMElement`] element to search through
//
// **Example**
// ```javascript
// var events = {
//   "click .next": "goToNextSlide"
// };
//
// Essential.Core.mapEvents(events, document);
// ```

Essential.Core.mapEvents = function(events, context) {
  if(typeof events === "undefined") {
    return;
  }

  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  for(var key in events) {
    var method = events[key];

    var match = key.match(delegateEventSplitter);
    var eventName = match[1],
      selector = match[2],
      nodeList = selector ? context.querySelectorAll(selector) : [context];

    if(typeof this[method] === "undefined") {
      continue;
    }

    Essential.Core.bind(eventName, nodeList, this[method].bind(this));
  }
};
// Bind
// ----
//
// Binds an event to a node
//
// Param eventName[`String`] name of the event to be binded
//
// Param callback[`Function`] function to be called when the event is triggered
//
// Param nodeList[`NodeList`, `Array`] node elements to be binded
//
// **Example**
//
// ```javascript
// var nodeList = document.querySelectorAll("*");
//
// Essential.Core.bind("hover", nodeList, function() {
//   alert("hover!");
// });
//
// // If the hover event is triggered for any of the
// // elements in the nodeList the alert will appear
// ```

Essential.Core.bind = function(eventName, nodeList, callback) {
  var i = -1;

  while(nodeList[++i]) {
    var currentElement = nodeList[i];

    if(currentElement.addEventListener) {
      nodeList[i].addEventListener(eventName, callback);
    } else {
      currentElement.attachEvent("on" + eventName, callback);
    }
  }
};
// RegExp Helpers
// --------------

// Looks for some of this characters `:` `-` `_` the objetive is allow
// to define behaviors like `cool:carousel` or `small-carousel`

Essential.Core.SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;

// Finds the first letter of a given string

Essential.Core.FIRST_LETTER_REGEXP = /^[a-z]/g;

// Camelize
// --------
//
// Converts strings to UpperCamelCase
//
// Param name[`String`] the name to be camelized
//
// Returns `String` camel case representation of the name
//
// **Example**
//
// ```javascript
// Essential.Core.camelize("cool-carousel");
//
// // => CoolCarousel
// ```

Essential.Core.camelize = function(name) {
  return name.
  replace(Essential.Core.FIRST_LETTER_REGEXP, function(letter) {
    return letter.toUpperCase();
  }).
  replace(Essential.Core.SPECIAL_CHARS_REGEXP, function(_, separator, letter) {
    return letter.toUpperCase();
  });
};
// Crawl
//------
//
// Scans the DOM looking for behaviors
//
// Return `Array<Object>` an array of objects with the behavior name as
// a key and an array of DOM nodes as a value
//
// **Example**
//
// ```html
// <div behavior="carousel"></div>
// ```
//
// ```javascript
// Essential.Core.crawl();
//
// // => [{ carousel: [<HTMLDivElement>, <HTMLDivElement>] }]
// ```

Essential.Core.crawl = function(rootElement) {
  var all = rootElement.querySelectorAll("[data-behavior], [behavior]"),
    i = -1,
    result = {};

  while(all[++i]) {
    var currentElement = all[i],
      rawBehaviors = currentElement.getAttribute("data-behavior") || currentElement.getAttribute("behavior"),
      behaviorsList = rawBehaviors.split(" "),
      j = -1;

    while(behaviorsList[++j]) {
      var currentBehavior = behaviorsList[j];

      if(result[currentBehavior]) {
        result[currentBehavior].push(currentElement);
      } else {
        result[currentBehavior] = [currentElement];
      }
    }
  }

  return result;
};
// Sort Methods
// ------------
//
// Namespace to hold sort methods

Essential.Core.SortMethods = {

  // By Priority
  // -----------
  //
  // This criteria allows to sort behaviors based on their respective priorities,
  // in descending order, that means behaviors with bigger priority will appear
  // first

  byPriority: function(behaviorA, behaviorB) {
    return behaviorB.priority - behaviorA.priority;
  }
};
;// -------------------------------------------
//   Main
// -------------------------------------------

ManView = {};
ManView.Behaviors = {};
ManView.Services = {};

document.addEventListener('DOMContentLoaded', function() {
  Essential.loadBehaviors({
    application: ManView.Behaviors,
    context: document
  });
});
;// -------------------------------------------
//   Text parser
// -------------------------------------------

ManView.Services.TextParser = Proto.extend({
  constructor: function() {
    this.generator = new Jroff.HTMLGenerator();
    this.macroLib = 'an';
  },

  setMacroLib: function(macroLib) {
    this.macroLib = macroLib;
  },

  parseGroff: function(text) {
    return this.generator.generate(text, this.macroLib);
  }
});
;// -------------------------------------------
//   Live preview
// -------------------------------------------

ManView.Behaviors.PageView = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    var url = 'https://raw.githubusercontent.com/dspinellis/manview/master/manview.3';
    var parsedURI = URI.parse(window.location.href);
    console.log('parsedURI ' + parsedURI);
    if (parsedURI.query) {
      var query = URI.parseQuery(parsedURI.query);
      console.log('Query: ' + query);
      if (query.src)
	url = query.src;
    }
    this.parser = ManView.Services.TextParser.new();
    var request = new XMLHttpRequest();
    console.log('Fetching ' + url);
    request.open('GET', url);
    request.responseType = 'text';
    request.onload = function() {
      var customEvent = new CustomEvent("source:retrieved", {
	"detail": {
	  text: request.response
	}
      });
      document.dispatchEvent(customEvent);
      console.log("Received " + request.response.length + " bytes");
    };
    request.send();
  },

  channels: {
    'source:retrieved': 'refreshChannel',
  },

  refreshChannel: function(e) {
    var text = e.detail.text;
    console.log("Source text length: " + text.length);
    if (text.search(".Dd") != -1)
      this.parser.setMacroLib("doc");
    this.el.innerHTML = this.parser.parseGroff(text);
    console.log("HTML length: " + this.el.innerHTML.length);
  },

});
;// -------------------------------------------
//   Set title
// -------------------------------------------

ManView.Behaviors.SetTitle = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    var title = "<a href='https://github.com/dspinellis/manview'>manview</a>";
    var parsedURI = URI.parse(window.location.href);
    if (parsedURI.query) {
      var query = URI.parseQuery(parsedURI.query);
      if (query.name && query.link)
	title += " — " + "<a href='" + query.link + "'>" + query.name + "</a>";
      else if (query.name)
	title += " — " + query.name;
      else if (query.link)
	title += " — " + "<a href='" + query.link + "'>Manual Page</a>";
      this.el.innerHTML = title;
    }
  },

});
;/*! URI.js v1.19.1 http://medialize.github.io/URI.js/ */
/* build contains: IPv6.js, punycode.js, SecondLevelDomains.js, URI.js, URITemplate.js */
(function(f,n){"object"===typeof module&&module.exports?module.exports=n():"function"===typeof define&&define.amd?define(n):f.IPv6=n(f)})(this,function(f){var n=f&&f.IPv6;return{best:function(h){h=h.toLowerCase().split(":");var k=h.length,b=8;""===h[0]&&""===h[1]&&""===h[2]?(h.shift(),h.shift()):""===h[0]&&""===h[1]?h.shift():""===h[k-1]&&""===h[k-2]&&h.pop();k=h.length;-1!==h[k-1].indexOf(".")&&(b=7);var q;for(q=0;q<k&&""!==h[q];q++);if(q<b)for(h.splice(q,1,"0000");h.length<b;)h.splice(q,0,"0000");
for(q=0;q<b;q++){k=h[q].split("");for(var f=0;3>f;f++)if("0"===k[0]&&1<k.length)k.splice(0,1);else break;h[q]=k.join("")}k=-1;var n=f=0,g=-1,p=!1;for(q=0;q<b;q++)p?"0"===h[q]?n+=1:(p=!1,n>f&&(k=g,f=n)):"0"===h[q]&&(p=!0,g=q,n=1);n>f&&(k=g,f=n);1<f&&h.splice(k,f,"");k=h.length;b="";""===h[0]&&(b=":");for(q=0;q<k;q++){b+=h[q];if(q===k-1)break;b+=":"}""===h[k-1]&&(b+=":");return b},noConflict:function(){f.IPv6===this&&(f.IPv6=n);return this}}});
(function(f){function n(b){throw new RangeError(w[b]);}function h(b,e){for(var g=b.length,h=[];g--;)h[g]=e(b[g]);return h}function k(b,e){var g=b.split("@"),f="";1<g.length&&(f=g[0]+"@",b=g[1]);b=b.replace(C,".");g=b.split(".");g=h(g,e).join(".");return f+g}function b(b){for(var e=[],g=0,h=b.length,f,a;g<h;)f=b.charCodeAt(g++),55296<=f&&56319>=f&&g<h?(a=b.charCodeAt(g++),56320==(a&64512)?e.push(((f&1023)<<10)+(a&1023)+65536):(e.push(f),g--)):e.push(f);return e}function q(b){return h(b,function(b){var e=
"";65535<b&&(b-=65536,e+=t(b>>>10&1023|55296),b=56320|b&1023);return e+=t(b)}).join("")}function z(b,e){return b+22+75*(26>b)-((0!=e)<<5)}function u(b,g,h){var f=0;b=h?e(b/700):b>>1;for(b+=e(b/g);455<b;f+=36)b=e(b/35);return e(f+36*b/(b+38))}function g(b){var g=[],h=b.length,f=0,k=128,a=72,c,d;var l=b.lastIndexOf("-");0>l&&(l=0);for(c=0;c<l;++c)128<=b.charCodeAt(c)&&n("not-basic"),g.push(b.charCodeAt(c));for(l=0<l?l+1:0;l<h;){c=f;var m=1;for(d=36;;d+=36){l>=h&&n("invalid-input");var x=b.charCodeAt(l++);
x=10>x-48?x-22:26>x-65?x-65:26>x-97?x-97:36;(36<=x||x>e((2147483647-f)/m))&&n("overflow");f+=x*m;var p=d<=a?1:d>=a+26?26:d-a;if(x<p)break;x=36-p;m>e(2147483647/x)&&n("overflow");m*=x}m=g.length+1;a=u(f-c,m,0==c);e(f/m)>2147483647-k&&n("overflow");k+=e(f/m);f%=m;g.splice(f++,0,k)}return q(g)}function p(g){var h,f,k,p=[];g=b(g);var a=g.length;var c=128;var d=0;var l=72;for(k=0;k<a;++k){var m=g[k];128>m&&p.push(t(m))}for((h=f=p.length)&&p.push("-");h<a;){var x=2147483647;for(k=0;k<a;++k)m=g[k],m>=c&&
m<x&&(x=m);var q=h+1;x-c>e((2147483647-d)/q)&&n("overflow");d+=(x-c)*q;c=x;for(k=0;k<a;++k)if(m=g[k],m<c&&2147483647<++d&&n("overflow"),m==c){var r=d;for(x=36;;x+=36){m=x<=l?1:x>=l+26?26:x-l;if(r<m)break;var A=r-m;r=36-m;p.push(t(z(m+A%r,0)));r=e(A/r)}p.push(t(z(r,0)));l=u(d,q,h==f);d=0;++h}++d;++c}return p.join("")}var D="object"==typeof exports&&exports&&!exports.nodeType&&exports,A="object"==typeof module&&module&&!module.nodeType&&module,B="object"==typeof global&&global;if(B.global===B||B.window===
B||B.self===B)f=B;var E=/^xn--/,r=/[^\x20-\x7E]/,C=/[\x2E\u3002\uFF0E\uFF61]/g,w={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},e=Math.floor,t=String.fromCharCode,y;var v={version:"1.3.2",ucs2:{decode:b,encode:q},decode:g,encode:p,toASCII:function(b){return k(b,function(b){return r.test(b)?"xn--"+p(b):b})},toUnicode:function(b){return k(b,function(b){return E.test(b)?g(b.slice(4).toLowerCase()):
b})}};if("function"==typeof define&&"object"==typeof define.amd&&define.amd)define("punycode",function(){return v});else if(D&&A)if(module.exports==D)A.exports=v;else for(y in v)v.hasOwnProperty(y)&&(D[y]=v[y]);else f.punycode=v})(this);
(function(f,n){"object"===typeof module&&module.exports?module.exports=n():"function"===typeof define&&define.amd?define(n):f.SecondLevelDomains=n(f)})(this,function(f){var n=f&&f.SecondLevelDomains,h={list:{ac:" com gov mil net org ",ae:" ac co gov mil name net org pro sch ",af:" com edu gov net org ",al:" com edu gov mil net org ",ao:" co ed gv it og pb ",ar:" com edu gob gov int mil net org tur ",at:" ac co gv or ",au:" asn com csiro edu gov id net org ",ba:" co com edu gov mil net org rs unbi unmo unsa untz unze ",
bb:" biz co com edu gov info net org store tv ",bh:" biz cc com edu gov info net org ",bn:" com edu gov net org ",bo:" com edu gob gov int mil net org tv ",br:" adm adv agr am arq art ato b bio blog bmd cim cng cnt com coop ecn edu eng esp etc eti far flog fm fnd fot fst g12 ggf gov imb ind inf jor jus lel mat med mil mus net nom not ntr odo org ppg pro psc psi qsl rec slg srv tmp trd tur tv vet vlog wiki zlg ",bs:" com edu gov net org ",bz:" du et om ov rg ",ca:" ab bc mb nb nf nl ns nt nu on pe qc sk yk ",
ck:" biz co edu gen gov info net org ",cn:" ac ah bj com cq edu fj gd gov gs gx gz ha hb he hi hl hn jl js jx ln mil net nm nx org qh sc sd sh sn sx tj tw xj xz yn zj ",co:" com edu gov mil net nom org ",cr:" ac c co ed fi go or sa ",cy:" ac biz com ekloges gov ltd name net org parliament press pro tm ","do":" art com edu gob gov mil net org sld web ",dz:" art asso com edu gov net org pol ",ec:" com edu fin gov info med mil net org pro ",eg:" com edu eun gov mil name net org sci ",er:" com edu gov ind mil net org rochest w ",
es:" com edu gob nom org ",et:" biz com edu gov info name net org ",fj:" ac biz com info mil name net org pro ",fk:" ac co gov net nom org ",fr:" asso com f gouv nom prd presse tm ",gg:" co net org ",gh:" com edu gov mil org ",gn:" ac com gov net org ",gr:" com edu gov mil net org ",gt:" com edu gob ind mil net org ",gu:" com edu gov net org ",hk:" com edu gov idv net org ",hu:" 2000 agrar bolt casino city co erotica erotika film forum games hotel info ingatlan jogasz konyvelo lakas media news org priv reklam sex shop sport suli szex tm tozsde utazas video ",
id:" ac co go mil net or sch web ",il:" ac co gov idf k12 muni net org ","in":" ac co edu ernet firm gen gov i ind mil net nic org res ",iq:" com edu gov i mil net org ",ir:" ac co dnssec gov i id net org sch ",it:" edu gov ",je:" co net org ",jo:" com edu gov mil name net org sch ",jp:" ac ad co ed go gr lg ne or ",ke:" ac co go info me mobi ne or sc ",kh:" com edu gov mil net org per ",ki:" biz com de edu gov info mob net org tel ",km:" asso com coop edu gouv k medecin mil nom notaires pharmaciens presse tm veterinaire ",
kn:" edu gov net org ",kr:" ac busan chungbuk chungnam co daegu daejeon es gangwon go gwangju gyeongbuk gyeonggi gyeongnam hs incheon jeju jeonbuk jeonnam k kg mil ms ne or pe re sc seoul ulsan ",kw:" com edu gov net org ",ky:" com edu gov net org ",kz:" com edu gov mil net org ",lb:" com edu gov net org ",lk:" assn com edu gov grp hotel int ltd net ngo org sch soc web ",lr:" com edu gov net org ",lv:" asn com conf edu gov id mil net org ",ly:" com edu gov id med net org plc sch ",ma:" ac co gov m net org press ",
mc:" asso tm ",me:" ac co edu gov its net org priv ",mg:" com edu gov mil nom org prd tm ",mk:" com edu gov inf name net org pro ",ml:" com edu gov net org presse ",mn:" edu gov org ",mo:" com edu gov net org ",mt:" com edu gov net org ",mv:" aero biz com coop edu gov info int mil museum name net org pro ",mw:" ac co com coop edu gov int museum net org ",mx:" com edu gob net org ",my:" com edu gov mil name net org sch ",nf:" arts com firm info net other per rec store web ",ng:" biz com edu gov mil mobi name net org sch ",
ni:" ac co com edu gob mil net nom org ",np:" com edu gov mil net org ",nr:" biz com edu gov info net org ",om:" ac biz co com edu gov med mil museum net org pro sch ",pe:" com edu gob mil net nom org sld ",ph:" com edu gov i mil net ngo org ",pk:" biz com edu fam gob gok gon gop gos gov net org web ",pl:" art bialystok biz com edu gda gdansk gorzow gov info katowice krakow lodz lublin mil net ngo olsztyn org poznan pwr radom slupsk szczecin torun warszawa waw wroc wroclaw zgora ",pr:" ac biz com edu est gov info isla name net org pro prof ",
ps:" com edu gov net org plo sec ",pw:" belau co ed go ne or ",ro:" arts com firm info nom nt org rec store tm www ",rs:" ac co edu gov in org ",sb:" com edu gov net org ",sc:" com edu gov net org ",sh:" co com edu gov net nom org ",sl:" com edu gov net org ",st:" co com consulado edu embaixada gov mil net org principe saotome store ",sv:" com edu gob org red ",sz:" ac co org ",tr:" av bbs bel biz com dr edu gen gov info k12 name net org pol tel tsk tv web ",tt:" aero biz cat co com coop edu gov info int jobs mil mobi museum name net org pro tel travel ",
tw:" club com ebiz edu game gov idv mil net org ",mu:" ac co com gov net or org ",mz:" ac co edu gov org ",na:" co com ",nz:" ac co cri geek gen govt health iwi maori mil net org parliament school ",pa:" abo ac com edu gob ing med net nom org sld ",pt:" com edu gov int net nome org publ ",py:" com edu gov mil net org ",qa:" com edu gov mil net org ",re:" asso com nom ",ru:" ac adygeya altai amur arkhangelsk astrakhan bashkiria belgorod bir bryansk buryatia cbg chel chelyabinsk chita chukotka chuvashia com dagestan e-burg edu gov grozny int irkutsk ivanovo izhevsk jar joshkar-ola kalmykia kaluga kamchatka karelia kazan kchr kemerovo khabarovsk khakassia khv kirov koenig komi kostroma kranoyarsk kuban kurgan kursk lipetsk magadan mari mari-el marine mil mordovia mosreg msk murmansk nalchik net nnov nov novosibirsk nsk omsk orenburg org oryol penza perm pp pskov ptz rnd ryazan sakhalin samara saratov simbirsk smolensk spb stavropol stv surgut tambov tatarstan tom tomsk tsaritsyn tsk tula tuva tver tyumen udm udmurtia ulan-ude vladikavkaz vladimir vladivostok volgograd vologda voronezh vrn vyatka yakutia yamal yekaterinburg yuzhno-sakhalinsk ",
rw:" ac co com edu gouv gov int mil net ",sa:" com edu gov med net org pub sch ",sd:" com edu gov info med net org tv ",se:" a ac b bd c d e f g h i k l m n o org p parti pp press r s t tm u w x y z ",sg:" com edu gov idn net org per ",sn:" art com edu gouv org perso univ ",sy:" com edu gov mil net news org ",th:" ac co go in mi net or ",tj:" ac biz co com edu go gov info int mil name net nic org test web ",tn:" agrinet com defense edunet ens fin gov ind info intl mincom nat net org perso rnrt rns rnu tourism ",
tz:" ac co go ne or ",ua:" biz cherkassy chernigov chernovtsy ck cn co com crimea cv dn dnepropetrovsk donetsk dp edu gov if in ivano-frankivsk kh kharkov kherson khmelnitskiy kiev kirovograd km kr ks kv lg lugansk lutsk lviv me mk net nikolaev od odessa org pl poltava pp rovno rv sebastopol sumy te ternopil uzhgorod vinnica vn zaporizhzhe zhitomir zp zt ",ug:" ac co go ne or org sc ",uk:" ac bl british-library co cym gov govt icnet jet lea ltd me mil mod national-library-scotland nel net nhs nic nls org orgn parliament plc police sch scot soc ",
us:" dni fed isa kids nsn ",uy:" com edu gub mil net org ",ve:" co com edu gob info mil net org web ",vi:" co com k12 net org ",vn:" ac biz com edu gov health info int name net org pro ",ye:" co com gov ltd me net org plc ",yu:" ac co edu gov org ",za:" ac agric alt bourse city co cybernet db edu gov grondar iaccess imt inca landesign law mil net ngo nis nom olivetti org pix school tm web ",zm:" ac co com edu gov net org sch ",com:"ar br cn de eu gb gr hu jpn kr no qc ru sa se uk us uy za ",net:"gb jp se uk ",
org:"ae",de:"com "},has:function(f){var b=f.lastIndexOf(".");if(0>=b||b>=f.length-1)return!1;var k=f.lastIndexOf(".",b-1);if(0>=k||k>=b-1)return!1;var n=h.list[f.slice(b+1)];return n?0<=n.indexOf(" "+f.slice(k+1,b)+" "):!1},is:function(f){var b=f.lastIndexOf(".");if(0>=b||b>=f.length-1||0<=f.lastIndexOf(".",b-1))return!1;var k=h.list[f.slice(b+1)];return k?0<=k.indexOf(" "+f.slice(0,b)+" "):!1},get:function(f){var b=f.lastIndexOf(".");if(0>=b||b>=f.length-1)return null;var k=f.lastIndexOf(".",b-1);
if(0>=k||k>=b-1)return null;var n=h.list[f.slice(b+1)];return!n||0>n.indexOf(" "+f.slice(k+1,b)+" ")?null:f.slice(k+1)},noConflict:function(){f.SecondLevelDomains===this&&(f.SecondLevelDomains=n);return this}};return h});
(function(f,n){"object"===typeof module&&module.exports?module.exports=n(require("./punycode"),require("./IPv6"),require("./SecondLevelDomains")):"function"===typeof define&&define.amd?define(["./punycode","./IPv6","./SecondLevelDomains"],n):f.URI=n(f.punycode,f.IPv6,f.SecondLevelDomains,f)})(this,function(f,n,h,k){function b(a,c){var d=1<=arguments.length,l=2<=arguments.length;if(!(this instanceof b))return d?l?new b(a,c):new b(a):new b;if(void 0===a){if(d)throw new TypeError("undefined is not a valid argument for URI");
a="undefined"!==typeof location?location.href+"":""}if(null===a&&d)throw new TypeError("null is not a valid argument for URI");this.href(a);return void 0!==c?this.absoluteTo(c):this}function q(a){return a.replace(/([.*+?^=!:${}()|[\]\/\\])/g,"\\$1")}function z(a){return void 0===a?"Undefined":String(Object.prototype.toString.call(a)).slice(8,-1)}function u(a){return"Array"===z(a)}function g(a,c){var d={},b;if("RegExp"===z(c))d=null;else if(u(c)){var m=0;for(b=c.length;m<b;m++)d[c[m]]=!0}else d[c]=
!0;m=0;for(b=a.length;m<b;m++)if(d&&void 0!==d[a[m]]||!d&&c.test(a[m]))a.splice(m,1),b--,m--;return a}function p(a,c){var d;if(u(c)){var b=0;for(d=c.length;b<d;b++)if(!p(a,c[b]))return!1;return!0}var m=z(c);b=0;for(d=a.length;b<d;b++)if("RegExp"===m){if("string"===typeof a[b]&&a[b].match(c))return!0}else if(a[b]===c)return!0;return!1}function D(a,c){if(!u(a)||!u(c)||a.length!==c.length)return!1;a.sort();c.sort();for(var d=0,b=a.length;d<b;d++)if(a[d]!==c[d])return!1;return!0}function A(a){return a.replace(/^\/+|\/+$/g,
"")}function B(a){return escape(a)}function E(a){return encodeURIComponent(a).replace(/[!'()*]/g,B).replace(/\*/g,"%2A")}function r(a){return function(c,d){if(void 0===c)return this._parts[a]||"";this._parts[a]=c||null;this.build(!d);return this}}function C(a,c){return function(d,b){if(void 0===d)return this._parts[a]||"";null!==d&&(d+="",d.charAt(0)===c&&(d=d.substring(1)));this._parts[a]=d;this.build(!b);return this}}var w=k&&k.URI;b.version="1.19.1";var e=b.prototype,t=Object.prototype.hasOwnProperty;
b._parts=function(){return{protocol:null,username:null,password:null,hostname:null,urn:null,port:null,path:null,query:null,fragment:null,preventInvalidHostname:b.preventInvalidHostname,duplicateQueryParameters:b.duplicateQueryParameters,escapeQuerySpace:b.escapeQuerySpace}};b.preventInvalidHostname=!1;b.duplicateQueryParameters=!1;b.escapeQuerySpace=!0;b.protocol_expression=/^[a-z][a-z0-9.+-]*$/i;b.idn_expression=/[^a-z0-9\._-]/i;b.punycode_expression=/(xn--)/i;b.ip4_expression=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
b.ip6_expression=/^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;
b.find_uri_expression=/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?\u00ab\u00bb\u201c\u201d\u2018\u2019]))/ig;b.findUri={start:/\b(?:([a-z][a-z0-9.+-]*:\/\/)|www\.)/gi,end:/[\s\r\n]|$/,trim:/[`!()\[\]{};:'".,<>?\u00ab\u00bb\u201c\u201d\u201e\u2018\u2019]+$/,parens:/(\([^\)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>)/g};b.defaultPorts={http:"80",https:"443",ftp:"21",
gopher:"70",ws:"80",wss:"443"};b.hostProtocols=["http","https"];b.invalid_hostname_characters=/[^a-zA-Z0-9\.\-:_]/;b.domAttributes={a:"href",blockquote:"cite",link:"href",base:"href",script:"src",form:"action",img:"src",area:"href",iframe:"src",embed:"src",source:"src",track:"src",input:"src",audio:"src",video:"src"};b.getDomAttribute=function(a){if(a&&a.nodeName){var c=a.nodeName.toLowerCase();if("input"!==c||"image"===a.type)return b.domAttributes[c]}};b.encode=E;b.decode=decodeURIComponent;b.iso8859=
function(){b.encode=escape;b.decode=unescape};b.unicode=function(){b.encode=E;b.decode=decodeURIComponent};b.characters={pathname:{encode:{expression:/%(24|26|2B|2C|3B|3D|3A|40)/ig,map:{"%24":"$","%26":"&","%2B":"+","%2C":",","%3B":";","%3D":"=","%3A":":","%40":"@"}},decode:{expression:/[\/\?#]/g,map:{"/":"%2F","?":"%3F","#":"%23"}}},reserved:{encode:{expression:/%(21|23|24|26|27|28|29|2A|2B|2C|2F|3A|3B|3D|3F|40|5B|5D)/ig,map:{"%3A":":","%2F":"/","%3F":"?","%23":"#","%5B":"[","%5D":"]","%40":"@",
"%21":"!","%24":"$","%26":"&","%27":"'","%28":"(","%29":")","%2A":"*","%2B":"+","%2C":",","%3B":";","%3D":"="}}},urnpath:{encode:{expression:/%(21|24|27|28|29|2A|2B|2C|3B|3D|40)/ig,map:{"%21":"!","%24":"$","%27":"'","%28":"(","%29":")","%2A":"*","%2B":"+","%2C":",","%3B":";","%3D":"=","%40":"@"}},decode:{expression:/[\/\?#:]/g,map:{"/":"%2F","?":"%3F","#":"%23",":":"%3A"}}}};b.encodeQuery=function(a,c){var d=b.encode(a+"");void 0===c&&(c=b.escapeQuerySpace);return c?d.replace(/%20/g,"+"):d};b.decodeQuery=
function(a,c){a+="";void 0===c&&(c=b.escapeQuerySpace);try{return b.decode(c?a.replace(/\+/g,"%20"):a)}catch(d){return a}};var y={encode:"encode",decode:"decode"},v,F=function(a,c){return function(d){try{return b[c](d+"").replace(b.characters[a][c].expression,function(d){return b.characters[a][c].map[d]})}catch(l){return d}}};for(v in y)b[v+"PathSegment"]=F("pathname",y[v]),b[v+"UrnPathSegment"]=F("urnpath",y[v]);y=function(a,c,d){return function(l){var m=d?function(a){return b[c](b[d](a))}:b[c];
l=(l+"").split(a);for(var e=0,g=l.length;e<g;e++)l[e]=m(l[e]);return l.join(a)}};b.decodePath=y("/","decodePathSegment");b.decodeUrnPath=y(":","decodeUrnPathSegment");b.recodePath=y("/","encodePathSegment","decode");b.recodeUrnPath=y(":","encodeUrnPathSegment","decode");b.encodeReserved=F("reserved","encode");b.parse=function(a,c){c||(c={preventInvalidHostname:b.preventInvalidHostname});var d=a.indexOf("#");-1<d&&(c.fragment=a.substring(d+1)||null,a=a.substring(0,d));d=a.indexOf("?");-1<d&&(c.query=
a.substring(d+1)||null,a=a.substring(0,d));"//"===a.substring(0,2)?(c.protocol=null,a=a.substring(2),a=b.parseAuthority(a,c)):(d=a.indexOf(":"),-1<d&&(c.protocol=a.substring(0,d)||null,c.protocol&&!c.protocol.match(b.protocol_expression)?c.protocol=void 0:"//"===a.substring(d+1,d+3)?(a=a.substring(d+3),a=b.parseAuthority(a,c)):(a=a.substring(d+1),c.urn=!0)));c.path=a;return c};b.parseHost=function(a,c){a||(a="");a=a.replace(/\\/g,"/");var d=a.indexOf("/");-1===d&&(d=a.length);if("["===a.charAt(0)){var l=
a.indexOf("]");c.hostname=a.substring(1,l)||null;c.port=a.substring(l+2,d)||null;"/"===c.port&&(c.port=null)}else{var m=a.indexOf(":");l=a.indexOf("/");m=a.indexOf(":",m+1);-1!==m&&(-1===l||m<l)?(c.hostname=a.substring(0,d)||null,c.port=null):(l=a.substring(0,d).split(":"),c.hostname=l[0]||null,c.port=l[1]||null)}c.hostname&&"/"!==a.substring(d).charAt(0)&&(d++,a="/"+a);c.preventInvalidHostname&&b.ensureValidHostname(c.hostname,c.protocol);c.port&&b.ensureValidPort(c.port);return a.substring(d)||
"/"};b.parseAuthority=function(a,c){a=b.parseUserinfo(a,c);return b.parseHost(a,c)};b.parseUserinfo=function(a,c){var d=a.indexOf("/"),l=a.lastIndexOf("@",-1<d?d:a.length-1);-1<l&&(-1===d||l<d)?(d=a.substring(0,l).split(":"),c.username=d[0]?b.decode(d[0]):null,d.shift(),c.password=d[0]?b.decode(d.join(":")):null,a=a.substring(l+1)):(c.username=null,c.password=null);return a};b.parseQuery=function(a,c){if(!a)return{};a=a.replace(/&+/g,"&").replace(/^\?*&*|&+$/g,"");if(!a)return{};for(var d={},l=a.split("&"),
m=l.length,e,g,f=0;f<m;f++)if(e=l[f].split("="),g=b.decodeQuery(e.shift(),c),e=e.length?b.decodeQuery(e.join("="),c):null,t.call(d,g)){if("string"===typeof d[g]||null===d[g])d[g]=[d[g]];d[g].push(e)}else d[g]=e;return d};b.build=function(a){var c="";a.protocol&&(c+=a.protocol+":");a.urn||!c&&!a.hostname||(c+="//");c+=b.buildAuthority(a)||"";"string"===typeof a.path&&("/"!==a.path.charAt(0)&&"string"===typeof a.hostname&&(c+="/"),c+=a.path);"string"===typeof a.query&&a.query&&(c+="?"+a.query);"string"===
typeof a.fragment&&a.fragment&&(c+="#"+a.fragment);return c};b.buildHost=function(a){var c="";if(a.hostname)c=b.ip6_expression.test(a.hostname)?c+("["+a.hostname+"]"):c+a.hostname;else return"";a.port&&(c+=":"+a.port);return c};b.buildAuthority=function(a){return b.buildUserinfo(a)+b.buildHost(a)};b.buildUserinfo=function(a){var c="";a.username&&(c+=b.encode(a.username));a.password&&(c+=":"+b.encode(a.password));c&&(c+="@");return c};b.buildQuery=function(a,c,d){var l="",m,e;for(m in a)if(t.call(a,
m)&&m)if(u(a[m])){var g={};var f=0;for(e=a[m].length;f<e;f++)void 0!==a[m][f]&&void 0===g[a[m][f]+""]&&(l+="&"+b.buildQueryParameter(m,a[m][f],d),!0!==c&&(g[a[m][f]+""]=!0))}else void 0!==a[m]&&(l+="&"+b.buildQueryParameter(m,a[m],d));return l.substring(1)};b.buildQueryParameter=function(a,c,d){return b.encodeQuery(a,d)+(null!==c?"="+b.encodeQuery(c,d):"")};b.addQuery=function(a,c,d){if("object"===typeof c)for(var l in c)t.call(c,l)&&b.addQuery(a,l,c[l]);else if("string"===typeof c)void 0===a[c]?
a[c]=d:("string"===typeof a[c]&&(a[c]=[a[c]]),u(d)||(d=[d]),a[c]=(a[c]||[]).concat(d));else throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");};b.setQuery=function(a,c,d){if("object"===typeof c)for(var l in c)t.call(c,l)&&b.setQuery(a,l,c[l]);else if("string"===typeof c)a[c]=void 0===d?null:d;else throw new TypeError("URI.setQuery() accepts an object, string as the name parameter");};b.removeQuery=function(a,c,d){var l;if(u(c))for(d=0,l=c.length;d<l;d++)a[c[d]]=
void 0;else if("RegExp"===z(c))for(l in a)c.test(l)&&(a[l]=void 0);else if("object"===typeof c)for(l in c)t.call(c,l)&&b.removeQuery(a,l,c[l]);else if("string"===typeof c)void 0!==d?"RegExp"===z(d)?!u(a[c])&&d.test(a[c])?a[c]=void 0:a[c]=g(a[c],d):a[c]!==String(d)||u(d)&&1!==d.length?u(a[c])&&(a[c]=g(a[c],d)):a[c]=void 0:a[c]=void 0;else throw new TypeError("URI.removeQuery() accepts an object, string, RegExp as the first parameter");};b.hasQuery=function(a,c,d,l){switch(z(c)){case "String":break;
case "RegExp":for(var m in a)if(t.call(a,m)&&c.test(m)&&(void 0===d||b.hasQuery(a,m,d)))return!0;return!1;case "Object":for(var e in c)if(t.call(c,e)&&!b.hasQuery(a,e,c[e]))return!1;return!0;default:throw new TypeError("URI.hasQuery() accepts a string, regular expression or object as the name parameter");}switch(z(d)){case "Undefined":return c in a;case "Boolean":return a=!(u(a[c])?!a[c].length:!a[c]),d===a;case "Function":return!!d(a[c],c,a);case "Array":return u(a[c])?(l?p:D)(a[c],d):!1;case "RegExp":return u(a[c])?
l?p(a[c],d):!1:!(!a[c]||!a[c].match(d));case "Number":d=String(d);case "String":return u(a[c])?l?p(a[c],d):!1:a[c]===d;default:throw new TypeError("URI.hasQuery() accepts undefined, boolean, string, number, RegExp, Function as the value parameter");}};b.joinPaths=function(){for(var a=[],c=[],d=0,l=0;l<arguments.length;l++){var m=new b(arguments[l]);a.push(m);m=m.segment();for(var e=0;e<m.length;e++)"string"===typeof m[e]&&c.push(m[e]),m[e]&&d++}if(!c.length||!d)return new b("");c=(new b("")).segment(c);
""!==a[0].path()&&"/"!==a[0].path().slice(0,1)||c.path("/"+c.path());return c.normalize()};b.commonPath=function(a,c){var d=Math.min(a.length,c.length),b;for(b=0;b<d;b++)if(a.charAt(b)!==c.charAt(b)){b--;break}if(1>b)return a.charAt(0)===c.charAt(0)&&"/"===a.charAt(0)?"/":"";if("/"!==a.charAt(b)||"/"!==c.charAt(b))b=a.substring(0,b).lastIndexOf("/");return a.substring(0,b+1)};b.withinString=function(a,c,d){d||(d={});var l=d.start||b.findUri.start,m=d.end||b.findUri.end,e=d.trim||b.findUri.trim,g=
d.parens||b.findUri.parens,f=/[a-z0-9-]=["']?$/i;for(l.lastIndex=0;;){var h=l.exec(a);if(!h)break;var k=h.index;if(d.ignoreHtml){var p=a.slice(Math.max(k-3,0),k);if(p&&f.test(p))continue}var n=k+a.slice(k).search(m);p=a.slice(k,n);for(n=-1;;){var r=g.exec(p);if(!r)break;n=Math.max(n,r.index+r[0].length)}p=-1<n?p.slice(0,n)+p.slice(n).replace(e,""):p.replace(e,"");p.length<=h[0].length||d.ignore&&d.ignore.test(p)||(n=k+p.length,h=c(p,k,n,a),void 0===h?l.lastIndex=n:(h=String(h),a=a.slice(0,k)+h+a.slice(n),
l.lastIndex=k+h.length))}l.lastIndex=0;return a};b.ensureValidHostname=function(a,c){var d=!!a,l=!1;c&&(l=p(b.hostProtocols,c));if(l&&!d)throw new TypeError("Hostname cannot be empty, if protocol is "+c);if(a&&a.match(b.invalid_hostname_characters)){if(!f)throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-:_] and Punycode.js is not available');if(f.toASCII(a).match(b.invalid_hostname_characters))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-:_]');
}};b.ensureValidPort=function(a){if(a){var c=Number(a);if(!(/^[0-9]+$/.test(c)&&0<c&&65536>c))throw new TypeError('Port "'+a+'" is not a valid port');}};b.noConflict=function(a){if(a)return a={URI:this.noConflict()},k.URITemplate&&"function"===typeof k.URITemplate.noConflict&&(a.URITemplate=k.URITemplate.noConflict()),k.IPv6&&"function"===typeof k.IPv6.noConflict&&(a.IPv6=k.IPv6.noConflict()),k.SecondLevelDomains&&"function"===typeof k.SecondLevelDomains.noConflict&&(a.SecondLevelDomains=k.SecondLevelDomains.noConflict()),
a;k.URI===this&&(k.URI=w);return this};e.build=function(a){if(!0===a)this._deferred_build=!0;else if(void 0===a||this._deferred_build)this._string=b.build(this._parts),this._deferred_build=!1;return this};e.clone=function(){return new b(this)};e.valueOf=e.toString=function(){return this.build(!1)._string};e.protocol=r("protocol");e.username=r("username");e.password=r("password");e.hostname=r("hostname");e.port=r("port");e.query=C("query","?");e.fragment=C("fragment","#");e.search=function(a,c){var b=
this.query(a,c);return"string"===typeof b&&b.length?"?"+b:b};e.hash=function(a,c){var b=this.fragment(a,c);return"string"===typeof b&&b.length?"#"+b:b};e.pathname=function(a,c){if(void 0===a||!0===a){var d=this._parts.path||(this._parts.hostname?"/":"");return a?(this._parts.urn?b.decodeUrnPath:b.decodePath)(d):d}this._parts.path=this._parts.urn?a?b.recodeUrnPath(a):"":a?b.recodePath(a):"/";this.build(!c);return this};e.path=e.pathname;e.href=function(a,c){var d;if(void 0===a)return this.toString();
this._string="";this._parts=b._parts();var l=a instanceof b,e="object"===typeof a&&(a.hostname||a.path||a.pathname);a.nodeName&&(e=b.getDomAttribute(a),a=a[e]||"",e=!1);!l&&e&&void 0!==a.pathname&&(a=a.toString());if("string"===typeof a||a instanceof String)this._parts=b.parse(String(a),this._parts);else if(l||e){l=l?a._parts:a;for(d in l)"query"!==d&&t.call(this._parts,d)&&(this._parts[d]=l[d]);l.query&&this.query(l.query,!1)}else throw new TypeError("invalid input");this.build(!c);return this};
e.is=function(a){var c=!1,d=!1,e=!1,m=!1,g=!1,f=!1,k=!1,p=!this._parts.urn;this._parts.hostname&&(p=!1,d=b.ip4_expression.test(this._parts.hostname),e=b.ip6_expression.test(this._parts.hostname),c=d||e,g=(m=!c)&&h&&h.has(this._parts.hostname),f=m&&b.idn_expression.test(this._parts.hostname),k=m&&b.punycode_expression.test(this._parts.hostname));switch(a.toLowerCase()){case "relative":return p;case "absolute":return!p;case "domain":case "name":return m;case "sld":return g;case "ip":return c;case "ip4":case "ipv4":case "inet4":return d;
case "ip6":case "ipv6":case "inet6":return e;case "idn":return f;case "url":return!this._parts.urn;case "urn":return!!this._parts.urn;case "punycode":return k}return null};var G=e.protocol,H=e.port,I=e.hostname;e.protocol=function(a,c){if(a&&(a=a.replace(/:(\/\/)?$/,""),!a.match(b.protocol_expression)))throw new TypeError('Protocol "'+a+"\" contains characters other than [A-Z0-9.+-] or doesn't start with [A-Z]");return G.call(this,a,c)};e.scheme=e.protocol;e.port=function(a,c){if(this._parts.urn)return void 0===
a?"":this;void 0!==a&&(0===a&&(a=null),a&&(a+="",":"===a.charAt(0)&&(a=a.substring(1)),b.ensureValidPort(a)));return H.call(this,a,c)};e.hostname=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0!==a){var d={preventInvalidHostname:this._parts.preventInvalidHostname};if("/"!==b.parseHost(a,d))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-]');a=d.hostname;this._parts.preventInvalidHostname&&b.ensureValidHostname(a,this._parts.protocol)}return I.call(this,
a,c)};e.origin=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a){var d=this.protocol();return this.authority()?(d?d+"://":"")+this.authority():""}d=b(a);this.protocol(d.protocol()).authority(d.authority()).build(!c);return this};e.host=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a)return this._parts.hostname?b.buildHost(this._parts):"";if("/"!==b.parseHost(a,this._parts))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-]');
this.build(!c);return this};e.authority=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a)return this._parts.hostname?b.buildAuthority(this._parts):"";if("/"!==b.parseAuthority(a,this._parts))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-]');this.build(!c);return this};e.userinfo=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a){var d=b.buildUserinfo(this._parts);return d?d.substring(0,d.length-1):d}"@"!==a[a.length-1]&&
(a+="@");b.parseUserinfo(a,this._parts);this.build(!c);return this};e.resource=function(a,c){if(void 0===a)return this.path()+this.search()+this.hash();var d=b.parse(a);this._parts.path=d.path;this._parts.query=d.query;this._parts.fragment=d.fragment;this.build(!c);return this};e.subdomain=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a){if(!this._parts.hostname||this.is("IP"))return"";var d=this._parts.hostname.length-this.domain().length-1;return this._parts.hostname.substring(0,
d)||""}d=this._parts.hostname.length-this.domain().length;d=this._parts.hostname.substring(0,d);d=new RegExp("^"+q(d));a&&"."!==a.charAt(a.length-1)&&(a+=".");if(-1!==a.indexOf(":"))throw new TypeError("Domains cannot contain colons");a&&b.ensureValidHostname(a,this._parts.protocol);this._parts.hostname=this._parts.hostname.replace(d,a);this.build(!c);return this};e.domain=function(a,c){if(this._parts.urn)return void 0===a?"":this;"boolean"===typeof a&&(c=a,a=void 0);if(void 0===a){if(!this._parts.hostname||
this.is("IP"))return"";var d=this._parts.hostname.match(/\./g);if(d&&2>d.length)return this._parts.hostname;d=this._parts.hostname.length-this.tld(c).length-1;d=this._parts.hostname.lastIndexOf(".",d-1)+1;return this._parts.hostname.substring(d)||""}if(!a)throw new TypeError("cannot set domain empty");if(-1!==a.indexOf(":"))throw new TypeError("Domains cannot contain colons");b.ensureValidHostname(a,this._parts.protocol);!this._parts.hostname||this.is("IP")?this._parts.hostname=a:(d=new RegExp(q(this.domain())+
"$"),this._parts.hostname=this._parts.hostname.replace(d,a));this.build(!c);return this};e.tld=function(a,c){if(this._parts.urn)return void 0===a?"":this;"boolean"===typeof a&&(c=a,a=void 0);if(void 0===a){if(!this._parts.hostname||this.is("IP"))return"";var b=this._parts.hostname.lastIndexOf(".");b=this._parts.hostname.substring(b+1);return!0!==c&&h&&h.list[b.toLowerCase()]?h.get(this._parts.hostname)||b:b}if(a)if(a.match(/[^a-zA-Z0-9-]/))if(h&&h.is(a))b=new RegExp(q(this.tld())+"$"),this._parts.hostname=
this._parts.hostname.replace(b,a);else throw new TypeError('TLD "'+a+'" contains characters other than [A-Z0-9]');else{if(!this._parts.hostname||this.is("IP"))throw new ReferenceError("cannot set TLD on non-domain host");b=new RegExp(q(this.tld())+"$");this._parts.hostname=this._parts.hostname.replace(b,a)}else throw new TypeError("cannot set TLD empty");this.build(!c);return this};e.directory=function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a||!0===a){if(!this._parts.path&&
!this._parts.hostname)return"";if("/"===this._parts.path)return"/";var d=this._parts.path.length-this.filename().length-1;d=this._parts.path.substring(0,d)||(this._parts.hostname?"/":"");return a?b.decodePath(d):d}d=this._parts.path.length-this.filename().length;d=this._parts.path.substring(0,d);d=new RegExp("^"+q(d));this.is("relative")||(a||(a="/"),"/"!==a.charAt(0)&&(a="/"+a));a&&"/"!==a.charAt(a.length-1)&&(a+="/");a=b.recodePath(a);this._parts.path=this._parts.path.replace(d,a);this.build(!c);
return this};e.filename=function(a,c){if(this._parts.urn)return void 0===a?"":this;if("string"!==typeof a){if(!this._parts.path||"/"===this._parts.path)return"";var d=this._parts.path.lastIndexOf("/");d=this._parts.path.substring(d+1);return a?b.decodePathSegment(d):d}d=!1;"/"===a.charAt(0)&&(a=a.substring(1));a.match(/\.?\//)&&(d=!0);var e=new RegExp(q(this.filename())+"$");a=b.recodePath(a);this._parts.path=this._parts.path.replace(e,a);d?this.normalizePath(c):this.build(!c);return this};e.suffix=
function(a,c){if(this._parts.urn)return void 0===a?"":this;if(void 0===a||!0===a){if(!this._parts.path||"/"===this._parts.path)return"";var d=this.filename(),e=d.lastIndexOf(".");if(-1===e)return"";d=d.substring(e+1);d=/^[a-z0-9%]+$/i.test(d)?d:"";return a?b.decodePathSegment(d):d}"."===a.charAt(0)&&(a=a.substring(1));if(d=this.suffix())e=a?new RegExp(q(d)+"$"):new RegExp(q("."+d)+"$");else{if(!a)return this;this._parts.path+="."+b.recodePath(a)}e&&(a=b.recodePath(a),this._parts.path=this._parts.path.replace(e,
a));this.build(!c);return this};e.segment=function(a,c,b){var d=this._parts.urn?":":"/",e=this.path(),g="/"===e.substring(0,1);e=e.split(d);void 0!==a&&"number"!==typeof a&&(b=c,c=a,a=void 0);if(void 0!==a&&"number"!==typeof a)throw Error('Bad segment "'+a+'", must be 0-based integer');g&&e.shift();0>a&&(a=Math.max(e.length+a,0));if(void 0===c)return void 0===a?e:e[a];if(null===a||void 0===e[a])if(u(c)){e=[];a=0;for(var f=c.length;a<f;a++)if(c[a].length||e.length&&e[e.length-1].length)e.length&&!e[e.length-
1].length&&e.pop(),e.push(A(c[a]))}else{if(c||"string"===typeof c)c=A(c),""===e[e.length-1]?e[e.length-1]=c:e.push(c)}else c?e[a]=A(c):e.splice(a,1);g&&e.unshift("");return this.path(e.join(d),b)};e.segmentCoded=function(a,c,d){var e;"number"!==typeof a&&(d=c,c=a,a=void 0);if(void 0===c){a=this.segment(a,c,d);if(u(a)){var g=0;for(e=a.length;g<e;g++)a[g]=b.decode(a[g])}else a=void 0!==a?b.decode(a):void 0;return a}if(u(c))for(g=0,e=c.length;g<e;g++)c[g]=b.encode(c[g]);else c="string"===typeof c||c instanceof
String?b.encode(c):c;return this.segment(a,c,d)};var J=e.query;e.query=function(a,c){if(!0===a)return b.parseQuery(this._parts.query,this._parts.escapeQuerySpace);if("function"===typeof a){var d=b.parseQuery(this._parts.query,this._parts.escapeQuerySpace),e=a.call(this,d);this._parts.query=b.buildQuery(e||d,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace);this.build(!c);return this}return void 0!==a&&"string"!==typeof a?(this._parts.query=b.buildQuery(a,this._parts.duplicateQueryParameters,
this._parts.escapeQuerySpace),this.build(!c),this):J.call(this,a,c)};e.setQuery=function(a,c,d){var e=b.parseQuery(this._parts.query,this._parts.escapeQuerySpace);if("string"===typeof a||a instanceof String)e[a]=void 0!==c?c:null;else if("object"===typeof a)for(var g in a)t.call(a,g)&&(e[g]=a[g]);else throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");this._parts.query=b.buildQuery(e,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace);"string"!==typeof a&&
(d=c);this.build(!d);return this};e.addQuery=function(a,c,d){var e=b.parseQuery(this._parts.query,this._parts.escapeQuerySpace);b.addQuery(e,a,void 0===c?null:c);this._parts.query=b.buildQuery(e,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace);"string"!==typeof a&&(d=c);this.build(!d);return this};e.removeQuery=function(a,c,d){var e=b.parseQuery(this._parts.query,this._parts.escapeQuerySpace);b.removeQuery(e,a,c);this._parts.query=b.buildQuery(e,this._parts.duplicateQueryParameters,
this._parts.escapeQuerySpace);"string"!==typeof a&&(d=c);this.build(!d);return this};e.hasQuery=function(a,c,d){var e=b.parseQuery(this._parts.query,this._parts.escapeQuerySpace);return b.hasQuery(e,a,c,d)};e.setSearch=e.setQuery;e.addSearch=e.addQuery;e.removeSearch=e.removeQuery;e.hasSearch=e.hasQuery;e.normalize=function(){return this._parts.urn?this.normalizeProtocol(!1).normalizePath(!1).normalizeQuery(!1).normalizeFragment(!1).build():this.normalizeProtocol(!1).normalizeHostname(!1).normalizePort(!1).normalizePath(!1).normalizeQuery(!1).normalizeFragment(!1).build()};
e.normalizeProtocol=function(a){"string"===typeof this._parts.protocol&&(this._parts.protocol=this._parts.protocol.toLowerCase(),this.build(!a));return this};e.normalizeHostname=function(a){this._parts.hostname&&(this.is("IDN")&&f?this._parts.hostname=f.toASCII(this._parts.hostname):this.is("IPv6")&&n&&(this._parts.hostname=n.best(this._parts.hostname)),this._parts.hostname=this._parts.hostname.toLowerCase(),this.build(!a));return this};e.normalizePort=function(a){"string"===typeof this._parts.protocol&&
this._parts.port===b.defaultPorts[this._parts.protocol]&&(this._parts.port=null,this.build(!a));return this};e.normalizePath=function(a){var c=this._parts.path;if(!c)return this;if(this._parts.urn)return this._parts.path=b.recodeUrnPath(this._parts.path),this.build(!a),this;if("/"===this._parts.path)return this;c=b.recodePath(c);var d="";if("/"!==c.charAt(0)){var e=!0;c="/"+c}if("/.."===c.slice(-3)||"/."===c.slice(-2))c+="/";c=c.replace(/(\/(\.\/)+)|(\/\.$)/g,"/").replace(/\/{2,}/g,"/");e&&(d=c.substring(1).match(/^(\.\.\/)+/)||
"")&&(d=d[0]);for(;;){var g=c.search(/\/\.\.(\/|$)/);if(-1===g)break;else if(0===g){c=c.substring(3);continue}var f=c.substring(0,g).lastIndexOf("/");-1===f&&(f=g);c=c.substring(0,f)+c.substring(g+3)}e&&this.is("relative")&&(c=d+c.substring(1));this._parts.path=c;this.build(!a);return this};e.normalizePathname=e.normalizePath;e.normalizeQuery=function(a){"string"===typeof this._parts.query&&(this._parts.query.length?this.query(b.parseQuery(this._parts.query,this._parts.escapeQuerySpace)):this._parts.query=
null,this.build(!a));return this};e.normalizeFragment=function(a){this._parts.fragment||(this._parts.fragment=null,this.build(!a));return this};e.normalizeSearch=e.normalizeQuery;e.normalizeHash=e.normalizeFragment;e.iso8859=function(){var a=b.encode,c=b.decode;b.encode=escape;b.decode=decodeURIComponent;try{this.normalize()}finally{b.encode=a,b.decode=c}return this};e.unicode=function(){var a=b.encode,c=b.decode;b.encode=E;b.decode=unescape;try{this.normalize()}finally{b.encode=a,b.decode=c}return this};
e.readable=function(){var a=this.clone();a.username("").password("").normalize();var c="";a._parts.protocol&&(c+=a._parts.protocol+"://");a._parts.hostname&&(a.is("punycode")&&f?(c+=f.toUnicode(a._parts.hostname),a._parts.port&&(c+=":"+a._parts.port)):c+=a.host());a._parts.hostname&&a._parts.path&&"/"!==a._parts.path.charAt(0)&&(c+="/");c+=a.path(!0);if(a._parts.query){for(var d="",e=0,g=a._parts.query.split("&"),h=g.length;e<h;e++){var k=(g[e]||"").split("=");d+="&"+b.decodeQuery(k[0],this._parts.escapeQuerySpace).replace(/&/g,
"%26");void 0!==k[1]&&(d+="="+b.decodeQuery(k[1],this._parts.escapeQuerySpace).replace(/&/g,"%26"))}c+="?"+d.substring(1)}return c+=b.decodeQuery(a.hash(),!0)};e.absoluteTo=function(a){var c=this.clone(),d=["protocol","username","password","hostname","port"],e,g;if(this._parts.urn)throw Error("URNs do not have any generally defined hierarchical components");a instanceof b||(a=new b(a));if(c._parts.protocol)return c;c._parts.protocol=a._parts.protocol;if(this._parts.hostname)return c;for(e=0;g=d[e];e++)c._parts[g]=
a._parts[g];c._parts.path?(".."===c._parts.path.substring(-2)&&(c._parts.path+="/"),"/"!==c.path().charAt(0)&&(d=(d=a.directory())?d:0===a.path().indexOf("/")?"/":"",c._parts.path=(d?d+"/":"")+c._parts.path,c.normalizePath())):(c._parts.path=a._parts.path,c._parts.query||(c._parts.query=a._parts.query));c.build();return c};e.relativeTo=function(a){var c=this.clone().normalize();if(c._parts.urn)throw Error("URNs do not have any generally defined hierarchical components");a=(new b(a)).normalize();var d=
c._parts;var e=a._parts;var g=c.path();a=a.path();if("/"!==g.charAt(0))throw Error("URI is already relative");if("/"!==a.charAt(0))throw Error("Cannot calculate a URI relative to another relative URI");d.protocol===e.protocol&&(d.protocol=null);if(d.username===e.username&&d.password===e.password&&null===d.protocol&&null===d.username&&null===d.password&&d.hostname===e.hostname&&d.port===e.port)d.hostname=null,d.port=null;else return c.build();if(g===a)return d.path="",c.build();g=b.commonPath(g,a);
if(!g)return c.build();e=e.path.substring(g.length).replace(/[^\/]*$/,"").replace(/.*?\//g,"../");d.path=e+d.path.substring(g.length)||"./";return c.build()};e.equals=function(a){var c=this.clone(),d=new b(a);a={};var e;c.normalize();d.normalize();if(c.toString()===d.toString())return!0;var g=c.query();var f=d.query();c.query("");d.query("");if(c.toString()!==d.toString()||g.length!==f.length)return!1;c=b.parseQuery(g,this._parts.escapeQuerySpace);f=b.parseQuery(f,this._parts.escapeQuerySpace);for(e in c)if(t.call(c,
e)){if(!u(c[e])){if(c[e]!==f[e])return!1}else if(!D(c[e],f[e]))return!1;a[e]=!0}for(e in f)if(t.call(f,e)&&!a[e])return!1;return!0};e.preventInvalidHostname=function(a){this._parts.preventInvalidHostname=!!a;return this};e.duplicateQueryParameters=function(a){this._parts.duplicateQueryParameters=!!a;return this};e.escapeQuerySpace=function(a){this._parts.escapeQuerySpace=!!a;return this};return b});
(function(f,n){"object"===typeof module&&module.exports?module.exports=n(require("./URI")):"function"===typeof define&&define.amd?define(["./URI"],n):f.URITemplate=n(f.URI,f)})(this,function(f,n){function h(b){if(h._cache[b])return h._cache[b];if(!(this instanceof h))return new h(b);this.expression=b;h._cache[b]=this;return this}function k(b){this.data=b;this.cache={}}var b=n&&n.URITemplate,q=Object.prototype.hasOwnProperty,z=h.prototype,u={"":{prefix:"",separator:",",named:!1,empty_name_separator:!1,
encode:"encode"},"+":{prefix:"",separator:",",named:!1,empty_name_separator:!1,encode:"encodeReserved"},"#":{prefix:"#",separator:",",named:!1,empty_name_separator:!1,encode:"encodeReserved"},".":{prefix:".",separator:".",named:!1,empty_name_separator:!1,encode:"encode"},"/":{prefix:"/",separator:"/",named:!1,empty_name_separator:!1,encode:"encode"},";":{prefix:";",separator:";",named:!0,empty_name_separator:!1,encode:"encode"},"?":{prefix:"?",separator:"&",named:!0,empty_name_separator:!0,encode:"encode"},
"&":{prefix:"&",separator:"&",named:!0,empty_name_separator:!0,encode:"encode"}};h._cache={};h.EXPRESSION_PATTERN=/\{([^a-zA-Z0-9%_]?)([^\}]+)(\}|$)/g;h.VARIABLE_PATTERN=/^([^*:.](?:\.?[^*:.])*)((\*)|:(\d+))?$/;h.VARIABLE_NAME_PATTERN=/[^a-zA-Z0-9%_.]/;h.LITERAL_PATTERN=/[<>{}"`^| \\]/;h.expand=function(b,f,k){var g=u[b.operator],p=g.named?"Named":"Unnamed";b=b.variables;var n=[],r,q;for(q=0;r=b[q];q++){var w=f.get(r.name);if(0===w.type&&k&&k.strict)throw Error('Missing expansion value for variable "'+
r.name+'"');if(w.val.length){if(1<w.type&&r.maxlength)throw Error('Invalid expression: Prefix modifier not applicable to variable "'+r.name+'"');n.push(h["expand"+p](w,g,r.explode,r.explode&&g.separator||",",r.maxlength,r.name))}else w.type&&n.push("")}return n.length?g.prefix+n.join(g.separator):""};h.expandNamed=function(b,h,k,n,q,u){var g="",p=h.encode;h=h.empty_name_separator;var A=!b[p].length,e=2===b.type?"":f[p](u),t;var y=0;for(t=b.val.length;y<t;y++){if(q){var v=f[p](b.val[y][1].substring(0,
q));2===b.type&&(e=f[p](b.val[y][0].substring(0,q)))}else A?(v=f[p](b.val[y][1]),2===b.type?(e=f[p](b.val[y][0]),b[p].push([e,v])):b[p].push([void 0,v])):(v=b[p][y][1],2===b.type&&(e=b[p][y][0]));g&&(g+=n);k?g+=e+(h||v?"=":"")+v:(y||(g+=f[p](u)+(h||v?"=":"")),2===b.type&&(g+=e+","),g+=v)}return g};h.expandUnnamed=function(b,h,k,n,q){var g="",p=h.encode;h=h.empty_name_separator;var A=!b[p].length,w;var e=0;for(w=b.val.length;e<w;e++){if(q)var t=f[p](b.val[e][1].substring(0,q));else A?(t=f[p](b.val[e][1]),
b[p].push([2===b.type?f[p](b.val[e][0]):void 0,t])):t=b[p][e][1];g&&(g+=n);if(2===b.type){var u=q?f[p](b.val[e][0].substring(0,q)):b[p][e][0];g+=u;g=k?g+(h||t?"=":""):g+","}g+=t}return g};h.noConflict=function(){n.URITemplate===h&&(n.URITemplate=b);return h};z.expand=function(b,f){var g="";this.parts&&this.parts.length||this.parse();b instanceof k||(b=new k(b));for(var p=0,n=this.parts.length;p<n;p++)g+="string"===typeof this.parts[p]?this.parts[p]:h.expand(this.parts[p],b,f);return g};z.parse=function(){var b=
this.expression,f=h.EXPRESSION_PATTERN,k=h.VARIABLE_PATTERN,n=h.VARIABLE_NAME_PATTERN,q=h.LITERAL_PATTERN,z=[],r=0,C=function(b){if(b.match(q))throw Error('Invalid Literal "'+b+'"');return b};for(f.lastIndex=0;;){var w=f.exec(b);if(null===w){z.push(C(b.substring(r)));break}else z.push(C(b.substring(r,w.index))),r=w.index+w[0].length;if(!u[w[1]])throw Error('Unknown Operator "'+w[1]+'" in "'+w[0]+'"');if(!w[3])throw Error('Unclosed Expression "'+w[0]+'"');var e=w[2].split(",");for(var t=0,y=e.length;t<
y;t++){var v=e[t].match(k);if(null===v)throw Error('Invalid Variable "'+e[t]+'" in "'+w[0]+'"');if(v[1].match(n))throw Error('Invalid Variable Name "'+v[1]+'" in "'+w[0]+'"');e[t]={name:v[1],explode:!!v[3],maxlength:v[4]&&parseInt(v[4],10)}}if(!e.length)throw Error('Expression Missing Variable(s) "'+w[0]+'"');z.push({expression:w[0],operator:w[1],variables:e})}z.length||z.push(C(b));this.parts=z;return this};k.prototype.get=function(b){var f=this.data,g={type:0,val:[],encode:[],encodeReserved:[]};
if(void 0!==this.cache[b])return this.cache[b];this.cache[b]=g;f="[object Function]"===String(Object.prototype.toString.call(f))?f(b):"[object Function]"===String(Object.prototype.toString.call(f[b]))?f[b](b):f[b];if(void 0!==f&&null!==f)if("[object Array]"===String(Object.prototype.toString.call(f))){var h=0;for(b=f.length;h<b;h++)void 0!==f[h]&&null!==f[h]&&g.val.push([void 0,String(f[h])]);g.val.length&&(g.type=3)}else if("[object Object]"===String(Object.prototype.toString.call(f))){for(h in f)q.call(f,
h)&&void 0!==f[h]&&null!==f[h]&&g.val.push([h,String(f[h])]);g.val.length&&(g.type=2)}else g.type=1,g.val.push([void 0,String(f)]);return g};f.expand=function(b,k){var g=(new h(b)).expand(k);return new f(g)};return h});
