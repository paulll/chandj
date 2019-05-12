const {Bot} = require('tdbot');
const Promise = require('bluebird');
const ID3Editor = require('id3-editor');
const bpmSink = require('bpm.js');
const ytdl = require('@microlink/youtube-dl');
const spawn = require('child_process').spawn;
const fs = require('fs').promises;
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const acoustid = util.promisify(require("acoustid"));

const settings = {
	api_id: +process.env.TG_API_ID,
	api_hash: process.env.TG_API_HASH,
	bot_token: process.env.TG_BOT_TOKEN,
	acoustid_key: process.env.ACOUSTID_KEY
};

const getBpm = (filename) => {
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
};

const parseFilename = (filename) => {

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

const main = async () => {
	const bot = new Bot(settings.api_id, settings.api_hash, settings.bot_token, {
		use_message_database: false,
		use_secret_chats: false,
		system_language_code: 'ru',
		application_version: '0.0.1',
		device_model: 'linux-server-amd',
		system_version: 'arch',
		enable_storage_optimizer: false,
		use_test_dc: true
	});

	await bot.connect();

	bot.on('message', async (m) => {
		if (m.content._ === 'messageText') {
			if (m.content.text.text === '/start') {
				return await bot.send(m,
					'Привет. Я помогу организовать личную музыкальную библиотеку в телеграме.' +
					'Создай канал, добавь меня в него, сделай меня админом и ̶я̶ ̶п̶о̶й̶д̶у̶ ' +
					'̶з̶а̶х̶в̶а̶т̶ы̶в̶а̶т̶ь̶ ̶м̶и̶р̶ и скинь какой-нибудь трек / ссылку на него / на ютубе или ином сервисе')
			}
		}

		//
		// Сначала получаем файл.
		// Источник - вложение (audio / document / ссылка на youtube-dl совместимое)
		//
		const path = await (async () => {
			if (m.content._ === 'messageDocument') {
				return await bot.downloadFile(m.content.document.document);
			} else if (m.content._ === 'messageAudio') {
				return await bot.downloadFile(m.content.audio.audio)
			} else if (m.content._ === 'messageText'){
				const link = m.content.text.text;
				return await new Promise(fulfill => {
					ytdl.exec(link, ['-x', '--audio-format', 'wav', '--audio-quality', '0'], {cwd: '/tmp/'}, (e, out) => {
						if (e) {
							console.log(e);
							fulfill(false);
							bot.send(m, 'Произошла ошибка при скачивании трека :C');
						}
						const marker = '[ffmpeg] Destination: ';
						fulfill('/tmp/' + out.find(e => e.includes(marker)).substr(marker.length).trim());
					});
				});
			} else return null;
		})();

		await bot.deleteMessage(m);
		if (!path)
			return;

		//
		// Перекодируем аудио в mp3
		//
		console.log('started lame, path =', path);
		const outname = `/tmp/${Math.random().toString(17).substr(3,10)}.mp3`;
		await execFile('/usr/bin/lame', ['--preset', 'standard', path, outname]);
		const trackData = await fs.readFile(outname);
		const editor = new ID3Editor;
		await editor.load(trackData);

		//
		// Распознаем трек и BPM
		//
		const metaAcoustid = await acoustid(outname, {key: settings.acoustid_key});
		const bpm = await getBpm(outname);

		//
		// Разгребаем мета-информацию о треке.
		// Если доступна информация из сети, ставим теги из сети
		// Иначе парсим название файла и существовавшие теги аналитически
		//
		const from_meta_artists = (editor.get('artists')||[editor.get('artist')]||[]).join('&');
		const from_meta_title = editor.get('title');
		let {performers, title} = parseFilename(`${from_meta_artists}–${from_meta_title}`);


		if (metaAcoustid.length && metaAcoustid[0].score > 0.9) {
			performers = metaAcoustid[0].recordings[0].artists.map(x => x.name);
			title = metaAcoustid[0].recordings[0].title;
			editor.set('musicbrainz_trackid', metaAcoustid[0].recordings[0].id);
			editor.set('musicbrainz_workid', metaAcoustid[0].id);
		} else if (!title) {
			let pt = parseFilename(path.split('/').pop());
			performers = pt.performers;
			title = pt.title;
		}

		editor.set('bpm', bpm);
		editor.set('artists', performers);
		editor.set('artist', [performers[0], ...performers.slice(1)].join(' & '));
		editor.set('title', title);
		await editor.save();

		//
		// Отправляем это дело обратно
		//
		const performer = [performers[0], ...performers.slice(1)].join(' & ');
		await bot.sendAudio(m, outname, {title, performer, caption: ''});
		await fs.unlink(path);

		// Удаляем оставшееся
		setTimeout(async () => {
			await fs.unlink(outname);
		}, 5*60*1000); // 5 minutes
	});

	bot.on('error', console.error);
};

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

main();