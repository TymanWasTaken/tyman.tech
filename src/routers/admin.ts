import { Router } from 'express';
import { join } from 'path';
import {
	adminLocked,
	allowedUsers,
	delFile,
	exists,
	formParse,
	readDir,
	readFile,
	stat,
	_dirname
} from '../utilities';

const router = Router();

router.get('/', adminLocked, async (req, res) => {
	res.render('admin/index');
});

router.get('/files', adminLocked, async (req, res) => {
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
	res.render('admin/files', {
		files
	});
});

router.get('/users', adminLocked, async (req, res) => {
	const users: allowedUsers = JSON.parse(
		(await readFile(join(_dirname, 'allowed-users.json'))).toString()
	);
	res.render('admin/users', {
		users: users
	});
});

router.delete('/files', adminLocked, formParse(), async (req, res) => {
	try {
		await delFile(_dirname + '/files/' + req.fields['file']);
		res.sendStatus(200);
	} catch (e) {
		res.sendStatus(500);
		console.log(e.stack);
	}
});

router.get('*', adminLocked, async (req, res) => {
	const path: string = req.path.replace(/^\//, '');
	if (await exists(req.app.get('views') + '/' + path + '.ejs')) {
		res.render(path);
	} else {
		res.sendStatus(404);
	}
});

export const AdminRouter = router;
