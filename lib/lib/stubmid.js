var path = require('path');
var fs = require("fs");
var JSON5 = require("json5");
var yaml = require('yamljs');
var deferred = require('deferred');
var bodyParser = require('body-parser');
var check = require('./check');
var Stubrec = require('stubrec');
var glob = require('glob');

module.exports = new StubMid();
function StubMid() { }

StubMid.prototype.loadEntry = function(entryPath, options) {
  this.entries = yaml.load(entryPath);
  options = options || {};
  this.basepath = options.basepath || path.dirname(entryPath);
  this.debug = options.debug || false;
  this.pretty = options.pretty || false;
  this.looseCompare = options.looseCompare || false;
  this.cors = options.cors || true;
};

StubMid.prototype.parseJSON5 = function(data) {
  var result;
  try {
    result = JSON5.parse(""+data);
  } catch (e) {
    throw e;
  }
  return result;
};

StubMid.prototype.getFinalEntries = function(entries){
  return entries.filter(function(entry){
    return entry.request.url === "$finally";
  }).map(function(entry){
    entry.request.url = "*";
    return entry;
  });
};

StubMid.prototype.getNormalEntries = function(entries){
  return entries.filter(function(entry){
    return entry.request.url[0] !== "$";
  });
};

StubMid.prototype.fileFromRequest = function(entryUrl, filepath, req, basepath) {
  var appendJson = appendJson === undefined ? true : appendJson;
  var req = req || {};
  var basepath = basepath || "";
  var url = entryUrl;
  var file = filepath;
  var method = req.method ? req.method.toLowerCase() : "";
  var reqBody = req.body || {};
  if (file) return file;
  var isSlash = url === "/";
  if (isSlash) {
    // / -> /index
    url += 'index';
  } else {
    // /abc/test/ -> /abc/test
    var hasLastSlash = url.lastIndexOf("/") === (url.length-1);
    if (hasLastSlash) url = url.substring(0, url.length-1);
  }

  // append method
  // /abc/test_get
  if (reqBody.jsonrpc) {
    // jsonrpc
    url = url + "/" + reqBody.method;
  } else if (method) {
    // not jsonrpc
    url = url + "_" + method;
  }

  // /abc/test_get -> /abc/test_get.json
  url += '.json';

  // if /abc/:id
  if (url.indexOf(":") >= 0) {
    // /abc/:id -> /abc/*
    temp = url.replace(/:[a-zA-Z0-9]+/g, '*');
    var files = glob.sync(basepath + temp);
    var found = "";
    files.some(function(file) {
      var replacedPath = file.replace(basepath, "");
      if (replacedPath === req.url + "_" + method + ".json") {
        found = replacedPath;
        return true;
      }
      return false;
    });
    if (found) {
      url = found;
    } else {
      url = url.replace(/:/g, '');
    }
  }
  file = basepath + url;

  return file;
};
