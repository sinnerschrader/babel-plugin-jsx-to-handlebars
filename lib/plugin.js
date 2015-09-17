module.exports = function(opts) {
  let Plugin = opts.Plugin;
  let t = opts.types;

  let localContextRef = t.identifier('localContext');
  let vars;
  return new Plugin('handlebars', {
    visitor: {
      ImportDeclaration: {
        exit() {
          if (this.get('source').get('value').node == 'react') {
            this.replaceWith(
              t.importDeclaration(
                [
                  t.importDefaultSpecifier(
                    t.identifier('Handlebars')
                  )
                ],
                t.literal('handlebars')
              )
            )
          } else {
            let specifier = this.get('specifiers')[0];
            if (specifier.isImportDefaultSpecifier()) {
              let name = specifier.get('local').get('name').node;
              this.insertAfter(
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
      ClassDeclaration: {
        exit() {
          this.dangerouslyRemove();
        }
      },
      MethodDefinition: {
        enter() {
          vars = findVariablesInJSX(this);
        },
        exit(node) {
          let methodBody = node.value.body;

          // Prepend context and context.props wrapper to function body
          let contextIdentifier = t.identifier('context');
          methodBody.body = Array.prototype.concat(
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
                      findDefaultPropsIfAny(this),
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
            methodBody.body
          );

          let programPath = findProgramPath(this);
          let classID = findClassDeclaration(this).get('id').get('name').node;
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
                        methodBody,
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
      },
      VariableDeclaration: {
        enter() {
          // Add line 'context.<varname> = <varname>;'
          // after each variable declaration in methods but not in jsx-attributes
          // This fills the handlebars render-context with all local vars and react.props
          if (isInMethodDefinition(this) && !wasInsideJSXExpressionContainer(this)) {
            for (let decl of this.get('declarations')) {
              let varRef = vars.get(createKeyFromPath(decl.get('id')));
              if (varRef) {
                this.replaceWith(
                  t.expressionStatement(
                    t.assignmentExpression(
                      '=',
                      createMemberExpression(localContextRef, varRef),
                      decl.get('init').node
                    )
                  )
                );
              }
            }
          }
        }
      },
      MemberExpression: {
        enter() {
          if (this.get('object').isThisExpression()
            && this.get('property').get('name').node == 'props') {
            this.skip();
            return createMemberExpression(localContextRef, 'props');
          }
        }
      },
      JSXElement: {
        enter(node, parent, scope) {
          let programPath = findProgramPath(this);
          // Extract and insert at the top the handelbars template...
          let compileResultRef = programPath.scope.generateUidIdentifier('compiledPartial');
          let markup = processJSXElement(this);
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
          this.replaceWith(
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
  });

  function findVariablesInJSX(path) {
    let vars = new Map();
    path.traverse({
      JSXExpressionContainer: {
        enter(node, parentPath, scope) {
          let expression = this.get('expression');
          switch (expression.type) {
            case 'Identifier':
            case 'MemberExpression':
              if (!isThisPropsExpression(expression)) {
                let key = createKeyFromPath(expression);
                let varRef = vars.get(key);
                if (!varRef) {
                  varRef = scope.generateUidIdentifier('var');
                  vars.set(key, varRef);
                }
                expression.replaceWith(t.identifier(varRef.name));
              }
              break;
          }
        }
      }
    });
    return vars;
  }

  function createKeyFromPath(path) {
    switch (path.type) {
      case 'Identifier':
        return path.get('name').node;
      case 'MemberExpression':
        return createKeyFromPath(path.get('object')) + '.' + createKeyFromPath(path.get('property'));
      case 'LogicalExpression':
        return createKeyFromPath(path.get('left')) 
          + path.get('operator').node 
          + createKeyFromPath(path.get('right'));
      case 'ThisExpression':
        return 'this';
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
      tagName = '{{' + stringifyExpression(filterThisExpressions(namePath)) + '}}';
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
    var attributes = opening.get('attributes');
    if (hasSpreadAttribute(attributes)) {
      markup += processAttributesWithSpread(attributes, tagName, renderAsPartial);
    } else {
      markup += processAttributes(attributes, renderAsPartial);
    }

    if (selfClosing) {
      markup += ' />';
    } else {
      if (renderAsPartial) {
       markup += '}}';
     } else {
        markup += '>';
      }
    }
    
    // ... children...
    path.traverse({
      enter() {
        if (this.isJSXElement()) {
          markup += processJSXElement(this);
        } else if (this.isJSXExpressionContainer() && !isInsideJSXAttribute(this)) {
          markup += processJSXExpressionContainer.bind(this)();
        } else if (this.isJSXOpeningElement() || this.isJSXClosingElement()) {
          // Skip
        } else if (this.isLiteral()) {
          markup += this.get('value').node;
        } else {
          throw new Error('Unknown element during JSX processing:  ' + this.type);
        }
        this.skip();
      }
    });

    // ... and closing tag
    if (renderAsPartial) {
      markup += '{{/' + tagName + '}}';
    } else if (!selfClosing) {
      markup += '</' + tagName + '>';
    }
    return markup;
  }

  function processAttributesWithSpread(attributes, tagName, renderAsPartial) {
    let objects = [];
    for (let attribute of attributes) {
      if (attribute.isJSXSpreadAttribute()) {
        objects.push(attribute.get('argument').node);
      } else {
        let name = getAttributeName(attribute);
        let value;
        let valuePath = attribute.get('value');
        if (valuePath.isJSXExpressionContainer()) {
          value = valuePath.get('expression').node;
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
    let ref = attributes[0].scope.generateUidIdentifier('_' + tagName + '_attributes_');
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
    return '{{#each ' + ref.name + '}} {{@key}}="{{this}}"{{/each}}';
  }

  function processAttributes(attributes, renderAsPartial) {
    let markup = '';
    for (let attribute of attributes) {
      markup += ' ' + getAttributeName(attribute) + '=';
      let value = attribute.get('value');
      if (value.isJSXExpressionContainer()) {
        if (!renderAsPartial) {
          markup += '{{'
        }
        markup += stringifyExpression(filterThisExpressions(value.get('expression')));
        if (!renderAsPartial) {
          markup += '}}'
        }
      } else if (value.isLiteral()) {
        markup += '"' + value.get('value').node + '"';
      } else {
        throw new Error('Unknown attribute node type: ' + attribute.get('type').node);
      }
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
            return;
          }
          if (this.isFunctionExpression()) {
            this.setData('was-jsx', true);
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
                      localContextRef
                    ]
                  )
                )
              ])
            );
            let params = this.get('params');
            for (let i = params.length - 1; i >= 0; i--) {
              let name = params[i].get('name').node;
              var varRef = vars.get(createKeyFromPath(params[i]));
              if (varRef) {
                firstStatement.insertBefore(
                  t.expressionStatement(
                    t.assignmentExpression(
                      '=',
                      createMemberExpression(localContextRef, varRef.name),
                      t.identifier(name)
                    )
                  )
                );
              }
            }
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
      return expressionRef.name;
    }
  }

  function filterThisExpressions(path) {
    // Remove all this-expression from the ast-path, because handlebars does not have a this
    // context. This is emulated with the context and context.props variables.
    switch (path.get('type').node) {
      case 'Literal':
        return path;
      case 'Identifier':
        return path;
      case 'BinaryExpression':
        path.replaceWith(
          t.binaryExpression(
            path.get('operator').node,
            filterThisExpressions(path.get('left')).node,
            filterThisExpressions(path.get('right')).node
          )
        );
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
      case 'CallExpression':
        if (path.get('callee').isMemberExpression()) {
          path.replaceWith(
            t.callExpression(filterThisExpressions(path.get('callee')).node, path.get('arguments').node)
          );
        }
        return path;
      case 'JSXMemberExpression':
        let object = path.get('object');
        if (object.isJSXMemberExpression()) {
          path.replaceWith(
            t.jSXMemberExpression(
              filterThisExpressions(object).node,
              path.get('property').node
            )
          );
        } else {
          if (object.get('name').node == 'this') {
            path.replaceWith(
              path.get('property').node
            )
          }
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
      case 'BinaryExpression':
        return stringifyExpression(path.get('left'))
          + path.get('operator').node
          + stringifyExpression(path.get('right'));
      case 'MemberExpression':
        return stringifyExpression(path.get('object')) + '.' + stringifyExpression(path.get('property'));
      case 'ThisExpression':
        return 'this';
      case 'JSXMemberExpression':
        return stringifyExpression(path.get('object')) + '.' + stringifyExpression(path.get('property'));
      case 'JSXIdentifier':
        return path.get('name').node;
    }
    throw new Error('Unknown expression node type: ' + path.type);
  }

  // -- helper -------------------

  function findProgramPath(path) {
    return path.findParent(path => path.isProgram());
  }

  function findClassDeclaration(path) {
    return path.findParent(path => path.isClassDeclaration());
  }

  function findDefaultPropsIfAny(path) {
    path = findClassDeclaration(path);
    let defaultPropsPath = path.get('body').get('body')
      .filter(element => element.isClassProperty())
      .filter(element => element.get('key').get('name').node == 'defaultProps');
    if (defaultPropsPath.length > 0) {
      return defaultPropsPath[0].get('value').node;
    }
    return t.objectExpression([]);
  }

  function findClosestStatement(path) {
    return path.findParent(path => path.isStatement());
  }

  function isInMethodDefinition(path) {
    return path.findParent(path => path.isMethodDefinition());
  }

  function wasInsideJSXExpressionContainer(path) {
    return !!path.findParent(path => path.getData('was-jsx'));
  }

  function isInsideJSXAttribute(path) {
    return !!path.findParent(path => path.isJSXAttribute());
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

  function getAttributeName(attribute) {
    const JSXAttributeAliases = {
      className: 'class',
      htmlFor: 'for',
      srcSet: 'srcset'
    };

    const raw = attribute.get('name').get('name').node
    return (raw in JSXAttributeAliases) ? JSXAttributeAliases[raw] : raw;
  }

}
