// Export all other routers
export * from './api';
export * from './admin';

// Export actual index router
import { Router } from 'express';
import {
	formParse,
	rateLimitUploader,
	handleUpload,
	allowedUsers,
	readFile,
	_dirname
} from '../utilities';

const router = Router();

router.get('/', (req, res) => {
	res.render('index');
});

router.post('/uploadfile', formParse(), rateLimitUploader, async (req, res) => {
	const handled = await handleUpload(req);
	res.status(handled.code).json(handled.res);
});

router.post('/login', formParse(), async (req, res) => {
	const users: allowedUsers = JSON.parse(
		(await readFile(_dirname + '/allowed-users.json')).toString()
	);
	if (users.admin[req.fields.key as string] === (req.fields.user as string)) {
		req.session['admin'] = true;
		res.redirect(`${req.protocol}://${req.get('host')}/admin`);
	} else {
		req.session['admin'] = false;
		res.sendStatus(403);
	}
});

export const IndexRouter = router;
