'use strict';

const fs = require('fs');
const Validator = require('jsonschema').Validator;

const DIR = process.argv[2];
const SCHEMA = getJsonSchema();

const t0 = Date.now();
walk(DIR, (err,files) => {

    const t1 = Date.now();
	if(err) {
		console.log("error: " + err);
		return;
	}
    
    // filter / remove files not to be validated
    const promises = files
                .filter(file => file.endsWith('.json'))
                .filter(file => !file.includes('/package') && !file.includes('/node_modules/'))
                .map(file => validateSchema(file));

    executeAllPromises(promises)
    .then(res => {

        const t2 = Date.now();

        console.log('SCHEMA VALIDATION');
        console.log('=================');
        console.log('# schemas     : ' + promises.length + ' files processed');
        console.log('# errors      : ' + res.errors.length);
        console.log('# validate ok : ' + res.results.length);
        console.log();
        console.log('total time: ' + Number(((t2-t0)/1000.0).toFixed(2)) + " seconds");
        console.log();

        if(res.errors.length>0) {
            console.log();
            console.log('ERROR - schemas with error(s):');
            res.errors.forEach(item => {
                console.log('... ' + item.file);
                // skip the first item, contains just the number of errors found
                item.errors.shift();
                item.errors.forEach(err => console.log('... ... ' + JSON.stringify(err.stack)));
            });
        }

        if(res.results.length>0) {
            console.log();
            console.log('OK - schemas without error(s):');
            res.results.forEach(r => console.log('... ' + r.file));
        }

        process.exit(res.errors.length);

    })
    .catch(error => {
        console.log('error: ' + error);
        process.exit(1);
    })

});

function validateSchema(file) {
    return new Promise(function(resolve, reject) {
        var jsonString;
        var schema;

        try {
            jsonString = fs.readFileSync(file);
            schema = JSON.parse(jsonString);
        } catch(error) {
            return reject({ 'errors': [error]})
        }

        const validator = new Validator();
        const options = { 'nestedErrors': true };
    
        validator.addSchema(getCoreJsonSchema(), 'http://json-schema.org/draft-07/schema#');
        
        var result = validator.validate(schema, SCHEMA, options);

        if(result.errors && result.errors.length>0) {
            return reject({'file': file, 'errors': result.errors});
        } else {
            return resolve({'file': file, 'validate': true});
        }
    })
}

//
// Specific schema validation additions reflecting the TMForum API schema approach 
//
function getJsonSchema() {
    return {
        allOf: [
            {
                "properties": {
                    "$schema": { "type": "string" },
                    "$id": { "type": "string" },
                    "title": { "type": "string" },
                    "description": { "type": "string" },
                    "definitions": { "type": "object" }
                },
                "required": ["$schema", "$id", "title", "definitions"],
                additionalProperties: false
            },
            {
                "properties": {
                    "definitions": {
                        "patternProperties": {
                            ".*": {
                                "properties": {
                                    "$id": { "type": "string" },
                                    "type": { "type": "string" },
                                    "description": { "type": "string" },
                                    "allOf": { "type": "array" },
                                    "properties": { "type": "object" },
                                    "enum": { "type": "array" },
                                    "required": { "type": "array" },
                                    "dependencies": { "type": "object" },
                                },
                                "oneOf": [ { "required": [ "allOf" ] },
                                           { "required": [ "properties" ] },
                                           { "required": [ "enum" ] }
                                ],
                                "required": ["type", "$id"],
                                additionalProperties: false
                            }
                        }
                    }
                }
            }, 
            {
                "type": "object",
                "propertyNames": {
                 "pattern": "^[A-Za-z_][A-Za-z0-9_]*$"
                }
            },
            { '$ref': "http://json-schema.org/draft-07/schema#" }
        ]
    }
}

//
// the draft-07 schema (wrapped in a function to put at end)
//
function getCoreJsonSchema() {
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "$id": "http://json-schema.org/draft-07/schema#",
        "title": "Core schema meta-schema",
        "definitions": {
            "schemaArray": {
                "type": "array",
                "minItems": 1,
                "items": { "$ref": "#" }
            },
            "nonNegativeInteger": {
                "type": "integer",
                "minimum": 0
            },
            "nonNegativeIntegerDefault0": {
                "allOf": [
                    { "$ref": "#/definitions/nonNegativeInteger" },
                    { "default": 0 }
                ]
            },
            "simpleTypes": {
                "enum": [
                    "array",
                    "boolean",
                    "integer",
                    "null",
                    "number",
                    "object",
                    "string"
                ]
            },
            "stringArray": {
                "type": "array",
                "items": { "type": "string" },
                "uniqueItems": true,
                "default": []
            }
        },
        "type": ["object", "boolean"],
        "properties": {
            "$id": {
                "type": "string",
                "format": "uri-reference"
            },
            "$schema": {
                "type": "string",
                "format": "uri"
            },
            "$ref": {
                "type": "string",
                "format": "uri-reference"
            },
            "$comment": {
                "type": "string"
            },
            "title": {
                "type": "string"
            },
            "description": {
                "type": "string"
            },
            "default": true,
            "readOnly": {
                "type": "boolean",
                "default": false
            },
            "examples": {
                "type": "array",
                "items": true
            },
            "multipleOf": {
                "type": "number",
                "exclusiveMinimum": 0
            },
            "maximum": {
                "type": "number"
            },
            "exclusiveMaximum": {
                "type": "number"
            },
            "minimum": {
                "type": "number"
            },
            "exclusiveMinimum": {
                "type": "number"
            },
            "maxLength": { "$ref": "#/definitions/nonNegativeInteger" },
            "minLength": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
            "pattern": {
                "type": "string",
                "format": "regex"
            },
            "additionalItems": { "$ref": "#" },
            "items": {
                "anyOf": [
                    { "$ref": "#" },
                    { "$ref": "#/definitions/schemaArray" }
                ],
                "default": true
            },
            "maxItems": { "$ref": "#/definitions/nonNegativeInteger" },
            "minItems": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
            "uniqueItems": {
                "type": "boolean",
                "default": false
            },
            "contains": { "$ref": "#" },
            "maxProperties": { "$ref": "#/definitions/nonNegativeInteger" },
            "minProperties": { "$ref": "#/definitions/nonNegativeIntegerDefault0" },
            "required": { "$ref": "#/definitions/stringArray" },
            "additionalProperties": { "$ref": "#" },
            "definitions": {
                "type": "object",
                "additionalProperties": { "$ref": "#" },
                "default": {}
            },
            "properties": {
                "type": "object",
                "additionalProperties": { "$ref": "#" },
                "default": {}
            },
            "patternProperties": {
                "type": "object",
                "additionalProperties": { "$ref": "#" },
                "propertyNames": { "format": "regex" },
                "default": {}
            },
            "dependencies": {
                "type": "object",
                "additionalProperties": {
                    "anyOf": [
                        { "$ref": "#" },
                        { "$ref": "#/definitions/stringArray" }
                    ]
                }
            },
            "propertyNames": { "$ref": "#" },
            "const": true,
            "enum": {
                "type": "array",
                "items": true,
                "minItems": 1,
                "uniqueItems": true
            },
            "type": {
                "anyOf": [
                    { "$ref": "#/definitions/simpleTypes" },
                    {
                        "type": "array",
                        "items": { "$ref": "#/definitions/simpleTypes" },
                        "minItems": 1,
                        "uniqueItems": true
                    }
                ]
            },
            "format": { "type": "string" },
            "contentMediaType": { "type": "string" },
            "contentEncoding": { "type": "string" },
            "if": { "$ref": "#" },
            "then": { "$ref": "#" },
            "else": { "$ref": "#" },
            "allOf": { "$ref": "#/definitions/schemaArray" },
            "anyOf": { "$ref": "#/definitions/schemaArray" },
            "oneOf": { "$ref": "#/definitions/schemaArray" },
            "not": { "$ref": "#" }
        },
        "required": [],
        "default": true
    }

}


// support stuff

function walk(dir, done) {
    var results = [];
    // console.log("walk: " + JSON.stringify(dir));
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

//
// Support for collecting all errors from list of promises
// (inspired by https://stackoverflow.com/questions/30362733/handling-errors-in-promise-all) 
//  

function executeAllPromises(promises) {
    // Wrap all Promises in a Promise that will always "resolve"
    var resolvingPromises = promises.map(function(promise) {
      return new Promise(function(resolve) {
        var payload = new Array(2);
        promise.then(function(result) {
            payload[0] = result
          })
          .catch(function(error) {
            payload[1] = error
          })
          .then(function() {
            /* 
             * The wrapped Promise returns an array:
             * The first position in the array holds the result (if any)
             * The second position in the array holds the error (if any)
             */
            resolve(payload)
          })
      })
    })
  
    var errors = [];
    var results = [];
  
    // Execute all wrapped Promises
    return Promise.all(resolvingPromises)
      .then(function(items) {
        items.forEach(function(payload) {
          if (payload[1]) {
            errors.push(payload[1])
          } else {
            results.push(payload[0])
          }
        });
  
        return {
          errors: errors,
          results: results
        }
  
    })
}
  
