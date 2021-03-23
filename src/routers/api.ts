import { APIMessage } from 'discord-api-types';
import { Router } from 'express';
import got from 'got';
import { botToken } from '../config';
import {
	delFile,
	formParse,
	_dirname,
	rateLimitUploader,
	handleUpload,
	apiKeyLocked
} from '../utilities';
import swaggerUI from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';

const apiSpec = JSON.parse(
	readFileSync(
		join(__dirname, '..', '..', 'static', 'api', 'openapi.json')
	).toString()
);

const router = Router();

router.get('/', (req, res) => {
	res.render('api/index');
});

router.use('/docs', swaggerUI.serve);

router.get('/docs', swaggerUI.setup(apiSpec));

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

router.delete(
	'/files/images/:filename',
	apiKeyLocked('admin'),
	async (req, res) => {
		try {
			await delFile(_dirname + '/files/' + req.params.filename);
			res.sendStatus(200);
		} catch (e) {
			res.sendStatus(500);
			console.log(e.stack);
		}
	}
);

router.post(
	'/files/images',
	apiKeyLocked('upload'),
	formParse(),
	rateLimitUploader,
	async (req, res) => {
		const handled = await handleUpload(req);
		res.status(handled.code).json(handled.res);
	}
);

export const APIRouter = router;
