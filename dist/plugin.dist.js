'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (opts) {
  var t = opts.types;

  var localContextRef = t.identifier('localContext');
  var vars = new Map();
  return {
    inherits: _babelPluginSyntaxJsx2.default,
    visitor: {
      ImportDeclaration: {
        exit: function exit(node) {
          if (node.get('source').get('value').node == 'react') {
            node.replaceWith(t.importDeclaration([t.importDefaultSpecifier(t.identifier('Handlebars'))], t.stringLiteral('handlebars')));
          } else {
            var specifier = node.get('specifiers')[0];
            if (specifier.isImportDefaultSpecifier()) {
              var name = specifier.get('local').get('name').node;
              node.insertAfter(t.ifStatement(createMemberExpression(t.identifier(name), t.stringLiteral('handlebars-partial')), t.blockStatement([t.expressionStatement(t.callExpression(t.identifier(name), []))])));
            }
          }
        }
      },
      FunctionExpression: {
        enter: function enter(node) {
          if (node.get('id').node !== null && node.get('id').get('name').node == 'render') {
            findVariablesInJSX(node);
          }
        },
        exit: function exit(node) {
          if (node.get('id').node !== null && node.get('id').get('name').node == 'render') {
            processRenderFunction(node, node.get('body').node);

            node.findParent(function (path) {
              return path.isVariableDeclaration();
            }).remove();
          }
        }
      },
      ClassDeclaration: {
        exit: function exit(node) {
          node.dangerouslyRemove();
        }
      },
      ClassMethod: {
        enter: function enter(node) {
          if (node.get('key').get('name').node == 'render') {
            findVariablesInJSX(node);
          }
        },
        exit: function exit(node) {
          if (node.get('key').get('name').node == 'render') {
            processRenderFunction(node, node.get('value').get('body').node);
          }
        }
      },
      MemberExpression: {
        enter: function enter(node) {
          if (node.get('object').isThisExpression() && node.get('property').get('name').node == 'props') {
            node.skip();
            node.replaceWith(createMemberExpression(localContextRef, 'props'));
            // return createMemberExpression(localContextRef, 'props');
          }
        }
      },
      JSXElement: {
        enter: function enter(node) {
          var programPath = findProgramPath(node);
          // Extract and insert at the top the handelbars template...
          var compileResultRef = programPath.scope.generateUidIdentifier('compiledPartial');
          var markup = processJSXElement(node);
          programPath.node.body.push(t.variableDeclaration('var', [t.variableDeclarator(compileResultRef, t.callExpression(createMemberExpression('Handlebars', 'compile'), [t.stringLiteral(markup)]))]));
          // ...and replace the expression element with a template render call
          node.replaceWith(t.newExpression(createMemberExpression('Handlebars', 'SafeString'), [t.callExpression(createMemberExpression(compileResultRef, 'call'), [t.thisExpression(), localContextRef, t.identifier('execOptions')])]));
        }
      }
    }
  };

  function processRenderFunction(path, node) {
    // Prepend context and context.props wrapper to function body
    var contextIdentifier = t.identifier('context');
    node.body = Array.prototype.concat([t.variableDeclaration('var', [t.variableDeclarator(localContextRef, t.objectExpression([]))]), t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, 'props'), t.callExpression(createMemberExpression('Object', 'assign'), [findDefaultPropsIfAny(path), createMemberExpression('execOptions', 'hash'), createMemberExpression(t.logicalExpression('||', createMemberExpression('execOptions', 'hash'), t.objectExpression([])), '__$spread$__')]))),
    // localContext.props.children = new Handlebars.SafeString(execOptions.data['partial-block'](context));
    t.ifStatement(t.unaryExpression('!', createMemberExpression('execOptions', 'data', t.stringLiteral('partial-block'))), t.blockStatement([t.throwStatement(t.newExpression(t.identifier('Error'), [t.stringLiteral('Calling partials is only valid as block-partial')]))])), t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, 'props', 'children'), t.newExpression(createMemberExpression('Handlebars', 'SafeString'), [t.callExpression(createMemberExpression('execOptions', 'data', t.stringLiteral('partial-block')), [contextIdentifier])])))], node.body);

    var programPath = findProgramPath(path);
    var decl = findClassDeclaration(path);
    var classID = void 0;
    if (decl) {
      classID = decl.get('id').get('name').node;
    } else {
      decl = findBabelClassDeclaration(path);
      classID = decl.get('arguments')[0].get('name').node;
    }
    // export default function...
    programPath.node.body.push(t.functionDeclaration(t.identifier(classID), // id
    [], // params
    t.blockStatement([t.expressionStatement(t.callExpression(createMemberExpression('Handlebars', 'registerPartial'), [t.stringLiteral(classID), t.functionExpression(undefined, // id
    [// params
    contextIdentifier, t.identifier('execOptions')], node, false, // generator
    false // async
    )]))]), false, // generator
    false // async
    ), t.expressionStatement(t.assignmentExpression('=', createMemberExpression(t.identifier(classID), t.stringLiteral('handlebars-partial')), t.booleanLiteral(true))), t.exportDefaultDeclaration(t.identifier(classID)));
  }

  function findVariablesInJSX(path) {
    path.traverse({
      JSXExpressionContainer: {
        enter: function enter(node) {
          var expression = node.get('expression');
          switch (expression.type) {
            case 'Identifier':
            case 'MemberExpression':
              if (!isThisPropsExpression(expression)) {
                var varRef = newVariableReplacement(expression);
                if (!isFunctionInsideJSXExpressionContainer(expression)) {
                  findClosestStatement(expression).insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, varRef.name), expression.node)));
                }
                node.setData('original', expression.node);
                expression.replaceWith(t.identifier(varRef.name));
              }
              break;
          }
        }
      }
    });
  }

  function createKeyFromPath(path) {
    switch (path.type) {
      case 'Literal':
        return path.get('value').node;
      case 'Identifier':
      case 'JSXIdentifier':
        return path.get('name').node;
      case 'MemberExpression':
      case 'JSXMemberExpression':
        return createKeyFromPath(path.get('object')) + '.' + createKeyFromPath(path.get('property'));
      default:
        throw new Error('Unable to create key for path type: ' + path.type);
    }
  }

  function processJSXElement(path) {
    var markup = '';
    var opening = path.get('openingElement');
    var namePath = opening.get('name');
    var tagName = void 0;
    if (namePath.isJSXMemberExpression()) {
      // TODO: Dynamic Component with Dynamic Partial
      var varRef = newVariableReplacement(namePath);
      findClosestStatement(namePath).insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, varRef.name), rewriteJsxThisProps(namePath).node)));
      tagName = '{{' + varRef.name + '}}';
    } else {
      tagName = namePath.get('name').node;
    }
    var renderAsPartial = tagName[0].toUpperCase() == tagName[0] && path.scope.hasBinding(tagName);
    var selfClosing = !renderAsPartial && opening.get('selfClosing').node;

    // Opening tag...
    if (renderAsPartial) {
      // Partial
      findClosestStatement(path).insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, t.identifier('__component__' + tagName)), createMemberExpression(t.identifier(tagName), 'name'))));
      markup += '{{#>' + '(lookup . "__component__' + tagName + '")';
      // XXX: Need hack here so dynamic block partials are satisfied with unknown block end name
      tagName = 'undefined';
    } else {
      // HTML
      markup += '<' + tagName;
    }

    // ... attributes...
    var attributes = filterAttriubtes(opening.get('attributes'));
    if (hasSpreadAttribute(attributes)) {
      markup += processAttributesWithSpread(attributes, tagName, renderAsPartial);
    } else {
      markup += processAttributes(attributes, renderAsPartial);
    }

    if (renderAsPartial) {
      markup += '}}';
    } else {
      markup += '>';
    }

    // ... children...
    var childMarkup = '';
    path.traverse({
      enter: function enter(node) {
        if (node.isJSXElement()) {
          childMarkup += processJSXElement(node);
        } else if (node.isJSXExpressionContainer() && !isInsideJSXAttribute(node)) {
          childMarkup += processJSXExpressionContainer(node);
        } else if (node.isJSXOpeningElement() || node.isJSXClosingElement()) {
          // Skip
        } else if (node.isLiteral()) {
          childMarkup += node.get('value').node;
        } else if (node.isJSXText()) {
          childMarkup += node.node.value;
        } else {
          throw new Error('Unknown element during JSX processing:  ' + node.type);
        }
        node.skip();
      }
    });
    markup += childMarkup.trim().replace(/(>|}})[\n\t]+\s*(<|{{)/g, '$1$2');

    // ... and closing tag
    if (renderAsPartial) {
      markup += '{{/' + tagName + '}}';
    } else if (!selfClosing || !isHtmlVoidElement(tagName)) {
      markup += '</' + tagName + '>';
    }
    return markup;
  }

  function processAttributesWithSpread(attributes, tagName, renderAsPartial) {
    if (attributes.length == 0) {
      return '';
    }

    var objects = [];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = attributes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var attribute = _step.value;

        if (attribute.isJSXSpreadAttribute()) {
          objects.push(attribute.get('argument').node);
        } else {
          var name = getAttributeName(attribute);
          var value = void 0;
          var valuePath = attribute.get('value');
          if (valuePath.isJSXExpressionContainer()) {
            value = valuePath.getData('original') || valuePath.get('expression').node;
          } else if (valuePath.isLiteral()) {
            value = valuePath.node;
          }
          objects.push(t.objectExpression([t.property(null, t.identifier(name), value)]));
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    var ref = findProgramPath(attributes[0]).scope.generateUidIdentifier('_' + tagName + '_attributes_');
    findClosestStatement(attributes[0]).insertBefore([t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, ref.name), t.arrayExpression(objects))), t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, ref.name), t.callExpression(createMemberExpression('Object', 'assign'), [t.objectExpression([]), t.spreadElement(createMemberExpression(localContextRef, ref.name))])))]);

    if (renderAsPartial) {
      return ' __$spread$__=' + ref.name;
    }
    createFilterSpreadAndChildrenAttributes(attributes[0], ref);
    return '{{#each ' + ref.name + '}} {{@key}}="{{this}}"{{/each}}';
  }

  function processAttributes(attributes, renderAsPartial) {
    var markup = '';
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = attributes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var attribute = _step2.value;

        var value = attribute.get('value');
        var valueMarkup = '';
        if (value.isJSXExpressionContainer()) {
          if (!renderAsPartial) {
            valueMarkup += '"{{';
          }
          value = stringifyExpression(filterThisExpressions(value.get('expression')));
          valueMarkup += value;
          if (!renderAsPartial) {
            valueMarkup += '}}"';
          }
          markup += prepareAttributeMarkup(attribute, renderAsPartial, value, valueMarkup);
        } else if (value.isLiteral()) {
          value = value.get('value').node;
          valueMarkup += '"' + value + '"';
          markup += prepareAttributeMarkup(attribute, true, value, valueMarkup);
        } else {
          throw new Error('Unknown attribute node type: ' + attribute.get('type').node);
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return markup;
  }

  function prepareAttributeMarkup(attribute, isStatic, value, valueMarkup) {
    var markup = '';
    if (!isStatic) {
      markup += '{{#if ' + value + '}}';
    }
    markup += ' ' + getAttributeName(attribute) + '=' + valueMarkup;
    if (!isStatic) {
      markup += '{{/if}}';
    }
    return markup;
  }

  function processJSXExpressionContainer(path) {
    var markup = '';
    var expression = path.get('expression');
    if (expression.isCallExpression()) {
      // Each call-expression in JSX need to be moved
      // above the JSX expression and the template needs a
      // context-variable to insert the render result for the call.
      expression.traverse({
        enter: function enter() {
          if (path.isArrowFunctionExpression() && !path.get('body').isBlockStatement()) {
            var body = this.get('body');
            this.replaceWith(t.functionExpression(null, path.node.params, t.blockStatement([t.returnStatement(body.node)]), false, false));
          }
          if (path.isFunction()) {
            var params = path.get('params');
            var objects = [];
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = params[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var param = _step3.value;

                var name = param.get('name').node;
                var varRef = vars.get(createKeyFromPath(param));
                if (varRef) {
                  objects.push(t.property(null, t.identifier(varRef.name), t.identifier(name)));
                }
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }

            var _body = path.get('body').get('body');
            var firstStatement = _body[0];
            firstStatement.insertBefore(t.variableDeclaration('var', [t.variableDeclarator(localContextRef, t.callExpression(createMemberExpression('Object', 'assign'), [t.objectExpression([]), localContextRef, t.objectExpression(objects)]))]));
          }
        }
      });

      var callResultRef = findProgramPath(path).scope.generateUidIdentifier('callResult');
      var statement = findClosestStatement(expression);
      statement.insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, callResultRef), t.callExpression(createOptionalArrayJoinFunction(), [expression.node]))));

      markup += '{{' + callResultRef.name + '}}';
    } else if (expression.isLogicalExpression()) {
      // Logical-expression are rewritten to handlebars if-helper
      var varRef = expression.scope.generateUidIdentifier('test-helper-var');
      findClosestStatement(expression).insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, varRef), expression.get('left').node)));
      markup += '{{#if ' + varRef.name + '}}' + processMaybeJsxElement(expression.get('right')) + '{{/if}}';
    } else if (expression.isConditionalExpression()) {
      // Conditional-expression are rewritten to handlebars if-else-helper
      var _varRef = expression.scope.generateUidIdentifier('test-helper-var');
      findClosestStatement(expression).insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, _varRef), expression.get('test').node)));

      markup += '{{#if ' + _varRef.name + '}}' + processMaybeJsxElement(expression.get('consequent')) + '{{else}}' + processMaybeJsxElement(expression.get('alternate')) + '{{/if}}';
    } else {
      // TODO: Check if this is sufficient
      markup += '{{' + stringifyExpression(filterThisExpressions(expression)) + '}}';
    }
    return markup;
  }

  /**
   * Returns a valid template snippet, either markup or a valid variable reference.
   */
  function processMaybeJsxElement(path) {
    if (path.isJSXElement()) {
      return processJSXElement(path);
    } else {
      var stmt = findClosestStatement(path);
      var expressionRef = stmt.scope.generateUidIdentifier('expression');
      stmt.insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, expressionRef.name), path.node)));
      return '{{' + expressionRef.name + '}}';
    }
  }

  function filterThisExpressions(path) {
    // Remove all this-expression from the ast-path, because handlebars does not have a this
    // context. This is emulated with the context and context.props variables.
    switch (path.get('type').node) {
      case 'Identifier':
        return path;
      case 'MemberExpression':
        if (path.get('object').isThisExpression()) {
          path.replaceWith(path.get('property'));
        } else if (path.get('object').isMemberExpression()) {
          path.replaceWith(createMemberExpression(filterThisExpressions(path.get('object')).node, path.get('property').node));
        }
        return path;
    }
    throw new Error('Unknown expression node type: ' + path.get('type').node);
  }

  function stringifyExpression(path) {
    // Creates a string-representation of the given ast-path.
    switch (path.get('type').node) {
      case 'Literal':
        return path.get('value').node;
      case 'Identifier':
        return path.get('name').node;
      case 'MemberExpression':
        return stringifyExpression(path.get('object')) + '.' + stringifyExpression(path.get('property'));
    }
    throw new Error('Unknown expression node type: ' + path.type);
  }

  function rewriteJsxThisProps(path) {
    if (path.isJSXMemberExpression()) {
      var object = path.get('object');
      if (object.isJSXIdentifier() && object.get('name').node == 'this') {
        path.replaceWith(createMemberExpression(localContextRef, path.get('property').node));
      } else {
        rewriteJsxThisProps(path.get('object'));
      }
    }
    return path;
  }

  // -- helper -------------------

  function findProgramPath(path) {
    return path.findParent(function (path) {
      return path.isProgram();
    });
  }

  function findClassDeclaration(path) {
    return path.findParent(function (path) {
      return path.isClassDeclaration();
    });
  }

  function findBabelClassDeclaration(path) {
    return path.findParent(function (path) {
      return path.isCallExpression() && path.get('callee').get('name').node == '_createClass';
    });
  }

  function findDefaultPropsIfAny(path) {
    var decl = findClassDeclaration(path);
    var defaultPropsPath = void 0;
    if (decl) {
      defaultPropsPath = decl.get('body').get('body').filter(function (element) {
        return element.isClassProperty();
      }).find(function (element) {
        return element.get('key').get('name').node == 'defaultProps';
      });
    } else {
      decl = findBabelClassDeclaration(path);
      if (decl) {
        var args = decl.get('arguments');
        if (args.length > 2) {
          // Find property with key defaultProps...
          var element = void 0;
          var _iteratorNormalCompletion4 = true;
          var _didIteratorError4 = false;
          var _iteratorError4 = undefined;

          try {
            for (var _iterator4 = args[2].get('elements')[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              var el = _step4.value;
              var _iteratorNormalCompletion6 = true;
              var _didIteratorError6 = false;
              var _iteratorError6 = undefined;

              try {
                for (var _iterator6 = el.get('properties')[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                  var _prop = _step6.value;

                  if (_prop.get('key').get('name').node == 'key' && _prop.get('value').get('value').node == 'defaultProps') {
                    element = el;
                  }
                }
              } catch (err) {
                _didIteratorError6 = true;
                _iteratorError6 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion6 && _iterator6.return) {
                    _iterator6.return();
                  }
                } finally {
                  if (_didIteratorError6) {
                    throw _iteratorError6;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError4 = true;
            _iteratorError4 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
              }
            } finally {
              if (_didIteratorError4) {
                throw _iteratorError4;
              }
            }
          }

          if (element) {
            // ... and select value node out of it
            var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;
            var _iteratorError5 = undefined;

            try {
              for (var _iterator5 = element.get('properties')[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                var prop = _step5.value;

                if (prop.get('key').get('name').node == 'value') {
                  defaultPropsPath = prop;
                }
              }
            } catch (err) {
              _didIteratorError5 = true;
              _iteratorError5 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion5 && _iterator5.return) {
                  _iterator5.return();
                }
              } finally {
                if (_didIteratorError5) {
                  throw _iteratorError5;
                }
              }
            }
          }
        }
      }
    }
    if (defaultPropsPath) {
      return defaultPropsPath.get('value').node;
    }
    return t.objectExpression([]);
  }

  function findClosestStatement(path) {
    return path.findParent(function (path) {
      return path.isStatement();
    });
  }

  function isInsideJSXAttribute(path) {
    return !!path.findParent(function (path) {
      return path.isJSXAttribute();
    });
  }

  function isFunctionInsideJSXExpressionContainer(path) {
    var result = false;
    path = path.findParent(function (path) {
      return path.isFunction();
    });
    if (path && path.isFunction()) {
      path = path.findParent(function (path) {
        return path.isJSXExpressionContainer();
      });
      if (path && path.isJSXExpressionContainer()) {
        result = true;
      }
    }
    return result;
  }

  function isThisPropsExpression(path) {
    if (path.isMemberExpression()) {
      var object = path.get('object');
      if (object.isThisExpression() && path.get('property').get('name').node == 'props') {
        return true;
      }
      return isThisPropsExpression(object);
    }
    return false;
  }

  function hasSpreadAttribute(attributes) {
    return attributes.find(function (attribute) {
      return attribute.isJSXSpreadAttribute();
    }) != undefined;
  }

  function createMemberExpression() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length == 1) {
      throw new Error("Member expressions consists at least of one '.'");
    }
    var expr = typeof args[0] == 'string' ? t.identifier(args[0]) : args[0];
    for (var i = 1, n = args.length; i < n; i++) {
      var node = typeof args[i] == 'string' ? t.identifier(args[i]) : args[i];
      var computed = args[i] && args[i].type ? args[i].type === 'StringLiteral' : false;
      expr = t.memberExpression(expr, node, computed);
    }
    return expr;
  }

  function createOptionalArrayJoinFunction() {
    return t.functionExpression(undefined, // id
    [// params
    t.identifier('result')], t.blockStatement([t.returnStatement(t.conditionalExpression(t.callExpression(createMemberExpression('Array', 'isArray'), [t.identifier('result')]), t.newExpression(createMemberExpression('Handlebars', 'SafeString'), [t.callExpression(createMemberExpression(t.identifier('result'), 'join'), [t.stringLiteral('')])]), t.identifier('result')))]), false, // generator
    false // async
    );
  }

  function createFilterSpreadAndChildrenAttributes(attribute, ref) {
    findClosestStatement(attribute).insertBefore(t.expressionStatement(t.assignmentExpression('=', createMemberExpression(localContextRef, ref.name), t.callExpression(createMemberExpression(t.callExpression(createMemberExpression(t.callExpression(createMemberExpression('Object', 'keys'), [createMemberExpression(localContextRef, ref.name)]), 'filter'), [t.functionExpression(null, [t.identifier('key')], t.blockStatement([t.returnStatement(t.logicalExpression('&&', t.binaryExpression('!=', t.identifier('key'), t.identifier('children')), t.binaryExpression('!=', t.identifier('key'), t.identifier('__$spread$__'))))]))]), 'reduce'), [t.functionExpression(null, [t.identifier('props'), t.identifier('key')], t.blockStatement([t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('props'), t.identifier('key'), true), t.memberExpression(createMemberExpression(localContextRef, ref.name), t.identifier('key'), true))), t.returnStatement(t.identifier('props'))])), t.objectExpression([])]))));
  }

  function newVariableReplacement(path) {
    var key = createKeyFromPath(path);
    var varRef = vars.get(key);
    if (!varRef) {
      varRef = path.scope.generateUidIdentifier('var');
      vars.set(key, varRef);
    }
    return varRef;
  }

  function filterAttriubtes(attributes) {
    var filteredAttributes = ['key', 'children'];
    return attributes.filter(function (attribute) {
      return !attribute.has('name') || filteredAttributes.indexOf(attribute.get('name').get('name').node) == -1;
    });
  }

  function getAttributeName(attribute) {
    var JSXAttributeAliases = {
      className: 'class',
      htmlFor: 'for',
      srcSet: 'srcset'
    };

    var raw = attribute.get('name').get('name').node;
    return raw in JSXAttributeAliases ? JSXAttributeAliases[raw] : raw;
  }

  function isHtmlVoidElement(tagName) {
    var voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link',
    // Note: menuitem is not void in react
    // 'menuitem',
    'meta', 'param', 'source', 'track', 'wbr'];
    return voidElements.indexOf(tagName) > -1;
  }
};

var _babelPluginSyntaxJsx = require('babel-plugin-syntax-jsx');

var _babelPluginSyntaxJsx2 = _interopRequireDefault(_babelPluginSyntaxJsx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

