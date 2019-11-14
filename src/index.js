const {Bot} = require('tdbot');
const fs = require('fs').promises;

const settings = require('./settings');
const {fetchTags} = require("./fetchTags");
const {downloadFromLink} = require('./downloadFromLink');
const {recode} = require('./recode');

(async () => {
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

		const placeholder = await bot.send(m, 'Загружаю...');

		//
		// Сначала получаем файл.
		// Источник - вложение (audio / document / ссылка на youtube-dl совместимое)
		//
		let sourceFile = '';
		try {
			sourceFile = await (async () => {
				if (m.content._ === 'messageDocument') {
					return await bot.downloadFile(m.content.document.document);
				} else if (m.content._ === 'messageAudio') {
					return await bot.downloadFile(m.content.audio.audio)
				} else if (m.content._ === 'messageText') {
					return await downloadFromLink(m.content.text.text);
				} else return '';
			})();
		} catch (e) {}


		// После получения файла удаляем исходное сообщение
		await bot.deleteMessage(m);
		if (!sourceFile)
			return await bot.send(m, 'Не удалось загрузить трек :c');

		// Ставим теги
		const reEncodedFile = await recode(sourceFile);
		const {performer, title} = await fetchTags(reEncodedFile, sourceFile);

		// Отправляем это дело обратно
		await bot.sendAudio(m, reEncodedFile, {title, performer, caption: ''});
		await bot.deleteMessage(placeholder);
		await fs.unlink(sourceFile);

		// Удаляем оставшееся
		setTimeout(async () => {
			await fs.unlink(reEncodedFile);
		}, 5*60*1000); // 5m
	});

	bot.on('error', console.error);
})();

process.on('unhandledRejection', (reason, p) => {
	// На всякий случай дабы ошибка в обработке одного запроса не клала бота
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
