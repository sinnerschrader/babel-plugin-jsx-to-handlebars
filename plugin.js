var runtimeRef;
var dependencies = [];

module.exports = function(opts) {
  var Plugin = opts.Plugin;
  var t = opts.types;

  var blockStack = [];
  var optionsRef;
  return new Plugin('handlebars', {
    visitor: {
      Program: {
        enter: function() {
          runtimeRef = this.scope.generateUidIdentifier('runtime');
          optionsRef = this.scope.generateUidIdentifier('options');
        },
        exit: function(node) {
          // Write runtime require statement
          node.body.unshift(
            t.variableDeclaration('var', [
              t.variableDeclarator(
                runtimeRef, 
                t.callExpression(
                  t.identifier('require'),
                  [
                    t.literal('patternplate-handlebars/runtime')
                  ]
                )
              )
            ])
          );
        }
      },
      ImportDeclaration: {
        enter: function(node) {
          // Collect import statements as dependencies
          dependencies.push({
            id: node.source.value,
            name: node.specifiers[0].local.name
          })
          this.dangerouslyRemove();
        }
      },
      ExportDefaultDeclaration: {
        exit: function(node) {
          // Add mapping comment for dependencies
          for (var i = 0, n = dependencies.length; i < n; i++) {
            var dependency = dependencies[i];
            (node.leadingComments = node.leadingComments || []).push({
              type: 'CommentLine',
              value: ' ' + dependency.id + ' -> ' + dependency.name
            })
          }
        }
      },
      ClassDeclaration: {
        exit: function(node) {
          // Find render method...
          var renderMethod;
          for (var i = 0, n = node.body.body.length; i < n; i++) {
            var methodDecl = node.body.body[i];
            if (t.isMethodDefinition(methodDecl) && methodDecl.key.name === 'render') {
              renderMethod = methodDecl.value;
              renderMethod.params.push(optionsRef);
            }
          }
          if (!renderMethod) {
            throw new Error('No render method found');
          }
          // ... and rewrite to function which does Handlebars.registerHelper
          return t.functionExpression(
            null, // id
            [], // params
            t.blockStatement([
              t.callExpression(
                t.memberExpression(t.identifier('Handlebars'), t.identifier('registerHelper')), 
                [
                    t.literal(node.id.name),
                    renderMethod
                ]
              )
            ]),
            false, // generator
            false // async
          );
        }
      },
      FunctionExpression: {
        enter: function(node) {
          blockStack.push({
            jsxStack: []
          });
        },
        exit: function(node) {
          blockStack.pop();
        }
      },
      JSXElement: {
        enter: function(node, parent) {
          // Create new local stackframe
          var currentBlock = peek(blockStack);
          if (!currentBlock.sourceRef) {
            currentBlock.propsRef = this.scope.generateUidIdentifier('props');
            currentBlock.sourceRef = this.scope.generateUidIdentifier('source');
            currentBlock.writer = createWriter(t, currentBlock.sourceRef, this.parentPath);
            currentBlock.writer.addVariable(currentBlock.propsRef, 
              t.memberExpression(optionsRef, t.identifier('hash'))
            );
            currentBlock.writer.addVariable(currentBlock.sourceRef, t.literal(''));
          }
          currentBlock['jsxStack'].push({
            node: node,
            element: true
          });

          // Write opening html + attributes
          processOpeningElement(node.openingElement, currentBlock.writer, t);
        },
        exit: function(node, parent) {
          // Remove local stackframe
          var currentBlock = peek(blockStack);
          var jsxStack = currentBlock['jsxStack'];
          var current = jsxStack.pop();
          if (!current.node.openingElement.selfClosing) {
            // Write closing html
            processClosingElement(current.node.closingElement, currentBlock.writer);
          }
          current.element = false;
          if (jsxStack.length == 0) {
            // Rewrite return statement
            return t.newExpression(
              t.memberExpression(t.identifier('Handlebars'), t.identifier('SafeString')),
              [
                t.callExpression(
                  t.memberExpression(currentBlock.sourceRef, t.identifier('join')),
                  [
                    t.literal('')
                  ]
                )
              ]
            );
          }
        }
      },
      JSXOpeningElement: {
        enter: function() {
          var current = peek(blockStack)['jsxStack'];
          current.opening = true;
        },
        exit: function() {
          var current = peek(blockStack)['jsxStack'];
          current.opening = false;
        }
      },
      JSXExpressionContainer: {
        exit: function(node, parent) {
          var currentBlock = peek(blockStack);
          var current = currentBlock['jsxStack'];
          if (current && !current.opening && currentBlock.writer) {
            currentBlock.writer.addToHtml(node.expression);
          }
        }
      },
      MemberExpression: {
        exit: function(node) {
          // Rewrite this reference to local scoped variable
          if (t.isMemberExpression(node.object)
              && t.isThisExpression(node.object.object)) {
            var currentBlock = peek(blockStack);
            return t.memberExpression(currentBlock.propsRef, node.property);
          }
        }
      }
    }
  });
};

/**
 * Process opening html tag and attributes
 */
function processOpeningElement(node, writer, t) {
  writer.addToHtml('<' + node.name.name)
  for (var i = 0, n = node.attributes.length; i < n; i++) {
    processAttribute(node.attributes[i], writer, t);
  }
  writer.addToHtml((node.selfClosing ? ' /' : '') + '>');
}

/**
 * Process attributes (including jsx-spread)
 */
function processAttribute(node, writer, t) {
  if (t.isJSXSpreadAttribute(node)) {
    writer.addToHtml(
      t.callExpression(
        t.memberExpression(runtimeRef, t.identifier('spread')),
        [
          node.argument
        ]
      )
    );
  } else {
    writer.addToHtml(' ' + node.name.name + '="');
    var value = node.value;
    if (t.isJSXExpressionContainer(value)) {
      value = value.expression;
    }
    writer.addToHtml(value);
    writer.addToHtml('"');
  }
}

/**
 * Process closing html tags
 */
function processClosingElement(node, writer) {
  writer.addToHtml('</' + node.name.name + '>')
}

/**
 * AST helper functions
 */
function createWriter(t, sourceRef, renderFunctionRef) {
  return {
    addVariable: function(ref, obj) {
      renderFunctionRef.insertBefore(
        t.variableDeclaration('var', [
          t.variableDeclarator(ref, obj)
        ])
      );
    },
    addToHtml: function(obj) {
      if (typeof obj === 'string') {
        obj = t.literal(obj);
      }
      renderFunctionRef.insertBefore(
        t.assignmentExpression(
          '=',
          sourceRef,
          t.callExpression(
            t.memberExpression(sourceRef, t.identifier('concat')),
            [obj]
          )
        )
      );
    }
  }
}

function peek(stack) {
  return stack.length > 0 ? stack[stack.length - 1] : undefined;
}
