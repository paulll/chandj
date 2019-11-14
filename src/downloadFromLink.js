const ytdl = require('youtube-dl');

exports.downloadFromLink = (url) => {
	return new Promise((fulfill, reject) => {
		if (url.includes('list='))
			url = url.slice(0, url.indexOf('list='));
		ytdl.exec(url, ['-x', '--audio-format', 'wav', '--audio-quality', '0'], {cwd: '/tmp/'}, (e, out) => {
			if (e) {
				console.warn(e);
				return reject('Произошла ошибка при скачивании трека :C');
			}
			const marker = '[ffmpeg] Destination: ';
			console.debug(out);
			fulfill('/tmp/' + out.find(e => e.includes(marker)).substr(marker.length).trim());
		});
	});
};