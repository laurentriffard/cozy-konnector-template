module.exports = Object.assign(require('./env.js'), {
  NODE_ENV: 'standalone',
  COZY_FIELDS: `{"connector": "Semidao", "account": "noid", "folder_to_save": "folderPath"}`,
  DEBUG: '*'
})
