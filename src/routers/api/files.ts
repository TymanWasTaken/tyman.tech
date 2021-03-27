import { APIMessage } from 'discord-api-types';
import { Router } from 'express';
import got from 'got/dist/source';
import { botToken } from '../../config';
import {
	apiKeyLocked,
	delFile,
	formParse,
	rateLimitUploader,
	readDir,
	stat,
	_dirname,
	handleUpload
} from '../../utilities';

const router = Router();

router.get('/mods', async (req, res) => {
	try {
		const apiRes = (await got
			.get(
				'https://discord.com/api/v8/channels/817563414615293973/messages?limit=100',
				{
					headers: {
						Authorization: 'Bot ' + botToken
					}
				}
			)
			.json()) as APIMessage[];
		res.json({
			success: true,
			files: apiRes.map(m => {
				const parsed = JSON.parse(m.content);
				return { ...parsed, url: m.attachments[0].url };
			})
		});
	} catch (e) {
		console.error(e);
		res.status(500).json({
			success: false,
			reason: e.reponse
				? 'Discord api error: ' +
				  (e.response !== undefined
						? JSON.parse(e.response.body).message
						: 'unable to find')
				: 'Internal Server Error'
		});
	}
});

router.delete('/images/:filename', apiKeyLocked('admin'), async (req, res) => {
	try {
		await delFile(_dirname + '/files/' + req.params.filename);
		res.status(200).json({
			success: true
		});
	} catch (e) {
		res.status(500).json({
			success: false,
			reason: 'Internal Server Error'
		});
		console.log(e.stack);
	}
});

router.get('/images', apiKeyLocked('admin'), async (req, res) => {
	const fileNames = await readDir(_dirname + '/files');
	const fileStatPromises = fileNames.map(async name => {
		return {
			name,
			time: (await stat(_dirname + '/files/' + name)).mtime.getTime()
		};
	});
	let fileStats = await Promise.all(fileStatPromises);
	fileStats = fileStats.sort((a, b) => a.time - b.time);
	const files = fileStats.map(f => f.name);
	res.status(200).json({
		success: true,
		files
	});
});

router.post(
	'/images',
	apiKeyLocked('upload'),
	formParse(),
	rateLimitUploader,
	async (req, res) => {
		const handled = await handleUpload(req);
		res.status(handled.code).json(handled.res);
	}
);

export const APIFilesRouter = router;
