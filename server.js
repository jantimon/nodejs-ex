//  OpenShift sample Node application
var express = require('express'),
    app     = express(),
    httpProxy = require('http-proxy'),
    glob = require('glob'),
    path = require('path'),
    fs = require('fs'),
    compression = require('compression');

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'
    target = process.env.TARGET || 'https://www.wikipedia.org/';

var proxy = httpProxy.createServer({});
var readFilePromise = (path) => new Promise((resolve, reject) => {
  fs.readFile(path, (err, result) => {
    if (err) {
      return reject(err);
     }
     return resolve(result.toString());
  })
});

const fileCache = {};
const overwritesDir = path.resolve(__dirname, 'overwrites');
function getFile(reqUrl) {
  const targetFile = path.resolve(overwritesDir, '.' + reqUrl);
  if (!fileCache[targetFile]) {
    fileCache[targetFile] = readFilePromise(targetFile);
  }
  return fileCache[targetFile];
}

app.use(compression());

app.get('/clear', (req, res) => {
  Object.keys(fileCache).forEach((key) => {
    delete(fileCache[key]);
  });
  res.send('File Cache Empty. ' + new Date());
  res.end();
});

app.use('/', (req, res, next) => {
  getFile(req.url).then((content) => {
    res.send(content)
  }).catch((err) => {
    if (err && ['ENOENT', 'EISDIR'].indexOf(err.code) !== -1) {
      next()
    } else {
      next(err);
    }
  });
});

app.use('/', (req, res) => proxy.web(req, res, {
  target: target,
  changeOrigin: true,
  autoRewrite: true,
  protocolRewrite: 'http'
}));

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
