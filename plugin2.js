module.exports = function(opts) {
  let Plugin = opts.Plugin;
  let t = opts.types;

  let dependencies = [];
  return new Plugin('handlebars', {
    visitor: {
      ImportDeclaration: {
        enter() {
          // Collect import statements as dependencies
          dependencies.push({
            id: this.get('source').get('value').node,
            name: this.get('specifiers')[0].get('local').get('name').node
          })
          this.dangerouslyRemove();
        }
      },
      ClassDeclaration: {
        exit() {
          this.dangerouslyRemove();
        }
      },
      MethodDefinition: {
        exit(node) {
          let methodBody = node.value.body;

          // Prepend context and context.props wrapper to function body
          let contextIdentifier = t.identifier('context');
          methodBody.body = Array.prototype.concat(
            [
              // context = context || {};
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  contextIdentifier,
                  t.logicalExpression(
                    '||',
                    contextIdentifier,
                    t.objectExpression([])
                  )
                )
              ),
              // context.props = context;
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  createMemberExpression('context', 'props'),
                  createMemberExpression('execOptions', 'hash')
                )
              ),
              // context.props.children = new Handlebars.SafeString(execOptions.data['partial-block'](context));
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  createMemberExpression('context', 'props', 'children'),
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
          // Add mapping comment for dependencies
          programPath.parent.comments[0].value =
            '\n'
            + dependencies.map(dependency => ` ${dependency.name} -> ${dependency.id}`)
              .join('\n')
            + '\n';

          // export default function...
          programPath.node.body.push(
            t.exportDefaultDeclaration(
              t.functionExpression(
                null, // id
                [], // params
                t.blockStatement([
                  t.expressionStatement(
                    t.callExpression(
                      createMemberExpression('Handlebars', 'registerPartial'),
                      [
                        t.literal(findClassDeclaration(this).get('id').get('name').node),
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
              )
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
              this.insertAfter(
                t.expressionStatement(
                  t.assignmentExpression(
                    '=',
                    createMemberExpression('context', decl.get('id').node),
                    decl.get('id').node
                  )
                )
              );
            }
          }
        }
      },
      MemberExpression: {
        enter() {
          if (this.get('object').isThisExpression()
            && this.get('property').get('name').node == 'props') {
            this.skip();
            return createMemberExpression('context', 'props');
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
                    t.identifier('context'),
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

  function processJSXElement(path) {
    let markup = '';
    // Opening tag...
    let opening = path.get('openingElement');
    let selfClosing = opening.get('selfClosing').node;
    markup += '<' + opening.get('name').get('name').node;
    // ... attributes...
    for (let attribute of opening.get('attributes')) {
      if (attribute.isJSXSpreadAttribute()) {
        throw new Error('Spread attributes are not supported.');
      } else {
        markup += ' ' + attribute.get('name').get('name').node + '="';
        let value = attribute.get('value');
        if (value.isJSXExpressionContainer()) {
          markup += '{{' + stringifyExpression(filterThisExpressions(value.get('expression'))) + '}}';
        } else if (value.isLiteral()) {
          markup += value.get('value').node;
        } else {
          throw new Error('Unknown attribute node type:', attribute.get('type'));
        }
        markup += '"';
      }
    }
    if (selfClosing) {
      markup += ' />';
    } else {
      markup += '>';
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
    if (!selfClosing) {
      markup += '</' + path.get('closingElement').get('name').get('name').node + '>';
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
          if (this.isFunctionExpression()) {
            this.setData('was-jsx', true);
            let body = this.get('body').get('body');
            let firstStatement = body[0];
            firstStatement.insertBefore(
              t.variableDeclaration('var', [
                t.variableDeclarator(
                  t.identifier('context'),
                  t.callExpression(
                    createMemberExpression('Object', 'assign'),
                    [
                      t.objectExpression([]),
                      t.identifier('context')
                    ]
                  )
                )
              ])
            );
            let params = this.get('params');
            for (let i = params.length - 1; i >= 0; i--) {
              let name = params[i].get('name').node;
              firstStatement.insertBefore(
                t.expressionStatement(
                  t.assignmentExpression(
                    '=',
                    createMemberExpression('context', name),
                    t.identifier(name)
                  )
                )
              );
            }
          }
        }
      });

      let callResultRef = findProgramPath(this).scope.generateUidIdentifier('callResult');
      let statement = findClosestStatement(expression);
      statement.insertBefore(
        t.variableDeclaration('var', [
          t.variableDeclarator(
            callResultRef,
            t.callExpression(
              createOptionalArrayJoinFunction(),
              [
                expression.node
              ]
            )
          )
        ])
      );

      markup += '{{' + callResultRef.name + '}}';
    } else if (expression.isLogicalExpression()) {
      // Logical-expression are rewritten to handlebars if-helper
      let testRef = findProgramPath(this).scope.generateUidIdentifier('test');
      findClosestStatement(expression).insertBefore(
        t.variableDeclaration('var', [
          t.variableDeclarator(
            testRef,
            expression.get('left').node
          )
        ])
      );
      markup += '{{#if ' + testRef.name + '}}'
          + processJSXElement(expression.get('right'))
        + '{{/if}}';
    } else if (expression.isConditionalExpression()) {
      // Conditional-expression are rewritten to handlebars if-else-helper
      let testRef = findProgramPath(this).scope.generateUidIdentifier('test');
      findClosestStatement(expression).insertBefore(
        t.variableDeclaration('var', [
          t.variableDeclarator(
            testRef,
            expression.get('test').node
          )
        ])
      );

      let consequent = expression.get('consequent');
      if (consequent.isJSXElement()) {
        consequent = processJSXElement(consequent);
      } else {
        consequent = stringifyExpression(filterThisExpressions(consequent));
      }
      
      let alternate = expression.get('alternate');
      if (alternate.isJSXElement()) {
        alternate = processJSXElement(alternate);
      } else {
        alternate = stringifyExpression(filterThisExpressions(alternate));
      }

      markup += '{{#if ' + testRef.name + '}}'
          + consequent
        + '{{else}}'
          + alternate
        + '{{/if}}';
    } else {
      // TODO: Check if this is sufficient
      markup += '{{' + stringifyExpression(filterThisExpressions(expression)) + '}}';
    }
    return markup;
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

}
