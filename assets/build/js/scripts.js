
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
  macroLib = 'doc';

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
Token.isInlineMacro = function (str, lib) {
  return callableMacros.indexOf(str) !== -1 &&
    (typeof lib === 'undefined' || lib === 'doc');
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
var TokenFactory = function (lib) {
  this.lib = lib;
};

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
  } else if(Token.isInlineMacro(rawToken, this.lib)) {
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
var Lexer = function (source, lib) {
  this.source = this.cleanSource(source)
    .split(patterns.lexeme);
  this.tokens = [];
  this.sourceIdx = 0;
  this.col = 0;
  this.line = 1;
  this.factory = new TokenFactory(lib);
};

/**
 * Performs the following tasks to the source string:
 * - Replaces bullets, em-dashes, copyright with their HTML entities
 * - Adds whitespaces between escape sequences
 * - Replaces < and > symbols with their HTML escape equivalents
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
    .replace(/\\\(bu|\\\[bu\]/g, '&bull;')
    .replace(/\\\(em|\\\[em\]/g, '&mdash;')
    .replace(/\\\(co|\\\[co\]/g, '&copy;')
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
var Parser = function (input, lib) {
  this.ast = [];
  this.scope = this.ast;
  this.lexer = new Lexer(input, lib);
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
      '<p style="display: grid; grid-template-columns: 1fr auto 1fr;">' +
      '<span>' + title + '</span>' +
      '<span style="text-align: center;">' + this.buffer.manual + '</span>' +
      '<span style="text-align: right;">' + title + '</span></p>'
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
    var result = '',
      lastDiv = this.buffer.openTags.lastIndexOf('div'),
      lastSection = this.buffer.openTags.lastIndexOf('section');

    result += this.closeAllTags(this.buffer.fontModes);

    if(lastDiv > lastSection) {
      result += this.closeTagsUntil('div', this.buffer.openTags);
    }

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
   * Start a tagged paragraph. The input line following `.TP' is used
   * as the tag, and subsequent text is rendered as the definition.
   *
   * @param {string} args
   *
   * @since 0.0.1
   *
   */
  TP: function (args) {
    var result = '',
      indent;

    args = this.parseArguments(args);
    indent = args[0] || this.buffer.style.indent;

    result += this.closeAllTags(this.buffer.fontModes);
    result += this.closeTagsUntil('div', this.buffer.openTags);

    result += '<div>';
    result += '<dl style="display: grid; grid-template-columns: ' +
      indent + 'ch 1fr; margin-bottom: 0;margin-top: 0;">';
    result += '<dt>';

    this.buffer.openTags.push('div');
    this.buffer.openTags.push('dl');
    this.buffer.openTags.push('dt');
    this.buffer.taggedParagraph = {
      indent: indent
    };

    return result;
  },

  /**
   * Start an example display.
   *
   * @since 0.0.1
   *
   */
  EX: function () {
    this.buffer.nf = 1;
    return '<pre style="font-family: monospace; white-space: pre; display: block;">';
  },

  /**
   * End an example display.
   *
   * @since 0.0.1
   *
   */
  EE: function () {
    if(this.buffer.nf) {
      this.buffer.nf = 0;
      return '</pre>';
    } else {
      return '';
    }
  },

  /**
   * Begin a command synopsis.
   *
   * @param {string} args
   *
   * @since 0.0.1
   *
   */
  SY: function (args) {
    var result = '',
      indent,
      command;

    args = this.parseArguments(args);
    command = args.join('');
    indent = command.length + 1;

    result += this.closeAllTags(this.buffer.fontModes);
    result += this.closeTagsUntil('p', this.buffer.openTags);

    this.buffer.openTags.push('p');
    this.buffer.synopsis = true;

    return result + '<p style="padding-left: ' + indent +
      'ch; text-indent: -' + indent + 'ch;"><strong>' +
      command + '</strong> ';
  },

  /**
   * End a command synopsis.
   *
   * @since 0.0.1
   *
   */
  YS: function () {
    var result = '';

    result += this.closeAllTags(this.buffer.fontModes);

    if(this.buffer.synopsis) {
      result += this.closeTagsUntil('p', this.buffer.openTags);
      this.buffer.synopsis = false;
    }

    return result;
  },

  /**
   * Start a new page.
   *
   * @since 0.0.1
   *
   */
  pa: function () {
    return '<div style="break-after: page;"></div>';
  },

  /**
   * Set a page header.
   *
   * @param {string} args
   *
   * @since 0.0.1
   *
   */
  he: function (args) {
    var header;

    header = (args || '').split("'");
    this.buffer.header = {
      left: header[1] || '',
      center: header[2] || '',
      right: header[3] || ''
    };

    return(
      '<p style="display: grid; grid-template-columns: 1fr auto 1fr;">' +
      '<span>' + this.buffer.header.left + '</span>' +
      '<span style="text-align: center;">' + this.buffer.header.center +
      '</span>' +
      '<span style="text-align: right;">' + this.buffer.header.right +
      '</span></p><br>'
    );
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
    var result = this.closeTagsUntil('section', this.buffer.openTags);

    if(this.buffer.openTags[this.buffer.openTags.length - 1] === 'div') {
      result += this.closeTagsUntil('div', this.buffer.openTags);
    }

    return result;
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
   * Temporarily indent the next line.
   *
   * @argument {string} indent
   *
   * @since 0.0.1
   *
   */
  ti: function (indent) {
    indent = indent || 0;
    this.buffer.openTags.push('div');

    return '<div style="text-indent:' + indent + 'em;">';
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
      '<p style="display: grid; grid-template-columns: 1fr auto 1fr;">' +
      '<span>' + sideText + '</span>' +
      '<span style="text-align: center;">' + midText + '</span>' +
      '<span style="text-align: right;">' + sideText +
      '</span></p><section>'
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

  lib = lib || 'doc';

  /* Global variable, used to define if a token is imacro */
  macroLib = lib;

  parser = new Parser(source, lib);
  ast = parser.buildAST();

  this.macros = mergeObjects([macros.defaults, macros[lib]]);

  this.buffer = {
    style: {
      indent: 8,
      lineLength: '6.5in',
      fontSize: 16
    },
    references: [],
    lists: [],
    openTags: [],
    fontModes: [],
    sectionTags: [],
    activeFontModes: [],
    taggedParagraph: null,
    section: ''
  };

  return this.wrapOutput(this.recurse(ast));
};

/**
 * Wrap generated HTML in a centered page-width container.
 *
 * @param {string} html
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.wrapOutput = function (html) {
  return '<main style="max-width: ' + this.buffer.style.lineLength +
    '; margin: 1in 0 1in 1in;">' + html + '</main>';
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

  if(this.buffer.taggedParagraph) {
    result += this.reduceTaggedParagraph(node);
    return result;
  }

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
 * Handles the line following a `.TP' macro as the paragraph tag.
 *
 * @param {token} node
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.reduceTaggedParagraph = function (node) {
  var state = this.buffer.taggedParagraph,
    value,
    result;

  if(node.kind !== TEXT) {
    state.started = true;
    this.buffer.taggedParagraph = null;
    result = this.reduceRecursive('', node);
    this.buffer.taggedParagraph = state;
    return result;
  }

  value = this.cleanQuotes(node.value);

  if(value.trim() === '' && !state.started) {
    return '';
  }

  if(value.trim() === '') {
    this.buffer.taggedParagraph = null;
    this.buffer.openTags.pop();
    this.buffer.openTags.push('dd');

    return this.closeAllTags(this.buffer.fontModes) +
      '</dt><dd style="margin-left: 0;">';
  }

  state.started = true;

  return value;
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
    var query = {};
    console.log('parsedURI ' + parsedURI);
    if (parsedURI.query) {
      query = URI.parseQuery(parsedURI.query);
      console.log('Query: ' + query);
      if (query.src)
	url = query.src;
    }
    this.sourceName = query.name || '';
    this.sourceLink = query.link || '';
    this.parser = ManView.Services.TextParser.new();
    var request = new XMLHttpRequest();
    console.log('Fetching ' + url);
    request.open('GET', url);
    request.responseType = 'text';
    request.onload = function() {
      var etag = request.getResponseHeader('ETag');
      var dispatchSource = function(fingerprint) {
        var customEvent = new CustomEvent("source:retrieved", {
	  "detail": {
	    text: request.response,
	    lastModified: request.getResponseHeader('Last-Modified'),
	    etag: etag || fingerprint
	  }
        });

        document.dispatchEvent(customEvent);
        console.log("Received " + request.response.length + " bytes");
      };

      if (etag) {
        dispatchSource(etag);
	return;
      }

      this.computeTextSha256(request.response)
	.then(dispatchSource)
	.catch(function() {
	  dispatchSource('');
	});
    }.bind(this);
    request.send();
  },

  computeTextSha256: function(text) {
    var bytes;

    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      return Promise.reject();
    }

    bytes = new TextEncoder().encode(text);

    return window.crypto.subtle.digest('SHA-256', bytes)
      .then(function(hash) {
	return Array.prototype.map.call(new Uint8Array(hash), function(byte) {
	  return ('00' + byte.toString(16)).slice(-2);
	}).join('');
      });
  },

  channels: {
    'source:retrieved': 'refreshChannel',
  },

  refreshChannel: function(e) {
    var text = e.detail.text;
    var hasHeader = text.search(/^\.(TH|Dt)\b/m) != -1;
    var html;
    console.log("Source text length: " + text.length);
    if (text.search(".Dd") != -1)
      this.parser.setMacroLib("doc");
    html = this.parser.parseGroff(text);
    this.renderManual(html, hasHeader);
    this.setFooter(e.detail.lastModified, e.detail.etag);
    console.log("HTML length: " + this.el.innerHTML.length);
  },

  renderManual: function(html, hasHeader) {
    var container = document.createElement('div');
    var header;

    container.innerHTML = html;
    header = container.querySelector('p:first-of-type');

    if (hasHeader && header) {
      if (this.sourceLink) {
	this.linkHeaderSpans(header);
      }
      this.setTopBar(header);
      header.parentNode.removeChild(header);
    } else if (this.sourceName) {
      this.setTopBar(this.createFallbackHeader());
    }

    this.el.innerHTML = container.innerHTML;
  },

  setTopBar: function(header) {
    var title = document.querySelector('[data-behavior="set-title"]');

    if (title) {
      title.innerHTML = header.innerHTML;
    }
  },

  setFooter: function(lastModified, etag) {
    var footerDate = document.querySelector('[data-role="manual-date"]');
    var footerEtag = document.querySelector('[data-role="manual-etag"]');
    var date = lastModified ? new Date(lastModified) : new Date();

    if (isNaN(date.getTime())) {
      date = new Date();
    }

    if (footerDate) {
      footerDate.textContent = this.formatIsoDate(date);
    }
    if (footerEtag) {
      footerEtag.textContent = etag ? 'etag: ' + this.cleanEtag(etag).slice(0, 6) : '';
    }
  },

  cleanEtag: function(etag) {
    return etag.replace(/^W\//, '').replace(/"/g, '');
  },

  formatIsoDate: function(date) {
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());

    if (month.length < 2) {
      month = '0' + month;
    }
    if (day.length < 2) {
      day = '0' + day;
    }

    return date.getFullYear() + '-' + month + '-' + day;
  },

  linkHeaderSpans: function(header) {
    var spans = header.querySelectorAll('span');
    var i;

    for (i = 0; i < spans.length; i++) {
      this.wrapContentsWithLink(spans[i]);
    }
  },

  wrapContentsWithLink: function(element) {
    var link = document.createElement('a');

    link.href = this.sourceLink;
    while (element.firstChild) {
      link.appendChild(element.firstChild);
    }
    element.appendChild(link);
  },

  createFallbackHeader: function() {
    var header = document.createElement('p');
    var span = document.createElement('span');

    header.className = 'manual-header';

    if (this.sourceLink) {
      span.appendChild(this.createSourceLink(this.sourceName));
    } else {
      span.textContent = this.sourceName;
    }

    header.appendChild(span);
    return header;
  },

  createSourceLink: function(text) {
    var link = document.createElement('a');

    link.href = this.sourceLink;
    link.textContent = text;

    return link;
  },

});
;// -------------------------------------------
//   Set title
// -------------------------------------------

ManView.Behaviors.SetTitle = Essential.Behavior.extend({
  priority: 1,

  init: function() {
    this.el.innerHTML = "<a href='https://github.com/dspinellis/manview'>manview</a>";
  },

});
;/*! URI.js v1.19.11 http://medialize.github.io/URI.js/ */
/* build contains: IPv6.js, punycode.js, SecondLevelDomains.js, URI.js, URITemplate.js */
(function(r,x){"object"===typeof module&&module.exports?module.exports=x():"function"===typeof define&&define.amd?define(x):r.IPv6=x(r)})(this,function(r){var x=r&&r.IPv6;return{best:function(k){k=k.toLowerCase().split(":");var m=k.length,d=8;""===k[0]&&""===k[1]&&""===k[2]?(k.shift(),k.shift()):""===k[0]&&""===k[1]?k.shift():""===k[m-1]&&""===k[m-2]&&k.pop();m=k.length;-1!==k[m-1].indexOf(".")&&(d=7);var q;for(q=0;q<m&&""!==k[q];q++);if(q<d)for(k.splice(q,1,"0000");k.length<d;)k.splice(q,0,"0000");
for(q=0;q<d;q++){m=k[q].split("");for(var E=0;3>E;E++)if("0"===m[0]&&1<m.length)m.splice(0,1);else break;k[q]=m.join("")}m=-1;var A=E=0,h=-1,p=!1;for(q=0;q<d;q++)p?"0"===k[q]?A+=1:(p=!1,A>E&&(m=h,E=A)):"0"===k[q]&&(p=!0,h=q,A=1);A>E&&(m=h,E=A);1<E&&k.splice(m,E,"");m=k.length;d="";""===k[0]&&(d=":");for(q=0;q<m;q++){d+=k[q];if(q===m-1)break;d+=":"}""===k[m-1]&&(d+=":");return d},noConflict:function(){r.IPv6===this&&(r.IPv6=x);return this}}});
(function(r){function x(l){throw new RangeError(H[l]);}function k(l,t){for(var C=l.length,y=[];C--;)y[C]=t(l[C]);return y}function m(l,t){var C=l.split("@"),y="";1<C.length&&(y=C[0]+"@",l=C[1]);l=l.replace(w,".");C=l.split(".");C=k(C,t).join(".");return y+C}function d(l){for(var t=[],C=0,y=l.length,J,M;C<y;)J=l.charCodeAt(C++),55296<=J&&56319>=J&&C<y?(M=l.charCodeAt(C++),56320==(M&64512)?t.push(((J&1023)<<10)+(M&1023)+65536):(t.push(J),C--)):t.push(J);return t}function q(l){return k(l,function(t){var C=
"";65535<t&&(t-=65536,C+=g(t>>>10&1023|55296),t=56320|t&1023);return C+=g(t)}).join("")}function E(l,t,C){var y=0;l=C?v(l/700):l>>1;for(l+=v(l/t);455<l;y+=36)l=v(l/35);return v(y+36*l/(l+38))}function A(l){var t=[],C=l.length,y=0,J=128,M=72,a,b;var c=l.lastIndexOf("-");0>c&&(c=0);for(a=0;a<c;++a)128<=l.charCodeAt(a)&&x("not-basic"),t.push(l.charCodeAt(a));for(c=0<c?c+1:0;c<C;){a=y;var e=1;for(b=36;;b+=36){c>=C&&x("invalid-input");var f=l.charCodeAt(c++);f=10>f-48?f-22:26>f-65?f-65:26>f-97?f-97:36;
(36<=f||f>v((2147483647-y)/e))&&x("overflow");y+=f*e;var n=b<=M?1:b>=M+26?26:b-M;if(f<n)break;f=36-n;e>v(2147483647/f)&&x("overflow");e*=f}e=t.length+1;M=E(y-a,e,0==a);v(y/e)>2147483647-J&&x("overflow");J+=v(y/e);y%=e;t.splice(y++,0,J)}return q(t)}function h(l){var t,C,y,J=[];l=d(l);var M=l.length;var a=128;var b=0;var c=72;for(y=0;y<M;++y){var e=l[y];128>e&&J.push(g(e))}for((t=C=J.length)&&J.push("-");t<M;){var f=2147483647;for(y=0;y<M;++y)e=l[y],e>=a&&e<f&&(f=e);var n=t+1;f-a>v((2147483647-b)/n)&&
x("overflow");b+=(f-a)*n;a=f;for(y=0;y<M;++y)if(e=l[y],e<a&&2147483647<++b&&x("overflow"),e==a){var z=b;for(f=36;;f+=36){e=f<=c?1:f>=c+26?26:f-c;if(z<e)break;var I=z-e;z=36-e;var L=J;e+=I%z;L.push.call(L,g(e+22+75*(26>e)-0));z=v(I/z)}J.push(g(z+22+75*(26>z)-0));c=E(b,n,t==C);b=0;++t}++b;++a}return J.join("")}var p="object"==typeof exports&&exports&&!exports.nodeType&&exports,D="object"==typeof module&&module&&!module.nodeType&&module,u="object"==typeof global&&global;if(u.global===u||u.window===u||
u.self===u)r=u;var K=/^xn--/,F=/[^\x20-\x7E]/,w=/[\x2E\u3002\uFF0E\uFF61]/g,H={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},v=Math.floor,g=String.fromCharCode,B;var G={version:"1.3.2",ucs2:{decode:d,encode:q},decode:A,encode:h,toASCII:function(l){return m(l,function(t){return F.test(t)?"xn--"+h(t):t})},toUnicode:function(l){return m(l,function(t){return K.test(t)?A(t.slice(4).toLowerCase()):
t})}};if("function"==typeof define&&"object"==typeof define.amd&&define.amd)define("punycode",function(){return G});else if(p&&D)if(module.exports==p)D.exports=G;else for(B in G)G.hasOwnProperty(B)&&(p[B]=G[B]);else r.punycode=G})(this);
(function(r,x){"object"===typeof module&&module.exports?module.exports=x():"function"===typeof define&&define.amd?define(x):r.SecondLevelDomains=x(r)})(this,function(r){var x=r&&r.SecondLevelDomains,k={list:{ac:" com gov mil net org ",ae:" ac co gov mil name net org pro sch ",af:" com edu gov net org ",al:" com edu gov mil net org ",ao:" co ed gv it og pb ",ar:" com edu gob gov int mil net org tur ",at:" ac co gv or ",au:" asn com csiro edu gov id net org ",ba:" co com edu gov mil net org rs unbi unmo unsa untz unze ",
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
org:"ae",de:"com "},has:function(m){var d=m.lastIndexOf(".");if(0>=d||d>=m.length-1)return!1;var q=m.lastIndexOf(".",d-1);if(0>=q||q>=d-1)return!1;var E=k.list[m.slice(d+1)];return E?0<=E.indexOf(" "+m.slice(q+1,d)+" "):!1},is:function(m){var d=m.lastIndexOf(".");if(0>=d||d>=m.length-1||0<=m.lastIndexOf(".",d-1))return!1;var q=k.list[m.slice(d+1)];return q?0<=q.indexOf(" "+m.slice(0,d)+" "):!1},get:function(m){var d=m.lastIndexOf(".");if(0>=d||d>=m.length-1)return null;var q=m.lastIndexOf(".",d-1);
if(0>=q||q>=d-1)return null;var E=k.list[m.slice(d+1)];return!E||0>E.indexOf(" "+m.slice(q+1,d)+" ")?null:m.slice(q+1)},noConflict:function(){r.SecondLevelDomains===this&&(r.SecondLevelDomains=x);return this}};return k});
(function(r,x){"object"===typeof module&&module.exports?module.exports=x(require("./punycode"),require("./IPv6"),require("./SecondLevelDomains")):"function"===typeof define&&define.amd?define(["./punycode","./IPv6","./SecondLevelDomains"],x):r.URI=x(r.punycode,r.IPv6,r.SecondLevelDomains,r)})(this,function(r,x,k,m){function d(a,b){var c=1<=arguments.length,e=2<=arguments.length;if(!(this instanceof d))return c?e?new d(a,b):new d(a):new d;if(void 0===a){if(c)throw new TypeError("undefined is not a valid argument for URI");
a="undefined"!==typeof location?location.href+"":""}if(null===a&&c)throw new TypeError("null is not a valid argument for URI");this.href(a);return void 0!==b?this.absoluteTo(b):this}function q(a){return a.replace(/([.*+?^=!:${}()|[\]\/\\])/g,"\\$1")}function E(a){return void 0===a?"Undefined":String(Object.prototype.toString.call(a)).slice(8,-1)}function A(a){return"Array"===E(a)}function h(a,b){var c={},e;if("RegExp"===E(b))c=null;else if(A(b)){var f=0;for(e=b.length;f<e;f++)c[b[f]]=!0}else c[b]=
!0;f=0;for(e=a.length;f<e;f++)if(c&&void 0!==c[a[f]]||!c&&b.test(a[f]))a.splice(f,1),e--,f--;return a}function p(a,b){var c;if(A(b)){var e=0;for(c=b.length;e<c;e++)if(!p(a,b[e]))return!1;return!0}var f=E(b);e=0;for(c=a.length;e<c;e++)if("RegExp"===f){if("string"===typeof a[e]&&a[e].match(b))return!0}else if(a[e]===b)return!0;return!1}function D(a,b){if(!A(a)||!A(b)||a.length!==b.length)return!1;a.sort();b.sort();for(var c=0,e=a.length;c<e;c++)if(a[c]!==b[c])return!1;return!0}function u(a){return a.replace(/^\/+|\/+$/g,
"")}function K(a){return escape(a)}function F(a){return encodeURIComponent(a).replace(/[!'()*]/g,K).replace(/\*/g,"%2A")}function w(a){return function(b,c){if(void 0===b)return this._parts[a]||"";this._parts[a]=b||null;this.build(!c);return this}}function H(a,b){return function(c,e){if(void 0===c)return this._parts[a]||"";null!==c&&(c+="",c.charAt(0)===b&&(c=c.substring(1)));this._parts[a]=c;this.build(!e);return this}}var v=m&&m.URI;d.version="1.19.11";var g=d.prototype,B=Object.prototype.hasOwnProperty;
d._parts=function(){return{protocol:null,username:null,password:null,hostname:null,urn:null,port:null,path:null,query:null,fragment:null,preventInvalidHostname:d.preventInvalidHostname,duplicateQueryParameters:d.duplicateQueryParameters,escapeQuerySpace:d.escapeQuerySpace}};d.preventInvalidHostname=!1;d.duplicateQueryParameters=!1;d.escapeQuerySpace=!0;d.protocol_expression=/^[a-z][a-z0-9.+-]*$/i;d.idn_expression=/[^a-z0-9\._-]/i;d.punycode_expression=/(xn--)/i;d.ip4_expression=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
d.ip6_expression=/^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/;
d.find_uri_expression=/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?\u00ab\u00bb\u201c\u201d\u2018\u2019]))/ig;d.findUri={start:/\b(?:([a-z][a-z0-9.+-]*:\/\/)|www\.)/gi,end:/[\s\r\n]|$/,trim:/[`!()\[\]{};:'".,<>?\u00ab\u00bb\u201c\u201d\u201e\u2018\u2019]+$/,parens:/(\([^\)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>)/g};d.leading_whitespace_expression=/^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
d.ascii_tab_whitespace=/[\u0009\u000A\u000D]+/g;d.defaultPorts={http:"80",https:"443",ftp:"21",gopher:"70",ws:"80",wss:"443"};d.hostProtocols=["http","https"];d.invalid_hostname_characters=/[^a-zA-Z0-9\.\-:_]/;d.domAttributes={a:"href",blockquote:"cite",link:"href",base:"href",script:"src",form:"action",img:"src",area:"href",iframe:"src",embed:"src",source:"src",track:"src",input:"src",audio:"src",video:"src"};d.getDomAttribute=function(a){if(a&&a.nodeName){var b=a.nodeName.toLowerCase();if("input"!==
b||"image"===a.type)return d.domAttributes[b]}};d.encode=F;d.decode=decodeURIComponent;d.iso8859=function(){d.encode=escape;d.decode=unescape};d.unicode=function(){d.encode=F;d.decode=decodeURIComponent};d.characters={pathname:{encode:{expression:/%(24|26|2B|2C|3B|3D|3A|40)/ig,map:{"%24":"$","%26":"&","%2B":"+","%2C":",","%3B":";","%3D":"=","%3A":":","%40":"@"}},decode:{expression:/[\/\?#]/g,map:{"/":"%2F","?":"%3F","#":"%23"}}},reserved:{encode:{expression:/%(21|23|24|26|27|28|29|2A|2B|2C|2F|3A|3B|3D|3F|40|5B|5D)/ig,
map:{"%3A":":","%2F":"/","%3F":"?","%23":"#","%5B":"[","%5D":"]","%40":"@","%21":"!","%24":"$","%26":"&","%27":"'","%28":"(","%29":")","%2A":"*","%2B":"+","%2C":",","%3B":";","%3D":"="}}},urnpath:{encode:{expression:/%(21|24|27|28|29|2A|2B|2C|3B|3D|40)/ig,map:{"%21":"!","%24":"$","%27":"'","%28":"(","%29":")","%2A":"*","%2B":"+","%2C":",","%3B":";","%3D":"=","%40":"@"}},decode:{expression:/[\/\?#:]/g,map:{"/":"%2F","?":"%3F","#":"%23",":":"%3A"}}}};d.encodeQuery=function(a,b){var c=d.encode(a+"");
void 0===b&&(b=d.escapeQuerySpace);return b?c.replace(/%20/g,"+"):c};d.decodeQuery=function(a,b){a+="";void 0===b&&(b=d.escapeQuerySpace);try{return d.decode(b?a.replace(/\+/g,"%20"):a)}catch(c){return a}};var G={encode:"encode",decode:"decode"},l,t=function(a,b){return function(c){try{return d[b](c+"").replace(d.characters[a][b].expression,function(e){return d.characters[a][b].map[e]})}catch(e){return c}}};for(l in G)d[l+"PathSegment"]=t("pathname",G[l]),d[l+"UrnPathSegment"]=t("urnpath",G[l]);G=
function(a,b,c){return function(e){var f=c?function(I){return d[b](d[c](I))}:d[b];e=(e+"").split(a);for(var n=0,z=e.length;n<z;n++)e[n]=f(e[n]);return e.join(a)}};d.decodePath=G("/","decodePathSegment");d.decodeUrnPath=G(":","decodeUrnPathSegment");d.recodePath=G("/","encodePathSegment","decode");d.recodeUrnPath=G(":","encodeUrnPathSegment","decode");d.encodeReserved=t("reserved","encode");d.parse=function(a,b){b||(b={preventInvalidHostname:d.preventInvalidHostname});a=a.replace(d.leading_whitespace_expression,
"");a=a.replace(d.ascii_tab_whitespace,"");var c=a.indexOf("#");-1<c&&(b.fragment=a.substring(c+1)||null,a=a.substring(0,c));c=a.indexOf("?");-1<c&&(b.query=a.substring(c+1)||null,a=a.substring(0,c));a=a.replace(/^(https?|ftp|wss?)?:+[/\\]*/i,"$1://");a=a.replace(/^[/\\]{2,}/i,"//");"//"===a.substring(0,2)?(b.protocol=null,a=a.substring(2),a=d.parseAuthority(a,b)):(c=a.indexOf(":"),-1<c&&(b.protocol=a.substring(0,c)||null,b.protocol&&!b.protocol.match(d.protocol_expression)?b.protocol=void 0:"//"===
a.substring(c+1,c+3).replace(/\\/g,"/")?(a=a.substring(c+3),a=d.parseAuthority(a,b)):(a=a.substring(c+1),b.urn=!0)));b.path=a;return b};d.parseHost=function(a,b){a||(a="");a=a.replace(/\\/g,"/");var c=a.indexOf("/");-1===c&&(c=a.length);if("["===a.charAt(0)){var e=a.indexOf("]");b.hostname=a.substring(1,e)||null;b.port=a.substring(e+2,c)||null;"/"===b.port&&(b.port=null)}else{var f=a.indexOf(":");e=a.indexOf("/");f=a.indexOf(":",f+1);-1!==f&&(-1===e||f<e)?(b.hostname=a.substring(0,c)||null,b.port=
null):(e=a.substring(0,c).split(":"),b.hostname=e[0]||null,b.port=e[1]||null)}b.hostname&&"/"!==a.substring(c).charAt(0)&&(c++,a="/"+a);b.preventInvalidHostname&&d.ensureValidHostname(b.hostname,b.protocol);b.port&&d.ensureValidPort(b.port);return a.substring(c)||"/"};d.parseAuthority=function(a,b){a=d.parseUserinfo(a,b);return d.parseHost(a,b)};d.parseUserinfo=function(a,b){var c=a;-1!==a.indexOf("\\")&&(a=a.replace(/\\/g,"/"));var e=a.indexOf("/"),f=a.lastIndexOf("@",-1<e?e:a.length-1);-1<f&&(-1===
e||f<e)?(e=a.substring(0,f).split(":"),b.username=e[0]?d.decode(e[0]):null,e.shift(),b.password=e[0]?d.decode(e.join(":")):null,a=c.substring(f+1)):(b.username=null,b.password=null);return a};d.parseQuery=function(a,b){if(!a)return{};a=a.replace(/&+/g,"&").replace(/^\?*&*|&+$/g,"");if(!a)return{};for(var c={},e=a.split("&"),f=e.length,n,z,I=0;I<f;I++)if(n=e[I].split("="),z=d.decodeQuery(n.shift(),b),n=n.length?d.decodeQuery(n.join("="),b):null,"__proto__"!==z)if(B.call(c,z)){if("string"===typeof c[z]||
null===c[z])c[z]=[c[z]];c[z].push(n)}else c[z]=n;return c};d.build=function(a){var b="",c=!1;a.protocol&&(b+=a.protocol+":");a.urn||!b&&!a.hostname||(b+="//",c=!0);b+=d.buildAuthority(a)||"";"string"===typeof a.path&&("/"!==a.path.charAt(0)&&c&&(b+="/"),b+=a.path);"string"===typeof a.query&&a.query&&(b+="?"+a.query);"string"===typeof a.fragment&&a.fragment&&(b+="#"+a.fragment);return b};d.buildHost=function(a){var b="";if(a.hostname)b=d.ip6_expression.test(a.hostname)?b+("["+a.hostname+"]"):b+a.hostname;
else return"";a.port&&(b+=":"+a.port);return b};d.buildAuthority=function(a){return d.buildUserinfo(a)+d.buildHost(a)};d.buildUserinfo=function(a){var b="";a.username&&(b+=d.encode(a.username));a.password&&(b+=":"+d.encode(a.password));b&&(b+="@");return b};d.buildQuery=function(a,b,c){var e="",f,n;for(f in a)if("__proto__"!==f&&B.call(a,f))if(A(a[f])){var z={};var I=0;for(n=a[f].length;I<n;I++)void 0!==a[f][I]&&void 0===z[a[f][I]+""]&&(e+="&"+d.buildQueryParameter(f,a[f][I],c),!0!==b&&(z[a[f][I]+
""]=!0))}else void 0!==a[f]&&(e+="&"+d.buildQueryParameter(f,a[f],c));return e.substring(1)};d.buildQueryParameter=function(a,b,c){return d.encodeQuery(a,c)+(null!==b?"="+d.encodeQuery(b,c):"")};d.addQuery=function(a,b,c){if("object"===typeof b)for(var e in b)B.call(b,e)&&d.addQuery(a,e,b[e]);else if("string"===typeof b)void 0===a[b]?a[b]=c:("string"===typeof a[b]&&(a[b]=[a[b]]),A(c)||(c=[c]),a[b]=(a[b]||[]).concat(c));else throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");
};d.setQuery=function(a,b,c){if("object"===typeof b)for(var e in b)B.call(b,e)&&d.setQuery(a,e,b[e]);else if("string"===typeof b)a[b]=void 0===c?null:c;else throw new TypeError("URI.setQuery() accepts an object, string as the name parameter");};d.removeQuery=function(a,b,c){var e;if(A(b))for(c=0,e=b.length;c<e;c++)a[b[c]]=void 0;else if("RegExp"===E(b))for(e in a)b.test(e)&&(a[e]=void 0);else if("object"===typeof b)for(e in b)B.call(b,e)&&d.removeQuery(a,e,b[e]);else if("string"===typeof b)void 0!==
c?"RegExp"===E(c)?!A(a[b])&&c.test(a[b])?a[b]=void 0:a[b]=h(a[b],c):a[b]!==String(c)||A(c)&&1!==c.length?A(a[b])&&(a[b]=h(a[b],c)):a[b]=void 0:a[b]=void 0;else throw new TypeError("URI.removeQuery() accepts an object, string, RegExp as the first parameter");};d.hasQuery=function(a,b,c,e){switch(E(b)){case "String":break;case "RegExp":for(var f in a)if(B.call(a,f)&&b.test(f)&&(void 0===c||d.hasQuery(a,f,c)))return!0;return!1;case "Object":for(var n in b)if(B.call(b,n)&&!d.hasQuery(a,n,b[n]))return!1;
return!0;default:throw new TypeError("URI.hasQuery() accepts a string, regular expression or object as the name parameter");}switch(E(c)){case "Undefined":return b in a;case "Boolean":return a=!(A(a[b])?!a[b].length:!a[b]),c===a;case "Function":return!!c(a[b],b,a);case "Array":return A(a[b])?(e?p:D)(a[b],c):!1;case "RegExp":return A(a[b])?e?p(a[b],c):!1:!(!a[b]||!a[b].match(c));case "Number":c=String(c);case "String":return A(a[b])?e?p(a[b],c):!1:a[b]===c;default:throw new TypeError("URI.hasQuery() accepts undefined, boolean, string, number, RegExp, Function as the value parameter");
}};d.joinPaths=function(){for(var a=[],b=[],c=0,e=0;e<arguments.length;e++){var f=new d(arguments[e]);a.push(f);f=f.segment();for(var n=0;n<f.length;n++)"string"===typeof f[n]&&b.push(f[n]),f[n]&&c++}if(!b.length||!c)return new d("");b=(new d("")).segment(b);""!==a[0].path()&&"/"!==a[0].path().slice(0,1)||b.path("/"+b.path());return b.normalize()};d.commonPath=function(a,b){var c=Math.min(a.length,b.length),e;for(e=0;e<c;e++)if(a.charAt(e)!==b.charAt(e)){e--;break}if(1>e)return a.charAt(0)===b.charAt(0)&&
"/"===a.charAt(0)?"/":"";if("/"!==a.charAt(e)||"/"!==b.charAt(e))e=a.substring(0,e).lastIndexOf("/");return a.substring(0,e+1)};d.withinString=function(a,b,c){c||(c={});var e=c.start||d.findUri.start,f=c.end||d.findUri.end,n=c.trim||d.findUri.trim,z=c.parens||d.findUri.parens,I=/[a-z0-9-]=["']?$/i;for(e.lastIndex=0;;){var L=e.exec(a);if(!L)break;var P=L.index;if(c.ignoreHtml){var N=a.slice(Math.max(P-3,0),P);if(N&&I.test(N))continue}var O=P+a.slice(P).search(f);N=a.slice(P,O);for(O=-1;;){var Q=z.exec(N);
if(!Q)break;O=Math.max(O,Q.index+Q[0].length)}N=-1<O?N.slice(0,O)+N.slice(O).replace(n,""):N.replace(n,"");N.length<=L[0].length||c.ignore&&c.ignore.test(N)||(O=P+N.length,L=b(N,P,O,a),void 0===L?e.lastIndex=O:(L=String(L),a=a.slice(0,P)+L+a.slice(O),e.lastIndex=P+L.length))}e.lastIndex=0;return a};d.ensureValidHostname=function(a,b){var c=!!a,e=!1;b&&(e=p(d.hostProtocols,b));if(e&&!c)throw new TypeError("Hostname cannot be empty, if protocol is "+b);if(a&&a.match(d.invalid_hostname_characters)){if(!r)throw new TypeError('Hostname "'+
a+'" contains characters other than [A-Z0-9.-:_] and Punycode.js is not available');if(r.toASCII(a).match(d.invalid_hostname_characters))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-:_]');}};d.ensureValidPort=function(a){if(a){var b=Number(a);if(!(/^[0-9]+$/.test(b)&&0<b&&65536>b))throw new TypeError('Port "'+a+'" is not a valid port');}};d.noConflict=function(a){if(a)return a={URI:this.noConflict()},m.URITemplate&&"function"===typeof m.URITemplate.noConflict&&(a.URITemplate=
m.URITemplate.noConflict()),m.IPv6&&"function"===typeof m.IPv6.noConflict&&(a.IPv6=m.IPv6.noConflict()),m.SecondLevelDomains&&"function"===typeof m.SecondLevelDomains.noConflict&&(a.SecondLevelDomains=m.SecondLevelDomains.noConflict()),a;m.URI===this&&(m.URI=v);return this};g.build=function(a){if(!0===a)this._deferred_build=!0;else if(void 0===a||this._deferred_build)this._string=d.build(this._parts),this._deferred_build=!1;return this};g.clone=function(){return new d(this)};g.valueOf=g.toString=
function(){return this.build(!1)._string};g.protocol=w("protocol");g.username=w("username");g.password=w("password");g.hostname=w("hostname");g.port=w("port");g.query=H("query","?");g.fragment=H("fragment","#");g.search=function(a,b){var c=this.query(a,b);return"string"===typeof c&&c.length?"?"+c:c};g.hash=function(a,b){var c=this.fragment(a,b);return"string"===typeof c&&c.length?"#"+c:c};g.pathname=function(a,b){if(void 0===a||!0===a){var c=this._parts.path||(this._parts.hostname?"/":"");return a?
(this._parts.urn?d.decodeUrnPath:d.decodePath)(c):c}this._parts.path=this._parts.urn?a?d.recodeUrnPath(a):"":a?d.recodePath(a):"/";this.build(!b);return this};g.path=g.pathname;g.href=function(a,b){var c;if(void 0===a)return this.toString();this._string="";this._parts=d._parts();var e=a instanceof d,f="object"===typeof a&&(a.hostname||a.path||a.pathname);a.nodeName&&(f=d.getDomAttribute(a),a=a[f]||"",f=!1);!e&&f&&void 0!==a.pathname&&(a=a.toString());if("string"===typeof a||a instanceof String)this._parts=
d.parse(String(a),this._parts);else if(e||f){e=e?a._parts:a;for(c in e)"query"!==c&&B.call(this._parts,c)&&(this._parts[c]=e[c]);e.query&&this.query(e.query,!1)}else throw new TypeError("invalid input");this.build(!b);return this};g.is=function(a){var b=!1,c=!1,e=!1,f=!1,n=!1,z=!1,I=!1,L=!this._parts.urn;this._parts.hostname&&(L=!1,c=d.ip4_expression.test(this._parts.hostname),e=d.ip6_expression.test(this._parts.hostname),b=c||e,n=(f=!b)&&k&&k.has(this._parts.hostname),z=f&&d.idn_expression.test(this._parts.hostname),
I=f&&d.punycode_expression.test(this._parts.hostname));switch(a.toLowerCase()){case "relative":return L;case "absolute":return!L;case "domain":case "name":return f;case "sld":return n;case "ip":return b;case "ip4":case "ipv4":case "inet4":return c;case "ip6":case "ipv6":case "inet6":return e;case "idn":return z;case "url":return!this._parts.urn;case "urn":return!!this._parts.urn;case "punycode":return I}return null};var C=g.protocol,y=g.port,J=g.hostname;g.protocol=function(a,b){if(a&&(a=a.replace(/:(\/\/)?$/,
""),!a.match(d.protocol_expression)))throw new TypeError('Protocol "'+a+"\" contains characters other than [A-Z0-9.+-] or doesn't start with [A-Z]");return C.call(this,a,b)};g.scheme=g.protocol;g.port=function(a,b){if(this._parts.urn)return void 0===a?"":this;void 0!==a&&(0===a&&(a=null),a&&(a+="",":"===a.charAt(0)&&(a=a.substring(1)),d.ensureValidPort(a)));return y.call(this,a,b)};g.hostname=function(a,b){if(this._parts.urn)return void 0===a?"":this;if(void 0!==a){var c={preventInvalidHostname:this._parts.preventInvalidHostname};
if("/"!==d.parseHost(a,c))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-]');a=c.hostname;this._parts.preventInvalidHostname&&d.ensureValidHostname(a,this._parts.protocol)}return J.call(this,a,b)};g.origin=function(a,b){if(this._parts.urn)return void 0===a?"":this;if(void 0===a){var c=this.protocol();return this.authority()?(c?c+"://":"")+this.authority():""}c=d(a);this.protocol(c.protocol()).authority(c.authority()).build(!b);return this};g.host=function(a,b){if(this._parts.urn)return void 0===
a?"":this;if(void 0===a)return this._parts.hostname?d.buildHost(this._parts):"";if("/"!==d.parseHost(a,this._parts))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-]');this.build(!b);return this};g.authority=function(a,b){if(this._parts.urn)return void 0===a?"":this;if(void 0===a)return this._parts.hostname?d.buildAuthority(this._parts):"";if("/"!==d.parseAuthority(a,this._parts))throw new TypeError('Hostname "'+a+'" contains characters other than [A-Z0-9.-]');this.build(!b);
return this};g.userinfo=function(a,b){if(this._parts.urn)return void 0===a?"":this;if(void 0===a){var c=d.buildUserinfo(this._parts);return c?c.substring(0,c.length-1):c}"@"!==a[a.length-1]&&(a+="@");d.parseUserinfo(a,this._parts);this.build(!b);return this};g.resource=function(a,b){if(void 0===a)return this.path()+this.search()+this.hash();var c=d.parse(a);this._parts.path=c.path;this._parts.query=c.query;this._parts.fragment=c.fragment;this.build(!b);return this};g.subdomain=function(a,b){if(this._parts.urn)return void 0===
a?"":this;if(void 0===a){if(!this._parts.hostname||this.is("IP"))return"";var c=this._parts.hostname.length-this.domain().length-1;return this._parts.hostname.substring(0,c)||""}c=this._parts.hostname.length-this.domain().length;c=this._parts.hostname.substring(0,c);c=new RegExp("^"+q(c));a&&"."!==a.charAt(a.length-1)&&(a+=".");if(-1!==a.indexOf(":"))throw new TypeError("Domains cannot contain colons");a&&d.ensureValidHostname(a,this._parts.protocol);this._parts.hostname=this._parts.hostname.replace(c,
a);this.build(!b);return this};g.domain=function(a,b){if(this._parts.urn)return void 0===a?"":this;"boolean"===typeof a&&(b=a,a=void 0);if(void 0===a){if(!this._parts.hostname||this.is("IP"))return"";var c=this._parts.hostname.match(/\./g);if(c&&2>c.length)return this._parts.hostname;c=this._parts.hostname.length-this.tld(b).length-1;c=this._parts.hostname.lastIndexOf(".",c-1)+1;return this._parts.hostname.substring(c)||""}if(!a)throw new TypeError("cannot set domain empty");if(-1!==a.indexOf(":"))throw new TypeError("Domains cannot contain colons");
d.ensureValidHostname(a,this._parts.protocol);!this._parts.hostname||this.is("IP")?this._parts.hostname=a:(c=new RegExp(q(this.domain())+"$"),this._parts.hostname=this._parts.hostname.replace(c,a));this.build(!b);return this};g.tld=function(a,b){if(this._parts.urn)return void 0===a?"":this;"boolean"===typeof a&&(b=a,a=void 0);if(void 0===a){if(!this._parts.hostname||this.is("IP"))return"";var c=this._parts.hostname.lastIndexOf(".");c=this._parts.hostname.substring(c+1);return!0!==b&&k&&k.list[c.toLowerCase()]?
k.get(this._parts.hostname)||c:c}if(a)if(a.match(/[^a-zA-Z0-9-]/))if(k&&k.is(a))c=new RegExp(q(this.tld())+"$"),this._parts.hostname=this._parts.hostname.replace(c,a);else throw new TypeError('TLD "'+a+'" contains characters other than [A-Z0-9]');else{if(!this._parts.hostname||this.is("IP"))throw new ReferenceError("cannot set TLD on non-domain host");c=new RegExp(q(this.tld())+"$");this._parts.hostname=this._parts.hostname.replace(c,a)}else throw new TypeError("cannot set TLD empty");this.build(!b);
return this};g.directory=function(a,b){if(this._parts.urn)return void 0===a?"":this;if(void 0===a||!0===a){if(!this._parts.path&&!this._parts.hostname)return"";if("/"===this._parts.path)return"/";var c=this._parts.path.length-this.filename().length-1;c=this._parts.path.substring(0,c)||(this._parts.hostname?"/":"");return a?d.decodePath(c):c}c=this._parts.path.length-this.filename().length;c=this._parts.path.substring(0,c);c=new RegExp("^"+q(c));this.is("relative")||(a||(a="/"),"/"!==a.charAt(0)&&
(a="/"+a));a&&"/"!==a.charAt(a.length-1)&&(a+="/");a=d.recodePath(a);this._parts.path=this._parts.path.replace(c,a);this.build(!b);return this};g.filename=function(a,b){if(this._parts.urn)return void 0===a?"":this;if("string"!==typeof a){if(!this._parts.path||"/"===this._parts.path)return"";var c=this._parts.path.lastIndexOf("/");c=this._parts.path.substring(c+1);return a?d.decodePathSegment(c):c}c=!1;"/"===a.charAt(0)&&(a=a.substring(1));a.match(/\.?\//)&&(c=!0);var e=new RegExp(q(this.filename())+
"$");a=d.recodePath(a);this._parts.path=this._parts.path.replace(e,a);c?this.normalizePath(b):this.build(!b);return this};g.suffix=function(a,b){if(this._parts.urn)return void 0===a?"":this;if(void 0===a||!0===a){if(!this._parts.path||"/"===this._parts.path)return"";var c=this.filename(),e=c.lastIndexOf(".");if(-1===e)return"";c=c.substring(e+1);c=/^[a-z0-9%]+$/i.test(c)?c:"";return a?d.decodePathSegment(c):c}"."===a.charAt(0)&&(a=a.substring(1));if(c=this.suffix())e=a?new RegExp(q(c)+"$"):new RegExp(q("."+
c)+"$");else{if(!a)return this;this._parts.path+="."+d.recodePath(a)}e&&(a=d.recodePath(a),this._parts.path=this._parts.path.replace(e,a));this.build(!b);return this};g.segment=function(a,b,c){var e=this._parts.urn?":":"/",f=this.path(),n="/"===f.substring(0,1);f=f.split(e);void 0!==a&&"number"!==typeof a&&(c=b,b=a,a=void 0);if(void 0!==a&&"number"!==typeof a)throw Error('Bad segment "'+a+'", must be 0-based integer');n&&f.shift();0>a&&(a=Math.max(f.length+a,0));if(void 0===b)return void 0===a?f:
f[a];if(null===a||void 0===f[a])if(A(b)){f=[];a=0;for(var z=b.length;a<z;a++)if(b[a].length||f.length&&f[f.length-1].length)f.length&&!f[f.length-1].length&&f.pop(),f.push(u(b[a]))}else{if(b||"string"===typeof b)b=u(b),""===f[f.length-1]?f[f.length-1]=b:f.push(b)}else b?f[a]=u(b):f.splice(a,1);n&&f.unshift("");return this.path(f.join(e),c)};g.segmentCoded=function(a,b,c){var e;"number"!==typeof a&&(c=b,b=a,a=void 0);if(void 0===b){a=this.segment(a,b,c);if(A(a)){var f=0;for(e=a.length;f<e;f++)a[f]=
d.decode(a[f])}else a=void 0!==a?d.decode(a):void 0;return a}if(A(b))for(f=0,e=b.length;f<e;f++)b[f]=d.encode(b[f]);else b="string"===typeof b||b instanceof String?d.encode(b):b;return this.segment(a,b,c)};var M=g.query;g.query=function(a,b){if(!0===a)return d.parseQuery(this._parts.query,this._parts.escapeQuerySpace);if("function"===typeof a){var c=d.parseQuery(this._parts.query,this._parts.escapeQuerySpace),e=a.call(this,c);this._parts.query=d.buildQuery(e||c,this._parts.duplicateQueryParameters,
this._parts.escapeQuerySpace);this.build(!b);return this}return void 0!==a&&"string"!==typeof a?(this._parts.query=d.buildQuery(a,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace),this.build(!b),this):M.call(this,a,b)};g.setQuery=function(a,b,c){var e=d.parseQuery(this._parts.query,this._parts.escapeQuerySpace);if("string"===typeof a||a instanceof String)e[a]=void 0!==b?b:null;else if("object"===typeof a)for(var f in a)B.call(a,f)&&(e[f]=a[f]);else throw new TypeError("URI.addQuery() accepts an object, string as the name parameter");
this._parts.query=d.buildQuery(e,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace);"string"!==typeof a&&(c=b);this.build(!c);return this};g.addQuery=function(a,b,c){var e=d.parseQuery(this._parts.query,this._parts.escapeQuerySpace);d.addQuery(e,a,void 0===b?null:b);this._parts.query=d.buildQuery(e,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace);"string"!==typeof a&&(c=b);this.build(!c);return this};g.removeQuery=function(a,b,c){var e=d.parseQuery(this._parts.query,
this._parts.escapeQuerySpace);d.removeQuery(e,a,b);this._parts.query=d.buildQuery(e,this._parts.duplicateQueryParameters,this._parts.escapeQuerySpace);"string"!==typeof a&&(c=b);this.build(!c);return this};g.hasQuery=function(a,b,c){var e=d.parseQuery(this._parts.query,this._parts.escapeQuerySpace);return d.hasQuery(e,a,b,c)};g.setSearch=g.setQuery;g.addSearch=g.addQuery;g.removeSearch=g.removeQuery;g.hasSearch=g.hasQuery;g.normalize=function(){return this._parts.urn?this.normalizeProtocol(!1).normalizePath(!1).normalizeQuery(!1).normalizeFragment(!1).build():
this.normalizeProtocol(!1).normalizeHostname(!1).normalizePort(!1).normalizePath(!1).normalizeQuery(!1).normalizeFragment(!1).build()};g.normalizeProtocol=function(a){"string"===typeof this._parts.protocol&&(this._parts.protocol=this._parts.protocol.toLowerCase(),this.build(!a));return this};g.normalizeHostname=function(a){this._parts.hostname&&(this.is("IDN")&&r?this._parts.hostname=r.toASCII(this._parts.hostname):this.is("IPv6")&&x&&(this._parts.hostname=x.best(this._parts.hostname)),this._parts.hostname=
this._parts.hostname.toLowerCase(),this.build(!a));return this};g.normalizePort=function(a){"string"===typeof this._parts.protocol&&this._parts.port===d.defaultPorts[this._parts.protocol]&&(this._parts.port=null,this.build(!a));return this};g.normalizePath=function(a){var b=this._parts.path;if(!b)return this;if(this._parts.urn)return this._parts.path=d.recodeUrnPath(this._parts.path),this.build(!a),this;if("/"===this._parts.path)return this;b=d.recodePath(b);var c="";if("/"!==b.charAt(0)){var e=!0;
b="/"+b}if("/.."===b.slice(-3)||"/."===b.slice(-2))b+="/";b=b.replace(/(\/(\.\/)+)|(\/\.$)/g,"/").replace(/\/{2,}/g,"/");e&&(c=b.substring(1).match(/^(\.\.\/)+/)||"")&&(c=c[0]);for(;;){var f=b.search(/\/\.\.(\/|$)/);if(-1===f)break;else if(0===f){b=b.substring(3);continue}var n=b.substring(0,f).lastIndexOf("/");-1===n&&(n=f);b=b.substring(0,n)+b.substring(f+3)}e&&this.is("relative")&&(b=c+b.substring(1));this._parts.path=b;this.build(!a);return this};g.normalizePathname=g.normalizePath;g.normalizeQuery=
function(a){"string"===typeof this._parts.query&&(this._parts.query.length?this.query(d.parseQuery(this._parts.query,this._parts.escapeQuerySpace)):this._parts.query=null,this.build(!a));return this};g.normalizeFragment=function(a){this._parts.fragment||(this._parts.fragment=null,this.build(!a));return this};g.normalizeSearch=g.normalizeQuery;g.normalizeHash=g.normalizeFragment;g.iso8859=function(){var a=d.encode,b=d.decode;d.encode=escape;d.decode=decodeURIComponent;try{this.normalize()}finally{d.encode=
a,d.decode=b}return this};g.unicode=function(){var a=d.encode,b=d.decode;d.encode=F;d.decode=unescape;try{this.normalize()}finally{d.encode=a,d.decode=b}return this};g.readable=function(){var a=this.clone();a.username("").password("").normalize();var b="";a._parts.protocol&&(b+=a._parts.protocol+"://");a._parts.hostname&&(a.is("punycode")&&r?(b+=r.toUnicode(a._parts.hostname),a._parts.port&&(b+=":"+a._parts.port)):b+=a.host());a._parts.hostname&&a._parts.path&&"/"!==a._parts.path.charAt(0)&&(b+="/");
b+=a.path(!0);if(a._parts.query){for(var c="",e=0,f=a._parts.query.split("&"),n=f.length;e<n;e++){var z=(f[e]||"").split("=");c+="&"+d.decodeQuery(z[0],this._parts.escapeQuerySpace).replace(/&/g,"%26");void 0!==z[1]&&(c+="="+d.decodeQuery(z[1],this._parts.escapeQuerySpace).replace(/&/g,"%26"))}b+="?"+c.substring(1)}return b+=d.decodeQuery(a.hash(),!0)};g.absoluteTo=function(a){var b=this.clone(),c=["protocol","username","password","hostname","port"],e,f;if(this._parts.urn)throw Error("URNs do not have any generally defined hierarchical components");
a instanceof d||(a=new d(a));if(b._parts.protocol)return b;b._parts.protocol=a._parts.protocol;if(this._parts.hostname)return b;for(e=0;f=c[e];e++)b._parts[f]=a._parts[f];b._parts.path?(".."===b._parts.path.substring(-2)&&(b._parts.path+="/"),"/"!==b.path().charAt(0)&&(c=(c=a.directory())?c:0===a.path().indexOf("/")?"/":"",b._parts.path=(c?c+"/":"")+b._parts.path,b.normalizePath())):(b._parts.path=a._parts.path,b._parts.query||(b._parts.query=a._parts.query));b.build();return b};g.relativeTo=function(a){var b=
this.clone().normalize();if(b._parts.urn)throw Error("URNs do not have any generally defined hierarchical components");a=(new d(a)).normalize();var c=b._parts;var e=a._parts;var f=b.path();a=a.path();if("/"!==f.charAt(0))throw Error("URI is already relative");if("/"!==a.charAt(0))throw Error("Cannot calculate a URI relative to another relative URI");c.protocol===e.protocol&&(c.protocol=null);if(c.username===e.username&&c.password===e.password&&null===c.protocol&&null===c.username&&null===c.password&&
c.hostname===e.hostname&&c.port===e.port)c.hostname=null,c.port=null;else return b.build();if(f===a)return c.path="",b.build();f=d.commonPath(f,a);if(!f)return b.build();e=e.path.substring(f.length).replace(/[^\/]*$/,"").replace(/.*?\//g,"../");c.path=e+c.path.substring(f.length)||"./";return b.build()};g.equals=function(a){var b=this.clone(),c=new d(a);a={};var e;b.normalize();c.normalize();if(b.toString()===c.toString())return!0;var f=b.query();var n=c.query();b.query("");c.query("");if(b.toString()!==
c.toString()||f.length!==n.length)return!1;b=d.parseQuery(f,this._parts.escapeQuerySpace);n=d.parseQuery(n,this._parts.escapeQuerySpace);for(e in b)if(B.call(b,e)){if(!A(b[e])){if(b[e]!==n[e])return!1}else if(!D(b[e],n[e]))return!1;a[e]=!0}for(e in n)if(B.call(n,e)&&!a[e])return!1;return!0};g.preventInvalidHostname=function(a){this._parts.preventInvalidHostname=!!a;return this};g.duplicateQueryParameters=function(a){this._parts.duplicateQueryParameters=!!a;return this};g.escapeQuerySpace=function(a){this._parts.escapeQuerySpace=
!!a;return this};return d});
(function(r,x){"object"===typeof module&&module.exports?module.exports=x(require("./URI")):"function"===typeof define&&define.amd?define(["./URI"],x):r.URITemplate=x(r.URI,r)})(this,function(r,x){function k(h){if(k._cache[h])return k._cache[h];if(!(this instanceof k))return new k(h);this.expression=h;k._cache[h]=this;return this}function m(h){this.data=h;this.cache={}}var d=x&&x.URITemplate,q=Object.prototype.hasOwnProperty,E=k.prototype,A={"":{prefix:"",separator:",",named:!1,empty_name_separator:!1,
encode:"encode"},"+":{prefix:"",separator:",",named:!1,empty_name_separator:!1,encode:"encodeReserved"},"#":{prefix:"#",separator:",",named:!1,empty_name_separator:!1,encode:"encodeReserved"},".":{prefix:".",separator:".",named:!1,empty_name_separator:!1,encode:"encode"},"/":{prefix:"/",separator:"/",named:!1,empty_name_separator:!1,encode:"encode"},";":{prefix:";",separator:";",named:!0,empty_name_separator:!1,encode:"encode"},"?":{prefix:"?",separator:"&",named:!0,empty_name_separator:!0,encode:"encode"},
"&":{prefix:"&",separator:"&",named:!0,empty_name_separator:!0,encode:"encode"}};k._cache={};k.EXPRESSION_PATTERN=/\{([^a-zA-Z0-9%_]?)([^\}]+)(\}|$)/g;k.VARIABLE_PATTERN=/^([^*:.](?:\.?[^*:.])*)((\*)|:(\d+))?$/;k.VARIABLE_NAME_PATTERN=/[^a-zA-Z0-9%_.]/;k.LITERAL_PATTERN=/[<>{}"`^| \\]/;k.expand=function(h,p,D){var u=A[h.operator],K=u.named?"Named":"Unnamed";h=h.variables;var F=[],w,H;for(H=0;w=h[H];H++){var v=p.get(w.name);if(0===v.type&&D&&D.strict)throw Error('Missing expansion value for variable "'+
w.name+'"');if(v.val.length){if(1<v.type&&w.maxlength)throw Error('Invalid expression: Prefix modifier not applicable to variable "'+w.name+'"');F.push(k["expand"+K](v,u,w.explode,w.explode&&u.separator||",",w.maxlength,w.name))}else v.type&&F.push("")}return F.length?u.prefix+F.join(u.separator):""};k.expandNamed=function(h,p,D,u,K,F){var w="",H=p.encode;p=p.empty_name_separator;var v=!h[H].length,g=2===h.type?"":r[H](F),B;var G=0;for(B=h.val.length;G<B;G++){if(K){var l=r[H](h.val[G][1].substring(0,
K));2===h.type&&(g=r[H](h.val[G][0].substring(0,K)))}else v?(l=r[H](h.val[G][1]),2===h.type?(g=r[H](h.val[G][0]),h[H].push([g,l])):h[H].push([void 0,l])):(l=h[H][G][1],2===h.type&&(g=h[H][G][0]));w&&(w+=u);D?w+=g+(p||l?"=":"")+l:(G||(w+=r[H](F)+(p||l?"=":"")),2===h.type&&(w+=g+","),w+=l)}return w};k.expandUnnamed=function(h,p,D,u,K){var F="",w=p.encode;p=p.empty_name_separator;var H=!h[w].length,v;var g=0;for(v=h.val.length;g<v;g++){if(K)var B=r[w](h.val[g][1].substring(0,K));else H?(B=r[w](h.val[g][1]),
h[w].push([2===h.type?r[w](h.val[g][0]):void 0,B])):B=h[w][g][1];F&&(F+=u);if(2===h.type){var G=K?r[w](h.val[g][0].substring(0,K)):h[w][g][0];F+=G;F=D?F+(p||B?"=":""):F+","}F+=B}return F};k.noConflict=function(){x.URITemplate===k&&(x.URITemplate=d);return k};E.expand=function(h,p){var D="";this.parts&&this.parts.length||this.parse();h instanceof m||(h=new m(h));for(var u=0,K=this.parts.length;u<K;u++)D+="string"===typeof this.parts[u]?this.parts[u]:k.expand(this.parts[u],h,p);return D};E.parse=function(){var h=
this.expression,p=k.EXPRESSION_PATTERN,D=k.VARIABLE_PATTERN,u=k.VARIABLE_NAME_PATTERN,K=k.LITERAL_PATTERN,F=[],w=0,H=function(t){if(t.match(K))throw Error('Invalid Literal "'+t+'"');return t};for(p.lastIndex=0;;){var v=p.exec(h);if(null===v){F.push(H(h.substring(w)));break}else F.push(H(h.substring(w,v.index))),w=v.index+v[0].length;if(!A[v[1]])throw Error('Unknown Operator "'+v[1]+'" in "'+v[0]+'"');if(!v[3])throw Error('Unclosed Expression "'+v[0]+'"');var g=v[2].split(",");for(var B=0,G=g.length;B<
G;B++){var l=g[B].match(D);if(null===l)throw Error('Invalid Variable "'+g[B]+'" in "'+v[0]+'"');if(l[1].match(u))throw Error('Invalid Variable Name "'+l[1]+'" in "'+v[0]+'"');g[B]={name:l[1],explode:!!l[3],maxlength:l[4]&&parseInt(l[4],10)}}if(!g.length)throw Error('Expression Missing Variable(s) "'+v[0]+'"');F.push({expression:v[0],operator:v[1],variables:g})}F.length||F.push(H(h));this.parts=F;return this};m.prototype.get=function(h){var p=this.data,D={type:0,val:[],encode:[],encodeReserved:[]};
if(void 0!==this.cache[h])return this.cache[h];this.cache[h]=D;p="[object Function]"===String(Object.prototype.toString.call(p))?p(h):"[object Function]"===String(Object.prototype.toString.call(p[h]))?p[h](h):p[h];if(void 0!==p&&null!==p)if("[object Array]"===String(Object.prototype.toString.call(p))){var u=0;for(h=p.length;u<h;u++)void 0!==p[u]&&null!==p[u]&&D.val.push([void 0,String(p[u])]);D.val.length&&(D.type=3)}else if("[object Object]"===String(Object.prototype.toString.call(p))){for(u in p)q.call(p,
u)&&void 0!==p[u]&&null!==p[u]&&D.val.push([u,String(p[u])]);D.val.length&&(D.type=2)}else D.type=1,D.val.push([void 0,String(p)]);return D};r.expand=function(h,p){var D=(new k(h)).expand(p);return new r(D)};return k});
