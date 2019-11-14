const ID3Editor = require('id3-editor');
const Promise = require('bluebird');
const bpmSink = require('bpm.js');
const spawn = require('child_process').spawn;
const util = require('util');
const fs = require('fs').promises;
const acoustid = util.promisify(require("acoustid"));

const settings = require('./settings');
const {parseFilename} = require("./parseFilename");

exports.fetchTags = async (sourceFileName, originalName) => {
	const trackData = await fs.readFile(sourceFileName);
	const editor = new ID3Editor;
	await editor.load(trackData);

	// Распознаем трек и BPM
	const metaAcoustid = await acoustid(sourceFileName, {key: settings.acoustid_key});
	const bpm = await getBpm(sourceFileName);

	console.log(metaAcoustid);

	// Разгребаем мета-информацию о треке.
	// Если доступна информация из сети, ставим теги из сети
	// Иначе парсим название файла и существовавшие теги аналитически
	const from_meta_artists = (editor.get('artists')||[editor.get('artist')]||[]).join('&');
	const from_meta_title = editor.get('title');
	let {performers, title} = parseFilename(`${from_meta_artists}–${from_meta_title}`);

	if (metaAcoustid.length && metaAcoustid[0].score > 0.8) {
		performers = metaAcoustid[0].recordings[0].artists.map(x => x.name);
		title = metaAcoustid[0].recordings[0].title;
		editor.set('musicbrainz_trackid', metaAcoustid[0].recordings[0].id);
		editor.set('musicbrainz_workid', metaAcoustid[0].id);
	} else if (!title) {
		let pt = parseFilename(originalName.split('/').pop());
		performers = pt.performers;
		title = pt.title;
	}

	const performer = [performers[0], ...performers.slice(1)].join(' & ');

	editor.set('bpm', bpm);
	editor.set('artists', performers);
	editor.set('artist', performer);
	editor.set('title', title);
	await editor.save();

	return {performer, title};
};

const getBpm = (filename) => {
	try {
		const createAudioStream = (filename) => {
			const args = "-t raw -r 44100 -e float -c 1 -".split(" ");
			args.unshift(filename);
			return spawn("sox", args).stdout;
		};
		return new Promise((f) => {
			createAudioStream(filename)
				.pipe(bpmSink())
				.on("bpm", function(bpm){
					f(bpm);
				});
		});
	} catch (e) {
		return Promise.resolve(0);
	}
};
