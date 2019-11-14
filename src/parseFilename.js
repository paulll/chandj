exports.parseFilename = (filename) => {
	// cut youtube-dl suffix or extension
	if (filename.endsWith('.wav'))
		filename = filename.split('-').slice(0,-1).join('-');
	else
		filename = filename.split('.').slice(0,-1).join('.');

	// extract braces
	const braces = (filename.match(/(?<=\()[^\)]+(?=\))|(?<=\{)[^\}]+(?=\})|(?<=\[)[^\]]+(?=\])/g)||[]).map(x => x.trim());
	const filename_clear = filename.replace(/\([^\)]+\)|\{[^\}]+\}|\[[^\]]+\]/g, '').trim();

	// locate divider
	const parts =
		filename_clear.includes(' - ') && filename_clear.split(' - ') ||
		filename_clear.includes('—') && filename_clear.split('—') ||
		filename_clear.includes('–') && filename_clear.split('–') ||
		filename_clear.includes('-') && filename_clear.split('-') ||
		[undefined, filename_clear];

	// extract main performer and title
	const performers = parts[0] ? [parts[0]] : [],
		title = parts.splice(1).join('-');

	// extract secondary performers
	for (let brace of braces) {
		if (!/ft|feat|vs|remix|cover/.test(brace))
			continue;
		const brace_clear = brace.replace(/\s*(ft|feat|vs|remix|cover|covered|remixed|featuring)(\s*by)?\s*\.?/, '');
		const brace_all = brace_clear.split(/\s*(&|and|with|,)\s*/);
		performers.push(...brace_all);
	}

	return {performers, title};
};