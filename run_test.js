const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'vscode') {
    return require('./mock_vscode.js');
  }
  return originalRequire.apply(this, arguments);
};
require('ts-node/register');
require('./test_graph.ts');
