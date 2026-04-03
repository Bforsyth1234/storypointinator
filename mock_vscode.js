module.exports = {
  workspace: {
    getConfiguration: () => ({ get: () => 'fake-key' })
  },
  window: {
    showErrorMessage: console.error
  }
};
