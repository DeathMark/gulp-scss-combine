'use strict';

var fs			= require('fs');
var path		= require('path');
var gutil		= require('gulp-util');
var throught	= require('through2');
var bufferFrom  = require('buffer-from');

var parsedFiles = [];

/**
 * Finds the file and returns it's content.
 *
 * @param  {string} capture     Import file path.
 * @param  {string} baseDir     Directory where the file was found.
 * @param  {string} paths       Alternative paths where to find the imports.
 * @param  {Array} parsedFiles  Yet parsed files to reduce size of the result.
 * @return {string}             Partially combined scss.
 */
function getReplace(capture, baseDir, paths, parsedFiles) {
    var parse   = path.parse(path.resolve(baseDir, capture + '.scss'));
    var file    = parse.dir + '/' + parse.name;


    if (!fs.existsSync(file + '.scss')) {
        // File not found, might be a partial file.
        file    = parse.dir + '/_' + parse.name;
    }

    // If file still not found, try to find the file in the alternative paths.
    var x = 0;
    while (!fs.existsSync(file + '.scss') && paths.length > x) {
        parse   = path.parse(path.resolve(paths[x], capture + '.scss'));
        file    = parse.dir + '/' + parse.name;

        x++;
    }

    file    = file + '.scss';

    if (!fs.existsSync(file)) {
        // File not found. Leave the import there.
        console.error('File "' + capture + '" not found');
        return '@import "' + capture + '";';
    }

    if (parsedFiles.indexOf(file) >= 0) {
        // File was already parsed, leave the import commented.
		console.error('File "' + capture + '" already parsed');
        return '// @import "' + capture + '";';
    }

    parsedFiles.push(file);
    var text = fs.readFileSync(file);

    // Recursive call.
    return scssCombine(text, parse.dir, paths, parsedFiles);
}

/**
 * Combine scss files with its imports
 *
 * @param  {string} content     Scss string to read.
 * @param  {string} baseDir     Directory where the file was found.
 * @param  {string} paths       Alternative paths where to find the imports.
 * @param  {Array} parsedFiles  Yet parsed files to reduce size of the result.
 * @return {string}             Scss string with the replaces done.
 */
function scssCombine(content, baseDir, paths, parsedFiles) {

    // Content is a Buffer, convert to string.
    if (typeof content != "string") {
        content = content.toString();
    }

    // Search of single imports.
    var regex = /@import[ ]*['"](.*)['"][ ]*;/g;

    if (regex.test(content)) {
        return content.replace(regex, function(m, capture) {
            return getReplace(capture, baseDir, paths, parsedFiles);
        });
    }

    // Search of multiple imports.
    regex = /@import(?:[ \n]+['"](.*)['"][,]?[ \n]*)+;/gm;
    if (regex.test(content)) {
        return content.replace(regex, function(m, capture) {
            var text = "";

            // Divide the import into multiple files.
            regex = /['"]([^'"]*)['"]/g;
            var captures = m.match(regex);
            for (var x in captures) {
                text += getReplace(captures[x].replace(/['"]+/g, ''), baseDir, paths, parsedFiles) + "\n";
            }

            return text;
        });
    }

    return content;
}


module.exports = function(paths, options) {
    if (!options) {
        options = {};
    }
	
	return throught.obj(function(file, enc, cb) {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new gutil.PluginError('gulp-scss-combine', 'Streaming not supported'));
			return;
		}

        parsedFiles.push(file);
        file.contents = bufferFrom(scssCombine(file.contents, path.dirname(file.path), paths, parsedFiles));

		setImmediate(cb, null, file);
	});
};
