'use strict';

const fs = require('fs');
const path = require('path');
const Validator = require('jsonschema').Validator;
const { readSchemaSync, walk, executeAllPromises } = require('./utilities.js');

const t0 = Date.now();

const DIR = process.argv[2];
const CONFDIR = process.argv[3];

const SCHEMA = readSchemaSync(path.join(CONFDIR + '/', 'VALIDATIONSCHEMA.json'));
const METASCHEMA = readSchemaSync(path.join(CONFDIR + '/', 'METASCHEMA.json'));

console.log('SCHEMA VALIDATION');
console.log('=================');

if(!SCHEMA) {
    console.log("error: unable to read and/or parse validation schema");
    process.exit(1);
}
if(!METASCHEMA) {
    console.log("error: unable to read and/or parse meta schema");
    process.exit(1);
}

walk(DIR, (err,files) => {

	if(err) {
		console.log("error: " + err);
		return;
	}
    
    // filter / remove files not to be validated
    const promises = files
                        .filter(file => file.endsWith('.json') &&
                                        !file.includes('/.circleci/') &&
                                        !file.includes('/package') && !file.includes('/node_modules/'))
                        .map(file => validateSchema(file));

    executeAllPromises(promises)
    .then(res => {

        const t1 = Date.now();

        // combine issues from the errors and results parts
        const issues = res.results.filter(r => r.issues.length>0)
                        .concat(res.errors.filter(r => r.issues.length>0).
                            map(s => {
                                const o = {"file": s.file, "issues": s.issues};
                                return o
                            })
                        );

        console.log('# schemas     : ' + promises.length + ' files processed');
        console.log('# errors      : ' + res.errors.length);
        console.log('# validate ok : ' + res.results.length);
        console.log('# issues      : ' + issues.length + ' files / ' + 
                                         issues.reduce((t,v)=>t+v.issues.length,0) + ' issues');
        console.log();
        console.log('total time: ' + Number(((t1-t0)/1000.0).toFixed(2)) + " seconds");
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

        if(issues.length>0) {
            console.log();
            console.log('ISSUES - schemas with issue(s):');
            issues.forEach(item => {
                console.log('... ' + item.file);
                item.issues.forEach(issue => console.log('... ... ' + issue));
                console.log();
            });
        }

        const results = res.results.filter(x => x.issues.length===0);
        if(results.length>0) {
            console.log();
            console.log('OK - schemas without error(s) or issue(s):');
            results.forEach(r => console.log('... ' + r.file));
        }
        console.log();

        process.exit(res.errors.length);

    })
    .catch(error => {
        console.log('error: ' + error);
        process.exit(1);
    })

});

function validateSchema(file) {
    return new Promise(function(resolve, reject) {
        
        var schema;
        try {
            const jsonString = fs.readFileSync(file);
            schema = JSON.parse(jsonString);
        } catch(error) {
            return reject({'file': file, 'errors': [error], 'issues': []})
        }

        const validator = new Validator();

        const options = { 'nestedErrors': true };

        validator.addSchema(METASCHEMA, 'http://json-schema.org/draft-07/schema#');

        const result = validator.validate(schema, SCHEMA, options);

        const issues = checkSchemaIssues(schema);

        if(result.errors && result.errors.length>0) {
            return reject({'file': file, 'errors': result.errors, 'issues': issues});
        } else {
            return resolve({'file': file, 'issues': issues});
        }
    })
}

//
// custom validation / checking for issues not included in the validation schema
//
function checkSchemaIssues(schema) {
    var res = [];

    try {
        const title = schema.title;
        const definitions = schema.definitions;

        var allOf = [];
        if(definitions && definitions[title] && definitions[title].allOf) {
            allOf = definitions[title].allOf
        }
        var hasPolyPattern=false;
        allOf.forEach(item => {

            // polymorphicPattern?
            if(item['$ref'] && item['$ref'].includes('polymorphicPattern')) hasPolyPattern=true;

            if(item.properties === undefined) {
                return;
            }

            // from here handling of "properties" topics

            const keys = Object.keys(item.properties);

            // check for empty properties
            if(keys.length===0) {
                res.push(title + ' :: no properties defined')
                return;
            }

            // check if possible Ref but not named as Ref?
            const ignore = ['id', 'href', 'name'];
            const realProps = keys.filter(k => !ignore.includes(k));
            if(realProps.length<=1 && !realProps.includes('value') && !title.endsWith('Ref')) {
                res.push(title + ' :: should be renamed as ' + title + 'Ref if this is a reference entity');
            }

            keys.forEach(p => {

                // some properties excluded from analysis
                if(ignore.includes(p)) return;

                const prop = item.properties[p];

                // check for expected properties
                const expecting = ['example', 'description'];
                expecting.forEach(exp => {
                    if(prop[exp] === undefined) {
                        res.push(p + ' :: no ' + exp + ' value')
                    }
                });

                // issue in case if 'type' and similar labels that should not be used    
                const avoid = ['type', 'baseType', 'schemaLocation'];
                avoid.forEach(item => {
                    if(p === item) {
                        res.push(p + ' :: rename to avoid conflict with @' + item)
                    }
                });

                // issue in case if properties that should have format
                if(prop.format === undefined) {   
                    const formatCandidates = ['DATE', 'TIME', 'URI', 'URL'];
                    formatCandidates.forEach(item => {
                        if(p.toUpperCase().includes(item)) {
                            res.push(p + ' :: recommend to add format');
                        }
                    });
                };

            })
        });
        
        if(!hasPolyPattern && allOf.length>0) {
            res.push(title + ' :: missing polymorphicPattern');
        }

    } catch(error) {
        res.push('Failing to check for issues: ' + error);
    }
    return res;
}
