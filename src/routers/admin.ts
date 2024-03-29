import { Router } from 'express';
import { join } from 'path';
import {
	adminLocked,
	allowedUsers,
	exists,
	formParse,
	readDir,
	readFile,
	stat,
	_dirname
} from '../utilities';
import { exec } from 'child_process';
import { promisify } from 'util';

const sh = promisify(exec);

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

router.get('/login', (req, res) => {
	if (req.session['admin']) res.redirect('/admin');
	else res.render('admin/login');
});

router.post('/login', formParse(), async (req, res) => {
	const users: allowedUsers = JSON.parse(
		(await readFile(_dirname + '/allowed-users.json')).toString()
	);
	if (
		users.keys.some(
			u => u.username === req.fields.user && u.key === req.fields.key
		)
	) {
		req.session['admin'] = true;
		res.redirect(`${req.protocol}://${req.get('host')}/admin`);
	} else {
		req.session['admin'] = false;
		res.sendStatus(403);
	}
});

router.get('/stats', adminLocked, async (req, res) => {
	const page = await sh(
		'zcat ~/.nginx/logs/tyman-tech.access.log* -f | goaccess - --log-format=COMBINED --output=html'
	).then(out => out.stdout);
	res.send(page);
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
