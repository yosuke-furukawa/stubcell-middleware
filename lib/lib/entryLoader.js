module.exports = function(baseURL, entryPath, options) {
  this.entries = yaml.load(entryPath);
  options = options || {};
  this.basepath = options.basepath || path.dirname(entryPath);
  this.debug = options.debug || false;
  this.pretty = options.pretty || false;
  this.record = options.record || {};
  this.looseCompare = options.looseCompare || false;
  this.cors = options.cors || true;
};

