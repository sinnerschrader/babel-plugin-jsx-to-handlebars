import jsxSyntax from 'babel-plugin-syntax-jsx';

export default function(opts) {
  let t = opts.types;

  let localContextRef = t.identifier('localContext');
  let vars = new Map();
  return {
    inherits: jsxSyntax,
    visitor: {
      ImportDeclaration: {
        exit(node) {
          if (node.get('source').get('value').node == 'react') {
            node.replaceWith(
              t.importDeclaration(
                [
                  t.importDefaultSpecifier(
                    t.identifier('Handlebars')
                  )
                ],
                t.stringLiteral('handlebars')
              )
            )
          } else {
            let specifier = node.get('specifiers')[0];
            if (specifier.isImportDefaultSpecifier()) {
              let name = specifier.get('local').get('name').node;
              node.insertAfter(
                t.ifStatement(
                  createMemberExpression(t.identifier(name), 'handlebars-partial'),
                  t.blockStatement([
                    t.expressionStatement(
                      t.callExpression(
                        t.identifier(name),
                        []
                      )
                    )
                  ])
                )
              )
            }
          }
        }
      },
      FunctionExpression: {
        enter(node) {
          if (node.get('id').node !== null && node.get('id').get('name').node == 'render') {
            findVariablesInJSX(node);
          }
        },
        exit(node) {
          if (node.get('id').node !== null && node.get('id').get('name').node == 'render') {
            processRenderFunction(node, node.get('body').node);
            node.findParent(path => path.isVariableDeclaration()).dangerouslyRemove();
          }
        }
      },
      ClassDeclaration: {
        exit(node) {
          node.dangerouslyRemove();
        }
      },
      ClassMethod: {
        enter(node) {
          if (node.get('key').get('name').node == 'render') {
            findVariablesInJSX(node);
          }
        },
        exit(node) {
          if (node.get('key').get('name').node == 'render') {
            processRenderFunction(node, node.get('value').get('body').node);
          }
        }
      },
      MemberExpression: {
        enter(node) {
          if (node.get('object').isThisExpression()
            && node.get('property').get('name').node == 'props') {
            node.skip();
            return createMemberExpression(localContextRef, 'props');
          }
        }
      },
      JSXElement: {
        enter(node) {
          let programPath = findProgramPath(node);
          // Extract and insert at the top the handelbars template...
          let compileResultRef = programPath.scope.generateUidIdentifier('compiledPartial');
          let markup = processJSXElement(node);
          programPath.node.body.push(
            t.variableDeclaration('var', [
              t.variableDeclarator(
                compileResultRef,
                t.callExpression(
                  createMemberExpression('Handlebars', 'compile'),
                  [
                    t.literal(markup)
                  ]
                )
              )
            ])
          );
          // ...and replace the expression element with a template render call
          node.replaceWith(
            t.newExpression(
              createMemberExpression('Handlebars', 'SafeString'),
              [
                t.callExpression(
                  createMemberExpression(compileResultRef, 'call'),
                  [
                    t.thisExpression(),
                    localContextRef,
                    t.identifier('execOptions')
                  ]
                )
              ]
            )
          );
        }
      }
    }
  };

  function processRenderFunction(path, node) {
    // Prepend context and context.props wrapper to function body
    let contextIdentifier = t.identifier('context');
    node.body = Array.prototype.concat(
      [
        t.variableDeclaration('var', [
          t.variableDeclarator(
            localContextRef,
            t.objectExpression([])
          )
        ]),
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, 'props'),
            t.callExpression(
              createMemberExpression('Object', 'assign'),
              [
                findDefaultPropsIfAny(path),
                createMemberExpression('execOptions', 'hash'),
                createMemberExpression(
                  t.logicalExpression(
                    '||',
                    createMemberExpression('execOptions', 'hash'),
                    t.objectExpression([])
                  ),
                  '__$spread$__')
              ]
            )
          )
        ),
        // localContext.props.children = new Handlebars.SafeString(execOptions.data['partial-block'](context));
        t.ifStatement(
          t.unaryExpression(
            '!',
            createMemberExpression('execOptions', 'data', 'partial-block')
          ),
          t.blockStatement([
            t.throwStatement(
              t.newExpression(
                t.identifier('Error'),
                [
                  t.literal('Calling partials is only valid as block-partial')
                ]
              )
            )
          ])
        ),
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, 'props', 'children'),
            t.newExpression(
              createMemberExpression('Handlebars', 'SafeString'),
              [
                t.callExpression(
                  createMemberExpression('execOptions', 'data', 'partial-block'),
                  [
                    contextIdentifier
                  ]
                )
              ]
            )
          )
        )
      ],
      node.body
    );

    let programPath = findProgramPath(path);
    let decl = findClassDeclaration(path);
    let classID;
    if (decl) {
      classID = decl.get('id').get('name').node;
    } else {
      decl = findBabelClassDeclaration(path);
      classID = decl.get('arguments')[0].get('name').node;
    }
    // export default function...
    programPath.node.body.push(
      t.functionDeclaration(
        t.identifier(classID), // id
        [], // params
        t.blockStatement([
          t.expressionStatement(
            t.callExpression(
              createMemberExpression('Handlebars', 'registerPartial'),
              [
                t.literal(classID),
                t.functionExpression(
                  undefined, // id
                  [ // params
                    contextIdentifier,
                    t.identifier('execOptions')
                  ],
                  node,
                  false, // generator
                  false // async
                )
              ]
            )
          )
        ]),
        false, // generator
        false // async
      ),
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          createMemberExpression(t.identifier(classID), 'handlebars-partial'),
          t.literal(true)
        )
      ),
      t.exportDefaultDeclaration(
        t.identifier(classID)
      )
    );
  }

  function findVariablesInJSX(path) {
    path.traverse({
      JSXExpressionContainer: {
        enter(node) {
          let expression = node.get('expression');
          switch (expression.type) {
            case 'Identifier':
            case 'MemberExpression':
              if (!isThisPropsExpression(expression)) {
                let varRef = newVariableReplacement(expression);
                if (!isFunctionInsideJSXExpressionContainer(expression)) {
                  findClosestStatement(expression).insertBefore(
                    t.expressionStatement(
                      t.assignmentExpression(
                        '=',
                        createMemberExpression(localContextRef, varRef.name),
                        expression.node
                      )
                    )
                  );
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
    let markup = '';
    let opening = path.get('openingElement');
    let namePath = opening.get('name');
    let tagName;
    if (namePath.isJSXMemberExpression()) {
      // TODO: Dynamic Component with Dynamic Partial
      let varRef = newVariableReplacement(namePath);
      findClosestStatement(namePath).insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, varRef.name),
            rewriteJsxThisProps(namePath).node
          )
        )
      );
      tagName = '{{' + varRef.name + '}}';
    } else {
      tagName = namePath.get('name').node;
    }
    let renderAsPartial = tagName[0].toUpperCase() == tagName[0] && path.scope.hasBinding(tagName);
    let selfClosing = !renderAsPartial && opening.get('selfClosing').node;

    // Opening tag...
    if (renderAsPartial) {
      // Partial
      findClosestStatement(path).insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, t.identifier('__component__' + tagName)),
            createMemberExpression(t.identifier(tagName), 'name')
          )
        )
      );
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
    let childMarkup = '';
    path.traverse({
      enter(node) {
        if (node.isJSXElement()) {
          childMarkup += processJSXElement(node);
        } else if (node.isJSXExpressionContainer() && !isInsideJSXAttribute(node)) {
          childMarkup += processJSXExpressionContainer.bind(node)();
        } else if (node.isJSXOpeningElement() || node.isJSXClosingElement()) {
          // Skip
        } else if (node.isLiteral()) {
          childMarkup += node.get('value').node;
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

    let objects = [];
    for (let attribute of attributes) {
      if (attribute.isJSXSpreadAttribute()) {
        objects.push(attribute.get('argument').node);
      } else {
        let name = getAttributeName(attribute);
        let value;
        let valuePath = attribute.get('value');
        if (valuePath.isJSXExpressionContainer()) {
          value = valuePath.getData('original') || valuePath.get('expression').node;
        } else if (valuePath.isLiteral()) {
          value = valuePath.node;
        }
        objects.push(
          t.objectExpression(
            [
              t.property(
                null,
                t.literal(name),
                value
              )
            ]
          )
        );
      }
    }
    let ref = findProgramPath(attributes[0]).scope.generateUidIdentifier('_' + tagName + '_attributes_');
    findClosestStatement(attributes[0]).insertBefore(
      [
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, ref.name),
            t.arrayExpression(objects)
          )
        ),
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, ref.name),
            t.callExpression(
              createMemberExpression('Object', 'assign'),
              [
                t.objectExpression([]),
                t.spreadElement(
                  createMemberExpression(localContextRef, ref.name)
                )
              ]
            )
          )
        )
      ]
    );

    if (renderAsPartial) {
      return ' __$spread$__=' + ref.name;
    }
    createFilterSpreadAndChildrenAttributes(attributes[0], ref);
    return '{{#each ' + ref.name + '}} {{@key}}="{{this}}"{{/each}}';
  }

  function processAttributes(attributes, renderAsPartial) {
    let markup = '';
    for (let attribute of attributes) {
      let value = attribute.get('value');
      let valueMarkup = '';
      if (value.isJSXExpressionContainer()) {
        if (!renderAsPartial) {
          valueMarkup += '"{{'
        }
        value = stringifyExpression(filterThisExpressions(value.get('expression')));
        valueMarkup += value;
        if (!renderAsPartial) {
          valueMarkup += '}}"'
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
    return markup;
  }

  function prepareAttributeMarkup(attribute, isStatic, value, valueMarkup) {
    let markup = '';
    if (!isStatic) {
      markup += '{{#if ' + value + '}}';
    }
    markup += ' ' + getAttributeName(attribute) + '=' + valueMarkup;
    if (!isStatic) {
      markup += '{{/if}}';
    }
    return markup;
  }

  function processJSXExpressionContainer() {
    let markup = '';
    let expression = this.get('expression');
    if (expression.isCallExpression()) {
      // Each call-expression in JSX need to be moved
      // above the JSX expression and the template needs a
      // context-variable to insert the render result for the call.
      expression.traverse({
        enter() {
          if (this.isArrowFunctionExpression() && !this.get('body').isBlockStatement()) {
            let body = this.get('body');
            this.replaceWith(
              t.functionExpression(
                null,
                this.node.params,
                t.blockStatement([
                  t.returnStatement(
                    body.node
                  )
                ]),
                false,
                false
              )
            );
          }
          if (this.isFunction()) {
            let params = this.get('params');
            let objects = [];
            for (let param of params) {
              let name = param.get('name').node;
              let varRef = vars.get(createKeyFromPath(param));
              if (varRef) {
                objects.push(
                  t.property(
                    null,
                    t.literal(varRef.name),
                    t.identifier(name)
                  )
                );
              }
            }
            let body = this.get('body').get('body');
            let firstStatement = body[0];
            firstStatement.insertBefore(
              t.variableDeclaration('var', [
                t.variableDeclarator(
                  localContextRef,
                  t.callExpression(
                    createMemberExpression('Object', 'assign'),
                    [
                      t.objectExpression([]),
                      localContextRef,
                      t.objectExpression(objects)
                    ]
                  )
                )
              ])
            );
          }
        }
      });

      let callResultRef = findProgramPath(this).scope.generateUidIdentifier('callResult');
      let statement = findClosestStatement(expression);
      statement.insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, callResultRef),
            t.callExpression(
              createOptionalArrayJoinFunction(),
              [
                expression.node
              ]
            )
          )
        )
      );

      markup += '{{' + callResultRef.name + '}}';
    } else if (expression.isLogicalExpression()) {
      // Logical-expression are rewritten to handlebars if-helper
      let varRef = expression.scope.generateUidIdentifier('test-helper-var');
      findClosestStatement(expression).insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, varRef),
            expression.get('left').node
          )
        )
      );
      markup += '{{#if ' + varRef.name + '}}'
          + processMaybeJsxElement(expression.get('right'))
        + '{{/if}}';
    } else if (expression.isConditionalExpression()) {
      // Conditional-expression are rewritten to handlebars if-else-helper
      let varRef = expression.scope.generateUidIdentifier('test-helper-var');
      findClosestStatement(expression).insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, varRef),
            expression.get('test').node
          )
        )
      );

      markup += '{{#if ' + varRef.name + '}}'
          + processMaybeJsxElement(expression.get('consequent'))
        + '{{else}}'
          + processMaybeJsxElement(expression.get('alternate'))
        + '{{/if}}';
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
      let stmt = findClosestStatement(path);
      let expressionRef = stmt.scope.generateUidIdentifier('expression');
      stmt.insertBefore(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            createMemberExpression(localContextRef, expressionRef.name),
            path.node
          )
        )
      );
      return `{{${expressionRef.name}}}`;
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
          path.replaceWith(
            createMemberExpression(filterThisExpressions(path.get('object')).node, path.get('property').node)
          );
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
      let object = path.get('object');
      if (object.isJSXIdentifier() && object.get('name').node == 'this') {
        path.replaceWith(
          createMemberExpression(localContextRef, path.get('property').node)
        );
      } else {
        rewriteJsxThisProps(path.get('object'));
      }
    }
    return path;
  }

  // -- helper -------------------

  function findProgramPath(path) {
    return path.findParent(path => path.isProgram());
  }

  function findClassDeclaration(path) {
    return path.findParent(path => path.isClassDeclaration());
  }

  function findBabelClassDeclaration(path) {
    return path.findParent(path => {
      return path.isCallExpression()
        && path.get('callee').get('name').node == '_createClass';
    });
  }

  function findDefaultPropsIfAny(path) {
    let decl = findClassDeclaration(path);
    let defaultPropsPath;
    if (decl) {
      defaultPropsPath = decl.get('body').get('body')
        .filter(element => element.isClassProperty())
        .find(element => element.get('key').get('name').node == 'defaultProps');
    } else {
      decl = findBabelClassDeclaration(path);
      if (decl) {
        const args = decl.get('arguments');
        if (args.length > 2) {
          // Find property with key defaultProps...
          let element;
          for (let el of args[2].get('elements')) {
            for (const prop of el.get('properties')) {
              if (prop.get('key').get('name').node == 'key'
                  && prop.get('value').get('value').node == 'defaultProps') {
                element = el;
              }
            }
          }
          if (element) {
            // ... and select value node out of it
            for (let prop of element.get('properties')) {
              if (prop.get('key').get('name').node == 'value') {
                defaultPropsPath = prop;
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
    return path.findParent(path => path.isStatement());
  }

  function isInsideJSXAttribute(path) {
    return !!path.findParent(path => path.isJSXAttribute());
  }

  function isFunctionInsideJSXExpressionContainer(path) {
    let result = false;
    path = path.findParent(path => path.isFunction());
    if (path && (path.isFunction())) {
      path = path.findParent(path => path.isJSXExpressionContainer());
      if (path && path.isJSXExpressionContainer()) {
        result = true;
      }
    }
    return result;
  }

  function isThisPropsExpression(path) {
    if (path.isMemberExpression()) {
      var object = path.get('object');
      if (object.isThisExpression()
          && path.get('property').get('name').node == 'props') {
        return true;
      }
      return isThisPropsExpression(object);
    }
    return false;
  }

  function hasSpreadAttribute(attributes) {
    return attributes.find(attribute => attribute.isJSXSpreadAttribute())
      != undefined;
  }

  function createMemberExpression(...args) {
    if (args.length == 1) {
      throw new Error("Member expressions consists at least of one '.'");
    }
    let expr = typeof args[0] == 'string' ? t.identifier(args[0]) : args[0];
    for (let i = 1, n = args.length; i < n; i++) {
      let node = typeof args[i] == 'string' ? t.identifier(args[i]) : args[i];
      expr = t.memberExpression(expr, node);
    }
    return expr;
  }

  function createOptionalArrayJoinFunction() {
    return t.functionExpression(
      undefined, // id
      [ // params
        t.identifier('result')
      ],
      t.blockStatement([
        t.returnStatement(
          t.conditionalExpression(
            t.callExpression(
              createMemberExpression('Array', 'isArray'),
              [
                t.identifier('result')
              ]
            ),
            t.newExpression(
              createMemberExpression('Handlebars', 'SafeString'),
              [
                t.callExpression(
                  createMemberExpression(t.identifier('result'), 'join'),
                  [
                    t.literal('')
                  ]
                )
              ]
            ),
            t.identifier('result')
          )
        )
      ]),
      false, // generator
      false // async
    );
  }

  function createFilterSpreadAndChildrenAttributes(attribute, ref) {
    findClosestStatement(attribute).insertBefore(
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          createMemberExpression(localContextRef, ref.name),
          t.callExpression(
            createMemberExpression(
              t.callExpression(
                createMemberExpression(
                  t.callExpression(
                    createMemberExpression('Object', 'keys'),
                    [
                      createMemberExpression(localContextRef, ref.name)
                    ]
                  ),
                  'filter'
                ),
                [
                  t.functionExpression(
                    null,
                    [
                      t.identifier('key')
                    ],
                    t.blockStatement([
                      t.returnStatement(
                        t.logicalExpression(
                          '&&',
                          t.logicalExpression(
                            '!=',
                            t.identifier('key'),
                            t.literal('children')
                          ),
                          t.logicalExpression(
                            '!=',
                            t.identifier('key'),
                            t.literal('__$spread$__')
                          )
                        )
                      )
                    ])
                  )
                ]
              ),
              'reduce'
            ),
            [
              t.functionExpression(
                null,
                [
                  t.identifier('props'),
                  t.identifier('key')
                ],
                t.blockStatement([
                  t.expressionStatement(
                    t.assignmentExpression(
                      '=',
                      t.memberExpression(
                        t.identifier('props'),
                        t.identifier('key'),
                        true
                      ),
                      t.memberExpression(
                        createMemberExpression(localContextRef, ref.name),
                        t.identifier('key'),
                        true
                      )
                    )
                  ),
                  t.returnStatement(
                    t.identifier('props')
                  )
                ])
              ),
              t.objectExpression([])
            ]
          )
        )
      )
    );
  }

  function newVariableReplacement(path) {
    let key = createKeyFromPath(path);
    let varRef = vars.get(key);
    if (!varRef) {
      varRef = path.scope.generateUidIdentifier('var');
      vars.set(key, varRef);
    }
    return varRef;
  }

  function filterAttriubtes(attributes) {
    const filteredAttributes = [
      'key',
      'children'
    ];
    return attributes.filter(attribute => !attribute.has('name') || filteredAttributes.indexOf(attribute.get('name').get('name').node) == -1);
  }

  function getAttributeName(attribute) {
    const JSXAttributeAliases = {
      className: 'class',
      htmlFor: 'for',
      srcSet: 'srcset'
    };

    const raw = attribute.get('name').get('name').node
    return (raw in JSXAttributeAliases) ? JSXAttributeAliases[raw] : raw;
  }

  function isHtmlVoidElement(tagName) {
    const voidElements = [
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'keygen',
      'link',
      // Note: menuitem is not void in react
      // 'menuitem',
      'meta',
      'param',
      'source',
      'track',
      'wbr'
    ];
    return voidElements.indexOf(tagName) > -1;
  }

}
