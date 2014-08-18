var express = require('express');
var http = require('http');
var serveStatic = require('serve-static');
var stubcell = require('..');
var app = express();
 
app.use(serveStatic('public', { index: ['index.html']}));
app.use(stubcell('/api', 'example.yaml'));
 
app.listen(3000);

