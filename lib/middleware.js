var path = require('path');
var fs = require("fs");
var JSON5 = require("json5");
var deferred = require('deferred');
var check = require('./check');
var Stubrec = require('stubrec');
var glob = require('glob');
var yaml = require('yamljs');
var check = require('./check');
var cors = require('./cors');

var stubcell = exports = module.exports = function(baseURL, entryPath, options) { 
  console.log(baseURL);
  stubcell.baseURL = baseURL.lastIndexOf("/") !== baseURL.length-1 ? baseURL + "/" : baseURL;
  stubcell.entries = yaml.load(entryPath);
  options = options || {};
  stubcell.basepath = options.basepath || path.dirname(entryPath);
  stubcell.debug = options.debug || false;
  stubcell.pretty = options.pretty || false;
  stubcell.record = options.record || {};
  stubcell.looseCompare = options.looseCompare || false;
  stubcell.cors = options.cors || true;
  var normalEntries = stubcell._getNormalEntries(stubcell.entries);
  var finalEntries  = stubcell._getFinalEntries(stubcell.entries);

  if(stubcell.debug){
    var prettify = stubcell.pretty ?
      function(obj){ return "\n" + JSON.stringify(obj, null, 4);} :
      JSON.stringify;

    this.all("*", function(req, res, next){
      console.log("\033[36m" + "[entry url] =" + prettify(req.url) +"\033[39m");
      console.log("\033[36m" + "[request headers] =", prettify(req.headers) +"\033[39m");
      if(Object.keys(req.query).length > 0)
        console.log("\033[36m" + "[request query] =", prettify(req.query) +"\033[39m");
      if(Object.keys(req.body).length > 0)
        console.log("\033[36m" + "[request body] =", prettify(req.body) +"\033[39m");
      next();
    });
  }

  normalEntries.forEach(stubcell._setupEntry.bind(this));
  if(finalEntries.length > 0) {
    finalEntries.forEach(stubcell._setupEntry.bind(this));
  }
  stubcell._setRecordingEntries(stubcell.record);
};

stubcell._parseJSON5 = function(data) {
  var result;
  try {
    result = JSON5.parse(""+data);
  } catch (e) {
    throw e;
  }
  return result;
};

stubcell._getFinalEntries = function(entries){
  return entries.filter(function(entry){
    return entry.request.url === "$finally";
  }).map(function(entry){
    entry.request.url = "*";
    return entry;
  });
};

stubcell._getNormalEntries = function(entries){
  return entries.filter(function(entry){
    return entry.request.url[0] !== "$";
  });
};

stubcell._setRecordingEntries = function(record){
  if(Object.keys(stubcell.record).length === 0) return;

  this.use(function(req, res, next) {
    var record = stubcell.record;
    record.basepath = record.basepath || stubcell.basepath;
    var storePath = stubcell.fileFromRequest(req.url, "", req);
    var stubrec = new Stubrec(record);
    stubrec.record(storePath, req, res);
  }.bind(this));
};

stubcell.fileFromRequest = function(entryUrl, filepath, req, basepath) {
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

stubcell._setupEntry = function(entry) {
  // HTTP method
  var method = entry.request.method;
  if (!method) throw new Error("need method get, post, put, delete");
  method = method.toLowerCase();
  // HTTP url
  var entryUrl = entry.request.url;
  if (!entryUrl) throw new Error("need url");
  // HTTP body
  var entryBody = entry.request.body || {};
  var expectJSONRPC = entryBody.jsonrpc;
  if (expectJSONRPC) method = "use";
  // HTTP queryparams
  var entryQuery = entry.request.query || {};


  console.log(this);
  this[method](stubcell.baseURL + entryUrl, function(req, res, next) {
    var hasContentType = false;
    var reqBody = req.body || {};
    var reqQuery = req.query || {};

    var isJSONRPC = expectJSONRPC && entryBody.jsonrpc == reqBody.jsonrpc;

    // CHECK request match
    if (isJSONRPC) {
      var match = check.jsonrpc(entryBody, reqBody, stubcell.looseCompare);
      if (!match) return next();
    } else {
      if(entry.request.body) {
        var match = check.body(entryBody, reqBody, stubcell.looseCompare);
        if (!match) return next();
      }
      if(entry.request.query) {
        var match = check.query(entryQuery, reqQuery, stubcell.looseCompare);
        if (!match) return next();
      }
    }
    //response header
    var response = entry.response;
    var headers = response.headers || {};
    Object.keys(headers).forEach(function(key) {
      res.setHeader(key, headers[key]);
    });
    if (!hasContentType) {
      res.setHeader('Content-Type', 'application/json');
    }
    // response data
    res.statusCode = response.status;

    var file = response.file ?
      response.file.indexOf("/") === 0 ?
      response.file :
      path.join(stubcell.basepath, response.file)
        : stubcell.fileFromRequest(entryUrl, response.file, req, stubcell.basepath);

        if(stubcell.cors){
          cors(stubcell.cors, res);
        }

        deferred(function(){
          if (response.body) return response.body;

          var d = deferred();
          fs.readFile(file, function(err, data){
            err ? d.reject(err) : d.resolve("" + data);
          });
          return d.promise;
        }())
        .then(function(body){
          var data = null;
          try {
            data = stubcell._parseJSON5(body);
            if (isJSONRPC) {
              data.id = reqBody.id;
              data.jsonrpc = reqBody.jsonrpc;
            }
          } catch(e) {
            console.log("\033[31m" + "Error occurred in " + (response.body || file) + "\033[39m");
            console.log(e.stack);
            throw e;
          }
          return data;
        })
        .then(function(data){
          res.send(data);
        }, function(err){
          res.send(500, { error : err.message });
        });
  });
};
