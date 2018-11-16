'use strict';

const fs = require('fs');

const DIR = ".";

walk(DIR, function(err, results) {
  if (err) throw err;
  const files = results.filter(f => f.endsWith(".json"));

  console.log(files.join('\n'));

});

//
// various support functions
//

function walk(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var i = 0;
    (function next() {
      var file = list[i++];
      if (!file) return done(null, results);
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          results.push(file);
          next();
        }
      });
    })();
  });
};

function readFile(file, callback) {
    var data=fs.readFileSync(file, 'utf8');
    var json=JSON.parse(data);
    callback(json);
}
