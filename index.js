'use strict';

var fs			= require('fs');
var path		= require('path');
var gutil		= require('gulp-util');
var throught	= require('through2');

function scssCombine(content, baseDir) {
	var regex = /@import[^'"]+?['"](.+?)['"];?/g;

	if (regex.test(content)) {
		content	= content.replace(regex, function(m, capture) {
			var parse	= path.parse(path.resolve(baseDir, capture));
			var file	= parse.dir + '/_' + parse.name;

			if (fs.existsSync(file + '.scss')) {
				file	= file + '.scss';
			} else if (fs.existsSync(file + '.scss.liquid')) {
				file	= file + '.scss.liquid';
			} else {
				return '';
			}

			return fs.readFileSync(file);
		});
	}

	return content;
}



module.exports	= function(opts) {
	return throught.obj(function(file, enc, cb) {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new gutil.PluginError('gulp-scss-combine', 'Streaming not supported'));
			return;
		}

		if (path.basename(file.path).indexOf('_') === 0) {
			return cb();
		}

		file.contents	= new Buffer(scssCombine(file.contents.toString(), path.dirname(file.path)));

		setImmediate(cb, null, file);
	});
};
