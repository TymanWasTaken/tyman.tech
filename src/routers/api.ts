import { APIMessage } from 'discord-api-types';
import { Router } from 'express';
import got from 'got';
import { botToken } from '../config';
import {
	adminLocked,
	delFile,
	formParse,
	_dirname,
	rateLimitUploader,
	handleUpload,
	uploadKeyLocked
} from '../utilities';

const router = Router();

router.get('/', (req, res) => {
	res.render('api/index');
});

router.get('/docs', (req, res) => {
	res.redirect(
		'https://app.swaggerhub.com/apis-docs/TymanWasTaken/tyman-tech-api'
	);
});

router.get('/files/mods', async (req, res) => {
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
		console.log('Modfiles api failed, code ' + e.response.statusCode);
		res.status(500).json({
			success: false,
			reason:
				'Discord api error: ' +
				(e.response !== undefined
					? JSON.parse(e.response.body).message
					: 'unable to find')
		});
	}
});

router.delete('/files/images/:filename', adminLocked, async (req, res) => {
	try {
		await delFile(_dirname + '/files/' + req.params.filename);
		res.sendStatus(200);
	} catch (e) {
		res.sendStatus(500);
		console.log(e.stack);
	}
});

router.post(
	'/files/images',
	uploadKeyLocked,
	formParse(),
	rateLimitUploader,
	async (req, res) => {
		const handled = await handleUpload(req);
		res.status(handled.code).json(handled.res);
	}
);

export const APIRouter = router;
