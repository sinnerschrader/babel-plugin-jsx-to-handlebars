module.exports = function(opts) {
  var Plugin = opts.Plugin;
  var t = opts.types;

  var blockStack = new Stack();
  return new Plugin('handlebars', {
    visitor: {
      MethodDefinition: {
        exit: function(node) {
          var methodBody = node.value.body;

          methodBody.body = Array.prototype.concat(
            [
              // context = context || {};
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.identifier('context'),
                  t.logicalExpression(
                    '||',
                    t.identifier('context'),
                    t.objectExpression([])
                  )
                )
              ),
              // context.props = {};
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  createMemberExpression('context', 'props'),
                  t.objectExpression([])
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
                          t.identifier('context')
                        ]
                      )
                    ]
                  )
                )
              )
            ],
            methodBody.body
          );

          findProgramPath(this).node.body.push(
            t.expressionStatement(
              t.callExpression(
                createMemberExpression('Handlebars', 'registerPartial'),
                [
                  t.literal(findClassDeclaration(this).node.id.name),
                  t.functionExpression(
                    t.identifier('partial'), // id
                    [ // params
                      t.identifier('context'),
                      t.identifier('execOptions')
                    ],
                    methodBody,
                    false, // generator
                    false // async
                  )
                ]
              )
            )
          );
        }
      },
      FunctionExpression: {
        enter: function(node, parent, scope) {
          var currentBlock = blockStack.peek();
          if (currentBlock) {
            var current = currentBlock.jsxStack.peek();
            if (current && current.inExpressionContainer) {
              for (var i = node.params.length - 1; i >= 0; i--) {
                node.body.body.unshift(
                  t.expressionStatement(
                    t.assignmentExpression(
                      '=',
                      createMemberExpression('context', node.params[i].name),
                      t.identifier(node.params[i].name)
                    )
                  )
                );
              }
              node.body.body.unshift(
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
            }
          }
          var compileResultRef = findProgramPath(this).scope.generateUidIdentifier('compiledPartial');
          blockStack.push({
            parent: currentBlock,
            scope: scope,
            jsxStack: new Stack(),
            markup: '',
            compileResultRef: compileResultRef
          });
        },
        exit: function(node) {
          var currentBlock = blockStack.pop();
          findProgramPath(this).node.body.push(
            t.variableDeclaration('var', [
              t.variableDeclarator(
                currentBlock.compileResultRef,
                t.callExpression(
                  createMemberExpression('Handlebars', 'compile'),
                  [
                    t.literal(currentBlock.markup)
                  ]
                )
              )
            ])
          );
        }
      },
      VariableDeclaration: {
        enter: function(node) {
          var addVarsToContext = true;
          var currentBlock = blockStack.peek();
          if (currentBlock && currentBlock.parent) {
            var current = currentBlock.parent.jsxStack.peek();
            if (current && current.inExpressionContainer) {
              addVarsToContext = false;
            }
          }
          if (addVarsToContext) {
            for (var i = 0, n = node.declarations.length; i < n; i++) {
              var decl = node.declarations[i];
              this.insertAfter(
                t.expressionStatement(
                  t.assignmentExpression(
                    '=',
                    createMemberExpression('context', decl.id),
                    decl.id
                  )
                )
              );
            }
          }
        }
      },
      CallExpression: {
        exit: function(node, parent, scope) {
          var currentBlock = blockStack.peek();
          var partialResultRef = scope.generateUidIdentifier('partialResult');
          this.setData('partialResult', partialResultRef);
          if (currentBlock.insertBefore) {
            // TODO....
            // currentBlock.insertBefore(
            //   t.variableDeclaration('var', [
            //     t.variableDeclarator(
            //       partialResultRef,
            //       node
            //     )
            //   ])
            // );
          }
       }
      },
      ReturnStatement: {
        enter: function(node) {
          var currentBlock = blockStack.peek();
          currentBlock.insertBefore = this.insertBefore.bind(this);
        }
      },
      JSXElement: {
        enter: function(node, parent, scope) {
          var currentBlock = blockStack.peek();
          currentBlock.jsxStack.push({
            node: node,
            element: true,
          });
          processOpeningTag(currentBlock, this.get('openingElement'));
        },
        exit: function() {
          var currentBlock = blockStack.peek();
          var current = currentBlock.jsxStack.pop();
          current.element = false;
          processClosingTag(currentBlock, current.node.closingElement);
          
          if (currentBlock.jsxStack.isEmpty()) {
            return t.callExpression(
              createMemberExpression(currentBlock.compileResultRef, 'call'),
              [
                t.thisExpression(),
                t.identifier('context'),
                t.identifier('execOptions')
              ]
            );
          }
        }
      },
      JSXOpeningElement: {
        enter: function() {
          blockStack.peek().jsxStack.peek().opening = true;
        },
        exit: function() {
          blockStack.peek().jsxStack.peek().opening = false;
        }
      },
      JSXExpressionContainer: {
        enter: function(node, parent, scope) {
          var currentBlock = blockStack.peek();
          var current = currentBlock.jsxStack.peek();
          current.inExpressionContainer = true;
        },
        exit: function(node) {
          var currentBlock = blockStack.peek();
          var current = currentBlock.jsxStack.peek();
          current.inExpressionContainer = false;
          if (current && !current.opening) {
            currentBlock.markup += '{{' + stringifyExpression(filterThisExpressions(this.get('expression'))) + '}}';
          }
        }
      }
    }
  });

  function processOpeningTag(block, path) {
    block.markup += '<' + path.get('name').get('name').node;
    var attributePaths = path.get('attributes');
    for (var i = 0, n = attributePaths.length; i < n; i++) {
      processAttribute(block, attributePaths[i]);
    }
    if (path.get('selfClosing').node) {
      block.markup += ' />';
    } else {
      block.markup += '>';
    }
  }

  function processAttribute(block, path) {
    if (path.isJSXSpreadAttribute()) {
      throw new Error('Spread attributes are not supported.');
    } else {
      block.markup += ' ' + path.get('name').get('name').node + '="';
      var value = path.get('value');
      if (value.isJSXExpressionContainer()) {
        block.markup += '{{' + stringifyExpression(filterThisExpressions(value.get('expression'))) + '}}';
      } else if (value.isLiteral()) {
        block.markup += value.get('value').node;
      } else {
        throw new Error('Unknown attribute node type:', path.get('type'));
      }
      block.markup += '"';
    }
  }

  function processClosingTag(block, node) {
    if (node) {
      block.markup += '</' + node.name.name + '>';
    }
  }

  function filterThisExpressions(path) {
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
    switch (path.get('type').node) {
      case 'Identifier':
        return path.get('name').node;
      case 'MemberExpression':
        return stringifyExpression(path.get('object')) + '.' + stringifyExpression(path.get('property'));
      case 'ThisExpression':
        return 'this';
      case 'CallExpression':
        return path.getData('partialResult').name;
    }
    throw new Error('Unknown expression node type: ' + path.type);
  }

  // -- helper -------------------

  function findProgramPath(path) {
    return path.findParent(function(path) { return path.isProgram(); })
  }

  function findClassDeclaration(path) {
    return path.findParent(function(path) { return path.isClassDeclaration(); })
  }

  function createMemberExpression() {
    if (arguments.length == 1) {
      throw new Error("Member expressions consists at least of one '.'");
    }
    var expr = typeof arguments[0] == 'string' ? t.identifier(arguments[0]) : arguments[0];
    for (var i = 1, n = arguments.length; i < n; i++) {
      var node = typeof arguments[i] == 'string' ? t.identifier(arguments[i]) : arguments[i];
      expr = t.memberExpression(expr, node);
    }
    return expr;
  }
}

function Stack() {
  this.stack = [];
}
Stack.prototype.isEmpty = function() {
  return this.stack.length == 0;
}
Stack.prototype.push = function(value) {
  this.stack.push(value);
}
Stack.prototype.pop = function() {
  if (this.stack.lengh == 0) {
    throw new Error('Stack is empty');
  }
  return this.stack.pop();
}
Stack.prototype.peek = function() {
  if (this.stack.lengh == 0) {
    throw new Error('Stack is empty');
  }
  return this.stack[this.stack.length - 1];
}
