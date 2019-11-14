const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

exports.recode = async (sourceFileName) => {
	console.debug('started lame, path =', sourceFileName);
	const outName = `/tmp/${Math.random().toString(17).substr(3,10)}.mp3`;
	await execFile('/usr/bin/lame', ['--preset', 'standard', sourceFileName, outName]);
	return outName;
};